import json
import sqlite3
import os
import datetime
from collectors.live_job_collector import collect_and_score_all_live_jobs
from matching.scoring import score_job
from collectors.career_urls import build_linkedin_jobs_url, build_naukri_jobs_url

def export_data():
    # 1. Load Profile
    with open("profile.json", "r", encoding="utf-8") as f:
        profile = json.load(f)

    max_age = profile.get("freshness", {}).get("max_age_hours", 48)

    # 2. Collect only listings with source-provided publication times.
    all_raw_jobs = []
    seen_keys = set()

    for j in collect_and_score_all_live_jobs(include_remotive=False):
        key = (j.get("company", "").strip().lower(), j.get("title", "").strip().lower())
        if key not in seen_keys:
            seen_keys.add(key)
            all_raw_jobs.append(j)

    # 3. Score and normalize each job
    detailed_jobs = []

    for raw in all_raw_jobs:
        title = raw.get("title", "Specialist")
        company = raw.get("company", "Tech Company")
        loc = raw.get("location", "Bengaluru, Karnataka, India")
        desc = raw.get("raw_description", "")
        hours_ago = raw.get("hours_ago")
        
        if not raw.get("posted_at_source") or hours_ago is None or hours_ago > max_age:
            continue

        # Ensure direct URL to official portal or ATS
        direct_url = raw.get("url", "")
        company_url = raw.get("company_url", "")
        
        if "linkedin.com/jobs/search" in direct_url or "linkedin.com/search" in direct_url:
            continue

        scored = score_job({
            "title": title,
            "raw_description": desc,
            "role_category": raw.get("category", "Data Science"),
            "location": loc,
            "seniority": "junior",
            "hours_ago": hours_ago,
            "url": direct_url,
            "required_skills": []
        }, profile)

        if scored.get("rejected"):
            continue

        final_tier = scored.get("tier") or 2
        final_cat = scored.get("category") or "Data Science"
        final_priority = scored.get("priority") or "Primary"
        final_score = scored.get("final_score") or 0.85
        badge = scored.get("badge") or ("🥇" if final_tier == 1 else ("🥈" if final_tier == 2 else ("🥉" if final_tier == 3 else str(final_tier))))

        # Format relative time
        if hours_ago < 1:
            mins = max(1, int(round(hours_ago * 60)))
            rel_time = f"{mins} minutes ago"
        elif hours_ago < 24:
            hrs = max(1, int(round(hours_ago)))
            rel_time = f"{hrs} hour{'s' if hrs > 1 else ''} ago"
        else:
            days = max(1, int(round(hours_ago / 24)))
            rel_time = f"{days} day{'s' if days > 1 else ''} ago"

        source_domain = raw.get("source_domain", "")
        if not source_domain and company_url:
            source_domain = company_url.replace("https://", "").replace("http://", "").split("/")[0].replace("www.", "")

        linkedin_url = build_linkedin_jobs_url(title, company)
        naukri_url = build_naukri_jobs_url(title)

        detailed_jobs.append({
            "url": direct_url,
            "linkedin_url": linkedin_url,
            "naukri_url": naukri_url,
            "company_url": company_url or direct_url,
            "title": title,
            "company": company,
            "location": loc,
            "score": round(final_score, 3),
            "tier": final_tier,
            "category": final_cat,
            "priority": final_priority,
            "badge": badge,
            "posted_at": raw["posted_at"],
            "posted_at_source": raw["posted_at_source"],
            "hours_ago": hours_ago,
            "relative_time": raw.get("relative_time") or rel_time,
            "source_type": raw.get("source_type") or scored.get("platform") or "Official Portal",
            "source_domain": source_domain or "Company Website",
            "is_fresher": scored.get("is_fresher", True),
            "matched_skills": scored.get("matched_skills", []),
            "missing_skills": scored.get("missing_skills", []),
            "description": desc or f"Fresher level opportunity for {title} at {company}.",
            "raw_description": desc,
            "contact_email": raw.get("contact_email"),
            "outreach_dm": raw.get("outreach_dm"),
            "is_post": raw.get("is_post", False),
            "post_author": raw.get("post_author")
        })

    # Sort detailed jobs by score descending
    detailed_jobs.sort(key=lambda x: x["score"], reverse=True)

    # 4. Clean and rebuild SQLite jobs.db
    conn = sqlite3.connect("jobs.db")
    c = conn.cursor()
    c.execute("DROP TABLE IF EXISTS jobs")
    c.execute("""
        CREATE TABLE jobs (
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
    for j in detailed_jobs:
        c.execute("""
            INSERT OR REPLACE INTO jobs (url, title, company, score, tier, category, priority, posted_at, hours_ago, source_domain)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            j["url"], j["title"], j["company"], j["score"], j["tier"],
            j["category"], j["priority"], j["posted_at"], j["hours_ago"], j["source_domain"]
        ))
    conn.commit()
    conn.close()

    # 5. Create Web Payload
    web_data = {
        "profile": profile,
        "jobs": detailed_jobs,
        "total_jobs": len(detailed_jobs),
        "last_updated": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="minutes").replace("+00:00", "Z"),
        "stats": {
            "total_matches": len(detailed_jobs),
            "primary_matches": len([j for j in detailed_jobs if j.get("tier") in [1, 2, 3, 4, 5, 6, 7]]),
            "secondary_matches": len([j for j in detailed_jobs if j.get("tier") == 8]),
            "adjacent_matches": len([j for j in detailed_jobs if j.get("tier") == 9]),
            "avg_score": round(sum(j["score"] for j in detailed_jobs) / len(detailed_jobs), 3) if detailed_jobs else 0.0,
            "top_categories": list(dict.fromkeys([j["category"] for j in detailed_jobs]))
        }
    }

    # 6. Write to data.js & data.json
    js_content = f"window.JOB_MATCHER_DATA = {json.dumps(web_data, indent=2)};"
    with open("data.js", "w", encoding="utf-8") as f:
        f.write(js_content)

    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(web_data, f, indent=2)

    os.makedirs("docs", exist_ok=True)
    with open("docs/data.js", "w", encoding="utf-8") as f:
        f.write(js_content)
    with open("docs/data.json", "w", encoding="utf-8") as f:
        json.dump(web_data, f, indent=2)

    print(f"[OK] Successfully exported {len(detailed_jobs)} verified jobs (0m - 48h) to data.js, data.json, and docs/")

if __name__ == "__main__":
    export_data()
