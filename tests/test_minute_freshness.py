import datetime
import unittest

from collectors.linkedin_post_fetcher import parse_linkedin_post_text


class MinuteFreshnessTests(unittest.TestCase):
    def test_linkedin_post_preserves_minute_age_and_utc_timestamp(self):
        for minutes in (1, 5, 30, 59):
            with self.subTest(minutes=minutes):
                before = datetime.datetime.now(datetime.timezone.utc)
                job = parse_linkedin_post_text(f'Hiring a data scientist fresher. Posted {minutes} minutes ago')
                after = datetime.datetime.now(datetime.timezone.utc)
                self.assertAlmostEqual(job['hours_ago'], minutes / 60)
                posted = datetime.datetime.fromisoformat(job['posted_at'].replace('Z', '+00:00'))
                self.assertEqual(posted.utcoffset(), datetime.timedelta(0))
                age = datetime.timedelta(minutes=minutes)
                self.assertGreaterEqual(posted, before - age - datetime.timedelta(seconds=1))
                self.assertLessEqual(posted, after - age)

