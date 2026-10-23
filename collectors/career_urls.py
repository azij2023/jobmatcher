"""
TargetMatch AI - Deep Requisition & Live Job Link Builder
Builds direct deep links to live entry-level job requisitions on LinkedIn and Naukri,
pre-filtered strictly to India, Past 24 Hours, and 0–1 Years Experience (Freshers & Interns).
"""

import re
import urllib.parse

def clean_job_title(title: str) -> str:
    """
    Cleans noisy parenthetical subtitles or extra notes from the job title
    so the search engine matches the actual job requisition accurately.
    Example: 'Associate Applied Scientist (GenAI & Recommendations)' -> 'Associate Applied Scientist'
    """
    if not title:
        return ""
    # Remove content in parentheses
    cleaned = re.sub(r'\(.*?\)', '', title)
    # Remove notes like '- Fresher', '- Campus', '- Early Career'
    cleaned = re.sub(r'-\s*(Fresher|Campus|Early Career|0-1 Yrs|Batch\s*\d+).*', '', cleaned, flags=re.IGNORECASE)
    # Clean multiple spaces
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned or title

def build_linkedin_jobs_url(title: str, company: str = "") -> str:
    """
    Builds a direct link to live LinkedIn job requisitions pre-filtered to:
      - Location: India
      - Freshness: Past 24 hours (f_TPR=r86400)
      - Experience level: Internship (1) & Entry Level (2) (f_E=1,2)
    """
    clean_title = clean_job_title(title)
    kw = f"{clean_title} {company}".strip()
    encoded_kw = urllib.parse.quote_plus(kw)
    return f"https://www.linkedin.com/jobs/search/?keywords={encoded_kw}&location=India&f_TPR=r86400&f_E=1%2C2"

def build_naukri_jobs_url(title: str) -> str:
    """
    Builds a direct link to live Naukri job requisitions pre-filtered to:
      - Location: India
      - Experience: 0 years (experience=0)
    """
    clean_title = clean_job_title(title)
    slug = re.sub(r'[^a-z0-9]+', '-', clean_title.lower()).strip('-')
    return f"https://www.naukri.com/{slug}-jobs-in-india?experience=0"
