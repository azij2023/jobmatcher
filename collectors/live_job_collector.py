"""
Live Entry-Level Job Collector & Scraper
TargetMatch AI - Real-time Job Pipeline

Connects directly to live public search feeds:
1. LinkedIn Public Guest Job Endpoint (Past 24h, Entry-level / Internship, India)
2. Remotive Live Public API (Remote Tech / Data & ML jobs eligible for India/Global)
3. Jobicy Remote Jobs API (India and worldwide-eligible roles)

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
import urllib.error
from collections import Counter

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

def parse_relative_time_to_hours(time_str: str) -> float | None:
    """Parse a publisher-provided relative age without guessing when it is missing."""
    text = (time_str or "").lower().strip()
    if text in {"just now", "today"}:
        return 0.0

    match = re.search(
        r"(\d+(?:\.\d+)?)\s*(s|sec|second|m|min|minute|h|hr|hour|d|day|w|week)",
        text,
    )
    if not match:
        return None

    amount = float(match.group(1))
    unit = match.group(2)
    if unit.startswith("s"):
        return amount / 3600.0
    if unit.startswith("m"):
        return amount / 60.0
    if unit.startswith("h"):
        return amount
    if unit.startswith("d"):
        return amount * 24.0
    if unit.startswith("w"):
        return amount * 168.0
    return None


def parse_published_datetime(value: str | None) -> datetime.datetime | None:
    """Parse a source publication date and normalize it to UTC."""
    if not value:
        return None
    try:
        published_at = datetime.datetime.fromisoformat(str(value).strip().replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    if published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=datetime.timezone.utc)
    return published_at.astimezone(datetime.timezone.utc)


def get_publication_freshness(
    published_at_value: str | None,
    relative_time: str | None,
    now: datetime.datetime | None = None,
) -> dict | None:
    """Return a real source timestamp or a timestamp derived from source relative time."""
    now = now or datetime.datetime.now(datetime.timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=datetime.timezone.utc)
    else:
        now = now.astimezone(datetime.timezone.utc)
    published_at = parse_published_datetime(published_at_value)
    source = "published_at"

    date_has_time = bool(
        published_at_value and
        re.search(r"[T ]\d{2}:\d{2}", str(published_at_value))
    )
    if published_at is None or (not date_has_time and relative_time):
        age_hours = parse_relative_time_to_hours(relative_time or "")
        if age_hours is None:
            if published_at is None:
                return None
            age_hours = (now - published_at).total_seconds() / 3600.0
        else:
            published_at = now - datetime.timedelta(hours=age_hours)
            source = "relative_time"
    else:
        age_hours = (now - published_at).total_seconds() / 3600.0

    if age_hours < 0:
        return None

    if age_hours < 1:
        label = f"{max(1, round(age_hours * 60))} minutes ago"
    elif age_hours < 24:
        hours = max(1, round(age_hours))
        label = f"{hours} hour{'s' if hours != 1 else ''} ago"
    else:
        days = max(1, round(age_hours / 24))
        label = f"{days} day{'s' if days != 1 else ''} ago"

    return {
        "posted_at": published_at.isoformat(timespec="seconds").replace("+00:00", "Z"),
        "hours_ago": round(age_hours, 2),
        "relative_time": label,
        "posted_at_source": source,
    }


def is_india_or_worldwide_remote(location: str) -> bool:
    """Limit remote-board results to India or postings explicitly open worldwide."""
    value = (location or "").lower()
    india_terms = ("india", "indian", "apac", "asia pacific", "asia-pacific")
    worldwide_terms = ("worldwide", "anywhere", "global", "all locations", "from anywhere")
    return any(term in value for term in india_terms + worldwide_terms)


def get_remote_location_label(location: str) -> str:
    value = (location or "").lower()
    if "india" in value or "indian" in value:
        return "Remote (India)"
    if "apac" in value or "asia pacific" in value or "asia-pacific" in value:
        return "Remote (APAC)"
    return "Remote (Worldwide)"

def fetch_live_linkedin_jobs(max_queries: int = 4) -> list:
    """
    Fetches live verified entry-level job postings from LinkedIn public guest endpoint.
    Filters: India location, Past 24 Hours, Entry-level / Internships.
    """
    queries = [
        "data analyst fresher",
        "data scientist fresher",
        "machine learning intern",
        "applied scientist intern",
    ][:max_queries]

    live_jobs = []
    now = datetime.datetime.now(datetime.timezone.utc)

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
                    published_raw = times[i][0].strip() if i < len(times) else None
                    time_raw = times[i][1].strip() if i < len(times) else ""
                    if not clean_link:
                        continue

                    # Hard filter for senior roles
                    lower_t = raw_title.lower()
                    if any(bad in lower_t for bad in EXCLUDE_TITLES):
                        continue

                    freshness = get_publication_freshness(published_raw, time_raw, now)
                    if freshness is None:
                        continue

                    # Format clean relative time
                    live_jobs.append({
                        "title": raw_title,
                        "company": company,
                        "location": loc,
                        "url": clean_link or build_linkedin_jobs_url(raw_title, company),
                        "direct_job_url": clean_link,
                        **freshness,
                        "source_type": "LinkedIn",
                        "source_domain": "linkedin.com",
                        "raw_description": f"{raw_title} at {company} in {loc}. Listed on LinkedIn.",
                        "is_post": False
                    })
        except urllib.error.HTTPError as e:
            print(f"[LiveCollector] Notice while querying LinkedIn '{q}': {e}")
            if e.code == 429:
                break
        except Exception as e:
            print(f"[LiveCollector] Notice while querying LinkedIn '{q}': {e}")
        finally:
            time.sleep(3.0)

    return live_jobs

def fetch_live_jobicy_jobs() -> list:
    """
    Fetches paginated, date-stamped remote data science jobs from Jobicy's public API.
    """
    live_jobs = []
    cursor = None

    while True:
        params = {"count": 200, "industry": "data-science"}
        if cursor:
            params["cursor"] = cursor
        url = f"https://jobicy.com/api/jobs?{urllib.parse.urlencode(params)}"

        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=15) as response:
                data = json.loads(response.read().decode("utf-8", errors="ignore"))
        except Exception as error:
            print(f"[LiveCollector] Jobicy notice: {error}")
            break

        for job in data.get("jobs", []):
            title = (job.get("jobTitle") or "").strip()
            if not title or any(bad in title.lower() for bad in EXCLUDE_TITLES):
                continue

            level = (job.get("jobLevel") or "").lower()
            entry_level_terms = ("entry", "junior", "intern", "graduate", "associate", "fresher", "early career")
            if any(term in level for term in ("senior", "mid", "lead", "principal", "director")):
                continue
            if not any(term in level for term in entry_level_terms) and not any(
                term in title.lower()
                for term in ("junior", "intern", "graduate", "associate", "trainee", "fresher", "new grad")
            ):
                continue

            source_location = job.get("jobGeo") or ""
            job_url = job.get("url") or ""
            if not job_url or not is_india_or_worldwide_remote(source_location):
                continue

            freshness = get_publication_freshness(job.get("pubDate"), None)
            if freshness is None:
                continue

            company = job.get("companyName") or "Tech Company"
            description = re.sub(r"<[^<]+?>", " ", job.get("jobDescription", ""))
            description = html_lib.unescape(description)
            live_jobs.append({
                "title": title,
                "company": company,
                "location": get_remote_location_label(source_location),
                "url": job_url,
                "direct_job_url": job_url,
                **freshness,
                "source_type": "Jobicy",
                "source_domain": "jobicy.com",
                "raw_description": f"{title} at {company}. {description[:1000]}",
                "is_remote": True,
                "is_post": False
            })

        cursor = data.get("nextCursor")
        if not cursor:
            break

    return live_jobs

def fetch_live_remotive_jobs() -> list:
    """
    Fetches real-time remote tech/data jobs from Remotive public API.
    Filters for worldwide / APAC / India availability and entry-level or junior relevance.
    """
    live_jobs = []

    endpoint = "https://remotive.com/api/remote-jobs?limit=100"
    try:
        req = urllib.request.Request(endpoint, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=8) as r:
            data = json.loads(r.read().decode("utf-8", errors="ignore"))
            for j in data.get("jobs", []):
                loc = (j.get("candidate_required_location") or "").lower()
                if not is_india_or_worldwide_remote(loc):
                    continue

                title = j.get("title", "")
                if not title or any(bad in title.lower() for bad in EXCLUDE_TITLES):
                    continue

                company = j.get("company_name", "Tech Company")
                job_url = j.get("url", "")
                if not job_url:
                    continue
                freshness = get_publication_freshness(
                    j.get("publication_date") or j.get("date_posted"),
                    j.get("relative_time"),
                )
                if freshness is None:
                    continue
                clean_desc = re.sub(r'<[^<]+?>', ' ', j.get("description", ""))[:300]

                live_jobs.append({
                    "title": title,
                    "company": company,
                    "location": get_remote_location_label(loc),
                    "url": job_url,
                    "direct_job_url": job_url,
                    **freshness,
                    "source_type": "Remotive",
                    "source_domain": "remotive.com",
                    "raw_description": f"{title} at {company}. {clean_desc}",
                    "is_remote": True,
                    "is_post": False
                })
    except Exception as e:
        print(f"[LiveCollector] Remotive notice: {e}")

    return live_jobs

def collect_and_score_all_live_jobs(include_remotive: bool = True) -> list:
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

    print("[LiveCollector] Fetching entry-level jobs from LinkedIn and Jobicy, plus Remotive when scheduled...")
    raw_linkedin = fetch_live_linkedin_jobs()
    raw_remotive = fetch_live_remotive_jobs() if include_remotive else []
    raw_jobicy = fetch_live_jobicy_jobs()
    all_raw = raw_linkedin + raw_remotive + raw_jobicy

    source_counts = Counter(job["source_type"] for job in all_raw)
    print(
        f"[LiveCollector] Retrieved {len(all_raw)} candidates from "
        + ", ".join(f"{source}: {count}" for source, count in sorted(source_counts.items()))
    )

    scored_jobs = []
    seen_keys = set()
    rejection_counts = Counter()

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
            "location": loc,
            "seniority": "junior",
            "hours_ago": hours_ago,
            "url": raw["url"],
            "required_skills": []
        }, profile)

        if scored.get("rejected"):
            rejection_counts[scored.get("rejection_reason", "Unknown match rejection")] += 1
            continue

        final_tier = scored.get("tier") or 2
        final_cat = scored.get("category") or "Data Science"
        final_priority = scored.get("priority") or "Primary"
        final_score = scored.get("final_score") or 0.85
        badge = scored.get("badge") or ("🥇" if final_tier == 1 else ("🥈" if final_tier == 2 else "🥉"))

        linkedin_url = (
            raw.get("direct_job_url")
            if raw["source_domain"] == "linkedin.com"
            else build_linkedin_jobs_url(title, company)
        )
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
            "posted_at_source": raw["posted_at_source"],
            "hours_ago": hours_ago,
            "relative_time": raw["relative_time"],
            "url": raw["url"],
            "linkedin_url": linkedin_url,
            "naukri_url": naukri_url,
            "company_url": raw.get("company_url") or raw["url"],
            "source_type": raw["source_type"],
            "source_domain": raw["source_domain"],
            "is_fresher": True,
            "matched_skills": scored.get("matched_skills", []),
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
    if rejection_counts:
        print(f"[LiveCollector] Candidate rejections: {dict(rejection_counts)}")
    print(f"[LiveCollector] Successfully scored & processed {len(scored_jobs)} live matching entry-level opportunities.")
    return scored_jobs

if __name__ == "__main__":
    jobs = collect_and_score_all_live_jobs()
    for idx, j in enumerate(jobs[:10], 1):
        safe_title = j['title'].encode('ascii', errors='replace').decode('ascii')
        safe_company = j['company'].encode('ascii', errors='replace').decode('ascii')
        safe_loc = j['location'].encode('ascii', errors='replace').decode('ascii')
        print(f"{idx}. [Tier {j['tier']}] {safe_title} @ {safe_company} ({safe_loc}) - {j['relative_time']} (Score: {int(j['score']*100)}%)")
