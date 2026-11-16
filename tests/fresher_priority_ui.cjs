const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const file of ['app.js', 'docs/app.js']) {
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('  const isFresherPriorityJob =');
  const end = source.indexOf('  const isInternshipJob =', start);
  assert.notEqual(start, -1, `${file} defines fresher priority`);
  assert.notEqual(end, -1, `${file} defines internship detection`);

  const context = vm.createContext({
    getJobFreshness: job => ({ hours: job.hours_ago })
  });
  vm.runInContext(
    `${source.slice(start, end)}
      globalThis.isFresherPriorityJob = isFresherPriorityJob;
      globalThis.compareFresherFirst = compareFresherFirst;`,
    context
  );

  const fresher = { title: 'Decision Scientist - Fresher', hours_ago: 48, score: 0.7 };
  const zeroToFour = { title: 'Forecasting Analyst', raw_description: '0-4 years of experience', hours_ago: 24, score: 0.8 };
  const unspecifiedLegacy = { title: 'Data Analyst', min_years_experience: 0, hours_ago: 1, score: 0.9 };

  assert.equal(context.isFresherPriorityJob(fresher), true);
  assert.equal(context.isFresherPriorityJob(zeroToFour), true);
  assert.equal(context.isFresherPriorityJob(unspecifiedLegacy), false);
  const sorted = [unspecifiedLegacy, fresher, zeroToFour].sort(context.compareFresherFirst);
  assert.deepEqual(sorted.map(job => job.title), [
    'Forecasting Analyst',
    'Decision Scientist - Fresher',
    'Data Analyst'
  ]);
}

console.log('Fresher-first sorting checks passed for app.js and docs/app.js');
