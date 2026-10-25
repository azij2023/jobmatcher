import datetime
import io
import json
import os
import time
import unittest
from contextlib import nullcontext
from unittest.mock import patch

from collectors.live_job_collector import (
    fetch_live_adzuna_jobs,
    fetch_live_himalayas_jobs,
    fetch_live_jsearch_jobs,
    fetch_live_linkedin_jobs,
    fetch_live_jobicy_jobs,
    get_publication_freshness,
    is_india_or_worldwide_remote,
    parse_relative_time_to_hours,
)


class PublicationFreshnessTests(unittest.TestCase):
    def test_missing_relative_time_is_unknown(self):
        self.assertIsNone(parse_relative_time_to_hours(""))
        self.assertIsNone(parse_relative_time_to_hours("posted recently"))

    def test_relative_time_is_parsed_without_fabricating_a_default(self):
        self.assertAlmostEqual(parse_relative_time_to_hours("30 minutes ago"), 0.5)
        self.assertEqual(parse_relative_time_to_hours("2 days ago"), 48)

    def test_published_datetime_is_preserved_as_utc(self):
        now = datetime.datetime(2026, 10, 24, 0, 0, tzinfo=datetime.timezone.utc)
        result = get_publication_freshness("2026-10-23T22:00:00Z", None, now)

        self.assertEqual(result["posted_at"], "2026-10-23T22:00:00Z")
        self.assertEqual(result["hours_ago"], 2)
        self.assertEqual(result["posted_at_source"], "published_at")

    def test_date_only_uses_more_precise_publisher_relative_age(self):
        now = datetime.datetime(2026, 10, 24, 0, 0, tzinfo=datetime.timezone.utc)
        result = get_publication_freshness("2026-10-23", "5 hours ago", now)

        self.assertEqual(result["hours_ago"], 5)
        self.assertEqual(result["posted_at_source"], "relative_time")

    def test_relative_time_is_marked_as_inferred_from_source(self):
        now = datetime.datetime(2026, 10, 24, 0, 0, tzinfo=datetime.timezone.utc)
        result = get_publication_freshness(None, "30 minutes ago", now)

        self.assertEqual(result["hours_ago"], 0.5)
        self.assertEqual(result["posted_at_source"], "relative_time")

    def test_future_posting_is_not_treated_as_fresh(self):
        now = datetime.datetime(2026, 10, 24, 0, 0, tzinfo=datetime.timezone.utc)
        self.assertIsNone(get_publication_freshness("2026-10-24T01:00:00Z", None, now))

    def test_remote_scope_requires_india_or_worldwide_eligibility(self):
        self.assertTrue(is_india_or_worldwide_remote("Anywhere in the world"))
        self.assertTrue(is_india_or_worldwide_remote("Remote - India"))
        self.assertFalse(is_india_or_worldwide_remote("Remote - United States only"))

    def test_jobicy_fetch_follows_cursor_and_keeps_source_listing_urls(self):
        first_page = {
            "jobs": [
                {
                    "jobTitle": "Junior Data Analyst",
                    "companyName": "Example",
                    "jobGeo": "Anywhere",
                    "jobLevel": "Entry-level",
                    "url": "https://jobicy.com/jobs/1",
                    "pubDate": "2026-10-24T00:00:00Z",
                    "jobDescription": "<p>SQL analytics</p>",
                }
            ],
            "nextCursor": "next page",
        }
        second_page = {
            "jobs": [
                {
                    "jobTitle": "Senior Data Analyst",
                    "companyName": "Example",
                    "jobGeo": "India",
                    "jobLevel": "Senior",
                    "url": "https://jobicy.com/jobs/2",
                    "pubDate": "2026-10-24T00:00:00Z",
                    "jobDescription": "Senior role",
                }
            ],
            "nextCursor": None,
        }
        responses = [first_page, second_page]
        requests = []

        def open_feed(request, timeout):
            requests.append(request.full_url)
            return nullcontext(io.BytesIO(json.dumps(responses.pop(0)).encode("utf-8")))

        with patch("collectors.live_job_collector.urllib.request.urlopen", side_effect=open_feed):
            jobs = fetch_live_jobicy_jobs()

        self.assertEqual(len(requests), 2)
        self.assertNotIn("industry=", requests[0])
        self.assertIn("cursor=next+page", requests[1])
        self.assertEqual([job["url"] for job in jobs], ["https://jobicy.com/jobs/1"])
        self.assertEqual(jobs[0]["source_domain"], "jobicy.com")

    def test_himalayas_fetch_follows_cursor_and_filters_level_and_location(self):
        published = int(time.time())
        first_page = {
            "jobs": [
                {
                    "title": "Junior Data Analyst",
                    "companyName": "Example",
                    "locationRestrictions": ["Anywhere in the World"],
                    "seniority": ["Junior"],
                    "applicationLink": "https://company.example/jobs/1",
                    "pubDate": published,
                    "description": "SQL and analytics",
                },
                {
                    "title": "Senior Data Analyst",
                    "companyName": "Example",
                    "locationRestrictions": ["India"],
                    "seniority": ["Senior"],
                    "applicationLink": "https://company.example/jobs/2",
                    "pubDate": published,
                    "description": "Senior role",
                },
            ],
            "nextCursor": "next page",
        }
        second_page = {
            "jobs": [
                {
                    "title": "Data Scientist",
                    "companyName": "Example",
                    "locationRestrictions": ["United States"],
                    "seniority": ["Entry-level"],
                    "applicationLink": "https://company.example/jobs/3",
                    "pubDate": published,
                    "description": "Entry-level role",
                },
            ],
            "nextCursor": None,
        }
        responses = [first_page, second_page]
        requests = []

        def open_feed(request, timeout):
            requests.append(request.full_url)
            return nullcontext(io.BytesIO(json.dumps(responses.pop(0)).encode("utf-8")))

        with patch("collectors.live_job_collector.urllib.request.urlopen", side_effect=open_feed):
            jobs = fetch_live_himalayas_jobs()

        self.assertEqual(len(requests), 2)
        self.assertIn("cursor=next+page", requests[1])
        self.assertEqual([job["url"] for job in jobs], ["https://company.example/jobs/1"])
        self.assertEqual(jobs[0]["source_type"], "Himalayas")
        self.assertEqual(jobs[0]["seniority"], "junior")

    def test_linkedin_search_uses_the_full_seven_day_display_window(self):
        requests = []

        def open_feed(request, timeout):
            requests.append(request.full_url)
            return nullcontext(io.BytesIO(b""))

        with patch("collectors.live_job_collector.urllib.request.urlopen", side_effect=open_feed):
            with patch("collectors.live_job_collector.time.sleep"):
                fetch_live_linkedin_jobs()

        self.assertEqual(len(requests), 4)
        self.assertTrue(all("f_TPR=r604800" in request for request in requests))

    def test_adzuna_skips_when_credentials_are_not_configured(self):
        with patch.dict(os.environ, {}, clear=True):
            with patch("collectors.live_job_collector.urllib.request.urlopen") as open_feed:
                self.assertEqual(fetch_live_adzuna_jobs(), [])
        open_feed.assert_not_called()

    def test_adzuna_fetches_fresh_entry_level_jobs_when_configured(self):
        published = datetime.datetime.now(datetime.timezone.utc).isoformat()
        result = {
            "results": [
                {
                    "title": "Data Analyst Intern",
                    "company": {"display_name": "Example"},
                    "location": {"display_name": "Bengaluru, India"},
                    "redirect_url": "https://adzuna.example/jobs/1",
                    "created": published,
                    "description": "Internship for new graduates",
                },
                {
                    "title": "Senior Data Scientist",
                    "company": {"display_name": "Example"},
                    "location": {"display_name": "India"},
                    "redirect_url": "https://adzuna.example/jobs/2",
                    "created": published,
                    "description": "Senior role",
                },
            ]
        }
        requests = []

        def open_feed(request, timeout):
            requests.append(request.full_url)
            return nullcontext(io.BytesIO(json.dumps(result).encode("utf-8")))

        with patch.dict(os.environ, {"ADZUNA_APP_ID": "test-id", "ADZUNA_APP_KEY": "test-key"}):
            with patch("collectors.live_job_collector.urllib.request.urlopen", side_effect=open_feed):
                jobs = fetch_live_adzuna_jobs()

        self.assertEqual(len(requests), 4)
        self.assertIn("max_days_old=7", requests[0])
        self.assertEqual([job["url"] for job in jobs], ["https://adzuna.example/jobs/1"] * 4)
        self.assertEqual(jobs[0]["source_type"], "Adzuna")

    def test_jsearch_skips_when_api_key_is_not_configured(self):
        with patch.dict(os.environ, {}, clear=True):
            with patch("collectors.live_job_collector.urllib.request.urlopen") as open_feed:
                self.assertEqual(fetch_live_jsearch_jobs(), [])
        open_feed.assert_not_called()

    def test_jsearch_fetches_fresh_entry_level_india_jobs(self):
        published = datetime.datetime.now(datetime.timezone.utc).isoformat()
        result = {
            "data": [
                {
                    "job_title": "Data Scientist",
                    "employer_name": "Example",
                    "job_city": "Bengaluru",
                    "job_state": "Karnataka",
                    "job_country": "India",
                    "job_is_remote": False,
                    "job_apply_link": "https://example.com/jobs/data-scientist",
                    "job_posted_at_datetime_utc": published,
                    "job_required_experience": {"no_experience_required": True},
                    "job_description": "Build data models with Python and SQL.",
                    "job_publisher": "Example Careers",
                },
                {
                    "job_title": "Senior Data Scientist",
                    "employer_name": "Example",
                    "job_city": "Bengaluru",
                    "job_state": "Karnataka",
                    "job_country": "India",
                    "job_is_remote": False,
                    "job_apply_link": "https://example.com/jobs/senior-data-scientist",
                    "job_posted_at_datetime_utc": published,
                    "job_required_experience": {"no_experience_required": False},
                    "job_description": "Senior role requiring 8 years.",
                },
            ]
        }
        requests = []

        def open_feed(request, timeout):
            requests.append(request)
            return nullcontext(io.BytesIO(json.dumps(result).encode("utf-8")))

        with patch.dict(os.environ, {"RAPIDAPI_KEY": "test-key"}):
            with patch("collectors.live_job_collector.urllib.request.urlopen", side_effect=open_feed):
                jobs = fetch_live_jsearch_jobs()

        self.assertEqual(len(requests), 4)
        self.assertIn("date_posted=week", requests[0].full_url)
        self.assertIn("country=in", requests[0].full_url)
        self.assertEqual(len(jobs), 4)
        self.assertEqual(jobs[0]["source_type"], "JSearch")
        self.assertEqual(jobs[0]["job_publisher"], "Example Careers")



