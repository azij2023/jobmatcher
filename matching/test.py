import json
import sys

# Ensure UTF-8 output on Windows console
if sys.platform.startswith("win"):
    sys.stdout.reconfigure(encoding="utf-8")

from matching.scoring import score_job

profile = json.load(open("profile.json", encoding="utf-8"))

test_jobs = [
    {
        "title": "Junior Applied Scientist",
        "role_type": "applied scientist",
        "role_category": "Applied ML / Research",
        "seniority": "junior",
        "location": "bangalore",
        "required_skills": ["python", "deep_learning", "pytorch", "machine_learning"],
        "nice_to_have": ["llms"],
        "min_years_experience": 1
    },
    {
        "title": "Product Data Scientist - Growth",
        "role_type": "product data scientist",
        "role_category": "Data Science",
        "seniority": "associate",
        "location": "hyderabad",
        "required_skills": ["python", "sql", "experimentation", "ab_testing", "product_analytics"],
        "nice_to_have": ["causal_inference"],
        "min_years_experience": 0
    },
    {
        "title": "Associate Decision Scientist",
        "role_type": "decision scientist",
        "role_category": "Decision Science",
        "seniority": "entry_level",
        "location": "remote_india",
        "required_skills": ["sql", "python", "statistical_modeling", "decision_analysis"],
        "nice_to_have": ["power_bi"],
        "min_years_experience": 1
    },
    {
        "title": "Junior Operations Research Scientist",
        "role_type": "or scientist",
        "role_category": "OR / Optimization",
        "seniority": "junior",
        "location": "gurgaon",
        "required_skills": ["python", "operations_research", "linear_programming", "optimization"],
        "nice_to_have": ["pulp"],
        "min_years_experience": 0
    },
    {
        "title": "Junior Machine Learning Engineer (Applied)",
        "role_type": "machine learning engineer",
        "role_category": "ML Engineering",
        "seniority": "junior",
        "location": "bangalore",
        "required_skills": ["python", "machine_learning", "scikit_learn", "docker", "fastapi"],
        "nice_to_have": ["aws"],
        "min_years_experience": 1
    },
    {
        "title": "Time Series Forecasting Analyst",
        "role_type": "forecasting analyst",
        "role_category": "Forecasting",
        "seniority": "fresher",
        "location": "pune",
        "required_skills": ["python", "time_series", "forecasting", "pandas"],
        "nice_to_have": ["arima", "xgboost"],
        "min_years_experience": 0
    },
    {
        "title": "Associate Product Manager (APM)",
        "role_type": "associate product manager",
        "role_category": "Product",
        "seniority": "associate",
        "location": "bangalore",
        "required_skills": ["product_analytics", "problem_solving", "sql"],
        "nice_to_have": ["communication"],
        "min_years_experience": 0
    },
    {
        "title": "Strategy & Program Analyst",
        "role_type": "strategy analyst",
        "role_category": "Strategy / Programs",
        "seniority": "entry_level",
        "location": "mumbai",
        "required_skills": ["analytical_thinking", "excel", "problem_solving", "communication"],
        "nice_to_have": ["power_bi"],
        "min_years_experience": 1
    },
    {
        "title": "Junior Analytics Engineer",
        "role_type": "analytics engineer",
        "role_category": "Data Engineering Adjacent",
        "seniority": "junior",
        "location": "bangalore",
        "required_skills": ["sql", "dbt", "data_modeling", "analytics_engineering"],
        "nice_to_have": ["python"],
        "min_years_experience": 1
    },
    {
        "title": "Senior Staff Applied Scientist",
        "role_type": "applied scientist",
        "role_category": "Applied ML / Research",
        "seniority": "senior",
        "location": "bangalore",
        "required_skills": ["python", "pytorch"],
        "min_years_experience": 8
    },
    {
        "title": "Backend Java Engineer",
        "role_type": "backend engineer",
        "role_category": "Software Engineering",
        "seniority": "junior",
        "location": "mumbai",
        "required_skills": ["java", "spring_boot"],
        "min_years_experience": 0
    }
]

print("=" * 80)
print("ENTRY-LEVEL ROLE MAPPING TEST RESULTS")
print("=" * 80)

for job in test_jobs:
    job.setdefault("company", "Amazon")
    res = score_job(job, profile)
    status = "REJECTED" if res["rejected"] else "ACCEPTED"
    badge = res.get("badge", "[X]")
    tier_info = f"Tier {res.get('tier')} - {res.get('category')} ({res.get('priority')})" if not res["rejected"] else f"Reason: {res.get('rejection_reason')}"
    score_str = f"Score: {res['final_score']:.3f}" if not res["rejected"] else "Score: 0.0"
    
    print(f"\n{badge} [{status}] {job['title']}")
    print(f"   {tier_info}")
    print(f"   {score_str}")
    if not res["rejected"]:
        print(f"   Matched Skills: {res['matched_skills']}")
        print(f"   Skill Match Rate: {res['skill_match_rate'] * 100:.0f}%")
