import urllib.request
import urllib.parse
import re
import datetime

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

queries = [
    "data scientist fresher",
    "junior data scientist",
    "applied scientist intern",
    "machine learning intern",
    "decision scientist",
    "operations research",
    "associate product manager"
]

all_found = []

for q in queries:
    params = urllib.parse.urlencode({
        "keywords": q,
        "location": "India",
        "f_TPR": "r86400",  # past 24 hours
        "f_E": "1,2",       # internship, entry level
        "start": 0
    })
    url = f"https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?{params}"
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as r:
            html = r.read().decode("utf-8", errors="ignore")
            titles = re.findall(r'<h3[^>]*base-search-card__title[^>]*>(.*?)</h3>', html, re.DOTALL)
            companies = re.findall(r'<h4[^>]*base-search-card__subtitle[^>]*>(.*?)</h4>', html, re.DOTALL)
            locations = re.findall(r'<span[^>]*job-search-card__location[^>]*>(.*?)</span>', html, re.DOTALL)
            links = re.findall(r'<a[^>]*base-card__full-link[^>]*href=["\']([^"\']+)["\']', html)
            times = re.findall(r'<time[^>]*datetime=["\']([^"\']+)["\'][^>]*>(.*?)</time>', html, re.DOTALL)

            for i in range(len(titles)):
                t = re.sub(r'<[^<]+?>', '', titles[i]).strip()
                c = re.sub(r'<[^<]+?>', '', companies[i]).strip() if i < len(companies) else 'Unknown'
                loc = re.sub(r'<[^<]+?>', '', locations[i]).strip() if i < len(locations) else 'India'
                l = links[i].split("?")[0] if i < len(links) else ""
                tm = times[i][1].strip() if i < len(times) else "1h ago"
                all_found.append({
                    "title": t,
                    "company": c,
                    "location": loc,
                    "url": l,
                    "time": tm,
                    "query": q
                })
    except Exception as e:
        print(f"Error querying {q}: {e}")

print(f"Total live fresh entry-level jobs found: {len(all_found)}")
for idx, j in enumerate(all_found[:15], 1):
    print(f"{idx}. {j['title']} @ {j['company']} ({j['location']}) | {j['time']} -> {j['url']}")
