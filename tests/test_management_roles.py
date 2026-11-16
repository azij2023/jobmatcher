import json
import unittest
from pathlib import Path

from collectors.company_pages import is_relevant_role
from collectors.live_job_collector import _is_entry_level_listing
from collectors.multi_channel_collector import is_fresher_eligible
from matching.scoring import score_job


class ManagementRoleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.profile = json.loads((Path(__file__).resolve().parents[1] / 'profile.json').read_text(encoding='utf-8'))

    def job(self, title, years=0):
        return dict(title=title, company='Example', location='Bengaluru, India',
                    url='https://example.com/jobs/123', hours_ago=1,
                    raw_description='Fresh graduates welcome. Python, SQL and communication required.',
                    min_years_experience=years, seniority='manager' if 'manager' in title.lower() else 'fresher',
                    required_skills=['python', 'sql', 'communication'])

    def test_management_tracks_survive_collection_and_scoring(self):
        for title, category in [
            ('Associate AI Product Manager', 'Product'),
            ('Junior Data Product Manager', 'Product'),
            ('Analytics Management Trainee', 'Strategy / Programs'),
            ('Junior Analytics Manager', 'Strategy / Programs'),
            ('Data Science Project Coordinator', 'Strategy / Programs'),
            ('AI Program Coordinator', 'Strategy / Programs'),
        ]:
            with self.subTest(title=title):
                self.assertTrue(is_relevant_role(title))
                self.assertTrue(is_fresher_eligible(title))
                self.assertTrue(_is_entry_level_listing(title, self.job(title)['seniority'], 'Fresh graduates welcome.'))
                result = score_job(self.job(title), self.profile)
                self.assertFalse(result['rejected'], result)
                self.assertEqual(result['category'], category)

    def test_additional_analytics_roles_survive_collection_and_scoring(self):
        for title, category in [
            ('Strategy Analyst', 'Strategy / Programs'),
            ('Marketing Analyst', 'Strategy / Programs'),
            ('Marketing Analytics Intern', 'Strategy / Programs'),
            ('Marketing Data Analyst', 'Strategy / Programs'),
            ('Operations Analyst', 'Strategy / Programs'),
            ('Operations Analytics Intern', 'Strategy / Programs'),
            ('HR Analytics Analyst', 'Strategy / Programs'),
            ('HR Analytics Intern', 'Strategy / Programs'),
            ('People Analytics Analyst', 'Strategy / Programs'),
            ('People Analytics Intern', 'Strategy / Programs'),
            ('Financial Analytics Analyst', 'Decision Science'),
            ('Financial Analytics Intern', 'Decision Science'),
            ('Finance Data Analyst', 'Decision Science'),
            ('Supply Chain Analytics Analyst', 'OR / Optimization'),
            ('Supply Chain Analytics Intern', 'OR / Optimization'),
            ('Logistics Analyst', 'OR / Optimization'),
            ('Inventory Analyst', 'OR / Optimization'),
            ('Demand Planning Analyst', 'OR / Optimization'),
        ]:
            with self.subTest(title=title):
                self.assertTrue(is_relevant_role(title))
                self.assertTrue(is_fresher_eligible(title))
                self.assertTrue(_is_entry_level_listing(title, 'fresher', 'Fresh graduates welcome.'))
                result = score_job(self.job(title), self.profile)
                self.assertFalse(result['rejected'], result)
                self.assertEqual(result['category'], category)

    def test_senior_and_experienced_managers_still_rejected(self):
        for title, years in [('Senior Analytics Manager', 0), ('Data Science Manager', 0),
                             ('Junior Analytics Manager', 2), ('Associate AI Product Manager', 1)]:
            with self.subTest(title=title, years=years):
                self.assertTrue(score_job(self.job(title, years), self.profile)['rejected'])

    def test_unrelated_management_roles_are_not_targeted(self):
        self.assertFalse(is_relevant_role('Retail Management Trainee'))
        self.assertTrue(score_job(self.job('Retail Management Trainee'), self.profile)['rejected'])
