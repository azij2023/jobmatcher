import datetime
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import hourly_pipeline
from collectors import multi_channel_collector


class ExactJobLinksTests(unittest.TestCase):
    def test_legacy_rss_card_is_identified_without_blocking_direct_job(self):
        rss = {'source_type': 'Apna', 'posted_at_source': 'Apna Live Feed',
               'url': 'https://apna.co/jobs?q=Data+Scientist'}
        self.assertTrue(multi_channel_collector.is_unverified_rss_job(rss))
        self.assertFalse(multi_channel_collector.is_unverified_rss_job({
            **rss, 'posted_at_source': 'published_at',
            'url': 'https://apna.co/job/data-scientist-123'}))

    def test_rss_search_results_are_not_collected_as_jobs(self):
        with patch.object(multi_channel_collector, 'fetch_platform_rss') as rss, \
             patch.object(multi_channel_collector, 'fetch_remoteok_jobs',
                          return_value=[{'title': 'Data Analyst', 'company': 'Example',
                                         'url': 'https://remoteok.com/remote-jobs/example'}]):
            jobs = multi_channel_collector.fetch_all_channel_jobs()
        rss.assert_not_called()
        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0]['url'], 'https://remoteok.com/remote-jobs/example')

    def test_pipeline_purges_existing_rss_search_card(self):
        now = datetime.datetime.now(datetime.timezone.utc)
        legacy = {
            'title': 'Data Scientist in Hero Motocorp Limited',
            'company': 'Hero Motocorp Limited',
            'location': 'India',
            'url': 'https://apna.co/jobs?q=Data+Scientist+in+Hero+Motocorp+Limited&experience=0',
            'source_type': 'Apna',
            'posted_at_source': 'Apna Live Feed',
            'posted_at': (now - datetime.timedelta(hours=1)).isoformat(),
            'hours_ago': 1,
        }
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'docs').mkdir()
            (root / 'data.json').write_text(json.dumps({'jobs': [legacy]}), encoding='utf-8')
            (root / 'profile.json').write_text('{}', encoding='utf-8')
            with patch.object(hourly_pipeline, 'ROOT_DIR', folder), \
                 patch.object(hourly_pipeline, 'collect_and_score_all_live_jobs', return_value=[]):
                count, added = hourly_pipeline.run_hourly_sync()
            self.assertEqual((count, added), (0, 0))
            self.assertEqual(json.loads((root / 'data.json').read_text(encoding='utf-8'))['jobs'], [])


if __name__ == '__main__':
    unittest.main()
