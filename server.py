import os
import json
import asyncio
import threading
import datetime
from fastapi import FastAPI, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from processing.feed_freshness import dated_jobs

app = FastAPI(
    title="TargetMatch AI - Entry-Level Career Engine",
    description="Real-Time Fresher & Entry-Level Job Feed API with Live Matching Engine",
    version="2.0.0"
)

# Enable CORS for cross-origin frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_JSON_PATH = os.path.join(BASE_DIR, "data.json")
SYNC_LOCK = threading.Lock()
SYNC_STATE = {"status": "idle", "started_at": None, "finished_at": None, "error": None}


def utc_now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

def load_jobs_data():
    if os.path.exists(DATA_JSON_PATH):
        try:
            with open(DATA_JSON_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            return {"error": str(e), "jobs": []}
    return {"jobs": []}

@app.get("/healthz")
@app.get("/api/health")
def health_check():
    data = load_jobs_data()
    return {
        "status": "healthy",
        "total_jobs": len(data.get("jobs", [])),
        "last_updated": data.get("last_updated"),
        "platform": "Render / Vercel"
    }

@app.get("/api/jobs")
def get_jobs(role_type: str = "all", max_hours: float = 120.0):
    data = load_jobs_data()
    jobs = dated_jobs(data.get("jobs", []), max_hours=max_hours if max_hours > 0 else None)
    
    # Filter by role type (jobs, internships, all)
    if role_type == "jobs":
        jobs = [j for j in jobs if not j.get("is_internship")]
    elif role_type == "internships":
        jobs = [j for j in jobs if j.get("is_internship")]
        
    return JSONResponse({
        "total": len(jobs),
        "last_updated": data.get("last_updated"),
        "role_type": role_type,
        "max_hours": max_hours,
        "profile": data.get("profile", {}),
        "stats": data.get("stats", {}),
        "sync": dict(SYNC_STATE),
        "jobs": jobs
    }, headers={"Cache-Control": "no-store"})

def _perform_sync():
    try:
        SYNC_STATE.update(status="running", started_at=utc_now(), finished_at=None, error=None)
        from hourly_pipeline import run_hourly_sync
        print("[API Sync] Triggering background feed sync...")
        run_hourly_sync()
        SYNC_STATE.update(status="complete", finished_at=utc_now())
    except Exception as e:
        SYNC_STATE.update(status="error", finished_at=utc_now(), error=str(e))
        print(f"[API Sync] Error: {e}")
    finally:
        SYNC_LOCK.release()


def run_sync_task():
    if SYNC_LOCK.acquire(blocking=False):
        _perform_sync()

# Automatic Hourly Background Scheduler
@app.on_event("startup")
async def start_hourly_background_sync():
    async def hourly_loop():
        await asyncio.sleep(10)
        while True:
            try:
                print("[Feed Scheduler] Running scheduled job feed refresh...")
                await asyncio.to_thread(run_sync_task)
            except Exception as e:
                print(f"[Hourly Scheduler] Error: {e}")
            await asyncio.sleep(900)
    app.state.sync_scheduler = asyncio.create_task(hourly_loop())


@app.on_event("shutdown")
async def stop_background_sync():
    task = getattr(app.state, "sync_scheduler", None)
    if task:
        task.cancel()


@app.get("/api/sync/status")
def sync_status():
    return JSONResponse(dict(SYNC_STATE), headers={"Cache-Control": "no-store"})

@app.post("/api/sync")
def trigger_sync(background_tasks: BackgroundTasks):
    if not SYNC_LOCK.acquire(blocking=False):
        return {"status": "processing", "message": "A feed collection is already running."}
    SYNC_STATE.update(status="queued", started_at=None, finished_at=None, error=None)
    background_tasks.add_task(_perform_sync)
    return {
        "message": "Live feed synchronization started in background.",
        "status": "processing"
    }

# Serve root dashboard index.html
@app.get("/")
def serve_dashboard():
    return FileResponse(os.path.join(BASE_DIR, "index.html"), media_type="text/html")

# Mount static files (app.js, styles.css, data.js, data.json)
app.mount("/", StaticFiles(directory=BASE_DIR, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)

