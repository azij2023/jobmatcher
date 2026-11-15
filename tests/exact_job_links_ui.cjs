const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const file of ['app.js', 'docs/app.js']) {
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('  const unverifiedRssSources =');
  const end = source.indexOf('  let jobs =', start);
  assert.ok(start > 0 && end > start);
  const context = vm.createContext({});
  vm.runInContext(source.slice(start, end) + '\nthis.isDisplayable = hasVerifiedPublicationTime;', context);

  const rss = {
    title: 'Data Scientist in Hero Motocorp Limited', company: 'Tech Employer',
    url: 'https://apna.co/jobs?q=Data+Scientist+in+Hero+Motocorp+Limited',
    source_type: 'Apna', posted_at_source: 'Apna Live Feed'
  };
  assert.equal(context.isDisplayable(rss), false);
  assert.equal(context.isDisplayable({ ...rss, source_type: 'Shine', posted_at_source: 'Shine Live Feed' }), false);
  assert.equal(context.isDisplayable({
    ...rss, company: 'Hero Motocorp Limited',
    url: 'https://apna.co/job/data-scientist-123', posted_at_source: 'published_at'
  }), true);
  assert.equal(context.isDisplayable({
    title: 'Data Scientist', company: 'Example', url: 'https://www.linkedin.com/jobs/view/1234567890',
    source_type: 'LinkedIn', posted_at_source: 'published_at'
  }), true);
  assert.equal(context.isDisplayable({
    title: 'Business Analyst', company: 'Example', url: 'https://www.linkedin.com/jobs/view/1234567890',
    source_type: 'LinkedIn', posted_at_source: 'published_at',
    raw_description: 'Verified entry-level fresher role (0-1 years exp) listed on LinkedIn (entry-level filter f_E=1,2).'
  }), false);
  console.log(`${file}: legacy RSS search cards hidden, direct posts retained`);
}
