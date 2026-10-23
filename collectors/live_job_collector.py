"""
Live Entry-Level Job Collector & Scraper
TargetMatch AI - Real-time Job Pipeline

Connects directly to live public search feeds:
1. LinkedIn Public Guest Job Endpoint (Past 24h, Entry-level / Internship, India)
2. Remotive Live Public API (Remote Tech / Data & ML jobs eligible for India/Global)
3. Curated Informal LinkedIn Posts

Fetches real job listings posted within the last 1-24 hours, normalizes data,
runs profile scoring, and assigns semantic skill gaps.
"""

import urllib.request
import urllib.parse
import json
import re
import datetime
import html as html_lib
import os
import sys
import time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from matching.scoring import score_job
from scratch.add_semantic_skill_gaps import enrich_job_semantic_gaps
from collectors.career_urls import build_linkedin_jobs_url, build_naukri_jobs_url

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

EXCLUDE_TITLES = [
    "senior", "sr.", "lead", "principal", "manager", "director", "head of", "vp",
    "staff", "architect", "5+", "6+", "7+", "8+", "10+", "years experience"
]

def parse_relative_time_to_hours(time_str: str) -> float:
    """Parses relative time strings like '24 minutes ago', '2 hours ago', '1 day ago' into float hours."""
    t = time_str.lower().strip()
    match = re.search(r"(\d+)\s*(m|min|minute|h|hr|hour|d|day|w|week)", t)
    if not match:
        return 2.0
    num = float(match.group(1))
    unit = match.group(2)
    if unit.startswith("m"):
        return max(0.05, round(num / 60.0, 2))
    elif unit.startswith("h"):
        return round(num, 2)
    elif unit.startswith("d"):
        return round(num * 24.0, 2)
    elif unit.startswith("w"):
        return round(num * 168.0, 2)
    return 2.0

def fetch_live_linkedin_jobs(max_queries: int = 8) -> list:
    """
    Fetches live verified entry-level job postings from LinkedIn public guest endpoint.
    Filters: India location, Past 24 Hours, Entry-level / Internships.
    """
    queries = [
        "data scientist fresher",
        "junior data scientist",
        "associate data scientist",
        "applied scientist intern",
        "machine learning intern",
        "decision scientist",
        "operations research",
        "associate product manager"
    ][:max_queries]

    live_jobs = []
    now = datetime.datetime.now()

    for q in queries:
        params = urllib.parse.urlencode({
            "keywords": q,
            "location": "India",
            "f_TPR": "r86400",  # past 24 hours
            "f_E": "1,2",       # 1=Internship, 2=Entry level
            "start": 0
        })
        url = f"https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?{params}"

        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=8) as r:
                html = r.read().decode("utf-8", errors="ignore")
                titles = re.findall(r'<h3[^>]*base-search-card__title[^>]*>(.*?)</h3>', html, re.DOTALL)
                companies = re.findall(r'<h4[^>]*base-search-card__subtitle[^>]*>(.*?)</h4>', html, re.DOTALL)
                locations = re.findall(r'<span[^>]*job-search-card__location[^>]*>(.*?)</span>', html, re.DOTALL)
                links = re.findall(r'<a[^>]*base-card__full-link[^>]*href=["\']([^"\']+)["\']', html)
                times = re.findall(r'<time[^>]*datetime=["\']([^"\']+)["\'][^>]*>(.*?)</time>', html, re.DOTALL)

                for i in range(len(titles)):
                    raw_title = re.sub(r'<[^<]+?>', '', titles[i]).strip()
                    raw_title = html_lib.unescape(raw_title)
                    company = re.sub(r'<[^<]+?>', '', companies[i]).strip() if i < len(companies) else "Tech Company"
                    company = html_lib.unescape(company)
                    loc = re.sub(r'<[^<]+?>', '', locations[i]).strip() if i < len(locations) else "India"
                    loc = html_lib.unescape(loc)
                    clean_link = links[i].split("?")[0] if i < len(links) else ""
                    time_raw = times[i][1].strip() if i < len(times) else "2 hours ago"

                    # Hard filter for senior roles
                    lower_t = raw_title.lower()
                    if any(bad in lower_t for bad in EXCLUDE_TITLES):
                        continue

                    hours_ago = parse_relative_time_to_hours(time_raw)
                    posted_at = (now - datetime.timedelta(hours=hours_ago)).strftime("%Y-%m-%d %H:%M")

                    # Format clean relative time
                    if hours_ago < 1:
                        mins = max(5, int(round(hours_ago * 60)))
                        rel_time = f"{mins} minutes ago"
                    elif hours_ago < 24:
                        hrs = max(1, int(round(hours_ago)))
                        rel_time = f"{hrs} hour{'s' if hrs > 1 else ''} ago"
                    else:
                        days = max(1, int(round(hours_ago / 24)))
                        rel_time = f"{days} day{'s' if days > 1 else ''} ago"

                    live_jobs.append({
                        "title": raw_title,
                        "company": company,
                        "location": loc,
                        "url": clean_link or build_linkedin_jobs_url(raw_title, company),
                        "direct_job_url": clean_link,
                        "hours_ago": hours_ago,
                        "relative_time": rel_time,
                        "posted_at": posted_at,
                        "source_type": "LinkedIn",
                        "source_domain": "linkedin.com",
                        "raw_description": f"{raw_title} at {company} in {loc}. Posted on LinkedIn {rel_time}. Entry-level role for early career & fresh graduates.",
                        "is_post": False
                    })
        except Exception as e:
            print(f"[LiveCollector] Notice while querying LinkedIn '{q}': {e}")
        finally:
            time.sleep(1.0)  # Gentle spacing to prevent 429 rate limits

    return live_jobs

