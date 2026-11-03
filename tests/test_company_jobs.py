import datetime
import unittest
from unittest.mock import patch

from collectors import company_pages as collector


class CompanyJobTests(unittest.TestCase):
    def setUp(self):
        self.company = ('example', 'Example', 'https://example.com')
        self.date = datetime.datetime.now(datetime.timezone.utc).isoformat()
        self.url = 'https://job-boards.greenhouse.io/example/jobs/12345'

    def test_requires_requisition_path_and_real_host(self):
        for url in ('https://example.com/careers', 'https://jobs.lever.co/example',
                    'https://jobs.ashbyhq.com/example', 'https://jobs.smartrecruiters.com/Example',
                    'https://greenhouse.io.evil.com/example/jobs/123', 'javascript:alert(1)'):
            with self.subTest(url=url):
                self.assertFalse(collector.is_direct_company_job_url(url))
        self.assertTrue(collector.is_direct_company_job_url(self.url))

    def test_employer_description_and_timestamp_required(self):
        def make(desc, date=None):
            return collector._make_job(self.company, 'Data Scientist', 'Bengaluru, India',
                                       self.url, desc, date or self.date)
        self.assertIsNone(make('Build predictive models.'))
        self.assertIsNone(make('Graduate position requiring 3 years of experience.'))
        self.assertIsNone(make('Freshers welcome.', 'invalid'))
        job = make('Freshers welcome. Use Python and SQL.')
        self.assertTrue(job['company_job_verified'])
        self.assertEqual(job['raw_description'], 'Freshers welcome. Use Python and SQL.')
        self.assertIsNotNone(make('Graduate position. 0 - 2 years of experience.'))
        self.assertIsNone(make('Graduate position. 1 to 3 years of experience.'))

    def test_greenhouse_preserves_description_and_update_provenance(self):
        response = {'jobs': [{'title': 'Data Science Intern', 'location': {'name': 'Bengaluru, India'},
                             'content': '<p>Internship using SQL.</p>', 'absolute_url': self.url,
                             'updated_at': self.date}]}
        with patch.object(collector, '_get_json', return_value=response):
            jobs = collector.fetch_single_greenhouse(self.company)
        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0]['posted_at_source'], 'updated_at')
        self.assertEqual(jobs[0]['raw_description'], 'Internship using SQL.')

    def test_smartrecruiters_uses_detail_canonical_url(self):
        url = 'https://jobs.smartrecruiters.com/Example/12345-data-science-intern'
        responses = [{'content': [{'id': '12345', 'name': 'Data Science Intern'}]},
                     {'postingUrl': url, 'releasedDate': self.date,
                      'location': {'city': 'Bengaluru', 'country': 'in'},
                      'jobAd': {'sections': {'qualifications': {'text': 'Internship using SQL.'}}}}]
        with patch.object(collector, '_get_json', side_effect=responses):
            jobs = collector.fetch_single_smartrecruiters(self.company)
        self.assertEqual(jobs[0]['url'], url)
        self.assertNotIn('min_years_experience', jobs[0])

    def test_lever_includes_requirements_before_checking_eligibility(self):
        url = 'https://jobs.lever.co/example/12345678-1234-1234-1234-123456789abc'
        item = {'text': 'Data Scientist', 'categories': {'location': 'Bengaluru, India'},
                'hostedUrl': url, 'createdAt': datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000,
                'descriptionPlain': 'Graduate role.',
                'lists': [{'content': '<li>Requires 2 years of experience.</li>'}]}
        with patch.object(collector, '_get_json', return_value=[item]):
            self.assertEqual(collector.fetch_single_lever(self.company), [])
        item['lists'] = [{'content': '<li>No experience required. Use Python.</li>'}]
        with patch.object(collector, '_get_json', return_value=[item]):
            self.assertEqual(collector.fetch_single_lever(self.company)[0]['url'], url)

    def test_ashby_does_not_default_missing_location_to_india(self):
        item = {'title': 'Data Science Intern', 'descriptionPlain': 'Internship using Python.',
                'publishedAt': self.date,
                'jobUrl': 'https://jobs.ashbyhq.com/example/12345678-1234-1234-1234-123456789abc'}
        with patch.object(collector, '_get_json', return_value={'jobs': [item]}):
            self.assertEqual(collector.fetch_single_ashby(self.company), [])
        item['location'] = 'Bengaluru, India'
        with patch.object(collector, '_get_json', return_value={'jobs': [item]}):
            self.assertEqual(len(collector.fetch_single_ashby(self.company)), 1)

    def test_outage_never_produces_placeholder_jobs(self):
        with patch.object(collector, '_get_json', side_effect=OSError('offline')):
            self.assertEqual(collector.fetch_single_greenhouse(self.company), [])

    def test_legacy_company_records_are_purged(self):
        job = {'source_type': 'Official Company Portal', 'url': self.url}
        self.assertTrue(collector.is_unverified_company_job(job))
        job['company_job_verified'] = True
        self.assertFalse(collector.is_unverified_company_job(job))
        job['url'] = 'https://example.com/careers'
        self.assertTrue(collector.is_unverified_company_job(job))


if __name__ == '__main__':
    unittest.main()
