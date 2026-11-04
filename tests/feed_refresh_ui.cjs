const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function check(file) {
  const source = fs.readFileSync(file, 'utf8');
  const helpers = source.slice(source.indexOf('  let refreshInFlight ='), source.indexOf('  if (navRefreshBtn) {', source.indexOf('  function setupRealtimeLiveStream()')));
  const old = { last_updated: '2026-11-03T10:00:00Z', jobs: [{ title: 'Old' }] };
  const latest = { last_updated: '2026-11-03T14:00:00Z', jobs: [{ title: 'New' }] };
  const empty = { last_updated: '2026-11-03T15:00:00Z', jobs: [] };
  let calls = [];
  const context = vm.createContext({
    URL, AbortController, setTimeout: (fn, ms) => ms === 3000 ? setImmediate(fn) : setTimeout(fn, ms), clearTimeout, setInterval,
    window: { location: { href: 'https://example.com/' } }, data: old, jobs: old.jobs, stats: {}, profile: {},
    document: { querySelectorAll: () => [] }, escapeHTML: value => value,
    navRefreshBtn: null, navRefreshIcon: null, navRefreshLabel: null,
    hasVerifiedPublicationTime: () => true, mergeSavedCustomJobs() {}, initStats() {}, updateFilterPillCounts() {},
    renderJobs() {}, renderCuratedFeed() {}, renderCompanySites() {}, renderAppliedJobs() {}, showToast() {}, console,
    fetch: async endpoint => {
      calls.push(endpoint);
      return { ok: true, json: async () => endpoint.includes('/api/jobs') ? latest : old };
    }
  });
  const freshness = source.slice(source.indexOf('  function getJobFreshness('), source.indexOf('  const DOMAIN_EXPANSIONS'));
  vm.runInContext(freshness + helpers, context);
  assert.equal(context.chooseLatestFeed([old, latest]), latest);
  assert.equal(context.chooseLatestFeed([old, latest, empty]), empty);
  assert.equal(context.chooseLatestFeed([{ last_updated: 'invalid', jobs: [] }]), null);
  await context.refreshJobsLive(true);
  assert.equal(context.data.last_updated, latest.last_updated);
  assert.equal(context.jobs[0].title, 'New');
  assert.equal(calls.length, 4);

  // Empty newer snapshots must clear stale cards instead of reviving older jobs.
  context.fetch = async () => ({ ok: true, json: async () => empty });
  await context.refreshJobsLive(true);
  assert.equal(context.jobs.length, 0);

  // A manual refresh requests collection and waits for completion before reloading.
  calls = [];
  context.data = old;
  context.fetch = async (endpoint, options) => {
    calls.push([endpoint, options.method]);
    return { ok: true, json: async () => endpoint === './api/sync' ? { status: 'processing' }
      : endpoint === './api/sync/status' ? { status: 'complete' } : latest };
  };
  await context.refreshJobsLive(false);
  assert.ok(calls.some(([url, method]) => url === './api/sync' && method === 'POST'));
  assert.ok(calls.some(([url]) => url === './api/sync/status'));

  // An automatic tick must not launch overlapping requests while refresh is pending.
  const pending = [];
  context.fetch = endpoint => new Promise(resolve => pending.push(() => resolve({ ok: true, json: async () => latest })));
  const first = context.refreshJobsLive(true);
  await context.refreshJobsLive(true);
  assert.equal(pending.length, 4);
  pending.forEach(resolve => resolve());
  await first;
  console.log(`${file}: newest snapshot, empty feed, backend sync and overlapping-refresh checks passed`);
}

(async () => {
  for (const file of ['app.js', 'docs/app.js']) await check(file);
})().catch(error => { console.error(error); process.exitCode = 1; });
