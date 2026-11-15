const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const file of ['app.js', 'docs/app.js']) {
  const source = fs.readFileSync(file, 'utf8');
  const storage = new Map();
  const nodes = new Map(['spam-jobs-grid', 'nav-spam-count', 'spam-jobs-count', 'spam-jobs-search']
    .map(id => [id, { innerHTML: '', textContent: '', value: '' }]));
  const context = vm.createContext({
    URL, Map,
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value)
    },
    getJobId: job => job.url,
    getSavedJobIds: () => ['https://example.com/jobs/1'],
    resolveJobTargetUrl: job => job.url,
    isInternshipJob: () => false,
    showToast() {},
    document: { getElementById: id => nodes.get(id) },
    escapeHTML: text => String(text).replace(/[&<>"']/g, value =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[value])
  });
  const state = source.slice(source.indexOf('  // Applied jobs retain'), source.indexOf('  // DOM Elements'));
  const view = source.slice(source.indexOf('  function renderSpamJobs()'), source.indexOf('  function refreshApplicationViews()'));
  vm.runInContext(state + view, context);

  const job = { title: 'Data Scientist', company: 'Example', url: 'https://example.com/jobs/1' };
  assert.equal(context.markJobSpam(job), true);
  assert.equal(context.markJobSpam({ ...job, url: job.url + '?utm_source=feed' }), false);
  assert.equal(context.isJobSpam(job), true);
  assert.equal(context.getAvailableSavedJobIds().length, 0);
  assert.ok(Date.parse(context.readSpamJobs()[0].flagged_at));

  vm.runInContext('spamJobs = readSpamJobs()', context);
  context.renderSpamJobs();
  assert.match(nodes.get('spam-jobs-grid').innerHTML, /Flagged as scam/);
  assert.equal(nodes.get('nav-spam-count').textContent, 1);
  nodes.get('spam-jobs-search').value = 'unrelated';
  context.renderSpamJobs();
  assert.match(nodes.get('spam-jobs-grid').innerHTML, /No spam jobs match/);
  nodes.get('spam-jobs-search').value = '';

  const writer = context.localStorage.setItem;
  context.localStorage.setItem = () => { throw new Error('QuotaExceeded'); };
  assert.equal(context.restoreSpamJob(context.getAppliedJobKey(job)), false);
  assert.equal(context.isJobSpam(job), true);
  context.localStorage.setItem = writer;
  assert.equal(context.restoreSpamJob(context.getAppliedJobKey(job)), true);
  assert.equal(context.isJobSpam(job), false);
  assert.equal(context.getAvailableSavedJobIds().length, 1);

  const expired = { ...job, flagged_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() };
  // Legacy array snapshots must migrate and expire without losing their hidden URL.
  storage.set('targetmatch_spam_jobs', JSON.stringify([expired]));
  vm.runInContext('spamState = readSpamState(); spamJobs = spamState.jobs; blockedSpamJobKeys = new Set(spamState.blocked)', context);
  assert.equal(context.readSpamJobs().length, 0);
  assert.equal(context.isJobSpam(job), true);
  assert.equal(context.markJobSpam(job), false);
  assert.equal(context.getAvailableSavedJobIds().length, 0);
  assert.equal(JSON.parse(storage.get('targetmatch_spam_jobs')).jobs.length, 0);
  vm.runInContext('spamState = readSpamState(); spamJobs = spamState.jobs; blockedSpamJobKeys = new Set(spamState.blocked)', context);
  assert.equal(context.isJobSpam(job), true);
  context.renderSpamJobs();
  assert.equal(nodes.get('nav-spam-count').textContent, 0);

  // An open page also clears the folder after 24 hours, preserving the block.
  const second = { ...job, url: 'https://example.com/jobs/2' };
  assert.equal(context.markJobSpam(second), true);
  vm.runInContext('spamJobs[0].flagged_at = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); expireSpamJobs()', context);
  assert.equal(context.isJobSpam(second), true);
  assert.equal(JSON.parse(storage.get('targetmatch_spam_jobs')).jobs.length, 0);

  context.markJobApplied(job);
  assert.equal(context.markJobSpam(job), false);
  context.markJobSpam({ title: '<img src=x onerror=alert(1)>', company: 'Example',
    url: 'javascript:alert(1)' });
  context.renderSpamJobs();
  assert.match(nodes.get('spam-jobs-grid').innerHTML, /&lt;img/);
  assert.doesNotMatch(nodes.get('spam-jobs-grid').innerHTML, /href="javascript:/);
  storage.set('targetmatch_spam_jobs', '{broken');
  assert.equal(context.readSpamJobs().length, 0);
  console.log(`${file}: spam persistence, restore, deduplication and safe rendering passed`);
}
