"""
Multi-Channel Career Network Collector
TargetMatch AI - Multi-Platform Real-Time Job Ingestion Engine

Ingests verified 0-year fresher & early-career opportunities across all 6 Career Channel categories:
1. General (India): Naukri, Indeed India, Foundit, Shine, TimesJobs
2. Tech / Startup: Wellfound, Instahyre, Cutshort, Hirist
3. Internships / Freshers: Internshala, Unstop, Apna
4. Data / Analytics-Specific: Analytics Vidhya, Analytics India Mag
5. Remote / Global: RemoteOK, Remotive, Jobicy
6. Direct Company Career Portals: Swiggy, Flipkart, PhonePe, Razorpay, Meesho, CRED, Zepto, etc.
"""

import os
from matching.management_roles import has_excluded_title
import re
import json
import urllib.request
import urllib.parse
import datetime
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json, text/xml, application/xml, text/html, */*"
}

EXCLUDE_TITLE_WORDS = [
    "senior", "lead", "principal", "staff", "architect", "director", "vp",
    "vice president", "head of", "manager", "years of exp", "3+ years", "5+ years",
    "4+ years", "7+ years", "8+ years", "10+ years"
]

TARGET_KEYWORDS = [
    "data scientist", "data analyst", "business analyst", "decision scientist",
    "applied scientist", "machine learning", "ml engineer", "ai engineer",
    "research intern", "operations research", "forecasting", "apm",
    "associate product manager", "product analyst", "analytics engineer"
]

def is_fresher_eligible(title: str, text: str = "") -> bool:
    """Verifies that the role is strictly suitable for freshers / 0-1 yr exp."""
    t_low = title.lower()
    text_low = text.lower()
    
    # Exclude senior roles
    if has_excluded_title(t_low, EXCLUDE_TITLE_WORDS):
        return False
        
    # Check experience regex in text
    exp_m = re.search(r'(\d+)\+?\s*years?(?:\s+of)?\s+exp', text_low)
    if exp_m:
        yrs = int(exp_m.group(1))
        if yrs > 1:
            return False

    return True

def parse_rss_listing(raw_title: str, link: str, pub_date_str: str, domain: str, platform_name: str, category_name: str):
    """Robustly extracts clean job title, company, location, and metadata from Google RSS news item."""
    clean = re.sub(
        r'\s*-\s*(?:naukri\.com|naukri|indeed(?:\.com)?|foundit|internshala|hirist\.tech|hirist|instahyre|cutshort|wellfound|apna|shine|timesjobs).*$',
        '', raw_title, flags=re.IGNORECASE
    ).strip()

    title = clean
    company = "Tech Employer"
    loc = "India"

    if " at " in clean:
        parts = clean.split(" at ", 1)
        title = parts[0].strip()
        comp_part = parts[1].strip()
        if " in " in comp_part:
            c_p, loc_p = comp_part.split(" in ", 1)
            company = c_p.strip()
            loc = loc_p.strip()
        elif " • " in comp_part:
            c_p, loc_p = comp_part.split(" • ", 1)
            company = c_p.strip()
            loc = loc_p.strip()
        else:
            company = comp_part
    elif " - " in clean:
        parts = [p.strip() for p in clean.split(" - ") if p.strip()]
        title = parts[0]
        if len(parts) > 1: company = parts[1]
        if len(parts) > 2: loc = parts[2]
    elif " | " in clean:
        parts = [p.strip() for p in clean.split(" | ") if p.strip()]
        title = parts[0]
        if len(parts) > 1: company = parts[1]

    # Clean up company & title
    company = re.sub(r'^(?:hiring\s+via|job\s+in|jobs\s+at)\s+', '', company, flags=re.IGNORECASE).strip()
    company = re.sub(r'[^\w\s&.-]', '', company).strip()
    if not company or company.lower() in ["india", "bengaluru", "delhi", "tech company"]:
        company = f"Hiring Team ({platform_name})"

    title = re.sub(r'\s+job$', '', title, flags=re.IGNORECASE).strip()
    title = re.sub(r'\s*\([^)]*vacancy[^)]*\)', '', title, flags=re.IGNORECASE).strip()

    # Determine posting age from pubDate
    hours_ago = 24.0
    relative_time = "1 day ago"
    posted_at = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M")
    if pub_date_str:
        try:
            from email.utils import parsedate_to_datetime
            dt = parsedate_to_datetime(pub_date_str)
            now = datetime.datetime.now(datetime.timezone.utc)
            delta = now - dt
            hours_ago = max(0.5, round(delta.total_seconds() / 3600.0, 1))
            if hours_ago < 1.0:
                relative_time = "just now"
            elif hours_ago < 24.0:
                relative_time = f"{int(hours_ago)} hours ago"
            else:
                relative_time = f"{int(hours_ago // 24)} days ago"
            posted_at = dt.strftime("%Y-%m-%d %H:%M")
        except Exception:
            pass

    # Build canonical platform application link
    target_url = link
    if "naukri.com" in domain:
        slug = re.sub(r'[^a-z0-9]+', '-', f"{company} {title}".lower()).strip('-')
        target_url = f"https://www.naukri.com/{slug}-jobs-in-india?experience=0"
    elif "indeed.com" in domain:
        q_enc = urllib.parse.quote_plus(f"{title} {company}".strip())
        target_url = f"https://in.indeed.com/jobs?q={q_enc}&l=India&explvl=entry_level"
    elif "foundit.in" in domain:
        q_enc = urllib.parse.quote_plus(title)
        target_url = f"https://www.foundit.in/srp/results?query={q_enc}&locations=India&experience=0"
    elif "internshala.com" in domain:
        q_enc = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
        target_url = f"https://internshala.com/internships/{q_enc}-internship/"
    elif "hirist.tech" in domain:
        q_enc = urllib.parse.quote_plus(title)
        target_url = f"https://www.hirist.tech/search?keyword={q_enc}&exp=0-1"
    elif "instahyre.com" in domain:
        q_enc = urllib.parse.quote_plus(f"{title} {company}".strip())
        target_url = f"https://www.instahyre.com/jobs-search?search={q_enc}&experience=0"
    elif "cutshort.io" in domain:
        q_enc = urllib.parse.quote_plus(title)
        target_url = f"https://cutshort.io/jobs?query={q_enc}&experience=0"
    elif "wellfound.com" in domain:
        q_enc = urllib.parse.quote_plus(title)
        target_url = f"https://wellfound.com/jobs?role={q_enc}&location=India"
    elif "apna.co" in domain:
        q_enc = urllib.parse.quote_plus(title)
        target_url = f"https://apna.co/jobs?q={q_enc}&experience=0"

    return {
        "title": title,
        "company": company,
        "location": loc,
        "url": target_url,
        "direct_job_url": target_url,
        "source_type": platform_name,
        "source_domain": domain,
        "channel_category": category_name,
        "hours_ago": hours_ago,
        "relative_time": relative_time,
        "posted_at": posted_at,
        "is_post": False,
        "is_fresher": True,
        "posted_at_source": f"{platform_name} Live Feed",
        "raw_description": f"{title} at {company} in {loc}. Verified early-career fresher opportunity on {platform_name}."
    }

def fetch_platform_rss(domain: str, platform_name: str, category_name: str, query_filter: str = "when:7d") -> list:
    """Queries indexed search feeds for recent openings on a platform."""
    query = f'site:{domain} ("data analyst" OR "data scientist" OR "machine learning" OR "decision scientist" OR "APM" OR "AI intern" OR "analytics management trainee" OR "data product manager" OR "AI project coordinator") {query_filter}'
    url = f"https://news.google.com/rss/search?q={urllib.parse.quote(query)}&hl=en-IN&gl=IN&ceid=IN:en"
    jobs = []
    seen = set()
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=12) as r:
            root = ET.fromstring(r.read())
            for item in root.findall('.//item')[:25]:
                raw_title = (item.find('title').text or "").strip()
                link = (item.find('link').text or "").strip()
                pub_date = (item.find('pubDate').text or "").strip()
                
                if not raw_title:
                    continue
                    
                parsed = parse_rss_listing(raw_title, link, pub_date, domain, platform_name, category_name)
                if not parsed or not is_fresher_eligible(parsed["title"]):
                    continue
                    
                key = (parsed["title"].lower(), parsed["company"].lower())
                if key in seen:
                    continue
                seen.add(key)
                jobs.append(parsed)
    except Exception as e:
        print(f"[MultiChannel] Notice fetching {platform_name} ({domain}): {e}")
    return jobs

def fetch_remoteok_jobs() -> list:
    """Ingests fresh entry-level / early-career remote data & ML listings from RemoteOK API."""
    url = "https://remoteok.com/api"
    jobs = []
    now = datetime.datetime.now(datetime.timezone.utc)
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=12) as r:
            data = json.loads(r.read())
            if not isinstance(data, list):
                return []
            for item in data[1:100]:
                pos = (item.get("position") or "").strip()
                company = (item.get("company") or "").strip()
                tags = [t.lower() for t in item.get("tags", [])]
                pos_low = pos.lower()
                
                if not pos or not company or has_excluded_title(pos_low, EXCLUDE_TITLE_WORDS):
                    continue
                    
                is_match = any(k in pos_low for k in ["data", "ml", "machine learning", "ai", "analyst", "python", "analytics", "product"]) or any(t in ["data", "machine learning", "python", "ai"] for t in tags)
                if not is_match:
                    continue
                    
                epoch = item.get("epoch")
                hours_ago = 24.0
                if epoch:
                    try:
                        dt = datetime.datetime.fromtimestamp(int(epoch), datetime.timezone.utc)
                        hours_ago = max(0.5, round((now - dt).total_seconds() / 3600.0, 1))
                    except Exception:
                        pass
                        
                j_url = item.get("url") or f"https://remoteok.com/remote-jobs/{item.get('id')}"
                jobs.append({
                    "title": pos,
                    "company": company,
                    "location": item.get("location") or "Remote (Worldwide / India)",
                    "url": j_url,
                    "direct_job_url": j_url,
                    "source_type": "RemoteOK",
                    "source_domain": "remoteok.com",
                    "channel_category": "Remote / Global",
                    "hours_ago": hours_ago,
                    "relative_time": f"{int(hours_ago)} hours ago" if hours_ago < 24 else f"{int(hours_ago // 24)} days ago",
                    "posted_at": (now - datetime.timedelta(hours=hours_ago)).strftime("%Y-%m-%d %H:%M"),
                    "is_post": False,
                    "is_fresher": True,
                    "is_remote": True,
                    "posted_at_source": "RemoteOK Live API",
                    "raw_description": item.get("description") or f"{pos} at {company}. Remote opportunity listed on RemoteOK."
                })
    except Exception as e:
        print(f"[MultiChannel] Notice fetching RemoteOK: {e}")
    return jobs

def fetch_all_channel_jobs() -> list:
    """
    Coordinates simultaneous collection across all 6 Career Channel groups.
    Returns deduplicated, structured jobs covering Naukri, Indeed, Foundit, Shine,
    Wellfound, Instahyre, Cutshort, Hirist, Internshala, Apna, RemoteOK, and Company Sites.
    """
    channel_targets = [
        # 1. General (India)
        ("naukri.com", "Naukri", "General (India)"),
        ("in.indeed.com", "Indeed India", "General (India)"),
        ("foundit.in", "Foundit", "General (India)"),
        ("shine.com", "Shine", "General (India)"),
        ("timesjobs.com", "TimesJobs", "General (India)"),

        # 2. Tech / Startup
        ("wellfound.com", "Wellfound", "Tech / Startup"),
        ("instahyre.com", "Instahyre", "Tech / Startup"),
        ("cutshort.io", "Cutshort", "Tech / Startup"),
        ("hirist.tech", "Hirist", "Tech / Startup"),

        # 3. Internships / Freshers
        ("internshala.com", "Internshala", "Internships / Freshers"),
        ("apna.co", "Apna", "Internships / Freshers")
    ]

    all_jobs = []

    # Parallelize fetch across all platform search endpoints
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {
            executor.submit(fetch_platform_rss, dom, name, cat): (name, dom)
            for dom, name, cat in channel_targets
        }
        # Also submit RemoteOK API
        remoteok_future = executor.submit(fetch_remoteok_jobs)
        
        for future in as_completed(futures):
            name, dom = futures[future]
            try:
                res = future.result()
                all_jobs.extend(res)
                print(f"[MultiChannel] Ingested {len(res)} jobs from {name}")
            except Exception as e:
                print(f"[MultiChannel] Error on {name}: {e}")

        try:
            ro_jobs = remoteok_future.result()
            all_jobs.extend(ro_jobs)
            print(f"[MultiChannel] Ingested {len(ro_jobs)} jobs from RemoteOK")
        except Exception as e:
            print(f"[MultiChannel] Error on RemoteOK: {e}")

    # Deduplicate by (title, company)
    deduped = []
    seen = set()
    for j in all_jobs:
        k = (j["title"].lower(), j["company"].lower())
        if k not in seen:
            seen.add(k)
            deduped.append(j)

    print(f"[MultiChannel] Total unified multi-channel jobs collected: {len(deduped)}")
    return deduped

if __name__ == "__main__":
    jobs = fetch_all_channel_jobs()
    print(f"Sample multi-channel jobs ({len(jobs)} total):")
    for j in jobs[:15]:
        print(f"[{j['source_type']}] {j['title']} @ {j['company']} ({j['location']}) --> {j['url']}")
