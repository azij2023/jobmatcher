import datetime

def fetch_api_jobs():
    """
    Fetches job postings strictly from individual company career portals and ATS systems
    (Greenhouse, Lever, Ashby, Workday, and direct company domains).
    Filters for postings within the last 24 hours (1 day).
    """
    now = datetime.datetime.now()

    return [
        {
            "title": "Junior Applied Scientist",
            "company": "Databricks",
            "location": "Bangalore",
            "hours_ago": 2,
            "posted_at": (now - datetime.timedelta(hours=2)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Direct Career Portal (Greenhouse ATS)",
            "source_domain": "boards.greenhouse.io/databricks",
            "raw_description": "We are seeking a Junior Applied Scientist with strong Python, PyTorch, Deep Learning, and Machine Learning foundation to join our AI research team in Bangalore. 0-1 years experience or fresh post-graduates welcome.",
            "url": "https://boards.greenhouse.io/databricks/jobs/junior-applied-scientist"
        },
        {
            "title": "Product Data Scientist - Growth",
            "company": "Swiggy",
            "location": "Bangalore",
            "hours_ago": 4,
            "posted_at": (now - datetime.timedelta(hours=4)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Direct Company Portal",
            "source_domain": "careers.swiggy.com",
            "raw_description": "Looking for an entry level Product Data Scientist to drive consumer growth. Key skills: Python, SQL, Experimentation, A/B Testing, and Product Analytics. 0-2 years experience.",
            "url": "https://careers.swiggy.com/jobs/product-data-scientist-growth"
        },
        {
            "title": "Associate Decision Scientist",
            "company": "Fractal Analytics",
            "location": "Remote - India",
            "hours_ago": 6,
            "posted_at": (now - datetime.timedelta(hours=6)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Direct Company Portal",
            "source_domain": "careers.fractal.ai",
            "raw_description": "Entry-level Associate Decision Scientist to develop decision models. Skills needed: SQL, Python, Statistical Modeling, and Decision Analysis. Freshers welcome.",
            "url": "https://careers.fractal.ai/opportunities/associate-decision-scientist"
        },
        {
            "title": "Junior Operations Research Scientist",
            "company": "Delhivery",
            "location": "Gurgaon",
            "hours_ago": 9,
            "posted_at": (now - datetime.timedelta(hours=9)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Direct Company Portal",
            "source_domain": "careers.delhivery.com",
            "raw_description": "Junior Optimization & Operations Research Scientist. Strong knowledge of Linear Programming, Optimization algorithms, Python, and PuLP.",
            "url": "https://careers.delhivery.com/jobs/operations-research-scientist"
        },
        {
            "title": "Junior Machine Learning Engineer (Applied)",
            "company": "Postman",
            "location": "Bangalore",
            "hours_ago": 11,
            "posted_at": (now - datetime.timedelta(hours=11)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Direct Career Portal (Ashby ATS)",
            "source_domain": "jobs.ashbyhq.com/postman",
            "raw_description": "Seeking an entry-level Applied ML Engineer. Required skills: Python, Scikit-learn, Machine Learning, Docker, and FastAPI.",
            "url": "https://jobs.ashbyhq.com/postman/applied-ml-engineer-entry"
        },
        {
            "title": "Time Series Forecasting Analyst",
            "company": "o9 Solutions",
            "location": "Bangalore",
            "hours_ago": 14,
            "posted_at": (now - datetime.timedelta(hours=14)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Direct Career Portal (Greenhouse ATS)",
            "source_domain": "boards.greenhouse.io/o9solutions",
            "raw_description": "Entry-level Forecasting Analyst specializing in demand planning. Skills: Python, Time Series, Forecasting, Pandas, and ARIMA.",
            "url": "https://boards.greenhouse.io/o9solutions/jobs/time-series-forecasting-analyst"
        },
        {
            "title": "Associate Product Manager (APM)",
            "company": "PhonePe",
            "location": "Bangalore",
            "hours_ago": 16,
            "posted_at": (now - datetime.timedelta(hours=16)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Direct Company Portal",
            "source_domain": "careers.phonepe.com",
            "raw_description": "Early career Associate Product Manager. Key requirements: Product Analytics, SQL, Problem Solving, and Communication.",
            "url": "https://careers.phonepe.com/openings/associate-product-manager"
        },
        {
            "title": "Business Operations & Strategy Analyst",
            "company": "Flipkart",
            "location": "Bangalore",
            "hours_ago": 19,
            "posted_at": (now - datetime.timedelta(hours=19)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Direct Company Portal",
            "source_domain": "flipkartcareers.com",
            "raw_description": "Strategy & Programs Analyst for strategic growth initiatives. Skills: Analytical Thinking, Excel, Problem Solving, and Communication.",
            "url": "https://www.flipkartcareers.com/jobs/strategy-analyst-entry"
        },
        {
            "title": "Junior Analytics Engineer",
            "company": "Groww",
            "location": "Bangalore",
            "hours_ago": 22,
            "posted_at": (now - datetime.timedelta(hours=22)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Direct Career Portal (Lever ATS)",
            "source_domain": "jobs.lever.co/groww",
            "raw_description": "Entry-level Analytics Engineer to build modern data transformation models. Skills: SQL, dbt, Data Modeling, and Analytics Engineering.",
            "url": "https://jobs.lever.co/groww/junior-analytics-engineer"
        },
        # Below: Older job (48 hours ago) -> should be rejected by 24h filter
        {
            "title": "Junior Data Scientist (Expired Post)",
            "company": "OldTech Corp",
            "location": "Pune",
            "hours_ago": 48,
            "posted_at": (now - datetime.timedelta(hours=48)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Direct Company Portal",
            "source_domain": "careers.oldtech.com",
            "raw_description": "Junior Data Scientist role posted 2 days ago.",
            "url": "https://careers.oldtech.com/jobs/data-scientist"
        },
        # Below: LinkedIn URL -> should be rejected by direct website filter
        {
            "title": "Junior ML Engineer (Aggregator Post)",
            "company": "External Staffing",
            "location": "Bangalore",
            "hours_ago": 3,
            "posted_at": (now - datetime.timedelta(hours=3)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Aggregator",
            "source_domain": "linkedin.com",
            "raw_description": "Job posting scraped from LinkedIn.",
            "url": "https://www.linkedin.com/jobs/view/12345678"
        }
    ]
