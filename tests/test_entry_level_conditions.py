"""Regression checks for evidence-based fresher matching."""

import json
import datetime
import io
import os
import unittest
from pathlib import Path
from contextlib import nullcontext
from unittest.mock import patch

from matching.scoring import score_job
from llm.job_extractor import JobExtractor
from collectors.live_job_collector import (
    _is_entry_level_listing,
    fetch_live_jsearch_jobs,
    fetch_live_linkedin_jobs,
)
from collectors.linkedin_post_fetcher import parse_linkedin_post_text


PROFILE = json.loads((Path(__file__).resolve().parents[1] / "profile.json").read_text(encoding="utf-8"))


class EntryLevelConditionsTests(unittest.TestCase):
    def test_predicted_category_cannot_make_unrelated_title_a_match(self):
        result = score_job({
            "title": "AI Campus Ambassador Internship",
            "company": "Example",
            "location": "India",
            "url": "https://example.com/job/123",
            "role_type": "standardized",
            "role_category": "Data Science",
            "seniority": "intern",
            "raw_description": "Promote the campus program to students. No experience required.",
        }, PROFILE)

        self.assertTrue(result["rejected"])
        self.assertIn("does not match any target role", result["rejection_reason"])

    def test_fallback_extractor_does_not_default_unknown_roles_to_data_science(self):
        result = JobExtractor()._heuristic_extract(
            "Promote the campus program to students.", title="Campus Ambassador Internship"
        )
        self.assertEqual(result["role_category"], "Other")

    def test_fallback_parser_does_not_infer_zero_years_from_fresher_label_alone(self):
        result = JobExtractor()._heuristic_extract(
            "Freshers welcome.", title="Data Analyst"
        )
        self.assertIsNone(result["min_years_experience"])

    def test_category_match_with_relevant_title_is_retained(self):
        result = score_job({
            "title": "Business Analytics Intern",
            "company": "Example",
            "location": "India",
            "url": "https://example.com/job/456",
            "role_type": "standardized",
            "role_category": "Data Science",
            "seniority": "intern",
            "raw_description": "Analyze business data with Python. No experience required.",
        }, PROFILE)
        self.assertFalse(result["rejected"], result)

    def test_rejects_fresher_label_without_explicit_zero_year_eligibility(self):
        result = score_job({
            "title": "Junior Data Scientist",
            "company": "Example",
            "location": "Bengaluru, India",
            "url": "https://example.com/job/123",
            "seniority": "junior",
            "role_category": "Data Science",
            "raw_description": "Fresh graduate applicants welcome for this data science role.",
        }, PROFILE)

        self.assertTrue(result["rejected"])
        self.assertIn("explicit fresher/zero-year signal", result["rejection_reason"])

    def test_rejects_unspecified_experience_without_fresher_signal(self):
        result = score_job({
            "title": "Junior Data Scientist",
            "company": "Example",
            "location": "Bengaluru, India",
            "url": "https://example.com/job/123",
            "seniority": "junior",
            "role_category": "Data Science",
            "raw_description": "Junior role on the data science team.",
        }, PROFILE)

        self.assertTrue(result["rejected"])
        self.assertIn("explicit fresher/zero-year signal", result["rejection_reason"])

    def test_fallback_parser_does_not_turn_unspecified_experience_into_zero(self):
        result = JobExtractor()._heuristic_extract(
            "Analyze business data and communicate results.", title="Data Analyst"
        )

        self.assertIsNone(result["min_years_experience"])
        self.assertIsNone(result["max_years_experience"])

    def test_fallback_parser_preserves_zero_to_two_year_fresher_range(self):
        result = JobExtractor()._heuristic_extract(
            "Freshers welcome; candidates with 0-2 years of experience may apply.",
            title="Data Analyst",
        )

        self.assertEqual(result["min_years_experience"], 0)
        self.assertEqual(result["max_years_experience"], 2)

    def test_legacy_fallback_zero_default_is_not_mislabeled_as_fresher(self):
        result = score_job({
            "title": "Data Analyst",
            "company": "Example",
            "location": "Bengaluru, India",
            "url": "https://example.com/job/123",
            "seniority": "junior",
            "analysis_method": "fallback",
            "min_years_experience": 0,
            "max_years_experience": 2,
            "role_category": "Data Science",
            "raw_description": "Analyze business data and communicate results.",
        }, PROFILE)

        self.assertTrue(result["rejected"])
        self.assertIn("explicit fresher/zero-year signal", result["rejection_reason"])

    def test_accepts_zero_to_two_years_only_with_fresher_signal(self):
        for requirement in ("0-2 years of experience", "0 to 2 years experience"):
            with self.subTest(requirement=requirement):
                result = score_job({
                    "title": "Data Scientist",
                    "company": "Example",
                    "location": "Bengaluru, India",
                    "url": "https://example.com/job/123",
                    "raw_description": f"Freshers welcome. Requires {requirement}.",
                }, PROFILE)
                self.assertFalse(result["rejected"], result)

    def test_requires_zero_year_eligibility_and_rejects_above_two_years(self):
        for requirement in ("1-2 years of experience", "3 years of experience",
                            "3+ years experience", "0-3 years of experience"):
            with self.subTest(requirement=requirement):
                result = score_job({
                    "title": "Junior Data Analyst",
                    "company": "Example",
                    "location": "Bengaluru, India",
                    "url": "https://example.com/job/123",
                    "seniority": "junior",
                    "raw_description": f"Freshers welcome. Requires {requirement}.",
                }, PROFILE)
                self.assertTrue(result["rejected"])
                self.assertIn("zero-year eligibility", result["rejection_reason"])

    def test_structured_experience_values_enforce_zero_to_two_years(self):
        base_job = {
            "title": "Data Analyst",
            "company": "Example",
            "location": "Bengaluru, India",
            "url": "https://example.com/job/123",
            "raw_description": "Freshers welcome.",
        }
        for experience, expected_rejected in (
            ({"min_years_experience": 0, "max_years_experience": 2}, False),
            ({"min_years_experience": 1, "max_years_experience": 2}, True),
            ({"min_years_experience": 0, "max_years_experience": 3}, True),
        ):
            with self.subTest(experience=experience):
                result = score_job({**base_job, **experience}, PROFILE)
                self.assertEqual(result["rejected"], expected_rejected, result)

    def test_linkedin_post_parser_preserves_experience_requirement(self):
        job = parse_linkedin_post_text(
            "Hiring a data scientist in Bengaluru with 4 years of experience."
        )
        self.assertEqual(job["min_years_experience"], 4)
        self.assertFalse(job["is_fresher"])

    def test_rejects_data_entry_job_misclassified_as_data_science(self):
        result = score_job({
            "title": "Data Entry Operator",
            "company": "Example",
            "location": "India",
            "url": "https://example.com/job/123",
            "seniority": "fresher",
            "role_category": "Data Science",
            "min_years_experience": 0,
            "raw_description": "Fresher data entry role. 0 years experience required.",
        }, PROFILE)

        self.assertTrue(result["rejected"])
        self.assertIn("excluded keyword: 'data entry'", result["rejection_reason"])

    def test_linkedin_reads_employer_description_and_internship_type(self):
        posted = datetime.datetime.now(datetime.timezone.utc).isoformat()
        search = f'''<li><h3 class="base-search-card__title">Business Analyst</h3>
          <h4 class="base-search-card__subtitle">Example</h4>
          <span class="job-search-card__location">India</span>
          <a class="base-card__full-link" href="https://in.linkedin.com/jobs/view/business-analyst-1234567890"></a>
          <time datetime="{posted}">1 hour ago</time></li>'''
        detail = '''<div class="show-more-less-html__markup">Business Analyst Internship. No experience required.</div>
          <li class="description__job-criteria-item"><h3>Seniority level</h3><span>Internship</span></li>
          <li class="description__job-criteria-item"><h3>Employment type</h3><span>Internship</span></li>'''

        def open_page(request, timeout):
            page = detail if '/jobs/view/' in request.full_url else search
            return nullcontext(io.BytesIO(page.encode('utf-8')))

        with patch('collectors.live_job_collector.urllib.request.urlopen', side_effect=open_page):
            with patch('collectors.live_job_collector.time.sleep'):
                jobs = fetch_live_linkedin_jobs(max_queries=1)
        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0]['raw_description'], 'Business Analyst Internship. No experience required.')
        self.assertTrue(jobs[0]['is_internship'])
        self.assertEqual(jobs[0]['seniority'], 'intern')

    def test_linkedin_skips_unreadable_or_senior_detail(self):
        posted = datetime.datetime.now(datetime.timezone.utc).isoformat()
        search = f'''<li><h3 class="base-search-card__title">Data Analyst</h3>
          <h4 class="base-search-card__subtitle">Example</h4>
          <a class="base-card__full-link" href="https://in.linkedin.com/jobs/view/data-analyst-1234567890"></a>
          <time datetime="{posted}">1 hour ago</time></li>'''
        for detail in ('<html>No job details</html>',
                       '<div class="show-more-less-html__markup">Freshers welcome.</div>'
                       '<li class="description__job-criteria-item"><h3>Seniority level</h3><span>Mid-Senior level</span></li>'):
            with self.subTest(detail=detail):
                def open_page(request, timeout):
                    page = detail if '/jobs/view/' in request.full_url else search
                    return nullcontext(io.BytesIO(page.encode('utf-8')))
                with patch('collectors.live_job_collector.urllib.request.urlopen', side_effect=open_page):
                    with patch('collectors.live_job_collector.time.sleep'):
                        self.assertEqual(fetch_live_linkedin_jobs(max_queries=1), [])

    def test_live_linkedin_requires_fresher_signal_and_zero_to_two_years(self):
        self.assertTrue(_is_entry_level_listing("Data Analyst", "", "Freshers welcome; 0-2 years experience."))
        self.assertTrue(_is_entry_level_listing(
            "Data Analyst Intern", "", "Internship; no experience required."
        ))
        self.assertFalse(_is_entry_level_listing("Data Analyst", "", "Analyze business data."))
        self.assertFalse(_is_entry_level_listing("Data Analyst", "", "Freshers welcome; 1-2 years experience."))
        self.assertFalse(_is_entry_level_listing("Data Analyst", "", "Freshers welcome; requires 3 years experience."))

    def test_jsearch_maps_explicit_zero_year_metadata_and_skips_positive_minimums(self):
        published = datetime.datetime.now(datetime.timezone.utc).isoformat()
        data = {
            "data": [
                {
                    "job_title": "Data Scientist",
                    "employer_name": "Example",
                    "job_city": "Bengaluru",
                    "job_country": "India",
                    "job_apply_link": "https://example.com/jobs/data-scientist",
                    "job_posted_at_datetime_utc": published,
                    "job_required_experience": {"no_experience_required": True},
                    "job_description": "Build data models with Python.",
                },
                {
                    "job_title": "Fresher Data Analyst",
                    "employer_name": "Example",
                    "job_city": "Bengaluru",
                    "job_country": "India",
                    "job_apply_link": "https://example.com/jobs/data-analyst",
                    "job_posted_at_datetime_utc": published,
                    "job_required_experience": {"required_experience_in_months": 6},
                    "job_description": "Freshers welcome.",
                },
            ]
        }

        with patch.dict(os.environ, {"RAPIDAPI_KEY": "test-key"}):
            with patch(
                "collectors.live_job_collector.urllib.request.urlopen",
                return_value=nullcontext(io.BytesIO(json.dumps(data).encode("utf-8"))),
            ):
                jobs = fetch_live_jsearch_jobs()

        self.assertTrue(jobs)
        self.assertTrue(all(job["title"] == "Data Scientist" for job in jobs))
        self.assertTrue(all(job["min_years_experience"] == 0 for job in jobs))
        self.assertTrue(all("No experience required." in job["raw_description"] for job in jobs))

    def test_experience_requirement_wins_over_fresher_claim(self):
        for requirement in ("3 years of experience", "0-3 years experience", "1-2 years experience"):
            with self.subTest(requirement=requirement):
                result = score_job({
                    "title": "Junior Data Analyst",
                    "company": "Example",
                    "location": "Bengaluru, India",
                    "url": "https://example.com/job/123",
                    "seniority": "junior",
                    "is_fresher": True,
                    "raw_description": f"Freshers welcome. Requires {requirement}.",
                }, PROFILE)
                self.assertTrue(result["rejected"])
                self.assertIn("zero-year eligibility", result["rejection_reason"])


if __name__ == "__main__":
    unittest.main()