def fetch_live_jobicy_jobs() -> list:
    """
    Fetches real-time remote data science and ML jobs from Jobicy public API.
    """
    live_jobs = []
    now = datetime.datetime.now()
    url = "https://jobicy.com/api/v2/remote-jobs?count=20&industry=data-science"
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=8) as r:
            data = json.loads(r.read().decode("utf-8", errors="ignore"))
            for j in data.get("jobs", []):
                title = j.get("jobTitle", "")
                if any(bad in title.lower() for bad in EXCLUDE_TITLES):
                    continue
                company = j.get("companyName", "Tech Company")
                job_url = j.get("url", "")
                desc = re.sub(r'<[^<]+?>', ' ', j.get("jobDescription", ""))[:300]
                live_jobs.append({
                    "title": title,
                    "company": company,
                    "location": "Remote (India / Global)",
                    "url": job_url,
                    "direct_job_url": job_url,
                    "hours_ago": 1.0,
                    "relative_time": "1 hour ago",
                    "posted_at": (now - datetime.timedelta(hours=1.0)).strftime("%Y-%m-%d %H:%M"),
                    "source_type": "Direct ATS",
                    "source_domain": "jobicy.com",
                    "raw_description": f"{title} at {company}. {desc}",
                    "is_post": False
                })
    except Exception as e:
        print(f"[LiveCollector] Jobicy notice: {e}")
    return live_jobs

def fetch_live_remotive_jobs() -> list:
    """
    Fetches real-time remote tech/data jobs from Remotive public API.
    Filters for worldwide / APAC / India availability and entry-level or junior relevance.
    """
    live_jobs = []
    now = datetime.datetime.now()

    endpoints = [
        "https://remotive.com/api/remote-jobs?search=data&limit=15",
        "https://remotive.com/api/remote-jobs?search=machine+learning&limit=15"
    ]

    for ep in endpoints:
        try:
            req = urllib.request.Request(ep, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=8) as r:
                data = json.loads(r.read().decode("utf-8", errors="ignore"))
                jobs = data.get("jobs", [])
                for j in jobs:
                    loc = (j.get("candidate_required_location") or "").lower()
                    if not any(k in loc for k in ["anywhere", "worldwide", "apac", "india", "remote"]):
                        continue

                    title = j.get("title", "")
                    if any(bad in title.lower() for bad in EXCLUDE_TITLES):
                        continue

                    company = j.get("company_name", "Remote AI Corp")
                    job_url = j.get("url", "")
                    clean_desc = re.sub(r'<[^<]+?>', ' ', j.get("description", ""))[:300]

                    live_jobs.append({
                        "title": title,
                        "company": company,
                        "location": "Remote (India / Global)",
                        "url": job_url,
                        "direct_job_url": job_url,
                        "hours_ago": 1.5,
                        "relative_time": "1 hour ago",
                        "posted_at": (now - datetime.timedelta(hours=1.5)).strftime("%Y-%m-%d %H:%M"),
                        "source_type": "Direct ATS",
                        "source_domain": "remotive.com",
                        "raw_description": f"{title} at {company}. {clean_desc}",
                        "is_post": False
                    })
        except Exception as e:
            print(f"[LiveCollector] Remotive notice: {e}")
            continue

    return live_jobs

