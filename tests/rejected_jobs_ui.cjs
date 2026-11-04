const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const file of ['app.js', 'docs/app.js']) {
  const source = fs.readFileSync(file, 'utf8');
  const storage = new Map();
  const nodes = new Map(['rejected-jobs-grid', 'nav-rejected-count', 'rejected-jobs-count', 'rejected-jobs-search']
    .map(id => [id, { innerHTML: '', textContent: '', value: '' }]));
  const context = vm.createContext({ URL, Map, localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value)
  }, getJobId: job => job.url, getSavedJobIds: () => ['https://example.com/jobs/1'],
    resolveJobTargetUrl: job => job.url, isInternshipJob: () => false, showToast() {},
    document: { getElementById: id => nodes.get(id) },
    escapeHTML: text => String(text).replace(/[&<>"']/g, value => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[value])
  });
  const state = source.slice(source.indexOf('  // Applied jobs retain'), source.indexOf('  // DOM Elements'));
  const view = source.slice(source.indexOf('  function renderRejectedJobs()'), source.indexOf('  function refreshApplicationViews()'));
  vm.runInContext(state + view, context);
  const job = { title: 'Data Scientist', company: 'Example', url: 'https://example.com/jobs/1' };
  assert.equal(context.rejectJob(job), true);
  assert.equal(context.rejectJob({ ...job, url: job.url + '?utm_source=feed' }), false);
  assert.equal(context.isJobRejected(job), true);
  assert.equal(context.isJobApplied(job), false);
  assert.equal(context.getAvailableSavedJobIds().length, 0);
  assert.ok(Date.parse(context.readRejectedJobs()[0].rejected_at));
  // A reload reads the rejection back from persistent storage.
  vm.runInContext('rejectedJobs = readRejectedJobs()', context);
  context.jobs = [];
  context.renderRejectedJobs();
  assert.match(nodes.get('rejected-jobs-grid').innerHTML, /Data Scientist/);
  assert.match(nodes.get('rejected-jobs-grid').innerHTML, />Rejected<\/span>/);
  assert.equal(nodes.get('nav-rejected-count').textContent, 1);
  nodes.get('rejected-jobs-search').value = 'unknown';
  context.renderRejectedJobs();
  assert.match(nodes.get('rejected-jobs-grid').innerHTML, /No rejected jobs match/);
  nodes.get('rejected-jobs-search').value = '';
  const writer = context.localStorage.setItem;
  context.localStorage.setItem = () => { throw new Error('QuotaExceeded'); };
  assert.equal(context.restoreRejectedJob(context.getAppliedJobKey(job)), false);
  assert.equal(context.rejectJob({ ...job, url: job.url + '/2' }), false);
  assert.equal(context.readRejectedJobs().length, 1);
  context.localStorage.setItem = writer;
  assert.equal(context.restoreRejectedJob(context.getAppliedJobKey(job)), true);
  assert.equal(context.isJobRejected(job), false);
  assert.equal(context.getAvailableSavedJobIds().length, 1);
  context.markJobApplied(job);
  assert.equal(context.rejectJob(job), false);
  context.rejectJob({ ...job, title: '<img src=x onerror=alert(1)>', url: 'javascript:alert(1)' });
  context.renderRejectedJobs();
  assert.match(nodes.get('rejected-jobs-grid').innerHTML, /&lt;img/);
  assert.doesNotMatch(nodes.get('rejected-jobs-grid').innerHTML, /href="javascript:/);
  storage.set('targetmatch_rejected_jobs', '{broken');
  assert.equal(context.readRejectedJobs().length, 0);
  storage.set('targetmatch_rejected_jobs', JSON.stringify([{}, null, { title: 'x', company: 'y', url: {} }]));
  assert.equal(context.readRejectedJobs().length, 0);
  console.log(`${file}: rejection persistence, restore, deduplication, search and storage errors passed`);
}
