import json
import unittest
from pathlib import Path

from matching.scoring import score_job


PROFILE_PATH = Path(__file__).resolve().parents[1] / "profile.json"


class LocationScoringTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with PROFILE_PATH.open(encoding="utf-8") as profile_file:
            cls.profile = json.load(profile_file)

    def score_remote_job(self, location):
        return score_job(
            {
                "title": "Junior Data Scientist",
                "location": location,
                "seniority": "junior",
                "hours_ago": 2,
                "raw_description": "Entry-level role using Python and SQL.",
                "required_skills": [],
            },
            self.profile,
        )

    def test_worldwide_remote_is_allowed(self):
        self.assertFalse(self.score_remote_job("Remote (Worldwide)")["rejected"])

    def test_apac_remote_is_allowed(self):
        self.assertFalse(self.score_remote_job("Remote (APAC)")["rejected"])

    def test_country_restricted_remote_is_rejected(self):
        result = self.score_remote_job("Remote - United States only")
        self.assertTrue(result["rejected"])
        self.assertIn("outside India or worldwide remote", result["rejection_reason"])

    def test_data_analyst_is_a_matched_fresher_role(self):
        result = score_job(
            {
                "title": "Junior Data Analyst",
                "location": "Bengaluru, India",
                "seniority": "junior",
                "hours_ago": 2,
                "raw_description": "Entry-level job using SQL and Python.",
                "required_skills": [],
            },
            self.profile,
        )

        self.assertFalse(result["rejected"])
        self.assertEqual(result["category"], "Data Science")


if __name__ == "__main__":
    unittest.main()
