"""
Indian Companies Direct Career Sites & Official ATS Collector
TargetMatch AI - Direct Requisition Engine

Fetches employer requisitions with fresher eligibility evidence from public
Greenhouse, Lever, Ashby and SmartRecruiters feeds. Unavailable boards return
no results. Dates, descriptions and application URLs come from employer records.
"""

import urllib.request
import urllib.parse
import json
import re
import datetime
import html as html_lib

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
}

# Indian tech employers with Greenhouse ATS boards
GREENHOUSE_COMPANIES = [
    ("groww", "Groww", "https://groww.in"),
    ("inmobi", "InMobi", "https://www.inmobi.com"),
    ("slice", "Slice", "https://slice.careers"),
    ("postman", "Postman", "https://www.postman.com"),
    ("clevertap", "CleverTap", "https://clevertap.com"),
    ("browserstack", "BrowserStack", "https://www.browserstack.com"),
    ("yellowai", "Yellow.ai", "https://yellow.ai"),
    ("urbancompany", "Urban Company", "https://www.urbancompany.com"),
]

# Indian tech employers with Lever ATS boards
LEVER_COMPANIES = [
    ("paytm", "Paytm", "https://paytm.com"),
    ("meesho", "Meesho", "https://www.meesho.com"),
    ("cred", "CRED", "https://cred.club"),
    ("fampay", "FamPay", "https://fampay.in"),
    ("fi", "Fi Money", "https://fi.money"),
    ("pocketfm", "Pocket FM", "https://pocketfm.com"),
    ("zeta", "Zeta", "https://www.zeta.tech"),
]

# Indian tech employers with Ashby ATS boards
ASHBY_COMPANIES = [
    ("atlan", "Atlan", "https://atlan.com"),
    ("navi", "Navi", "https://navi.com"),
    ("toplyne", "Toplyne", "https://toplyne.io"),
    ("squadstack", "SquadStack", "https://www.squadstack.com"),
]

# Indian tech employers with SmartRecruiters ATS boards
SMARTRECRUITERS_COMPANIES = [
    ("swiggy", "Swiggy", "https://careers.swiggy.com"),
    ("freshworks", "Freshworks", "https://www.freshworks.com"),
]

from concurrent.futures import ThreadPoolExecutor

ROLE_KEYWORDS = [
    "data scientist", "data science", "applied scientist", "applied ml",
    "data analyst", "data analytics", "machine learning", "decision scientist",
    "operations research", "product analyst", "research intern",
    "ai engineer", "ai applied", "quantitative analyst", "analytics",
    "statistician", "decision science", "optimization", "product research",
    "risk analyst", "credit risk", "analytics specialist", "research scientist",
    "ml engineer", "business analyst", "product manager i", "associate product manager", "apm"
]

EXCLUDE_TITLES = [
    "senior", "sr.", "lead", "principal", "director", "head of", "vp",
    "staff", "architect", "5+", "6+", "7+", "8+", "10+", "years experience", "yr exp", "yrs exp",
    " iii", " iv", " v", " vi"
]

def is_relevant_role(title: str) -> bool:
    t = title.lower()
    if any(bad in t for bad in EXCLUDE_TITLES):
        return False
    if re.search(r'\b(?:[3-9]|\d{2,})\+?\s*(?:-|to)?\s*\d*\s*(?:years?|yrs?)\b', t):
        return False
    # If title contains 'manager', only allow APM, Product Manager I, or Decision Science / Analytics Manager
    if "manager" in t:
        if not ("associate product manager" in t or "product manager i" in t or "apm" in t or "decision science" in t or "analytics" in t or "risk" in t):
            return False
    # Direct match on role keywords
    if any(k in t for k in ROLE_KEYWORDS):
        return True
    # Contextual combinations
    if "analyst" in t and any(w in t for w in ["data", "risk", "business", "product", "growth", "operations", "pricing", "financial", "bi", "reporting", "credit"]):
        return True
    if "scientist" in t and any(w in t for w in ["data", "applied", "research", "decision", "machine learning", "ml", "ai"]):
        return True
    if "engineer" in t and any(w in t for w in ["machine learning", "ml", "ai", "deep learning", "computer vision", "nlp", "llm"]):
        return True
    return False

