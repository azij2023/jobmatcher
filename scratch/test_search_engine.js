const fs = require('fs');

const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const jobs = data.jobs;

// City synonyms map
const CITY_SYNONYMS = {
  bengaluru: ['bengaluru', 'bangalore', 'blr'],
  bangalore: ['bengaluru', 'bangalore', 'blr'],
  gurugram: ['gurugram', 'gurgaon', 'noida', 'delhi', 'ncr', 'greater noida'],
  gurgaon: ['gurugram', 'gurgaon', 'noida', 'delhi', 'ncr', 'greater noida'],
  delhi: ['delhi', 'new delhi', 'noida', 'gurugram', 'gurgaon', 'ncr'],
  noida: ['noida', 'greater noida', 'gurugram', 'gurgaon', 'delhi', 'ncr'],
  mumbai: ['mumbai', 'bombay', 'navi mumbai', 'thane', 'pune'],
  pune: ['pune', 'maharashtra', 'mumbai'],
  hyderabad: ['hyderabad', 'secunderabad', 'hyd', 'telangana'],
  remote: ['remote', 'work from home', 'wfh', 'anywhere', 'telecommute']
};

// Domain keywords / acronyms mapping
const DOMAIN_EXPANSIONS = {
  'ml': ['machine learning', 'ml', 'mle'],
  'mle': ['machine learning engineer', 'mle', 'applied mle', 'ml engineer'],
  'ai': ['artificial intelligence', 'ai', 'genai', 'applied ai', 'deep learning'],
  'genai': ['generative ai', 'genai', 'llm', 'foundation models', 'prompt engineering'],
  'llm': ['large language model', 'llm', 'genai', 'generative ai', 'transformer'],
  'ds': ['data science', 'data scientist', 'ds'],
  'da': ['data analyst', 'data analytics', 'business analyst'],
  'or': ['operations research', 'optimization', 'linear programming', 'integer programming', 'simplex'],
  'optimization': ['optimization', 'operations research', 'or', 'gurobi', 'cplex', 'scipy.optimize'],
  'fresher': ['fresher', '0-1 yr', '0-1', '0-2', 'entry-level', 'entry level', 'intern', 'campus', 'graduate', 'early career'],
  'intern': ['intern', 'internship', 'trainee', 'apprentice']
};

function normalizeTokens(query) {
  return query
    .toLowerCase()
    .replace(/[,\/\\|+&;()]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length > 0);
}

