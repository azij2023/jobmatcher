import datetime
import unittest

from collectors.live_job_collector import (
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


if __name__ == "__main__":
    unittest.main()
