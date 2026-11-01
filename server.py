import os
import json
import asyncio
from fastapi import FastAPI, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

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
def get_jobs(role_type: str = "all", max_hours: float = 48.0):
    data = load_jobs_data()
    jobs = data.get("jobs", [])
    
    # Filter by recency if specified
    if max_hours:
        jobs = [j for j in jobs if (j.get("hours_ago") is not None and j["hours_ago"] <= max_hours)]
    
    # Filter by role type (jobs, internships, all)
    if role_type == "jobs":
        jobs = [j for j in jobs if not j.get("is_internship")]
    elif role_type == "internships":
        jobs = [j for j in jobs if j.get("is_internship")]
        
    return {
        "total": len(jobs),
        "last_updated": data.get("last_updated"),
        "role_type": role_type,
        "max_hours": max_hours,
        "profile": data.get("profile", {}),
        "stats": data.get("stats", {}),
        "jobs": jobs
    }

def run_sync_task():
    try:
        from hourly_pipeline import run_hourly_sync
        print("[API Sync] Triggering background feed sync...")
        run_hourly_sync()
    except Exception as e:
        print(f"[API Sync] Error: {e}")

# Automatic Hourly Background Scheduler
@app.on_event("startup")
async def start_hourly_background_sync():
    async def hourly_loop():
        # Wait 60 seconds after startup before first background check
        await asyncio.sleep(60)
        while True:
            try:
                print("[Hourly Scheduler] Running automated 1-hour job feed refresh...")
                await asyncio.to_thread(run_sync_task)
            except Exception as e:
                print(f"[Hourly Scheduler] Error: {e}")
            # Sleep 1 hour (3600 seconds)
            await asyncio.sleep(3600)
    asyncio.create_task(hourly_loop())

@app.post("/api/sync")
def trigger_sync(background_tasks: BackgroundTasks):
    background_tasks.add_task(run_sync_task)
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