function matchJob(job, query, locationFilter, freshnessFilter) {
  // 1. Freshness check
  let hours = job.hours_ago || 2;
  if (job.posted_at) {
    try {
      const postedMs = new Date(job.posted_at.replace(" ", "T")).getTime();
      const nowMs = Date.now();
      if (!isNaN(postedMs) && postedMs <= nowMs) {
        hours = Math.max(0.01, (nowMs - postedMs) / (1000 * 60 * 60));
      }
    } catch(e) {}
  }
  if (freshnessFilter && freshnessFilter !== 'all' && hours > parseFloat(freshnessFilter)) {
    return false;
  }

  // 2. Location check
  if (locationFilter && locationFilter !== 'all') {
    const locTarget = locationFilter.toLowerCase();
    const jobLoc = (job.location || '').toLowerCase();
    const isRemote = job.is_remote || jobLoc.includes('remote');

    if (locTarget === 'remote') {
      if (!isRemote) return false;
    } else {
      const syns = CITY_SYNONYMS[locTarget] || [locTarget];
      const locMatches = syns.some(s => jobLoc.includes(s));
      if (!locMatches) return false;
    }
  }

  // 3. Search query check
  if (!query || !query.trim()) return true;

  const q = query.toLowerCase().trim();
  const title = (job.title || '').toLowerCase();
  const company = (job.company || '').toLowerCase();
  const category = (job.category || '').toLowerCase();
  const location = (job.location || '').toLowerCase();
  const desc = (job.description || '').toLowerCase();
  const rawDesc = (job.raw_description || '').toLowerCase();
  const skills = [
    ...(job.matched_skills || []),
    ...(job.missing_skills || [])
  ].map(s => s.toLowerCase().replace(/_/g, ' '));

  const allText = [title, company, category, location, desc, rawDesc, ...skills].join(' ');

  // Direct exact substring match in title or company gets immediate pass (except common 2-letter stop words)
  if (q.length > 2 && (title.includes(q) || company.includes(q))) return true;

  // Handle 'or' specifically (Operations Research / Tier 4)
  if (q === 'or') {
    if (job.tier === 4 || category.includes('optimization') || category.includes('or')) return true;
    const orExpansions = ['operations research', 'linear programming', 'integer programming', 'simplex', 'gurobi', 'cplex', 'scipy.optimize'];
    return orExpansions.some(exp => allText.includes(exp));
  }

  // Full substring match in combined text, BUT protect short words from false positives
  const shortAcronyms = ['ai', 'ml', 'ds', 'da'];
  if (shortAcronyms.includes(q)) {
    // Check whole word / regex boundary
    const regex = new RegExp(`\\b${q}\\b`, 'i');
    if (regex.test(title) || regex.test(company) || regex.test(category) || skills.some(s => regex.test(s))) {
      return true;
    }
    // Also check domain expansions
    const expansions = DOMAIN_EXPANSIONS[q] || [];
    if (expansions.some(exp => allText.includes(exp))) return true;
    return false;
  }

  if (allText.includes(q)) return true;

  // Token-based matching with synonym expansions
  const tokens = normalizeTokens(q);
  if (tokens.length === 0) return true;

  // Check if every token (or its synonyms) is satisfied somewhere in the job
  const everyTokenMatches = tokens.every(token => {
    // Check direct substring
    if (allText.includes(token)) return true;

    // Check city synonyms
    if (CITY_SYNONYMS[token]) {
      if (CITY_SYNONYMS[token].some(syn => allText.includes(syn))) return true;
    }

    // Check domain expansions
    if (DOMAIN_EXPANSIONS[token]) {
      if (DOMAIN_EXPANSIONS[token].some(exp => allText.includes(exp))) return true;
    }

    // Check boundary match for short token
    if (token.length <= 3) {
      const tokenRegex = new RegExp(`\\b${token}\\b`, 'i');
      return tokenRegex.test(allText);
    }

    return false;
  });

  return everyTokenMatches;
}

// Test suite
const testCases = [
  { q: 'Bangalore', expectedMin: 50 },
  { q: 'Bengaluru', expectedMin: 50 },
  { q: 'Gurugram', expectedMin: 15 },
  { q: 'Gurgaon', expectedMin: 15 },
  { q: 'Accenture', expectedMin: 2 },
  { q: 'EXL', expectedMin: 1 },
  { q: 'OR', expectedMin: 5, expectedMax: 30 }, // should NOT be 167!
  { q: 'AI', expectedMin: 5, expectedMax: 100 },
  { q: 'ML', expectedMin: 5, expectedMax: 100 },
  { q: 'Applied ML', expectedMin: 5 },
  { q: 'Data Scientist', expectedMin: 20 },
  { q: 'Python', expectedMin: 30 },
  { q: 'Decision Science', expectedMin: 10 },
  { q: 'Fresher Bangalore', expectedMin: 10 },
  { q: 'Remote', expectedMin: 5 }
];

console.log('Running Search Engine Test Suite...\n');
let allPassed = true;
testCases.forEach(tc => {
  const matches = jobs.filter(j => matchJob(j, tc.q, 'all', 48));
  const count = matches.length;
  let passed = true;
  if (tc.expectedMin !== undefined && count < tc.expectedMin) passed = false;
  if (tc.expectedMax !== undefined && count > tc.expectedMax) passed = false;

  console.log(`${passed ? '✓ PASS' : '✗ FAIL'}: Query "${tc.q}" => ${count} matches (Expected: min ${tc.expectedMin || 0}${tc.expectedMax ? ', max ' + tc.expectedMax : ''})`);
  if (!passed) allPassed = false;
});

console.log('\nAll tests passed?', allPassed ? 'YES! 🎯' : 'NO');
