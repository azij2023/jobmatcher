import datetime
import io
import json
import unittest
from contextlib import nullcontext
from unittest.mock import patch

from collectors.live_job_collector import (
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
        self.assertIn("cursor=next+page", requests[1])
        self.assertEqual([job["url"] for job in jobs], ["https://jobicy.com/jobs/1"])
        self.assertEqual(jobs[0]["source_domain"], "jobicy.com")


if __name__ == "__main__":
    unittest.main()