def is_direct_company_job_url(url):
    """Require a requisition path, rather than an ATS board or career homepage."""
    try:
        parsed = urllib.parse.urlsplit(url or "")
    except ValueError:
        return False
    if parsed.scheme not in ("http", "https"):
        return False
    host, path = (parsed.hostname or "").lower(), parsed.path.rstrip("/")
    patterns = {
        "greenhouse.io": r"/[^/]+/jobs/\d+(?:/.*)?$",
        "lever.co": r"/[^/]+/[0-9a-f-]{36}(?:/apply)?$",
        "ashbyhq.com": r"/[^/]+/[0-9a-f-]{36}(?:/application)?$",
        "smartrecruiters.com": r"/[^/]+/\d+[^/]*$",
        "myworkdayjobs.com": r"/.*/job/.+/.+$",
    }
    return any((host == domain or host.endswith("." + domain)) and re.fullmatch(pattern, path, re.I)
               for domain, pattern in patterns.items())


def is_unverified_company_job(job):
    # Old snapshots included invented roles, IDs, dates and fresher claims.
    return job.get("source_type") == "Official Company Portal" and (
        job.get("company_job_verified") is not True
        or not is_direct_company_job_url(job.get("direct_job_url") or job.get("url"))
    )


def _get_json(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=12) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _plain_text(value):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html_lib.unescape(value or ""))).strip()


