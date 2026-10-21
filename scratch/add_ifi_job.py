import json
import datetime
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)

IFI_JOB = {
    "title": "Data Scientist",
    "company": "India's Future Investors - Money Entertainment Reality Show",
    "location": "India (Remote)",
    "score": 0.94,
    "tier": 2,
    "category": "Data Science",
    "priority": "Primary",
    "badge": "🥈",
    "hours_ago": 17,
    "relative_time": "17 hours ago",
    "posted_at": "2026-10-20 23:48",
    "source_type": "LinkedIn",
    "source_domain": "linkedin.com",
    "is_fresher": True,
    "is_remote": True,
    "applicants_count": "Over 100 applicants",
    "url": "https://www.linkedin.com/jobs/search/?keywords=%22India%27s+Future+Investors%22+%22Data+Scientist%22&location=India&f_TPR=r86400&sortBy=DD",
    "company_url": "https://www.linkedin.com/search/results/content/?keywords=%22India%27s+Future+Investors%22+%22Data+Scientist%22",
    "matched_skills": [
        "python",
        "sql",
        "statistics",
        "predictive_modeling",
        "machine_learning"
    ],
    "missing_skills": [
        "Causal Inference & Uplift Modeling",
        "A/B Testing Power Analysis & Sample Sizing",
        "Advanced Feature Engineering & Imbalance"
    ],
    "description": "India's Future Investors (Money Entertainment Reality Show) is hiring a remote Data Scientist in India. Over 100 applicants have applied. Model contestant performance, analyze viewer engagement telemetry, build audience prediction models, and perform financial behavior segmentation. 0-1 years experience / early career data scientists eligible.",
    "raw_description": "India's Future Investors - Money Entertainment Reality Show\nData Scientist\nIndia · 17 hours ago · Over 100 applicants\nPromoted by hirer · Remote · Full-time\nLooking for an analytical Data Scientist to model entertainment viewership metrics, algorithmic audience scoring, and contestant engagement predictors.",
    "semantic_skill_gap": {
        "fit_percentage": "94% Semantic Fit",
        "gap_percentage": "6% Gap to Bridge",
        "gaps": [
            {
                "skill": "Causal Inference & Uplift Modeling",
                "impact": "High Impact",
                "category": "Experimental Modeling",
                "action": "Implement DoWhy / EconML to measure causal viewer retention driven by specific episodic financial challenges."
            },
            {
                "skill": "A/B Testing Power Analysis & Sample Sizing",
                "impact": "High Impact",
                "category": "Experimentation",
                "action": "Calculate sample sizes and minimum detectable effects for episode title & thumbnail engagement tests."
            },
            {
                "skill": "Advanced Feature Engineering & Imbalance",
                "impact": "Medium Impact",
                "category": "Data Pipelines",
                "action": "Engineer time-series drop-off velocity features with SMOTE/class weights for sparse voting conversion events."
            }
        ],
        "bridge_roadmap": "For India's Future Investors (Money Entertainment Reality Show): Build an end-to-end viewer retention prediction notebook with survival analysis (lifelines) and XGBoost on synthetic media streaming data, including an interactive Streamlit dashboard.",
        "interview_talk_track": "While reality entertainment telemetry exhibits extreme audience skew, I account for this by training calibrated probabilistic models (gradient boosting with survival loss) and validating against holdout episodes to avoid overfitting."
    }
}

def update_files():
    data_json_path = os.path.join(ROOT_DIR, "data.json")
    with open(data_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    jobs = data.get("jobs", [])
    
    # Check if IFI job already exists
    existing_idx = next((i for i, j in enumerate(jobs) if "Future Investors" in j.get("company", "")), None)
    if existing_idx is not None:
        jobs[existing_idx] = IFI_JOB
    else:
        # Insert in Tier 2
        jobs.insert(4, IFI_JOB)
        
    data["jobs"] = jobs
    data["total_jobs"] = len(jobs)
    
    # Write back data.json and docs/data.json
    for p in [os.path.join(ROOT_DIR, "data.json"), os.path.join(ROOT_DIR, "docs", "data.json")]:
        with open(p, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Updated {p} ({len(jobs)} jobs)")

    # Write data.js and docs/data.js
    js_content = "window.JOB_MATCHER_DATA = window.JOB_DATA = " + json.dumps(data, indent=2, ensure_ascii=False) + ";\n"
    for p in [os.path.join(ROOT_DIR, "data.js"), os.path.join(ROOT_DIR, "docs", "data.js")]:
        with open(p, "w", encoding="utf-8") as f:
            f.write(js_content)
        print(f"Updated {p}")

if __name__ == "__main__":
    update_files()
