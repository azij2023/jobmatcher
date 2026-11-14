const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const file of ['app.js', 'docs/app.js']) {
  const source = fs.readFileSync(file, 'utf8');
  const helpers = source.slice(source.indexOf('  function isEntryManagementTitle('), source.indexOf('  const isInternshipJob ='));
  const context = vm.createContext({});
  vm.runInContext(helpers + '\nthis.check = isZeroExpJob;', context);
  for (const title of ['Associate AI Product Manager', 'Junior Data Product Manager', 'Analytics Management Trainee', 'Junior Analytics Manager', 'Data Science Project Coordinator']) {
    assert.equal(context.check({ title, min_years_experience: 0, description: 'Fresh graduates welcome' }), true, title);
    assert.equal(context.check({ title, min_years_experience: 2 }), false, title);
  }
  assert.equal(context.check({ title: 'Senior Analytics Manager', min_years_experience: 0 }), false);
  assert.equal(context.check({ title: 'Data Science Manager', min_years_experience: 0 }), false);
  console.log(`${file}: entry-level data management tracks and experience limits passed`);
}
