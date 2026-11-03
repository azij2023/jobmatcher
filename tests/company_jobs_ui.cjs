const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const file of ['app.js', 'docs/app.js']) {
  const source = fs.readFileSync(file, 'utf8');
  const helpers = source.slice(source.indexOf('  function getCompanyJobUrl('), source.indexOf('  function renderCompanySites('));
  const context = vm.createContext({ URL, profile: { target_roles: ['Data Scientist'], role_mapping: [] }, isZeroExpJob: () => true,
    getJobFreshness: job => ({ hours: job.hours_ago }) });
  vm.runInContext(helpers, context);
  const job = { title: 'Data Scientist', source_type: 'Official Company Portal', company_job_verified: true,
    direct_job_url: 'https://job-boards.greenhouse.io/example/jobs/123', hours_ago: 2,
    company_url: 'https://example.com/careers' };
  assert.equal(context.getCompanyJobUrl(job), job.direct_job_url);
  assert.equal(context.isCompanySiteJob(job), true);
  assert.equal(context.isCompanySiteJob({ ...job, title: 'Sales Executive' }), false);
  assert.equal(context.isCompanySiteJob({ ...job, hours_ago: 121 }), false);
  assert.equal(context.isCompanySiteJob({ ...job, company_job_verified: false }), false);
  assert.equal(context.isCompanySiteJob({ ...job, direct_job_url: 'https://jobs.lever.co/example' }), false);
  assert.equal(context.getCompanyJobUrl({ ...job, direct_job_url: 'https://greenhouse.io.evil.com/example/jobs/123' }), '');
  assert.equal(context.getCompanyJobUrl({ ...job, direct_job_url: '', url: 'https://example.com/careers' }), '');
  context.isZeroExpJob = () => false;
  assert.equal(context.isCompanySiteJob(job), false);
  console.log(`${file}: company job links and filters passed`);
}
