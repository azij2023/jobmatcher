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
from matching.semantic_gaps import enrich_job_semantic_gaps

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

def normalize_job_key(company, title, is_post=False):
    import re
    c = re.sub(r'[^a-z0-9]', '', (company or '').lower())
    t = (title or '').lower()
    t = re.sub(r'\s*\([^)]*\)', '', t)
    t = re.sub(r'\s*\|.*', '', t)
    t = re.sub(r'\s*-\s*(?:fresher|batch\s*202\d|bangalore|bengaluru|gurugram|noida|india|early career).*', '', t)
    t = re.sub(r'[^a-z0-9]', '', t)
    suffix = "::post" if is_post else ""
    return f"{c}::{t}{suffix}"

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

    # Keep valid existing jobs, strictly purging any pseudo-jobs, search redirects, or expired deadlines
    valid_existing = []
    for job in data.get("jobs", []):
        t = (job.get("title") or "").strip()
        c = (job.get("company") or "").strip()
        u = (job.get("url") or job.get("linkedin_url") or "").strip()
        t_lower = t.lower()
        c_lower = c.lower()
        u_lower = u.lower()

        if not t or not c or not u:
            continue

        # Purge fake/pseudo aggregator jobs
        if c_lower in ["tech company", "other organization not listed here", "unknown"]:
            continue
        if any(bad in t_lower for bad in ["jobs in", "job vacancies", "salary in", "vacancies in", "mba fresher or"]):
            continue
        if "indeed.com/jobs?q=" in u_lower or "-jobs-in-india" in u_lower:
            continue

        # Purge expired application deadlines
        deadline_str = job.get("deadline") or job.get("end_date")
        if deadline_str:
            deadline_dt = parse_any_datetime(deadline_str)
            if deadline_dt and deadline_dt < now:
                continue

        # Purge stale unstop jobs from legacy runs lacking verified active deadlines
        if "unstop.com" in u_lower and not job.get("deadline"):
            continue

        # Keep verified company career portals and direct requisitions
        is_portal_type = "portal" in (job.get("source_type") or "").lower() or "company" in (job.get("source_type") or "").lower()
        if is_portal_type:
            if "linkedin.com/jobs/search" in u_lower:
                continue
            if not any(exact in u_lower for exact in ["/job", "/posting", "/jobs/", "smartrecruiters", "greenhouse.io", "lever.co", "ashbyhq", "careers", "/careers"]):
                continue

        valid_existing.append(job)

    # Deduplicate existing jobs by normalized (company, title) keeping newest entry
    deduped_existing = []
    seen_existing_keys = set()
    for job in sorted(valid_existing, key=lambda j: (j.get("hours_ago") if j.get("hours_ago") is not None else 999)):
        k = normalize_job_key(job.get("company"), job.get("title"))
        if k in seen_existing_keys:
            continue
        seen_existing_keys.add(k)
        deduped_existing.append(job)

    existing_jobs = deduped_existing
    existing_by_url = {job["url"].lower(): job for job in existing_jobs if job.get("url")}
    existing_by_key = {
        normalize_job_key(job.get('company'), job.get('title'), job.get('is_post')): job
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
        j_key = normalize_job_key(job.get('company'), job.get('title'), job.get('is_post'))
        j_url = (job.get("url") or "").lower()
        existing_job = existing_by_url.get(j_url) or existing_by_key.get(j_key)
        if existing_job:
            existing_job.update(job)
        else:
            existing_jobs.insert(0, job)
            if j_url:
                existing_by_url[j_url] = job
            existing_by_key[j_key] = job
            added_count += 1

    # 1b. Collect individual message posts from hiring leads & founders
    from collectors.linkedin_post_fetcher import get_curated_linkedin_posts
    individual_posts = get_curated_linkedin_posts()
    for p in individual_posts:
        title_lower = p["title"].lower()
        skills = ["python", "sql"]
        tier = 2
        badge = "🥈"
        category = "Data Science"
        priority = "Primary"
        score = 0.95

        if "product" in title_lower or "apm" in title_lower:
            tier = 5
            badge = "5"
            category = "Product"
            priority = "Primary"
            skills = ["product_analytics", "sql", "telemetry", "problem_solving"]
            score = 0.945
        elif "decision" in title_lower:
            tier = 3
            badge = "🥉"
            category = "Decision Science"
            priority = "Primary"
            skills = ["statistical_modeling", "ab_testing", "hypothesis_testing", "sql"]
            score = 0.950
        elif "data scientist" in title_lower or "data science" in title_lower:
            tier = 2
            badge = "🥈"
            category = "Data Science"
            priority = "Primary"
            skills = ["python", "sql", "pandas", "predictive_modeling"]
            score = 0.965
        elif "optimization" in title_lower or "operations research" in title_lower:
            tier = 4
            badge = "🏅"
            category = "OR / Optimization"
            priority = "Primary"
            skills = ["linear_programming", "python", "pulp", "optimization"]
            score = 0.940
        elif "forecasting" in title_lower or "time series" in title_lower:
            tier = 7
            badge = "7"
            category = "Forecasting"
            priority = "Primary"
            skills = ["time_series", "forecasting", "prophet", "arima", "pandas"]
            score = 0.925
        elif "ml engineer" in title_lower or "machine learning engineer" in title_lower:
            tier = 8
            badge = "8"
            category = "ML Engineering"
            priority = "Secondary"
            skills = ["fastapi", "docker", "mlops", "python", "scikit_learn"]
            score = 0.910
        elif "applied scientist" in title_lower or "applied ml" in title_lower:
            tier = 1
            badge = "🥇"
            category = "Applied ML / Research"
            priority = "Primary"
            skills = ["pytorch", "deep_learning", "transformers", "vector_search"]
            score = 0.980
        elif "strategy" in title_lower or "bizops" in title_lower:
            tier = 6
            badge = "6"
            category = "Strategy / Programs"
            priority = "Primary"
            skills = ["excel", "sql", "financial_modeling", "problem_solving"]
            score = 0.930

        p_hrs = float(p.get("hours_ago", 3.0))
        p_posted_at = (now - datetime.timedelta(hours=p_hrs)).isoformat(timespec="seconds").replace("+00:00", "Z")

        job_entry = {
            "title": p["title"],
            "company": p["company"],
            "location": p["location"],
            "hours_ago": p_hrs,
            "posted_at": p_posted_at,
            "source_type": "LinkedIn Post",
            "source_domain": "linkedin.com",
            "is_post": True,
            "post_author": p.get("post_author", "Hiring Lead"),
            "contact_email": p.get("contact_email"),
            "url": p["url"],
            "direct_job_url": p["url"],
            "raw_description": p.get("raw_description", ""),
            "company_url": p.get("company_url"),
            "score": score,
            "tier": tier,
            "priority": priority,
            "badge": badge,
            "category": category,
            "is_fresher": True,
            "is_internship": False,
            "matched_skills": skills,
            "missing_skills": [],
            "description": p.get("raw_description", "")
        }
        p_key = normalize_job_key(job_entry['company'], job_entry['title'], is_post=True)
        p_url = job_entry["url"].lower()
        if p_key not in existing_by_key and p_url not in existing_by_url:
            existing_jobs.append(job_entry)
            existing_by_key[p_key] = job_entry
            existing_by_url[p_url] = job_entry
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
                    mins = max(1, int(round(elapsed_hrs * 60)))
                    job["relative_time"] = f"{mins} minute{'s' if mins != 1 else ''} ago"
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

    # 2a. Re-evaluate role mapping, tier classification & badges against updated profile
    profile_path = os.path.join(ROOT_DIR, "profile.json")
    loaded_profile = {}
    if os.path.exists(profile_path):
        with open(profile_path, "r", encoding="utf-8") as f:
            loaded_profile = json.load(f)

    from matching.scoring import match_role_category
    for job in existing_jobs:
        if loaded_profile:
            role_match = match_role_category(job, loaded_profile)
            if role_match:
                job["tier"] = role_match.get("tier")
                job["priority"] = role_match.get("priority")
                job["badge"] = role_match.get("badge")
                job["category"] = role_match.get("category")

    # 2b. Re-evaluate strict 0-experience eligibility against profile
    strict_zero = loaded_profile.get("job_filters", {}).get("strict_zero_experience", True)
    if strict_zero:
        from matching.scoring import score_job
        clean_zero_jobs = []
        for job in existing_jobs:
            scored = score_job(job, loaded_profile)
            if not scored.get("rejected"):
                clean_zero_jobs.append(job)
        existing_jobs = clean_zero_jobs

    # 2c-1. Enrich multi_source_urls across 6 channel categories
    from collectors.career_urls import build_multi_source_urls
    for job in existing_jobs:
        if "multi_source_urls" not in job or not job["multi_source_urls"]:
            job["multi_source_urls"] = build_multi_source_urls(job.get("title", ""), job.get("company", ""))

    # 2c. Compute is_internship flag for every job
    import re
    intern_keywords = ["intern", "internship", "trainee", "apprentice", "apprenticeship"]
    for job in existing_jobs:
        t_low = (job.get("title") or "").lower()
        d_low = (job.get("raw_description") or job.get("description") or "").lower()
        is_int = any(kw in t_low for kw in intern_keywords)
        if not is_int:
            is_int = bool(re.search(r'\b(?:internship|intern\s+position|apprenticeship)\b', d_low))
        job["is_internship"] = is_int

    # 2d. Filter out closed requisitions, dead URLs, or expired postings
    DEAD_URL_PATTERNS = [
        "smartrecruiters.com/swiggy/6000000001526179",
        "job-boards.eu.greenhouse.io/groww/jobs/4714061101",
        "jobs.lever.co/meesho/ad781ae8",
        "jobs.lever.co/cred/cf1076c8",
        "skillzen-loop",
        "inlighnx-global"
    ]
    def is_active_listing(job):
        u = (job.get("direct_job_url") or job.get("url") or "").lower()
        if not u or u == "#":
            return False
        if any(p in u for p in DEAD_URL_PATTERNS):
            return False
        return True

    existing_jobs = [j for j in existing_jobs if is_active_listing(j)]

    # Keep listings strictly between 1 minute and 120 hours (5 days) for live real-time freshness
    existing_jobs = [
        job for job in existing_jobs
        if job.get("hours_ago") is not None and job["hours_ago"] <= 120.0
    ]

    # 3. Sort from newest to oldest
    existing_jobs.sort(key=lambda j: j.get("hours_ago", 999))

    # Final deduplication by normalized key preserving newest
    final_deduped = []
    seen_final = set()
    for job in existing_jobs:
        k = normalize_job_key(job.get("company"), job.get("title"))
        if k in seen_final:
            continue
        seen_final.add(k)
        final_deduped.append(job)
    existing_jobs = final_deduped

    data["jobs"] = existing_jobs
    data["total_jobs"] = len(existing_jobs)
    data["last_updated"] = timestamp_str
    data["profile"] = loaded_profile

    # 4. Update stats
    primary_count = sum(1 for j in existing_jobs if j.get("priority") == "Primary" or j.get("tier") in [1, 2, 3, 4, 5, 6, 7])
    secondary_count = sum(1 for j in existing_jobs if j.get("priority") == "Secondary" or j.get("tier") == 8)
    adjacent_count = sum(1 for j in existing_jobs if j.get("tier") == 9)

    data["stats"] = {
        "total_jobs_evaluated": len(existing_jobs),
        "primary_matches": primary_count,
        "secondary_matches": secondary_count,
        "adjacent_matches": adjacent_count,
        "full_time_matches": sum(1 for j in existing_jobs if not j.get("is_internship")),
        "internship_matches": sum(1 for j in existing_jobs if j.get("is_internship")),
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
