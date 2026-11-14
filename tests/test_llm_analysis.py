import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from contextlib import ExitStack

from llm.analysis import JobAnalyzer
from llm.job_extractor import JobExtractor
from matching.semantic_gaps import enrich_job_semantic_gaps


class AnalysisTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.path = Path(self.folder.name) / 'cache.sqlite3'
        self.extractor = JobExtractor()
        self.extractor.llm.is_configured = True
        self.result = dict(role_type='Data Science Intern', role_category='Data Science',
                           seniority='intern', min_years_experience=0, max_years_experience=None,
                           required_skills=['Python', 'Apache Spark'], nice_to_have=[], domain='technology')

    def analyzer(self, **kwargs):
        return JobAnalyzer(self.path, self.extractor, **kwargs)

    def test_success_cached_across_runs_but_changed_description_reanalysed(self):
        with patch.object(self.extractor.llm, 'chat', return_value=json.dumps(self.result)) as chat:
            first = self.analyzer().analyze('Data Science Intern', 'Python required')
            cached = self.analyzer().analyze('Data Science Intern', 'Python required')
            changed = self.analyzer().analyze('Data Science Intern', 'Python and Spark required')
        self.assertEqual(chat.call_count, 2)
        self.assertEqual(first['required_skills'], ['python', 'apache_spark'])
        self.assertEqual(first['analysis_method'], 'llm')
        self.assertTrue(cached['analysis_cached'])
        self.assertFalse(changed['analysis_cached'])

    def test_invalid_output_falls_back_and_is_retried_next_run(self):
        for output in ('[]', '{"required_skills":"Python"}', 'not json'):
            with self.subTest(output=output), patch.object(self.extractor.llm, 'chat', return_value=output) as chat:
                analyzer = self.analyzer()
                self.assertEqual(analyzer.analyze('Intern', 'Python')['analysis_method'], 'fallback')
                analyzer.analyze('Another intern', 'SQL')
                self.assertEqual(chat.call_count, 1)
                self.analyzer().analyze('Intern', 'Python')
                self.assertEqual(chat.call_count, 2)

    def test_missing_key_and_budget_never_call_api(self):
        with patch.object(self.extractor.llm, 'chat') as chat:
            self.assertEqual(self.analyzer(max_calls=0).analyze('Intern', 'Python')['analysis_method'], 'fallback')
            self.extractor.llm.is_configured = False
            self.assertEqual(self.analyzer().analyze('Intern', 'Python')['analysis_method'], 'fallback')
            chat.assert_not_called()

    def test_timeout_falls_back(self):
        with patch.object(self.extractor.llm, 'chat', side_effect=TimeoutError):
            self.assertEqual(self.analyzer().analyze('Intern', 'Python')['analysis_method'], 'fallback')

    def test_templates_preserve_real_missing_requirements(self):
        job = enrich_job_semantic_gaps({'tier': 2, 'missing_skills': ['apache_spark']})
        self.assertEqual(job['missing_skills'], ['apache_spark'])
        self.assertEqual(job['semantic_skill_gap']['method'], 'template')

    def test_collector_passes_extracted_requirements_to_scoring(self):
        from collectors import live_job_collector as collector
        extracted = dict(self.result, required_skills=['python', 'apache_spark'],
                         analysis_method='llm', analysis_model='test-model', analysis_cached=False)
        raw = dict(title='Data Science Intern', company='Example', url='https://example.com/jobs/123',
                   location='Bengaluru, India', raw_description='Python and Apache Spark required.',
                   hours_ago=1, source_type='Company Portal', source_domain='example.com',
                   posted_at='2026-11-05T08:00:00Z', relative_time='1 hour ago')
        with ExitStack() as stack:
            for name in ('fetch_live_unstop_jobs', 'fetch_live_linkedin_jobs', 'fetch_live_remotive_jobs',
                         'fetch_live_jobicy_jobs', 'fetch_live_himalayas_jobs', 'fetch_live_adzuna_jobs', 'fetch_live_jsearch_jobs'):
                stack.enter_context(patch.object(collector, name, return_value=[]))
            stack.enter_context(patch('collectors.company_pages.fetch_company_jobs', return_value=[raw]))
            stack.enter_context(patch('collectors.multi_channel_collector.fetch_all_channel_jobs', return_value=[]))
            analyzer = stack.enter_context(patch.object(collector, 'JobAnalyzer'))
            analyzer.return_value.analyze.return_value = extracted
            score = stack.enter_context(patch.object(collector, 'score_job', return_value={
                'rejected': False, 'final_score': .8, 'tier': 2,
                'matched_skills': ['python'], 'missing_skills': ['apache_spark']}))
            jobs = collector.collect_and_score_all_live_jobs()
        self.assertEqual(score.call_args.args[0]['required_skills'], ['python', 'apache_spark'])
        self.assertEqual(score.call_args.args[0]['min_years_experience'], 0)
        self.assertEqual(jobs[0]['analysis_method'], 'llm')
        self.assertEqual(jobs[0]['missing_skills'], ['apache_spark'])


if __name__ == '__main__':
    unittest.main()
