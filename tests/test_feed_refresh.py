import datetime
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import BackgroundTasks
from fastapi.testclient import TestClient

import hourly_pipeline
import server
from collectors.live_job_collector import fetch_live_linkedin_jobs
from processing.feed_freshness import dated_jobs


class FeedFreshnessTests(unittest.TestCase):
    def test_source_dates_override_cached_age_and_sort_newest_first(self):
        now = datetime.datetime(2026, 11, 3, 12, tzinfo=datetime.timezone.utc)
        jobs = [
            {'title': 'Old', 'posted_at': '2026-11-03T10:00:00Z', 'hours_ago': 0},
            {'title': 'New', 'posted_at': '2026-11-03T11:50:00Z', 'hours_ago': 99},
            {'title': 'Unknown', 'hours_ago': 0},
            {'title': 'Future', 'posted_at': '2026-11-04T12:00:00Z', 'hours_ago': 0},
        ]
        result = dated_jobs(jobs, now, max_hours=1)
        self.assertEqual([job['title'] for job in result], ['New'])
        self.assertAlmostEqual(result[0]['hours_ago'], 1 / 6, places=3)
        self.assertEqual(jobs[1]['hours_ago'], 99)

    def test_linkedin_requests_date_sort_and_skips_undated_results(self):
        markup = b'''<li><h3 class="base-search-card__title">Data Science Intern</h3>
          <h4 class="base-search-card__subtitle">Example</h4>
          <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/1234567890"></a></li>'''
        from unittest.mock import MagicMock
        response = MagicMock()
        response.__enter__.return_value.read.return_value = markup
        with patch('urllib.request.urlopen', return_value=response) as request, patch('time.sleep'):
            self.assertEqual(fetch_live_linkedin_jobs(max_queries=1), [])
        from urllib.parse import parse_qs, urlsplit
        params = parse_qs(urlsplit(request.call_args.args[0].full_url).query)
        self.assertEqual(params['sortBy'], ['DD'])
        self.assertEqual(params['f_TPR'], ['r172800'])

    def test_pipeline_keeps_empty_feed_empty_and_never_injects_samples(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'docs').mkdir()
            (root / 'data.json').write_text(json.dumps({'jobs': []}), encoding='utf-8')
            (root / 'profile.json').write_text('{}', encoding='utf-8')
            with patch.object(hourly_pipeline, 'ROOT_DIR', folder), \
                 patch.object(hourly_pipeline, 'collect_and_score_all_live_jobs', return_value=[]):
                count, added = hourly_pipeline.run_hourly_sync()
            self.assertEqual((count, added), (0, 0))
            self.assertEqual(json.loads((root / 'data.json').read_text(encoding='utf-8'))['jobs'], [])


class SyncApiTests(unittest.TestCase):
    def test_api_recalculates_age_and_disables_caching(self):
        now = datetime.datetime.now(datetime.timezone.utc)
        feed = {'jobs': [{'posted_at': (now - datetime.timedelta(hours=4)).isoformat(), 'hours_ago': 0},
                         {'posted_at': (now - datetime.timedelta(minutes=10)).isoformat(), 'hours_ago': 50}]}
        with patch.object(server, 'load_jobs_data', return_value=feed):
            response = TestClient(server.app).get('/api/jobs?max_hours=1')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['cache-control'], 'no-store')
        self.assertEqual(response.json()['total'], 1)
        self.assertLess(response.json()['jobs'][0]['hours_ago'], 1)

    def test_repeated_sync_requests_queue_only_one_collection(self):
        first, second = BackgroundTasks(), BackgroundTasks()
        try:
            self.assertEqual(server.trigger_sync(first)['status'], 'processing')
            self.assertEqual(server.trigger_sync(second)['status'], 'processing')
            self.assertEqual(len(first.tasks), 1)
            self.assertEqual(len(second.tasks), 0)
            with patch.object(hourly_pipeline, 'run_hourly_sync', return_value=(1, 1)):
                first.tasks[0].func()
            self.assertEqual(server.SYNC_STATE['status'], 'complete')
            self.assertFalse(server.SYNC_LOCK.locked())
        finally:
            if server.SYNC_LOCK.locked():
                server.SYNC_LOCK.release()

    def test_failure_is_visible_and_releases_sync_lock(self):
        tasks = BackgroundTasks()
        server.trigger_sync(tasks)
        with patch.object(hourly_pipeline, 'run_hourly_sync', side_effect=RuntimeError('Feed unavailable')):
            tasks.tasks[0].func()
        self.assertEqual(server.SYNC_STATE['status'], 'error')
        self.assertEqual(server.SYNC_STATE['error'], 'Feed unavailable')
        self.assertFalse(server.SYNC_LOCK.locked())


if __name__ == '__main__':
    unittest.main()
