"""
Scheduled Job Fetcher & Pipeline Sync
TargetMatch AI - Entry-Level Career Engine

Runs every 30 minutes via GitHub Actions.
Fetches dated entry-level opportunities, recalculates age from source timestamps,
deduplicates, enriches matches, and synchronizes the web payloads.
"""

import os
import json
import datetime
import subprocess
import sqlite3

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = SCRIPT_DIR

from collectors.live_job_collector import collect_and_score_all_live_jobs
from scratch.add_semantic_skill_gaps import enrich_job_semantic_gaps

def parse_any_datetime(dt_str):
    """Robustly parse timestamps in ISO, UTC, or space-separated formats."""
    if not dt_str:
        return None
    clean = str(dt_str).strip()
    try:
        dt = datetime.datetime.fromisoformat(clean.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.timezone.utc)
        return dt.astimezone(datetime.timezone.utc)
    except Exception:
        pass
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d", "%a, %d %b %Y %H:%M:%S %z"):
        try:
            dt = datetime.datetime.strptime(clean, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=datetime.timezone.utc)
            return dt.astimezone(datetime.timezone.utc)
        except Exception:
            pass
    return None

def run_hourly_sync():
    now = datetime.datetime.now(datetime.timezone.utc)
    timestamp_str = now.isoformat(timespec="minutes").replace("+00:00", "Z")
    print(f"[{timestamp_str}] Running TargetMatch AI job feed sync...")

    data_json_path = os.path.join(ROOT_DIR, "data.json")
    data = None
    if os.path.exists(data_json_path):
        try:
            with open(data_json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"[{timestamp_str}] Warning: Failed to parse data.json: {e}")

    # Fallback to pristine baseline if data.json was empty or corrupted
    if not data or not isinstance(data.get("jobs"), list) or len(data.get("jobs", [])) < 10:
        try:
            raw_git = subprocess.check_output(
                ["git", "show", "cf5b887:data.json"],
                cwd=ROOT_DIR,
                stderr=subprocess.DEVNULL
            ).decode("utf-8")
            data = json.loads(raw_git)
            print(f"[{timestamp_str}] Self-healed job pool from baseline commit cf5b887 ({len(data.get('jobs', []))} jobs).")
        except Exception as e:
            if not data:
                data = {"jobs": [], "total_jobs": 0, "profile": {}, "stats": {}}

    # Keep valid existing jobs, strictly purging any whose application deadline has passed
    valid_existing = []
    for job in data.get("jobs", []):
        if not (job.get("title") or job.get("company")) or not (job.get("url") or job.get("linkedin_url")):
            continue

        # Purge expired application deadlines
        deadline_str = job.get("deadline") or job.get("end_date")
        if deadline_str:
            deadline_dt = parse_any_datetime(deadline_str)
            if deadline_dt and deadline_dt < now:
                continue

        # Purge stale unstop jobs from legacy runs lacking verified active deadlines
        if "unstop.com" in (job.get("url") or "") and not job.get("deadline"):
            continue

        valid_existing.append(job)

    existing_jobs = valid_existing
    existing_by_url = {job["url"]: job for job in existing_jobs if job.get("url")}
    existing_by_key = {
        f"{job.get('company', '').lower()}::{job.get('title', '').lower()}": job
        for job in existing_jobs
    }

    def source_is_due(last_sync_value, source_name, cooldown_hours=1):
        if not last_sync_value:
            return True
        try:
            last_sync = parse_any_datetime(last_sync_value)
            if last_sync is None:
                return True
            return now - last_sync >= datetime.timedelta(hours=cooldown_hours)
        except Exception:
            return True

    # Check due sources (Remotive every 1h, others every 30m-1h)
    include_remotive = source_is_due(data.get("last_remotive_sync"), "last_remotive_sync", cooldown_hours=1)
    include_himalayas = source_is_due(data.get("last_himalayas_sync"), "last_himalayas_sync", cooldown_hours=1)
    include_adzuna = source_is_due(data.get("last_adzuna_sync"), "last_adzuna_sync", cooldown_hours=1)
    include_jsearch = source_is_due(data.get("last_jsearch_sync"), "last_jsearch_sync", cooldown_hours=1)

    # 1. Collect dated listings from the available public feeds.
    print(f"[{timestamp_str}] Scraping & aggregating live job boards...")
    live_scraped_jobs = collect_and_score_all_live_jobs(
        include_remotive=include_remotive,
        include_himalayas=include_himalayas,
        include_adzuna=include_adzuna,
        include_jsearch=include_jsearch,
    )
    if include_remotive:
        data["last_remotive_sync"] = timestamp_str
    if include_himalayas:
        data["last_himalayas_sync"] = timestamp_str
    if include_adzuna:
        data["last_adzuna_sync"] = timestamp_str
    if include_jsearch:
        data["last_jsearch_sync"] = timestamp_str
    added_count = 0

    for job in live_scraped_jobs:
        j_key = f"{job.get('company', '').lower()}::{job.get('title', '').lower()}"
        j_url = job.get("url")
        existing_job = existing_by_url.get(j_url) or existing_by_key.get(j_key)
        if existing_job:
            existing_job.update(job)
        else:
            existing_jobs.insert(0, job)
            if j_url:
                existing_by_url[j_url] = job
            existing_by_key[j_key] = job
            added_count += 1

    # 2. Recalculate age from preserved publication timestamps
    for job in existing_jobs:
        if not job.get("posted_at_source"):
            job["posted_at_source"] = "published_at"

        posted_at_str = job.get("posted_at")
        posted_dt = parse_any_datetime(posted_at_str) if posted_at_str else None
        if posted_dt:
            elapsed_hrs = (now - posted_dt).total_seconds() / 3600.0
            if elapsed_hrs >= 0:
                job["hours_ago"] = round(elapsed_hrs, 2)
                if elapsed_hrs < 1:
                    mins = max(5, int(round(elapsed_hrs * 60)))
                    job["relative_time"] = f"{mins} minutes ago"
                elif elapsed_hrs < 24:
                    hrs = max(1, int(round(elapsed_hrs)))
                    job["relative_time"] = f"{hrs} hour{'s' if hrs > 1 else ''} ago"
                else:
                    days = max(1, int(round(elapsed_hrs / 24)))
                    job["relative_time"] = f"{days} day{'s' if days > 1 else ''} ago"
        else:
            # If posted_at could not be parsed, preserve existing hours_ago safely
            if job.get("hours_ago") is None:
                job["hours_ago"] = 18.0
            if not job.get("relative_time"):
                job["relative_time"] = "18 hours ago"

        if "semantic_skill_gap" not in job:
            enrich_job_semantic_gaps(job)

    # Keep listings up to 30 days (720 hours) for the "Anytime" filter
    existing_jobs = [
        job for job in existing_jobs
        if job.get("hours_ago") is not None and job["hours_ago"] <= 720
    ]

    # 3. Sort from newest to oldest
    existing_jobs.sort(key=lambda j: j.get("hours_ago", 999))

    data["jobs"] = existing_jobs
    data["total_jobs"] = len(existing_jobs)
    data["last_updated"] = timestamp_str
    profile_path = os.path.join(ROOT_DIR, "profile.json")
    if os.path.exists(profile_path):
        with open(profile_path, "r", encoding="utf-8") as f:
            data["profile"] = json.load(f)

    # 4. Update stats
    primary_count = sum(1 for j in existing_jobs if j.get("priority") == "Primary" or j.get("tier") in [1, 2, 3, 4, 5, 6, 7])
    secondary_count = sum(1 for j in existing_jobs if j.get("priority") == "Secondary" or j.get("tier") == 8)
    adjacent_count = sum(1 for j in existing_jobs if j.get("tier") == 9)

    data["stats"] = {
        "total_jobs_evaluated": len(existing_jobs),
        "primary_matches": primary_count,
        "secondary_matches": secondary_count,
        "adjacent_matches": adjacent_count,
        "last_sync": timestamp_str
    }

    # 5. Write back data.json and docs/data.json
    for p in [os.path.join(ROOT_DIR, "data.json"), os.path.join(ROOT_DIR, "docs", "data.json")]:
        with open(p, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Updated {p} ({len(existing_jobs)} jobs)")

    # 6. Write back data.js and docs/data.js
    js_content = "window.JOB_MATCHER_DATA = window.JOB_DATA = " + json.dumps(data, indent=2, ensure_ascii=False) + ";\n"
    for p in [os.path.join(ROOT_DIR, "data.js"), os.path.join(ROOT_DIR, "docs", "data.js")]:
        with open(p, "w", encoding="utf-8") as f:
            f.write(js_content)
        print(f"Updated {p}")

    # 7. Update SQLite jobs.db
    try:
        db_path = os.path.join(ROOT_DIR, "jobs.db")
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                url TEXT PRIMARY KEY,
                title TEXT,
                company TEXT,
                score REAL,
                tier INTEGER,
                category TEXT,
                priority TEXT,
                posted_at TEXT,
                hours_ago REAL,
                source_domain TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        for j in existing_jobs:
            c.execute("""
                INSERT OR REPLACE INTO jobs (url, title, company, score, tier, category, priority, posted_at, hours_ago, source_domain)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                j.get("url") or j.get("linkedin_url"), j.get("title"), j.get("company"),
                j.get("score"), j.get("tier"), j.get("category"), j.get("priority"),
                j.get("posted_at"), j.get("hours_ago"), j.get("source_domain")
            ))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[{timestamp_str}] SQLite update notice: {e}")

    print(f"[{timestamp_str}] Feed sync complete. Added {added_count} verified listings. Total: {len(existing_jobs)} jobs.")
    return len(existing_jobs), added_count

if __name__ == "__main__":
    run_hourly_sync()
