import urllib.parse

def make_linkedin_url(title: str, location: str) -> str:
    query = f"{title} {location}".strip()
    return f"https://www.linkedin.com/jobs/search/?keywords={urllib.parse.quote_plus(query)}"

def fetch_api_jobs():
    return [
        {
            "title": "Junior Applied Scientist",
            "company": "DeepTech AI",
            "location": "Bangalore",
            "raw_description": "We are seeking a Junior Applied Scientist with strong Python, PyTorch, Deep Learning, and Machine Learning foundation to join our AI research team. 0-1 years experience or fresh post-graduates welcome.",
            "url": make_linkedin_url("Junior Applied Scientist", "Bangalore")
        },
        {
            "title": "Product Data Scientist - Growth",
            "company": "NextGen Unicorn",
            "location": "Hyderabad",
            "raw_description": "Looking for an entry level Product Data Scientist. Key skills: Python, SQL, Experimentation, A/B Testing, and Product Analytics. 0-2 years experience.",
            "url": make_linkedin_url("Product Data Scientist", "Hyderabad")
        },
        {
            "title": "Associate Decision Scientist",
            "company": "DecisionIQ Labs",
            "location": "Remote - India",
            "raw_description": "Entry-level Associate Decision Scientist to develop decision models. Skills needed: SQL, Python, Statistical Modeling, and Decision Analysis.",
            "url": make_linkedin_url("Associate Decision Scientist", "India")
        },
        {
            "title": "Junior Operations Research Scientist",
            "company": "LogiRoute Systems",
            "location": "Gurgaon",
            "raw_description": "Junior Optimization & Operations Research Scientist. Strong knowledge of Linear Programming, Optimization algorithms, Python, and PuLP.",
            "url": make_linkedin_url("Operations Research Scientist", "Gurgaon")
        },
        {
            "title": "Junior Machine Learning Engineer (Applied)",
            "company": "Nexus Robotics",
            "location": "Bangalore",
            "raw_description": "Seeking an entry-level Applied ML Engineer. Required skills: Python, Scikit-learn, Machine Learning, Docker, and FastAPI.",
            "url": make_linkedin_url("Junior Machine Learning Engineer", "Bangalore")
        },
        {
            "title": "Time Series Forecasting Analyst",
            "company": "RetailMatrix",
            "location": "Pune",
            "raw_description": "Entry-level Forecasting Analyst specializing in demand planning. Skills: Python, Time Series, Forecasting, Pandas, and ARIMA.",
            "url": make_linkedin_url("Forecasting Analyst", "Pune")
        },
        {
            "title": "Associate Product Manager (APM)",
            "company": "ProductFlow",
            "location": "Bangalore",
            "raw_description": "Early career Associate Product Manager. Key requirements: Product Analytics, SQL, Problem Solving, and Communication.",
            "url": make_linkedin_url("Associate Product Manager", "Bangalore")
        },
        {
            "title": "Business Operations & Strategy Analyst",
            "company": "QuantScale Ventures",
            "location": "Mumbai",
            "raw_description": "Strategy & Programs Analyst for strategic growth initiatives. Skills: Analytical Thinking, Excel, Problem Solving, and Communication.",
            "url": make_linkedin_url("Business Operations Strategy Analyst", "Mumbai")
        },
        {
            "title": "Junior Analytics Engineer",
            "company": "DataSphere Technologies",
            "location": "Kolkata",
            "raw_description": "Entry-level Analytics Engineer to build modern data transformation models. Skills: SQL, dbt, Data Modeling, and Analytics Engineering.",
            "url": make_linkedin_url("Junior Analytics Engineer", "Kolkata")
        },
        {
            "title": "Senior Staff Applied Scientist",
            "company": "MegaCorp AI",
            "location": "Bangalore",
            "raw_description": "Looking for a Senior Staff Applied Scientist with 8+ years experience leading research teams.",
            "url": make_linkedin_url("Senior Staff Applied Scientist", "Bangalore")
        }
    ]
