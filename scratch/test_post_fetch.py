import re
import urllib.request
import urllib.parse
import html as html_lib
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def fetch_linkedin_public_post(url: str):
    """
    Fetches a public LinkedIn post URL and extracts the message text and author
    using OpenGraph and meta tags, with detection for 'Invalid post link' 404 pages.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }
    
    clean_url = url.strip()
    
    # Check if URL is a live LinkedIn search query
    if "/search/results/content/" in clean_url or "keywords=" in clean_url:
        parsed_url = urllib.parse.urlparse(clean_url)
        params = urllib.parse.parse_qs(parsed_url.query)
        kw = params.get("keywords", [""])[0]
        kw_clean = urllib.parse.unquote(kw).replace('"', '')
        return {
            "success": True,
            "type": "Live Search Query",
            "url": clean_url,
            "keywords": kw_clean,
            "message": f"Live LinkedIn search query for hiring posts: '{kw_clean}' (Past 24h, sorted by date). This link never 404s and connects directly to active public updates."
        }

    req = urllib.request.Request(clean_url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
            
            # Check for LinkedIn "Invalid post link" page
            if "Invalid post link" in html or "couldn't find a post at this URL" in html or "We couldn't find a post" in html:
                return {
                    "success": False,
                    "is_invalid_link": True,
                    "url": clean_url,
                    "error": "Invalid post link: LinkedIn reported that no post exists at this URL (expired or deleted post)."
                }
            
            # Extract og:description
            desc_match = re.search(r'<meta\s+(?:property|name)=["\']og:description["\']\s+content=["\'](.*?)["\']', html, re.DOTALL | re.IGNORECASE)
            if not desc_match:
                desc_match = re.search(r'<meta\s+content=["\'](.*?)["\']\s+(?:property|name)=["\']og:description["\']', html, re.DOTALL | re.IGNORECASE)
            
            # Extract og:title
            title_match = re.search(r'<meta\s+(?:property|name)=["\']og:title["\']\s+content=["\'](.*?)["\']', html, re.DOTALL | re.IGNORECASE)
            if not title_match:
                title_match = re.search(r'<meta\s+content=["\'](.*?)["\']\s+(?:property|name)=["\']og:title["\']', html, re.DOTALL | re.IGNORECASE)
            
            page_title_match = re.search(r'<title>(.*?)</title>', html, re.DOTALL | re.IGNORECASE)
            
            og_desc = desc_match.group(1) if desc_match else ""
            og_title = title_match.group(1) if title_match else (page_title_match.group(1) if page_title_match else "")
            
            og_desc = html_lib.unescape(og_desc)
            og_title = html_lib.unescape(og_title)
            
            author = ""
            if " on LinkedIn:" in og_title:
                author = og_title.split(" on LinkedIn:")[0].strip()
            elif " | LinkedIn" in og_title:
                author = og_title.split(" | LinkedIn")[0].strip()
                
            return {
                "success": True,
                "url": clean_url,
                "author": author or "LinkedIn User",
                "title": og_title,
                "message": og_desc
            }
    except urllib.error.HTTPError as he:
        return {
            "success": False,
            "is_invalid_link": True,
            "url": clean_url,
            "error": f"HTTP {he.code}: {he.reason}"
        }
    except Exception as e:
        return {
            "success": False,
            "url": clean_url,
            "error": str(e)
        }

if __name__ == "__main__":
    print("Testing LinkedIn public post fetcher...")
    
    # Test 1: Live search URL (guaranteed never to 404)
    print("\n--- Test 1: Live Content Search Query ---")
    res1 = fetch_linkedin_public_post("https://www.linkedin.com/search/results/content/?keywords=%22Swiggy%22%20%22APM%22%20%22hiring%22&datePosted=%22past-24h%22&sortBy=%22date_posted%22")
    print(res1)
    
    # Test 2: Collectors module test
    print("\n--- Test 2: Collectors linkedin_post_fetcher ---")
    from collectors.linkedin_post_fetcher import fetch_linkedin_post_by_url
    res2 = fetch_linkedin_post_by_url("https://www.linkedin.com/search/results/content/?keywords=%22Razorpay%22%20%22BizOps%22%20%22hiring%22&datePosted=%22past-24h%22&sortBy=%22date_posted%22")
    print(f"Company: {res2.get('company')} | Role: {res2.get('title')} | Author: {res2.get('post_author')}")
    print(f"Fetch success: {res2.get('fetch_success')} | Via: {res2.get('fetched_via')}")