def _make_job(company_info, title, location, url, description, published, time_source="published_at"):
    if not is_relevant_role(title) or not is_direct_company_job_url(url):
        return None
    description = _plain_text(description)
    text = f"{title} {description}".lower()
    # Evidence must come from the employer, never an appended fresher claim.
    if not description or not re.search(
        r"\b(?:freshers?|intern|internship|trainee|apprentice|graduates?|campus|entry[ -]level|no experience|zero experience)\b|\b0\s*(?:[-–]\s*\d+)?\s*years?", text
    ):
        return None
    # A range starting at zero allows freshers; do not read its upper bound as a minimum.
    exp_text = re.sub(r"\b0\s*(?:[-–]|to)\s*\d+\s*years?", "zero years", text)
    if re.search(r"\b[1-9]\d*\+?\s*(?:(?:[-–]|to)\s*\d+)?\s*years?(?:\s+of)?\s+(?:(?:relevant|work|professional)\s+)?experience\b", exp_text):
        return None
    loc = (location or "").lower()
    if not any(city in loc for city in ("india", "bengaluru", "bangalore", "mumbai", "delhi", "noida", "gurugram", "gurgaon", "hyderabad", "pune", "chennai", "kolkata", "ahmedabad", "kochi")):
        return None
    try:
        dt = datetime.datetime.fromisoformat(str(published).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.timezone.utc)
        now = datetime.datetime.now(datetime.timezone.utc)
        hours = (now - dt).total_seconds() / 3600
        if hours < 0:
            return None
    except (ValueError, TypeError):
        return None
    return {
        "title": title, "company": company_info[1], "company_url": company_info[2],
        "location": location, "url": url, "direct_job_url": url,
        "source_type": "Official Company Portal", "source_domain": urllib.parse.urlsplit(url).netloc,
        "company_job_verified": True,
        "posted_at": dt.astimezone(datetime.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "posted_at_source": time_source, "hours_ago": round(hours, 2),
        "relative_time": f"{max(1, int(hours))} hours ago" if hours < 24 else f"{int(hours / 24)} days ago",
        "raw_description": description, "is_post": False,
    }


def _fetch_board(company_info, provider):
    slug = company_info[0]
    jobs = []
    try:
        if provider == "greenhouse":
            items = _get_json(f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true").get("jobs", [])
        elif provider == "lever":
            items = _get_json(f"https://api.lever.co/v0/postings/{slug}?mode=json")
        elif provider == "ashby":
            items = _get_json(f"https://api.ashbyhq.com/posting-api/job-board/{slug}").get("jobs", [])
        else:
            items = _get_json(f"https://api.smartrecruiters.com/v1/companies/{slug}/postings").get("content", [])
        for item in items:
            title = item.get("title") or item.get("text") or item.get("name") or ""
            if not is_relevant_role(title):
                continue
            try:
                time_source = "published_at"
                if provider == "greenhouse":
                    location = (item.get("location") or {}).get("name", "")
                    url, desc = item.get("absolute_url"), item.get("content")
                    published = item.get("updated_at")
                    time_source = "updated_at"
                elif provider == "lever":
                    location = (item.get("categories") or {}).get("location", "")
                    url = item.get("hostedUrl")
                    desc = " ".join([item.get("descriptionPlain") or item.get("description") or "",
                                     item.get("additionalPlain") or item.get("additional") or ""] +
                                    [section.get("content", "") for section in item.get("lists", [])])
                    published = datetime.datetime.fromtimestamp(item["createdAt"] / 1000, datetime.timezone.utc).isoformat()
                elif provider == "ashby":
                    location, url = item.get("location", ""), item.get("jobUrl")
                    desc = item.get("descriptionPlain") or item.get("descriptionHtml")
                    published = item.get("publishedAt")
                else:
                    # The list response omits requirements and the canonical apply URL.
                    detail = _get_json(f"https://api.smartrecruiters.com/v1/companies/{slug}/postings/{item['id']}")
                    loc = detail.get("location") or {}
                    location = ", ".join(filter(None, [loc.get("city"), loc.get("region"), loc.get("country")]))
                    if loc.get("country", "").lower() == "in":
                        location += ", India"
                    url = detail.get("postingUrl")
                    desc = " ".join(section.get("text", "") for section in (detail.get("jobAd", {}).get("sections") or {}).values())
                    published = detail.get("releasedDate")
                job = _make_job(company_info, title, location, url, desc, published, time_source)
                if job:
                    jobs.append(job)
            except (KeyError, TypeError, ValueError, OSError):
                continue
    except (OSError, ValueError, TypeError) as exc:
        print(f"[CompanyPortals] {company_info[1]} ({provider}) unavailable: {exc}")
    return jobs


def fetch_single_greenhouse(company_info):
    return _fetch_board(company_info, "greenhouse")


def fetch_single_lever(company_info):
    return _fetch_board(company_info, "lever")


def fetch_single_ashby(company_info):
    return _fetch_board(company_info, "ashby")


def fetch_single_smartrecruiters(company_info):
    return _fetch_board(company_info, "smartrecruiters")


def _fetch_companies(companies, fetcher):
    jobs = []
    with ThreadPoolExecutor(max_workers=8) as executor:
        for result in executor.map(fetcher, companies):
            jobs.extend(result)
    return jobs


def fetch_greenhouse_company_jobs():
    return _fetch_companies(GREENHOUSE_COMPANIES, fetch_single_greenhouse)


def fetch_lever_company_jobs():
    return _fetch_companies(LEVER_COMPANIES, fetch_single_lever)


def fetch_ashby_company_jobs():
    return _fetch_companies(ASHBY_COMPANIES, fetch_single_ashby)


def fetch_smartrecruiters_company_jobs():
    return _fetch_companies(SMARTRECRUITERS_COMPANIES, fetch_single_smartrecruiters)


def fetch_company_jobs():
    """Only employer API records; an unavailable board contributes no placeholders."""
    seen, jobs = set(), []
    for fetcher in (fetch_greenhouse_company_jobs, fetch_lever_company_jobs,
                    fetch_ashby_company_jobs, fetch_smartrecruiters_company_jobs):
        for job in fetcher():
            if job["url"] not in seen:
                seen.add(job["url"])
                jobs.append(job)
    print(f"[CompanyPortals] Fetched {len(jobs)} actual employer requisitions.")
    return jobs


if __name__ == "__main__":
    for job in fetch_company_jobs():
        print(job["title"], job["company"], job["url"])
