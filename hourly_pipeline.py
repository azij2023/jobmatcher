"""
Scheduled Job Fetcher & Pipeline Sync
TargetMatch AI - Entry-Level Career Engine

Runs every 30 minutes via GitHub Actions. Remotive is queried at most every six hours.
Fetches dated entry-level opportunities, recalculates age from source timestamps,
deduplicates, enriches matches, and synchronizes the web payloads.
"""

import os
import json
import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = SCRIPT_DIR

from collectors.live_job_collector import collect_and_score_all_live_jobs
from scratch.add_semantic_skill_gaps import enrich_job_semantic_gaps

def run_hourly_sync():
    now = datetime.datetime.now(datetime.timezone.utc)
    timestamp_str = now.isoformat(timespec="minutes").replace("+00:00", "Z")
    print(f"[{timestamp_str}] Running TargetMatch AI job feed sync...")

    data_json_path = os.path.join(ROOT_DIR, "data.json")
    if os.path.exists(data_json_path):
        with open(data_json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = {"jobs": [], "total_jobs": 0, "profile": {}, "stats": {}}

    existing_jobs = [
        job for job in data.get("jobs", [])
        if job.get("posted_at_source") in {"published_at", "relative_time"}
    ]
    existing_by_url = {job["url"]: job for job in existing_jobs if job.get("url")}
    existing_by_key = {
        f"{job.get('company', '').lower()}::{job.get('title', '').lower()}": job
        for job in existing_jobs
    }

    def source_is_due(last_sync_value, source_name):
        if not last_sync_value:
            return True
        try:
            last_sync = datetime.datetime.fromisoformat(last_sync_value.replace("Z", "+00:00"))
            if last_sync.tzinfo is None:
                last_sync = last_sync.replace(tzinfo=datetime.timezone.utc)
            return now - last_sync >= datetime.timedelta(hours=6)
        except (TypeError, ValueError):
            print(f"[{timestamp_str}] Ignoring invalid {source_name} sync timestamp.")
            return True

    # Remotive recommends at most four requests a day; throttle all larger public feeds.
    include_remotive = source_is_due(data.get("last_remotive_sync"), "last_remotive_sync")
    include_himalayas = source_is_due(data.get("last_himalayas_sync"), "last_himalayas_sync")
    include_adzuna = source_is_due(data.get("last_adzuna_sync"), "last_adzuna_sync")

    # 1. Collect dated listings from the available public feeds.
    print(f"[{timestamp_str}] Scraping & aggregating live job boards...")
    live_scraped_jobs = collect_and_score_all_live_jobs(
        include_remotive=include_remotive,
        include_himalayas=include_himalayas,
        include_adzuna=include_adzuna,
    )
    if include_remotive:
        data["last_remotive_sync"] = timestamp_str
    if include_himalayas:
        data["last_himalayas_sync"] = timestamp_str
    if include_adzuna:
        data["last_adzuna_sync"] = timestamp_str
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

    # 2. Recalculate age from the preserved source publication timestamp.
    for job in existing_jobs:
        posted_at_str = job.get("posted_at")
        if posted_at_str:
            try:
                posted_dt = datetime.datetime.fromisoformat(posted_at_str.replace("Z", "+00:00"))
                if posted_dt.tzinfo is None:
                    posted_dt = posted_dt.replace(tzinfo=datetime.timezone.utc)
                elapsed_hrs = (now - posted_dt).total_seconds() / 3600.0
                if elapsed_hrs < 0:
                    job["hours_ago"] = None
                    continue
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
            except (TypeError, ValueError) as error:
                print(f"[{timestamp_str}] Dropping listing with invalid publication date: {error}")
                job["hours_ago"] = None
                continue

        if "semantic_skill_gap" not in job:
            enrich_job_semantic_gaps(job)

    # Keep one month of verified listings for the "Anytime" filter.
    existing_jobs = [
        job for job in existing_jobs
        if job.get("hours_ago") is not None and job["hours_ago"] <= 24 * 30
    ]

    # 3. Sort from newest to oldest.
    existing_jobs.sort(key=lambda j: j.get("hours_ago", 999))

    data["jobs"] = existing_jobs
    data["total_jobs"] = len(existing_jobs)
    data["last_updated"] = timestamp_str
    with open(os.path.join(ROOT_DIR, "profile.json"), "r", encoding="utf-8") as f:
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

    print(f"[{timestamp_str}] Feed sync complete. Added {added_count} verified listings. Total: {len(existing_jobs)} jobs.")
    return len(existing_jobs), added_count

if __name__ == "__main__":
    run_hourly_sync()
