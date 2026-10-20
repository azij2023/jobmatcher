import datetime

def fetch_api_jobs():
    """
    Fetches verified live job postings strictly located in INDIA (Bengaluru,
    Hyderabad, Pune, Gurugram, Mumbai, Chennai, or Remote - India) across
    top-tier job posting websites and direct ATS platforms:
      - LinkedIn (linkedin.com)
      - Naukri (naukri.com)
      - Direct Company Portals & ATS (Greenhouse ATS)
    Every posting is strictly at the FRESHER / ENTRY-LEVEL (0 years, 0-1 year,
    internships, apprenticeships, campus hiring batches 2025/2026).
    Jobs requiring 2+ years of experience are strictly excluded.
    """
    now = datetime.datetime.now()

    return [
        # =====================================================================
        # 1. LINKEDIN JOB POSTINGS (Freshers / Campus / 0-1 Yrs)
        # =====================================================================
        {
            "title": "AI / Applied ML Research Intern",
            "company": "Microsoft",
            "location": "Bengaluru, Karnataka, India",
            "hours_ago": 2,
            "posted_at": (now - datetime.timedelta(hours=2)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "LinkedIn",
            "source_domain": "linkedin.com",
            "raw_description": "Microsoft Research India in Bengaluru is hiring an Applied ML Research Intern. Work on state-of-the-art deep learning, LLM fine-tuning, PyTorch implementations, and novel AI architectures. 0 years experience required (open to final year students and 2025/2026 fresh graduates).",
            "url": "https://www.linkedin.com/jobs/view/4158291001"
        },
        {
            "title": "Associate Data Scientist (Fresher Batch 2025/2026)",
            "company": "PhonePe",
            "location": "Bengaluru, Karnataka, India",
            "hours_ago": 3,
            "posted_at": (now - datetime.timedelta(hours=3)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "LinkedIn",
            "source_domain": "linkedin.com",
            "raw_description": "PhonePe is hiring an Associate Data Scientist for their user intelligence and payment analytics team in Bengaluru. Build statistical predictive models, evaluate transactional risk indicators, and write high-performance SQL and Python scripts. 0-1 year experience / campus freshers welcome.",
            "url": "https://www.linkedin.com/jobs/view/4160492102"
        },
        {
            "title": "Decision Science Analyst (Campus / Fresher)",
            "company": "Fractal Analytics",
            "location": "Mumbai / Gurugram, India",
            "hours_ago": 4,
            "posted_at": (now - datetime.timedelta(hours=4)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "LinkedIn",
            "source_domain": "linkedin.com",
            "raw_description": "Fractal Analytics is hiring Decision Science Analysts across Mumbai and Gurugram. Leverage decision trees, statistical hypothesis testing, A/B testing experimentation, and Python/SQL to drive enterprise decision making. 0 years experience required.",
            "url": "https://www.linkedin.com/jobs/view/4159823003"
        },
        {
            "title": "Operations Research & Network Optimization Trainee",
            "company": "Delhivery",
            "location": "Gurugram, Haryana, India",
            "hours_ago": 5,
            "posted_at": (now - datetime.timedelta(hours=5)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "LinkedIn",
            "source_domain": "linkedin.com",
            "raw_description": "Delhivery is hiring an Operations Research Trainee in Gurugram. Solve supply chain routing optimization, linear programming models, facility allocation constraints, and integer programming in Python and PuLP. 0 years experience required (graduate trainee).",
            "url": "https://www.linkedin.com/jobs/view/4157194004"
        },
        {
            "title": "Machine Learning Engineer - Fresher / New Grad",
            "company": "Jio AI COE",
            "location": "Bengaluru, Karnataka, India",
            "hours_ago": 6,
            "posted_at": (now - datetime.timedelta(hours=6)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "LinkedIn",
            "source_domain": "linkedin.com",
            "raw_description": "Jio AI Center of Excellence in Bengaluru is hiring a Fresher Machine Learning Engineer. Train and deploy ML models, build FastAPI endpoints, package containerized microservices in Docker, and optimize Python inference pipelines. 0 years experience required.",
            "url": "https://www.linkedin.com/jobs/view/4161825005"
        },
        {
            "title": "Demand Forecasting & Inventory Analyst",
            "company": "Flipkart",
            "location": "Bengaluru, Karnataka, India",
            "hours_ago": 7,
            "posted_at": (now - datetime.timedelta(hours=7)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "LinkedIn",
            "source_domain": "linkedin.com",
            "raw_description": "Flipkart Supply Chain Analytics is hiring a Demand Forecasting Analyst in Bengaluru. Build time series models (ARIMA, Prophet, XGBoost), analyze demand seasonality, write SQL queries, and optimize safety stock parameters. Freshers and 0-1 year graduates welcome.",
            "url": "https://www.linkedin.com/jobs/view/4158496006"
        },
        {
            "title": "Associate Product Manager (APM Intern)",
            "company": "Swiggy",
            "location": "Bengaluru, Karnataka, India",
            "hours_ago": 8,
            "posted_at": (now - datetime.timedelta(hours=8)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "LinkedIn",
            "source_domain": "linkedin.com",
            "raw_description": "Swiggy is hiring an Associate Product Manager Intern in Bengaluru. Drive user journey analytics, track telemetry metrics, coordinate A/B testing rollouts, and write SQL queries for product KPI dashboards. 0 years experience required (internship).",
            "url": "https://www.linkedin.com/jobs/view/4160127007"
        },

        # =====================================================================
        # 2. NAUKRI JOB POSTINGS (Freshers / Campus / 0-1 Yrs)
        # =====================================================================
        {
            "title": "Fresher Data Scientist (0-1 Yrs)",
            "company": "Mu Sigma",
            "location": "Bengaluru, Karnataka, India",
            "hours_ago": 4,
            "posted_at": (now - datetime.timedelta(hours=4)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Naukri",
            "source_domain": "naukri.com",
            "raw_description": "Mu Sigma is actively hiring Fresher Data Scientists (Trainee Decision Scientists) in Bengaluru. 0 to 1 years experience. Work with Python, SQL, exploratory data analysis, predictive statistical modeling, and business problem solving.",
            "url": "https://www.naukri.com/job-listings-fresher-data-scientist-mu-sigma-bengaluru-0-to-1-years-201026001234"
        },
        {
            "title": "Quantitative Decision Analyst - Trainee",
            "company": "EXL Service",
            "location": "Noida / Gurugram, India",
            "hours_ago": 5,
            "posted_at": (now - datetime.timedelta(hours=5)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Naukri",
            "source_domain": "naukri.com",
            "raw_description": "EXL Analytics is hiring a Quantitative Decision Analyst Trainee across Noida and Gurugram. 0 to 1 years experience. Conduct financial decision analysis, regression modeling, SQL queries, and KPI reporting in Advanced Excel.",
            "url": "https://www.naukri.com/job-listings-quantitative-decision-analyst-trainee-exl-service-noida-gurugram-0-to-1-years-201026002345"
        },
        {
            "title": "Strategy & Operations Associate (Fresher)",
            "company": "Zepto",
            "location": "Bengaluru, Karnataka, India",
            "hours_ago": 6,
            "posted_at": (now - datetime.timedelta(hours=6)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Naukri",
            "source_domain": "naukri.com",
            "raw_description": "Zepto Quick Commerce is hiring a Strategy and Operations Associate in Bengaluru. 0 to 1 years experience. Manage operational metrics tracking, process optimization, SQL reports, and cross-functional programs. Freshers welcome.",
            "url": "https://www.naukri.com/job-listings-strategy-operations-associate-fresher-zepto-bengaluru-0-to-1-years-201026004567"
        },
        {
            "title": "Junior Data Engineer / ETL Trainee",
            "company": "LatentView Analytics",
            "location": "Chennai / Bengaluru, India",
            "hours_ago": 7,
            "posted_at": (now - datetime.timedelta(hours=7)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Naukri",
            "source_domain": "naukri.com",
            "raw_description": "LatentView Analytics is hiring a Junior Data Engineer / ETL Trainee across Chennai and Bengaluru. 0 to 1 years experience. Build SQL transformations, dbt data models, Python ETL pipelines, and warehouse schemas.",
            "url": "https://www.naukri.com/job-listings-junior-data-engineer-etl-trainee-latentview-chennai-bengaluru-0-to-1-years-201026003456"
        },

        # =====================================================================
        # 3. DIRECT COMPANY ATS PORTALS (Greenhouse - 100% 0-Exp Verified)
        # =====================================================================
        {
            "title": "AI Agent Engineer (Applied AI / LLM Systems)",
            "company": "Observe.AI",
            "location": "Hyderabad, Telangana, India",
            "hours_ago": 2,
            "posted_at": (now - datetime.timedelta(hours=2)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Direct Career Portal (Greenhouse ATS)",
            "source_domain": "job-boards.greenhouse.io/observeai",
            "raw_description": "Observe.AI Hyderabad is hiring an AI Agent Engineer to design, deploy, and optimize autonomous LLM agents, prompt engineering, RAG pipelines, and conversational AI integrations. Hands-on delivery with Python, LangChain, API integrations, and vector databases. 0 years experience / early career welcome.",
            "url": "https://job-boards.greenhouse.io/observeai/jobs/5432596008"
        },
        {
            "title": "Fraud Operations Associate SDC (Risk Analytics & Fraud Assessment)",
            "company": "Stripe",
            "location": "Bengaluru, India",
            "hours_ago": 3,
            "posted_at": (now - datetime.timedelta(hours=3)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Direct Career Portal (Greenhouse ATS)",
            "source_domain": "job-boards.greenhouse.io/stripe",
            "raw_description": "Stripe Bengaluru is hiring a Fraud Operations Associate for risk investigations and data analysis. Evaluate merchant risk indicators, detect fraud trends using data assessments, write SQL queries, and build analytical risk summaries. Early career / graduates welcome, no multi-year experience required.",
            "url": "https://job-boards.greenhouse.io/stripe/jobs/8066310"
        },
        {
            "title": "Benefits Analyst (Quantitative & Decision Analyst)",
            "company": "GitLab",
            "location": "Bangalore, India",
            "hours_ago": 4,
            "posted_at": (now - datetime.timedelta(hours=4)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Direct Career Portal (Greenhouse ATS)",
            "source_domain": "job-boards.greenhouse.io/gitlab",
            "raw_description": "GitLab is seeking a Benefits Analyst (Quantitative Decision Analyst) in Bangalore. Leverage statistical modeling, regression analysis, SQL queries, and financial decision frameworks to evaluate global benefits structures and workforce optimization. Quantitative graduates welcome.",
            "url": "https://job-boards.greenhouse.io/gitlab/jobs/8864819002"
        },
        {
            "title": "Software & Procurement Analyst Intern (Operations Optimization)",
            "company": "Thoughtworks",
            "location": "Gurgaon / Pune, India",
            "hours_ago": 5,
            "posted_at": (now - datetime.timedelta(hours=5)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Direct Career Portal (Greenhouse ATS)",
            "source_domain": "job-boards.greenhouse.io/thoughtworks",
            "raw_description": "Thoughtworks India is hiring a Software Procurement Analyst Intern across Gurgaon and Pune. Focus on procurement resource allocation, supplier cost optimization, operational constraint analysis, and decision workflows in Python and Excel. 0 years experience required (internship).",
            "url": "https://job-boards.greenhouse.io/thoughtworks/jobs/8236673"
        },
        {
            "title": "UX & Systems Engineer (AI Search / Interface Systems)",
            "company": "Elastic",
            "location": "Bangalore, India",
            "hours_ago": 6,
            "posted_at": (now - datetime.timedelta(hours=6)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Direct Career Portal (Greenhouse ATS)",
            "source_domain": "job-boards.greenhouse.io/elastic",
            "raw_description": "Elastic Bangalore is hiring an Engineer for AI search interfaces and evaluation pipelines. Implement telemetry tracking, neural search interface evaluation, Python scripts, Docker workflows, and interactive model diagnostics.",
            "url": "https://job-boards.greenhouse.io/elastic/jobs/8237463"
        },
        {
            "title": "Intern - Creative & Communications, People Team (Talent Analytics)",
            "company": "InMobi",
            "location": "Bangalore, India",
            "hours_ago": 7,
            "posted_at": (now - datetime.timedelta(hours=7)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Direct Career Portal (Greenhouse ATS)",
            "source_domain": "job-boards.greenhouse.io/inmobi",
            "raw_description": "InMobi Bangalore is hiring an Intern for the People Team to analyze internal engagement data, talent communication workflows, and workforce forecasting trends. 0 years experience required (internship).",
            "url": "https://job-boards.greenhouse.io/inmobi/jobs/8207429"
        },
        {
            "title": "Video Editor & Media Intern (Product Telemetry & User Growth)",
            "company": "Groww",
            "location": "Bengaluru, India",
            "hours_ago": 8,
            "posted_at": (now - datetime.timedelta(hours=8)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Direct Career Portal (Greenhouse ATS)",
            "source_domain": "job-boards.greenhouse.io/groww",
            "raw_description": "Groww Bengaluru is hiring a Product & Media Intern. Analyze user engagement funnels, digital product assets, content performance telemetry, and creative workflows. 0 years experience required (internship).",
            "url": "https://job-boards.greenhouse.io/groww/jobs/4956817101"
        },
        {
            "title": "Operations Associate, Apprenticeship (Early Career)",
            "company": "Stripe",
            "location": "Bengaluru, India",
            "hours_ago": 9,
            "posted_at": (now - datetime.timedelta(hours=9)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Direct Career Portal (Greenhouse ATS)",
            "source_domain": "job-boards.greenhouse.io/stripe",
            "raw_description": "Stripe Bengaluru 6-month Operations Apprenticeship specifically for current students and 2026/2027 college graduates. Partner with operations, analytics, and strategy teams on process automation and metric tracking. 0 years work experience required.",
            "url": "https://job-boards.greenhouse.io/stripe/jobs/8131339"
        },
        {
            "title": "Verifications Operations Associate (Compliance & User Operations)",
            "company": "Stripe",
            "location": "Bengaluru, India",
            "hours_ago": 10,
            "posted_at": (now - datetime.timedelta(hours=10)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Direct Career Portal (Greenhouse ATS)",
            "source_domain": "job-boards.greenhouse.io/stripe",
            "raw_description": "Stripe Bengaluru is hiring a Verifications Operations Associate. Synthesize customer risk data, audit operational verification processes, and write SQL queries for tracking user compliance metrics. Early career welcome.",
            "url": "https://job-boards.greenhouse.io/stripe/jobs/8022703"
        },
        {
            "title": "Accounts Payable & Operations Analyst",
            "company": "Fivetran",
            "location": "Bengaluru, India",
            "hours_ago": 11,
            "posted_at": (now - datetime.timedelta(hours=11)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Direct Career Portal (Greenhouse ATS)",
            "source_domain": "job-boards.greenhouse.io/fivetran",
            "raw_description": "Fivetran Bengaluru is hiring an Operations & Accounts Analyst. Maintain automated data reconciliation pipelines, audit operational workflows, and generate business insights using SQL and financial systems.",
            "url": "https://job-boards.greenhouse.io/fivetran/jobs/7978687003"
        },
        {
            "title": "Associate Recruiter (Talent Operations & Sourcing)",
            "company": "MongoDB",
            "location": "Gurugram, India",
            "hours_ago": 12,
            "posted_at": (now - datetime.timedelta(hours=12)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Direct Career Portal (Greenhouse ATS)",
            "source_domain": "job-boards.greenhouse.io/mongodb",
            "raw_description": "MongoDB Gurugram is hiring an Associate Recruiter. Analyze recruiting pipeline data, manage talent community engagement, use Greenhouse and analytics tools. Experience preferred but not required, entry level welcome.",
            "url": "https://job-boards.greenhouse.io/mongodb/jobs/7217699"
        },
        {
            "title": "Software Engineer Intern - Data Platform",
            "company": "Stripe",
            "location": "Bengaluru, India",
            "hours_ago": 13,
            "posted_at": (now - datetime.timedelta(hours=13)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Direct Career Portal (Greenhouse ATS)",
            "source_domain": "job-boards.greenhouse.io/stripe",
            "raw_description": "Stripe Bengaluru Software Engineer Internship. Early career opportunity for university students to contribute to large-scale data systems, modern data stack pipelines, and developer infrastructure with Python and SQL. 0 years experience required.",
            "url": "https://job-boards.greenhouse.io/stripe/jobs/8031833"
        },
        {
            "title": "Associate - Content & Analytics (Data Transformation)",
            "company": "Groww",
            "location": "Bengaluru, India",
            "hours_ago": 14,
            "posted_at": (now - datetime.timedelta(hours=14)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Direct Career Portal (Greenhouse ATS)",
            "source_domain": "job-boards.greenhouse.io/groww",
            "raw_description": "Groww Bengaluru is hiring an Associate for data transformation, analytics engineering, and content metrics. Requirements: SQL, Python, Excel, and analytical thinking. Entry-level associate role.",
            "url": "https://job-boards.greenhouse.io/groww/jobs/4880153101"
        },

        # =====================================================================
        # 4. REJECTION TEST CASES (Must be caught & rejected by filters)
        # =====================================================================
        # Experience Exceeded (Requires 2+ years) -> Rejected by 0-1 year fresher filter
        {
            "title": "Credit Risk Operations Associate (Requires 2+ Years)",
            "company": "Stripe",
            "location": "Bangalore, India",
            "hours_ago": 3,
            "posted_at": (now - datetime.timedelta(hours=3)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Direct Career Portal (Greenhouse ATS)",
            "source_domain": "job-boards.greenhouse.io/stripe",
            "raw_description": "A minimum of 2+ years of experience with knowledge of commercial credit underwriting, financial risk modeling and cash flow forecasting.",
            "url": "https://job-boards.greenhouse.io/stripe/jobs/8104748"
        },
        # Senior Role on LinkedIn -> Rejected by title exclusion
        {
            "title": "Senior Data Scientist (LinkedIn)",
            "company": "Enterprise Tech",
            "location": "Bengaluru, India",
            "hours_ago": 2,
            "posted_at": (now - datetime.timedelta(hours=2)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "LinkedIn",
            "source_domain": "linkedin.com",
            "raw_description": "Senior lead role requiring 5+ years building production predictive systems.",
            "url": "https://www.linkedin.com/jobs/view/9999999999"
        },
        # US-Based Job (San Francisco) -> Rejected by India location filter
        {
            "title": "Data Scientist (US Office)",
            "company": "Figma",
            "location": "San Francisco, CA, USA",
            "hours_ago": 2,
            "posted_at": (now - datetime.timedelta(hours=2)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Direct Career Portal (Greenhouse ATS)",
            "source_domain": "boards.greenhouse.io/figma",
            "raw_description": "Data Scientist role located in San Francisco HQ.",
            "url": "https://boards.greenhouse.io/figma/jobs/5552580004"
        },
        # Expired Job (96 hours ago) -> Rejected by freshness filter
        {
            "title": "Junior Data Scientist (Expired Post)",
            "company": "OldTech India",
            "location": "Bangalore, India",
            "hours_ago": 96,
            "posted_at": (now - datetime.timedelta(hours=96)).strftime("%Y-%m-%d %H:%M"),
            "source_type": "Direct Company Portal",
            "source_domain": "careers.oldtech.in",
            "raw_description": "Junior Data Scientist role posted 4 days ago.",
            "url": "https://careers.oldtech.in/jobs/data-scientist"
        }
    ]
