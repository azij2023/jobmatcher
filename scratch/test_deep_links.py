import re
import urllib.parse

def clean_job_title(title: str) -> str:
    """
    Cleans noisy parenthetical subtitles or extra notes from the job title
    so the search engine matches the actual job requisition accurately.
    Example: 'Associate Applied Scientist (GenAI & Recommendations)' -> 'Associate Applied Scientist'
    """
    # Remove content in parentheses
    cleaned = re.sub(r'\(.*?\)', '', title)
    # Remove content after hyphen if it denotes sub-team or notes like '- Fresher' or '- Campus'
    cleaned = re.sub(r'-\s*(Fresher|Campus|Early Career|0-1 Yrs|Batch\s*\d+).*', '', cleaned, flags=re.IGNORECASE)
    # Clean multiple spaces
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned or title

def build_linkedin_jobs_url(title: str, company: str = "") -> str:
    clean_title = clean_job_title(title)
    # Combine title and company for focused requisition search, or title alone for guaranteed high-yield live posts
    kw = f"{clean_title} {company}".strip()
    encoded_kw = urllib.parse.quote_plus(kw)
    return f"https://www.linkedin.com/jobs/search/?keywords={encoded_kw}&location=India&f_TPR=r86400&f_E=1%2C2"

def build_naukri_jobs_url(title: str) -> str:
    clean_title = clean_job_title(title)
    slug = re.sub(r'[^a-z0-9]+', '-', clean_title.lower()).strip('-')
    return f"https://www.naukri.com/{slug}-jobs-in-india?experience=0"

# Test samples
samples = [
    ("Associate Applied Scientist (GenAI & Recommendations)", "Flipkart"),
    ("Data Scientist I (Analytics & Personalization - Fresher)", "Swiggy"),
    ("Decision Science Analyst (Pricing & Logistics)", "Meesho"),
    ("Operations Research Analyst - Network Optimization", "Delhivery"),
    ("Junior AI Agent & LLM Engineer", "Sarvam AI")
]

for title, comp in samples:
    clean = clean_job_title(title)
    li = build_linkedin_jobs_url(title, comp)
    nk = build_naukri_jobs_url(title)
    print(f"Original: {title} @ {comp}")
    print(f"Clean:    {clean}")
    print(f"LinkedIn: {li}")
    print(f"Naukri:   {nk}")
    print("-" * 50)
