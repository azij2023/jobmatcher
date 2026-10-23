import json
from collectors.live_job_collector import collect_and_score_all_live_jobs
from storage.db import init_db, save_job
from alerts.emailer import send_email

def main():
    with open("profile.json", "r", encoding="utf-8") as f:
        profile = json.load(f)

    init_db()

    results = []
    print("Fetching and processing job postings...")

    for job in collect_and_score_all_live_jobs(include_remotive=False):
        scored = {
            "final_score": job["score"],
            "tier": job.get("tier"),
            "category": job.get("category"),
            "priority": job.get("priority"),
        }
        save_job(job, scored)
        results.append({
            "title": job["title"],
            "company": job["company"],
            "url": job["url"],
            "score": job["score"],
            "tier": job.get("tier"),
            "badge": job.get("badge"),
            "matched_skills": job.get("matched_skills", [])
        })

    results.sort(key=lambda x: x["score"], reverse=True)
    send_email(results[:profile["alerting"]["max_jobs_per_day"]])

if __name__ == "__main__":
    main()
