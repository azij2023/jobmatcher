import json
import datetime
import sys
import os
sys.path.insert(0, os.path.abspath("."))
from collectors.linkedin_post_fetcher import get_curated_linkedin_posts

def main():
    with open("data.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    existing_jobs = data.get("jobs", [])
    existing_urls = {j["url"] for j in existing_jobs}

    posts = get_curated_linkedin_posts()
    added_count = 0

    for p in posts:
        if p["url"] in existing_urls:
            continue

        title_lower = p["title"].lower()
        skills = []
        tier = 1
        badge = "🥇"
        category = "Applied ML / Research"
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
        elif "applied scientist" in title_lower or "applied ml" in title_lower or "research" in title_lower:
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

        job_entry = {
            "title": p["title"],
            "company": p["company"],
            "location": p["location"],
            "hours_ago": p.get("hours_ago", 3),
            "posted_at": p.get("posted_at", datetime.datetime.now().strftime("%Y-%m-%d %H:%M")),
            "source_type": "LinkedIn Post",
            "source_domain": "linkedin.com",
            "is_post": True,
            "post_author": p.get("post_author", "Hiring Lead"),
            "contact_email": p.get("contact_email"),
            "url": p["url"],
            "raw_description": p.get("raw_description", ""),
            "company_url": p.get("company_url"),
            "score": score,
            "tier": tier,
            "priority": priority,
            "badge": badge,
            "category": category,
            "is_fresher": True,
            "matched_skills": skills,
            "missing_skills": [],
            "description": p.get("raw_description", "")
        }

        existing_jobs.append(job_entry)
        added_count += 1

    # Recalculate stats
    primary_count = sum(1 for j in existing_jobs if j.get("priority") == "Primary" or j.get("tier") in [1, 2, 3, 4, 5, 6, 7])
    secondary_count = sum(1 for j in existing_jobs if j.get("priority") == "Secondary" or j.get("tier") == 8)
    adjacent_count = sum(1 for j in existing_jobs if j.get("tier") == 9)
    total_count = len(existing_jobs)

    data["jobs"] = existing_jobs
    data["stats"]["total_matches"] = total_count
    data["stats"]["primary_matches"] = primary_count
    data["stats"]["secondary_matches"] = secondary_count
    data["stats"]["adjacent_matches"] = adjacent_count

    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    with open("data.js", "w", encoding="utf-8") as f:
        f.write("window.JOB_MATCHER_DATA = " + json.dumps(data, indent=2, ensure_ascii=False) + ";\n")

    with open("docs/data.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    with open("docs/data.js", "w", encoding="utf-8") as f:
        f.write("window.JOB_MATCHER_DATA = " + json.dumps(data, indent=2, ensure_ascii=False) + ";\n")

    print(f"Successfully added {added_count} individual public posts. Total catalog now: {total_count} jobs.")
    print(f"Primary: {primary_count}, Secondary: {secondary_count}, Optional/Adjacent: {adjacent_count}")

if __name__ == "__main__":
    main()
