import json
import sqlite3
import os

def export_data():
    # 1. Load Profile
    with open("profile.json", "r", encoding="utf-8") as f:
        profile = json.load(f)

    # 2. Load Jobs from SQLite
    jobs = []
    if os.path.exists("jobs.db"):
        conn = sqlite3.connect("jobs.db")
        c = conn.cursor()
        c.execute("SELECT url, title, company, score, tier, category, priority, created_at FROM jobs ORDER BY score DESC")
        for row in c.fetchall():
            jobs.append({
                "url": row[0],
                "title": row[1],
                "company": row[2],
                "score": round(row[3], 3),
                "tier": row[4],
                "category": row[5],
                "priority": row[6],
                "created_at": row[7]
            })
        conn.close()

    # Match skills for each job using collectors data
    from collectors.api_sources import fetch_api_jobs
    from matching.scoring import score_job
    from processing.clean_text import clean_text
    from processing.normalize import normalize_location, normalize_skills, normalize_seniority

    api_jobs_map = {j["url"]: j for j in fetch_api_jobs()}

    detailed_jobs = []
    for j in jobs:
        raw_job = api_jobs_map.get(j["url"], {})
        desc = raw_job.get("raw_description", "")
        loc = raw_job.get("location", "India / Remote")
        
        # Extract skills & scoring detail
        scored = score_job({
            "title": j["title"],
            "raw_description": desc,
            "role_category": j["category"],
            "location": loc,
            "seniority": "junior",
            "hours_ago": raw_job.get("hours_ago", 4),
            "url": j["url"],
            "required_skills": []
        }, profile)

        if scored.get("rejected"):
            continue

        # Fallback badge
        badge = scored.get("badge")
        if not badge:
            badge = "🥇" if j["tier"] == 1 else ("🥈" if j["tier"] == 2 else ("🥉" if j["tier"] == 3 else str(j["tier"])))

        hours_ago = raw_job.get("hours_ago", 4)
        if hours_ago is not None and hours_ago > 24:
            continue
        if "linkedin.com" in j["url"].lower():
            continue

        final_tier = scored.get("tier") or j.get("tier")
        final_cat = scored.get("category") or j.get("category")
        final_priority = scored.get("priority") or j.get("priority")
        final_score = scored.get("final_score") or j.get("score")

        detailed_jobs.append({
            "url": j["url"],
            "title": j["title"],
            "company": j["company"],
            "location": loc,
            "score": round(final_score, 3),
            "tier": final_tier,
            "category": final_cat,
            "priority": final_priority,
            "badge": badge,
            "posted_at": raw_job.get("posted_at") or "Today",
            "hours_ago": hours_ago,
            "source_type": raw_job.get("source_type", "Direct Company Portal"),
            "source_domain": raw_job.get("source_domain", "Company Website"),
            "matched_skills": scored.get("matched_skills", []),
            "missing_skills": scored.get("missing_skills", []),
            "description": desc or f"Entry-level position for {j['title']} with strong domain expertise."
        })

    # Sort detailed jobs by score descending
    detailed_jobs.sort(key=lambda x: x["score"], reverse=True)

    # 3. Create Web Payload
    web_data = {
        "profile": profile,
        "jobs": detailed_jobs,
        "stats": {
            "total_matches": len(detailed_jobs),
            "primary_matches": len([j for j in detailed_jobs if j.get("tier") in [1, 2, 3]]),
            "secondary_matches": len([j for j in detailed_jobs if j.get("tier") in [4, 5, 6]]),
            "adjacent_matches": len([j for j in detailed_jobs if j.get("tier") in [7, 8, 9]]),
            "avg_score": round(sum(j["score"] for j in detailed_jobs) / len(detailed_jobs), 3) if detailed_jobs else 0.0,
            "top_categories": list(dict.fromkeys([j["category"] for j in detailed_jobs]))
        }
    }

    # Write as JS and JSON
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

    print(f"[OK] Exported {len(detailed_jobs)} jobs and profile taxonomy to data.js & docs/data.js")

if __name__ == "__main__":
    export_data()
