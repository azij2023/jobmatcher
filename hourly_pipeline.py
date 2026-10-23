"""
Hourly Automated Job Fetcher & Pipeline Sync
TargetMatch AI - Entry-Level Career Engine

Runs automatically every hour via GitHub Actions cron, local scheduler, or manual trigger.
Fetches REAL live entry-level opportunities from LinkedIn Guest API, Remotive, and Jobicy.
Accurately recalculates elapsed age for older jobs, deduplicates, enriches semantic skill gaps,
sorts by freshness (newest first), and synchronizes data payloads across root and docs/.
"""

import os
import json
import datetime
import re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = SCRIPT_DIR

from collectors.live_job_collector import collect_and_score_all_live_jobs
from collectors.linkedin_post_fetcher import get_curated_linkedin_posts
from scratch.add_semantic_skill_gaps import enrich_job_semantic_gaps

def run_hourly_sync():
    now = datetime.datetime.now()
    timestamp_str = now.strftime("%Y-%m-%d %H:%M")
    print(f"[{timestamp_str}] Running TargetMatch AI Hourly Pipeline Sync...")

    data_json_path = os.path.join(ROOT_DIR, "data.json")
    if os.path.exists(data_json_path):
        with open(data_json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = {"jobs": [], "total_jobs": 0, "profile": {}, "stats": {}}

    existing_jobs = data.get("jobs", [])
    existing_urls = {j.get("url") for j in existing_jobs if j.get("url")}
    existing_keys = {f"{j.get('company', '').lower()}::{j.get('title', '').lower()}" for j in existing_jobs}

    # 1. Collect REAL LIVE fresh jobs from LinkedIn Guest API, Remotive, and Jobicy
    print(f"[{timestamp_str}] Scraping & aggregating live job boards...")
    live_scraped_jobs = collect_and_score_all_live_jobs()
    added_count = 0

    for job in live_scraped_jobs:
        j_key = f"{job.get('company', '').lower()}::{job.get('title', '').lower()}"
        j_url = job.get("url")
        if j_url not in existing_urls and j_key not in existing_keys:
            existing_jobs.insert(0, job)
            existing_urls.add(j_url)
            existing_keys.add(j_key)
            added_count += 1

    # 2. Collect informal LinkedIn public posts from founders / hiring managers
    fresh_posts = get_curated_linkedin_posts()
    for post in fresh_posts:
        p_key = f"{post.get('company', '').lower()}::{post.get('title', '').lower()}"
        p_url = post.get("url")
        if p_url not in existing_urls and p_key not in existing_keys:
            enrich_job_semantic_gaps(post)
            existing_jobs.append(post)
            existing_urls.add(p_url)
            existing_keys.add(p_key)
            added_count += 1

    # 3. Accurately recalculate elapsed time for ALL jobs based on true posted_at timestamp
    # This prevents older jobs from staying stuck at "5 minutes ago" indefinitely
    for job in existing_jobs:
        posted_at_str = job.get("posted_at")
        if posted_at_str:
            try:
                posted_dt = datetime.datetime.strptime(posted_at_str, "%Y-%m-%d %H:%M")
                elapsed_hrs = max(0.05, (now - posted_dt).total_seconds() / 3600.0)
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
            except Exception:
                pass

        if "semantic_skill_gap" not in job:
            enrich_job_semantic_gaps(job)

    # 4. Sort strictly from LATEST to FARTHEST (lowest hours_ago at the top!)
    existing_jobs.sort(key=lambda j: j.get("hours_ago", 999))

    data["jobs"] = existing_jobs
    data["total_jobs"] = len(existing_jobs)
    data["last_updated"] = timestamp_str

    # 5. Update stats
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

    # 6. Write back data.json and docs/data.json
    for p in [os.path.join(ROOT_DIR, "data.json"), os.path.join(ROOT_DIR, "docs", "data.json")]:
        with open(p, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Updated {p} ({len(existing_jobs)} jobs)")

    # 7. Write back data.js and docs/data.js
    js_content = "window.JOB_MATCHER_DATA = window.JOB_DATA = " + json.dumps(data, indent=2, ensure_ascii=False) + ";\n"
    for p in [os.path.join(ROOT_DIR, "data.js"), os.path.join(ROOT_DIR, "docs", "data.js")]:
        with open(p, "w", encoding="utf-8") as f:
            f.write(js_content)
        print(f"Updated {p}")

    print(f"[{timestamp_str}] Hourly sync complete! {added_count} brand-new live opportunities incorporated. Total: {len(existing_jobs)} jobs.")
    return len(existing_jobs), added_count

if __name__ == "__main__":
    run_hourly_sync()
