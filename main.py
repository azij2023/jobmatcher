import json
import sys

# Ensure UTF-8 output on Windows console
if sys.platform.startswith("win"):
    sys.stdout.reconfigure(encoding="utf-8")

from collectors.api_sources import fetch_api_jobs
from processing.clean_text import clean_text
from processing.normalize import normalize_location, normalize_skills, normalize_seniority
from llm.job_extractor import JobExtractor
from matching.scoring import score_job
from storage.db import init_db, save_job
from alerts.emailer import send_email

def main():
    with open("profile.json", "r", encoding="utf-8") as f:
        profile = json.load(f)

    extractor = JobExtractor()
    init_db()

    results = []
    print("Fetching and processing job postings...")

    for job in fetch_api_jobs():
        text = clean_text(job["raw_description"])
        extracted = extractor.extract(text)

        extracted["title"] = job["title"]
        extracted["url"] = job["url"]
        extracted["hours_ago"] = job.get("hours_ago")
        extracted["posted_at"] = job.get("posted_at")
        extracted["raw_description"] = job["raw_description"]
        extracted["location"] = normalize_location(job["location"])
        extracted["seniority"] = normalize_seniority(extracted.get("seniority", "junior"))
        extracted["required_skills"] = normalize_skills(extracted.get("required_skills", []))
        extracted["nice_to_have"] = normalize_skills(extracted.get("nice_to_have", []))

        scored = score_job(extracted, profile)

        if not scored["rejected"]:
            save_job(job, scored)
            results.append({
                "title": job["title"],
                "company": job["company"],
                "url": job["url"],
                "score": scored["final_score"],
                "tier": scored.get("tier"),
                "category": scored.get("category"),
                "badge": scored.get("badge"),
                "matched_skills": scored.get("matched_skills", [])
            })
        else:
            print(f"[-] Skipped '{job['title']}': {scored.get('rejection_reason')}")

    results.sort(key=lambda x: x["score"], reverse=True)
    send_email(results[:profile["alerting"]["max_jobs_per_day"]])

if __name__ == "__main__":
    main()