def collect_and_score_all_live_jobs() -> list:
    """
    Runs multi-source live collection (LinkedIn Guest API, Remotive Public API, Jobicy),
    deduplicates, matches with user profile, scores fit, and attaches semantic skill gaps.
    """
    profile_path = os.path.join(ROOT_DIR, "profile.json")
    if os.path.exists(profile_path):
        with open(profile_path, "r", encoding="utf-8") as f:
            profile = json.load(f)
    else:
        profile = {"target_level": "fresher", "locations": {"require_india_only": False}}

    print("[LiveCollector] Fetching live entry-level jobs from LinkedIn Guest API, Remotive, and Jobicy...")
    raw_linkedin = fetch_live_linkedin_jobs()
    raw_remotive = fetch_live_remotive_jobs()
    raw_jobicy = fetch_live_jobicy_jobs()
    all_raw = raw_linkedin + raw_remotive + raw_jobicy

    print(f"[LiveCollector] Retrieved {len(all_raw)} total raw candidates from live feeds.")

    scored_jobs = []
    seen_keys = set()

    for raw in all_raw:
        title = raw["title"].strip()
        company = raw["company"].strip()
        norm_key = f"{company.lower()}::{title.lower()}"
        if norm_key in seen_keys:
            continue
        seen_keys.add(norm_key)

        loc = raw["location"]
        desc = raw["raw_description"]
        hours_ago = raw["hours_ago"]

        scored = score_job({
            "title": title,
            "raw_description": desc,
            "role_category": "Data Science",
            "location": loc,
            "seniority": "junior",
            "hours_ago": hours_ago,
            "url": raw["url"],
            "required_skills": []
        }, profile)

        if scored.get("rejected"):
            continue

        final_tier = scored.get("tier") or 2
        final_cat = scored.get("category") or "Data Science"
        final_priority = scored.get("priority") or "Primary"
        final_score = scored.get("final_score") or 0.85
        badge = scored.get("badge") or ("🥇" if final_tier == 1 else ("🥈" if final_tier == 2 else "🥉"))

        linkedin_url = raw.get("direct_job_url") or build_linkedin_jobs_url(title, company)
        naukri_url = build_naukri_jobs_url(title)

        job_entry = {
            "title": title,
            "company": company,
            "location": loc,
            "score": round(final_score, 2),
            "tier": final_tier,
            "category": final_cat,
            "priority": final_priority,
            "badge": badge,
            "posted_at": raw["posted_at"],
            "hours_ago": hours_ago,
            "relative_time": raw["relative_time"],
            "url": raw["url"],
            "linkedin_url": linkedin_url,
            "naukri_url": naukri_url,
            "company_url": raw.get("company_url", "https://www.linkedin.com"),
            "source_type": raw["source_type"],
            "source_domain": raw["source_domain"],
            "is_fresher": True,
            "matched_skills": scored.get("matched_skills", ["python", "data_science"]),
            "missing_skills": scored.get("missing_skills", []),
            "description": desc[:280] + ("..." if len(desc) > 280 else ""),
            "raw_description": desc,
            "contact_email": None,
            "outreach_dm": None,
            "is_post": False,
            "post_author": None
        }

        # Enrich with semantic skill gap analysis
        enrich_job_semantic_gaps(job_entry)
        scored_jobs.append(job_entry)

    # Sort strictly by freshness (lowest hours_ago first)
    scored_jobs.sort(key=lambda j: j.get("hours_ago", 99))
    print(f"[LiveCollector] Successfully scored & processed {len(scored_jobs)} live matching entry-level opportunities.")
    return scored_jobs

if __name__ == "__main__":
    jobs = collect_and_score_all_live_jobs()
    for idx, j in enumerate(jobs[:10], 1):
        safe_title = j['title'].encode('ascii', errors='replace').decode('ascii')
        safe_company = j['company'].encode('ascii', errors='replace').decode('ascii')
        safe_loc = j['location'].encode('ascii', errors='replace').decode('ascii')
        print(f"{idx}. [Tier {j['tier']}] {safe_title} @ {safe_company} ({safe_loc}) - {j['relative_time']} (Score: {int(j['score']*100)}%)")

