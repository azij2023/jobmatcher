"""
TargetMatch AI - Multi-Platform Deep Requisition & Live Job Link Builder
Comprehensive link generator across all top entry-level, tech, analytics,
and remote career channels (India & Global).
"""

import re
import urllib.parse

def clean_job_title(title: str) -> str:
    """Cleans noisy parenthetical subtitles or extra notes from the job title."""
    if not title:
        return ""
    cleaned = re.sub(r'\(.*?\)', '', title)
    cleaned = re.sub(r'-\s*(Fresher|Campus|Early Career|0-1 Yrs|Batch\s*\d+|India|Bengaluru|Bangalore|Hyderabad|Pune|Gurugram|Noida).*', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned or title

def title_to_slug(title: str) -> str:
    cleaned = clean_job_title(title)
    return re.sub(r'[^a-z0-9]+', '-', cleaned.lower()).strip('-')

# ==============================================================================
# 1. General (India)
# ==============================================================================

def build_linkedin_jobs_url(title: str, company: str = "") -> str:
    kw = f"{clean_job_title(title)} {company}".strip()
    encoded = urllib.parse.quote_plus(kw)
    return f"https://www.linkedin.com/jobs/search/?keywords={encoded}&location=India&f_TPR=r86400&f_E=1%2C2"

def build_naukri_jobs_url(title: str, company: str = "") -> str:
    slug = title_to_slug(title)
    if company:
        kw = urllib.parse.quote_plus(f"{clean_job_title(title)} {company}".strip())
        return f"https://www.naukri.com/{slug}-jobs-in-india?k={kw}&experience=0"
    return f"https://www.naukri.com/{slug}-jobs-in-india?experience=0"

def build_indeed_jobs_url(title: str, company: str = "") -> str:
    kw = f"{clean_job_title(title)} {company}".strip()
    encoded = urllib.parse.quote_plus(kw)
    return f"https://in.indeed.com/jobs?q={encoded}&l=India&fromage=1&explvl=entry_level"

def build_foundit_jobs_url(title: str, company: str = "") -> str:
    kw = f"{clean_job_title(title)} {company}".strip()
    encoded = urllib.parse.quote_plus(kw)
    return f"https://www.foundit.in/srp/results?query={encoded}&locations=India&experience=0"

def build_glassdoor_jobs_url(title: str, company: str = "") -> str:
    slug = title_to_slug(title)
    return f"https://www.glassdoor.co.in/Job/india-{slug}-jobs-SRCH_IL.0,5_IN115.htm?fromAge=1&seniorityType=entrylevel"

def build_shine_jobs_url(title: str, company: str = "") -> str:
    slug = title_to_slug(title)
    return f"https://www.shine.com/job-search/{slug}-jobs-in-india?experience=0"

def build_timesjobs_url(title: str, company: str = "") -> str:
    kw = f"{clean_job_title(title)} {company}".strip()
    encoded = urllib.parse.quote_plus(kw)
    return f"https://www.timesjobs.com/candidate/job-search.html?searchType=personalizedSearch&from=submit&txtKeywords={encoded}&cboWorkExp1=0"

# ==============================================================================
# 2. Tech / Startup
# ==============================================================================

def build_wellfound_jobs_url(title: str, company: str = "") -> str:
    kw = clean_job_title(title)
    encoded = urllib.parse.quote_plus(kw)
    return f"https://wellfound.com/jobs?role={encoded}&location=India"

def build_instahyre_jobs_url(title: str, company: str = "") -> str:
    kw = f"{clean_job_title(title)} {company}".strip()
    encoded = urllib.parse.quote_plus(kw)
    return f"https://www.instahyre.com/jobs-search?search={encoded}&experience=0"

def build_cutshort_jobs_url(title: str, company: str = "") -> str:
    kw = clean_job_title(title)
    encoded = urllib.parse.quote_plus(kw)
    return f"https://cutshort.io/jobs?query={encoded}&experience=0"

def build_hirist_jobs_url(title: str, company: str = "") -> str:
    kw = clean_job_title(title)
    encoded = urllib.parse.quote_plus(kw)
    return f"https://www.hirist.tech/search?keyword={encoded}&exp=0-1"

def build_ycombinator_jobs_url(title: str, company: str = "") -> str:
    kw = clean_job_title(title)
    encoded = urllib.parse.quote_plus(kw)
    return f"https://www.workatastartup.com/jobs?query={encoded}"

# ==============================================================================
# 3. Internships / Freshers
# ==============================================================================

def build_internshala_jobs_url(title: str) -> str:
    slug = title_to_slug(title)
    return f"https://internshala.com/internships/{slug}-internship/"

def build_unstop_jobs_url(title: str) -> str:
    kw = clean_job_title(title)
    encoded = urllib.parse.quote_plus(kw)
    return f"https://unstop.com/internships?keyword={encoded}"

def build_letsintern_jobs_url(title: str) -> str:
    slug = title_to_slug(title)
    return f"https://www.letsintern.com/internships/{slug}-internships"

def build_apna_jobs_url(title: str) -> str:
    kw = clean_job_title(title)
    encoded = urllib.parse.quote_plus(kw)
    return f"https://apna.co/jobs?q={encoded}&experience=0"

# ==============================================================================
# 4. Data / Analytics-Specific
# ==============================================================================

def build_analytics_vidhya_jobs_url(title: str) -> str:
    kw = clean_job_title(title)
    encoded = urllib.parse.quote_plus(kw)
    return f"https://jobs.analyticsvidhya.com/jobs?search={encoded}"

def build_kaggle_jobs_url() -> str:
    return "https://www.kaggle.com/jobs"

def build_aim_jobs_url(title: str = "") -> str:
    return "https://analyticsindiamag.com/careers/"

def build_data_elixir_jobs_url() -> str:
    return "https://dataelixir.com/jobs"

# ==============================================================================
# 5. Remote / Global
# ==============================================================================

def build_remoteok_jobs_url(title: str) -> str:
    slug = title_to_slug(title)
    return f"https://remoteok.com/remote-{slug}-jobs"

def build_weworkremotely_jobs_url(title: str) -> str:
    kw = clean_job_title(title)
    encoded = urllib.parse.quote_plus(kw)
    return f"https://weworkremotely.com/remote-jobs/search?term={encoded}"

def build_remotive_jobs_url(title: str) -> str:
    kw = clean_job_title(title)
    encoded = urllib.parse.quote_plus(kw)
    return f"https://remotive.com/remote-jobs?search={encoded}"

def build_workingnomads_jobs_url(title: str) -> str:
    kw = clean_job_title(title)
    encoded = urllib.parse.quote_plus(kw)
    return f"https://www.workingnomads.com/jobs?category=data&q={encoded}"

def build_otta_jobs_url() -> str:
    return "https://app.otta.com/jobs"

# ==============================================================================
# 6. Direct Tech & Analytics Company Career Portals
# ==============================================================================

DIRECT_COMPANY_PORTALS = {
    "Flipkart": "https://www.flipkartcareers.com/",
    "Swiggy": "https://careers.swiggy.com/",
    "Razorpay": "https://razorpay.com/jobs/",
    "PhonePe": "https://www.phonepe.com/careers/",
    "Meesho": "https://www.meesho.io/careers",
    "Fractal": "https://fractal.ai/careers/",
    "Fractal Analytics": "https://fractal.ai/careers/",
    "Mu Sigma": "https://www.mu-sigma.com/careers",
    "Tiger Analytics": "https://www.tigeranalytics.com/careers/",
    "Zomato": "https://www.zomato.com/careers",
    "CRED": "https://careers.cred.club/",
    "Zepto": "https://www.zeptonow.com/careers",
    "InMobi": "https://www.inmobi.com/company/careers",
    "Groww": "https://groww.in/careers",
    "Delhivery": "https://www.delhivery.com/careers",
    "Paytm": "https://paytm.com/careers",
    "Atlan": "https://atlan.com/careers/",
    "Postman": "https://www.postman.com/company/careers/",
    "BrowserStack": "https://www.browserstack.com/careers",
    "Yellow.ai": "https://yellow.ai/company/careers/",
}

def get_company_portal_url(company: str) -> str:
    for k, v in DIRECT_COMPANY_PORTALS.items():
        if k.lower() in company.lower() or company.lower() in k.lower():
            return v
    return ""

def build_multi_source_urls(title: str, company: str = "") -> dict:
    """Builds a structured dictionary of search URLs across all 6 categories."""
    return {
        "general_india": {
            "LinkedIn": build_linkedin_jobs_url(title, company),
            "Naukri": build_naukri_jobs_url(title, company),
            "Indeed India": build_indeed_jobs_url(title, company),
            "Foundit": build_foundit_jobs_url(title, company),
            "Glassdoor": build_glassdoor_jobs_url(title, company),
            "Shine": build_shine_jobs_url(title, company),
            "TimesJobs": build_timesjobs_url(title, company)
        },
        "tech_startup": {
            "Wellfound": build_wellfound_jobs_url(title, company),
            "Instahyre": build_instahyre_jobs_url(title, company),
            "Cutshort": build_cutshort_jobs_url(title, company),
            "Hirist": build_hirist_jobs_url(title, company),
            "YC Work at a Startup": build_ycombinator_jobs_url(title, company)
        },
        "internships_freshers": {
            "Internshala": build_internshala_jobs_url(title),
            "Unstop": build_unstop_jobs_url(title),
            "LetsIntern": build_letsintern_jobs_url(title),
            "Apna": build_apna_jobs_url(title)
        },
        "data_analytics": {
            "Analytics Vidhya": build_analytics_vidhya_jobs_url(title),
            "Kaggle Jobs": build_kaggle_jobs_url(),
            "AIM Jobs": build_aim_jobs_url(title),
            "Data Elixir": build_data_elixir_jobs_url()
        },
        "remote_global": {
            "RemoteOK": build_remoteok_jobs_url(title),
            "We Work Remotely": build_weworkremotely_jobs_url(title),
            "Remotive": build_remotive_jobs_url(title),
            "Working Nomads": build_workingnomads_jobs_url(title),
            "Otta": build_otta_jobs_url()
        },
        "direct_company_portal": get_company_portal_url(company) or (f"https://www.google.com/search?q={urllib.parse.quote_plus(company + ' careers')}" if company else "")
    }
