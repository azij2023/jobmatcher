const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const file of ['app.js', 'docs/app.js']) {
  const source = fs.readFileSync(file, 'utf8');
  const storage = new Map();
  const nodes = new Map(['applied-jobs-grid', 'nav-applied-count', 'applied-jobs-count', 'applied-jobs-search']
    .map(id => [id, { innerHTML: '', textContent: '', value: '' }]));
  const context = vm.createContext({ URL, Map, localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value)
  }, getJobId: job => job.url, getSavedJobIds: () => ['https://example.com/jobs/1'],
    resolveJobTargetUrl: job => job.url, isInternshipJob: job => Boolean(job.is_internship), showToast() {},
    document: { getElementById: id => nodes.get(id) },
    escapeHTML: text => String(text).replace(/[&<>"']/g, value => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[value])
  });
  const state = source.slice(source.indexOf('  // Applied jobs retain'), source.indexOf('  // DOM Elements'));
  const view = source.slice(source.indexOf('  function renderAppliedJobs()'), source.indexOf('  function refreshApplicationViews()'));
  vm.runInContext(state + view, context);
  const first = { title: 'Data Scientist', company: 'Example', url: 'https://example.com/jobs/1', description: 'Graduate role' };
  const second = { ...first, url: 'https://example.com/jobs/2' };
  assert.equal(context.markJobApplied(first), true);
  assert.equal(context.isJobApplied(first), true);
  assert.equal(context.isJobApplied(second), false);
  assert.equal(context.markJobApplied({ ...first, url: first.url + '?utm_source=newsletter' }), false);
  assert.equal(context.readAppliedJobs().length, 1);
  assert.equal(context.readAppliedJobs()[0].title, first.title);
  assert.ok(Date.parse(context.readAppliedJobs()[0].applied_at));
  assert.equal(context.getAvailableSavedJobIds().length, 0);
  assert.notEqual(context.getAppliedJobKey({ url: 'https://example.com/job?id=1' }), context.getAppliedJobKey({ url: 'https://example.com/job?id=2' }));

  // Replacing the entire live feed does not remove the archived snapshot.
  context.jobs = [];
  context.renderAppliedJobs();
  assert.match(nodes.get('applied-jobs-grid').innerHTML, /Data Scientist/);
  assert.equal(nodes.get('nav-applied-count').textContent, 1);
  nodes.get('applied-jobs-search').value = 'unknown company';
  context.renderAppliedJobs();
  assert.match(nodes.get('applied-jobs-grid').innerHTML, /No applied jobs match/);
  nodes.get('applied-jobs-search').value = '';

  // Storage failures must leave the previous visible state intact.
  const originalWriter = context.localStorage.setItem;
  context.localStorage.setItem = () => { throw new Error('QuotaExceeded'); };
  assert.equal(context.markJobApplied(second), false);
  assert.equal(context.restoreAppliedJob(context.getAppliedJobKey(first)), false);
  assert.equal(context.isJobApplied(first), true);
  context.localStorage.setItem = originalWriter;
  assert.equal(context.restoreAppliedJob(context.getAppliedJobKey(first)), true);
  assert.equal(context.isJobApplied(first), false);
  assert.equal(context.readAppliedJobs().length, 0);

  // Saved text and URLs are untrusted; render text safely and omit unsafe links.
  context.markJobApplied({ ...first, title: '<img src=x onerror=alert(1)>', url: 'javascript:alert(1)' });
  context.renderAppliedJobs();
  assert.match(nodes.get('applied-jobs-grid').innerHTML, /&lt;img/);
  assert.doesNotMatch(nodes.get('applied-jobs-grid').innerHTML, /href="javascript:/);
  storage.set('targetmatch_applied_jobs', '{broken');
  assert.equal(context.readAppliedJobs().length, 0);
  storage.set('targetmatch_applied_jobs', JSON.stringify([{}, null, { title: 'x', company: 'y', url: {} }]));
  assert.equal(context.readAppliedJobs().length, 0);
  console.log(`${file}: applied tracking, deduplication, restore, snapshot retention and storage errors passed`);
}