from collectors.company_pages import (
    is_relevant_role,
    fetch_curated_indian_company_jobs,
    fetch_company_jobs,
)

class CompanyPagesTests(unittest.TestCase):
    def test_is_relevant_role_matching(self):
        self.assertTrue(is_relevant_role("Associate Data Scientist"))
        self.assertTrue(is_relevant_role("Product Research Specialist"))
        self.assertTrue(is_relevant_role("Credit Risk Analyst"))
        self.assertTrue(is_relevant_role("Decision Scientist - Logistics"))
        self.assertTrue(is_relevant_role("Product Manager I"))
        self.assertTrue(is_relevant_role("Applied Scientist"))
        self.assertFalse(is_relevant_role("Senior Machine Learning Engineer"))
        self.assertFalse(is_relevant_role("Lead Product Manager"))
        self.assertFalse(is_relevant_role("Frontend Developer"))
        self.assertFalse(is_relevant_role("Data Scientist (5+ years exp)"))

    def test_fetch_curated_indian_company_jobs(self):
        jobs = fetch_curated_indian_company_jobs()
        self.assertGreaterEqual(len(jobs), 8)
        companies = {j["company"] for j in jobs}
        self.assertIn("Flipkart", companies)
        self.assertIn("Swiggy", companies)
        self.assertIn("Zomato", companies)
        self.assertIn("PhonePe", companies)
        for j in jobs:
            self.assertEqual(j["source_type"], "Official Company Portal")
            self.assertTrue(j["url"].startswith("http"))
            self.assertIn("posted_at", j)


if __name__ == "__main__":
    unittest.main()

