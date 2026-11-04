const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const file of ['app.js', 'docs/app.js']) {
  const source = fs.readFileSync(file, 'utf8');
  const parser = source.slice(source.indexOf('  function parseLinkedInPostClient('), source.indexOf('  // URL Post Fetcher Implementation'));
  const freshness = source.slice(source.indexOf('  function getJobFreshness('), source.indexOf('  const DOMAIN_EXPANSIONS'));
  let badge = { innerHTML: '' };
  const status = source.slice(source.indexOf('  function updateFeedStatus('), source.indexOf('  function applyPublishedFeed('));
  const context = vm.createContext({
    jobs: [], data: { last_updated: new Date().toISOString() }, escapeHTML: String,
    document: { querySelectorAll: () => [badge] }
  });
  vm.runInContext(parser + freshness + status, context);
  for (const minutes of [1, 5, 30, 59]) {
    const job = context.parseLinkedInPostClient(`Hiring a data scientist fresher. Posted ${minutes} minutes ago`, '', 'https://example.com/job');
    assert.equal(job.hours_ago, minutes / 60);
    assert.equal(context.getJobFreshness(job).label, `${minutes}m ago`);
    context.jobs = [job];
    context.updateFeedStatus();
    assert.match(badge.innerHTML, new RegExp(`Newest listing: ${minutes}m ago`));
  }
  // A recent collection must not make an older job appear minute-old.
  context.jobs = [{ posted_at: new Date(Date.now() - 2 * 3600000).toISOString() }];
  context.updateFeedStatus();
  assert.match(badge.innerHTML, /Newest listing: 2h ago/);
  assert.match(badge.innerHTML, /Last collection:/);
  console.log(`${file}: minute precision and collection/listing age distinction passed`);
}
