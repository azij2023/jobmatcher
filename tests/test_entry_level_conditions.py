"""Regression checks for evidence-based fresher matching."""

import json
import datetime
import io
import unittest
from pathlib import Path
from contextlib import nullcontext
from unittest.mock import patch

from matching.scoring import score_job
from collectors.live_job_collector import fetch_live_linkedin_jobs


PROFILE = json.loads((Path(__file__).resolve().parents[1] / "profile.json").read_text(encoding="utf-8"))


class EntryLevelConditionsTests(unittest.TestCase):
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

    def test_experience_requirement_wins_over_fresher_claim(self):
        for requirement in ("3 years of experience", "2 yrs exp", "1+ years experience"):
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
                self.assertIn("Job demands", result["rejection_reason"])


if __name__ == "__main__":
    unittest.main()
