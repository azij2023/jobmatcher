/**
 * TargetMatch AI - Interactive Dashboard & Scoring Engine
 */

document.addEventListener("DOMContentLoaded", () => {
  // Collapsible overview sidebar; retain the user's layout preference.
  const sidebarToggle = document.getElementById('stats-sidebar-toggle');
  function updateSidebarToggle() {
    const collapsed = document.documentElement.classList.contains('stats-sidebar-collapsed');
    if (!sidebarToggle) return;
    sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
    sidebarToggle.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} overview sidebar`);
    sidebarToggle.title = `${collapsed ? 'Expand' : 'Collapse'} overview sidebar`;
    sidebarToggle.querySelector('.stats-sidebar-toggle-text').textContent = collapsed ? 'Expand' : 'Collapse';
  }
  if (sidebarToggle) {
    updateSidebarToggle();
    sidebarToggle.addEventListener('click', () => {
      const collapsed = document.documentElement.classList.toggle('stats-sidebar-collapsed');
      try { localStorage.setItem('targetmatch_sidebar_collapsed', String(collapsed)); } catch (error) {}
      updateSidebarToggle();
    });
  }
  const navbar = document.getElementById('navbar');
  if (navbar && typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      document.documentElement.style.setProperty('--navbar-height', `${navbar.offsetHeight}px`);
    }).observe(navbar);
  }

  // The search sidebar has its own saved expand/collapse preference.
  const filtersSidebar = document.getElementById('filters-sidebar');
  const filtersSidebarToggle = document.getElementById('filters-sidebar-toggle');
  function updateFiltersSidebarToggle() {
    if (!filtersSidebarToggle) return;
    const collapsed = document.documentElement.classList.contains('filters-sidebar-collapsed');
    filtersSidebarToggle.setAttribute('aria-expanded', String(!collapsed));
    filtersSidebarToggle.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} search and filters sidebar`);
    filtersSidebarToggle.title = `${collapsed ? 'Expand' : 'Collapse'} search and filters sidebar`;
    filtersSidebarToggle.querySelector('.filters-sidebar-toggle-text').textContent = collapsed ? 'Expand' : 'Collapse';
    const deck = document.getElementById('search-command-deck');
    if (deck) deck.hidden = collapsed;
  }
  if (filtersSidebarToggle) {
    updateFiltersSidebarToggle();
    filtersSidebarToggle.addEventListener('click', () => {
      const collapsed = document.documentElement.classList.toggle('filters-sidebar-collapsed');
      try { localStorage.setItem('targetmatch_filters_sidebar_collapsed', String(collapsed)); } catch (error) {}
      updateFiltersSidebarToggle();
    });
  }
  function showSidebarJobResults(event) {
    if (!event.target.closest('#search-command-deck')) return;
    document.querySelectorAll('.tab-content').forEach(content => content.classList.toggle('active', content.id === 'view-jobs'));
    const tabId = currentFilter.roleType === 'internships' ? 'tab-btn-internships' : 'tab-btn-jobs';
    document.querySelectorAll('.nav-tab').forEach(button => button.classList.toggle('active', button.id === tabId));
  }
  if (filtersSidebar) {
    filtersSidebar.addEventListener('focusin', showSidebarJobResults);
    filtersSidebar.addEventListener('click', showSidebarJobResults, true);
  }

  // 1. Data Initialization
  let data = window.JOB_MATCHER_DATA || window.JOB_DATA || {
    jobs: [],
    profile: {},
    stats: {}
  };

  const hasVerifiedPublicationTime = job =>
    Boolean(job && (job.title || job.company) && (job.url || job.linkedin_url)) &&
    (job.source_type !== 'Official Company Portal' || job.company_job_verified === true);

  let jobs = (data.jobs || []).filter(hasVerifiedPublicationTime);
  let profile = data.profile || {};
  let stats = data.stats || {};

  // Purge legacy unverified custom jobs from localStorage so live verified feed is 100% accurate
  function mergeSavedCustomJobs(targetJobs) {
    try {
      localStorage.removeItem("targetmatch_custom_jobs");
    } catch (e) {}
  }

  mergeSavedCustomJobs(jobs);

  // Shortlist / Bookmark State Management
  const SHORTLIST_STORAGE_KEY = "targetmatch_shortlist";

  function getSavedJobIds() {
    try {
      return JSON.parse(localStorage.getItem(SHORTLIST_STORAGE_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }

  function getJobId(job) {
    if (!job) return "";
    return job.url || `${job.tier}-${(job.company || '').replace(/\s+/g, '-').toLowerCase()}-${(job.title || '').replace(/\s+/g, '-').toLowerCase()}`;
  }

  function isJobSaved(jobId) {
    if (!jobId) return false;
    return getSavedJobIds().includes(jobId);
  }

  function toggleSavedJob(jobId) {
    if (!jobId) return false;
    const saved = getSavedJobIds();
    const idx = saved.indexOf(jobId);
    let isSavedNow = false;
    if (idx >= 0) {
      saved.splice(idx, 1);
      isSavedNow = false;
    } else {
      saved.push(jobId);
      isSavedNow = true;
    }
    try {
      localStorage.setItem(SHORTLIST_STORAGE_KEY, JSON.stringify(saved));
    } catch (e) {
      console.warn("Could not save to localStorage", e);
    }
    updateShortlistStats();
    updateFilterPillCounts();
    return isSavedNow;
  }

  // Applied jobs retain a snapshot even after they leave the live feed.
  const APPLIED_STORAGE_KEY = 'targetmatch_applied_jobs';
  let appliedJobs = readAppliedJobs();

  function getAppliedJobKey(job) {
    const original = getJobId(job);
    try {
      const url = new URL(original);
      for (const key of [...url.searchParams.keys()]) {
        if (/^utm_/i.test(key) || ['trackingId', 'refId', 'gh_src', 'source', 'ref'].includes(key)) {
          url.searchParams.delete(key);
        }
      }
      return url.href.replace(/\/$/, '');
    } catch (error) {
      return original;
    }
  }

  function readAppliedJobs() {
    try {
      const stored = JSON.parse(localStorage.getItem(APPLIED_STORAGE_KEY) || '[]');
      if (!Array.isArray(stored)) return [];
      const unique = new Map();
      for (const job of stored) {
        if (!job || typeof job.title !== 'string' || typeof job.company !== 'string' || typeof job.url !== 'string' || !job.url.trim()) continue;
        unique.set(getAppliedJobKey(job), job);
      }
      return [...unique.values()];
    } catch (error) {
      return [];
    }
  }

  function isJobApplied(job) {
    const key = getAppliedJobKey(job);
    return appliedJobs.some(applied => getAppliedJobKey(applied) === key);
  }

  function getAvailableSavedJobIds() {
    return getSavedJobIds().filter(url => !isJobApplied({ url }) && !isJobRejected({ url }));
  }

  function storeAppliedJobs(next) {
    try {
      localStorage.setItem(APPLIED_STORAGE_KEY, JSON.stringify(next));
      appliedJobs = next;
      return true;
    } catch (error) {
      showToast('Could not save your applied jobs. Check browser storage and try again.');
      return false;
    }
  }

  function markJobApplied(job) {
    if (!job || isJobApplied(job)) return false;
    const snapshot = {
      title: job.title, company: job.company, location: job.location,
      url: job.url || job.direct_job_url, direct_job_url: job.direct_job_url,
      applied_url: resolveJobTargetUrl(job), tier: job.tier, category: job.category,
      description: job.description || '', is_internship: isInternshipJob(job),
      applied_at: new Date().toISOString()
    };
    return storeAppliedJobs([snapshot, ...appliedJobs]);
  }

  function restoreAppliedJob(key) {
    const next = appliedJobs.filter(job => getAppliedJobKey(job) !== key);
    return next.length !== appliedJobs.length && storeAppliedJobs(next);
  }

  // Rejected jobs stay hidden across feed refreshes and can be restored.
  const REJECTED_STORAGE_KEY = 'targetmatch_rejected_jobs';
  let rejectedJobs = readRejectedJobs();

  function readRejectedJobs() {
    try {
      const stored = JSON.parse(localStorage.getItem(REJECTED_STORAGE_KEY) || '[]');
      if (!Array.isArray(stored)) return [];
      const unique = new Map();
      for (const job of stored) {
        if (!job || typeof job.title !== 'string' || typeof job.company !== 'string' || typeof job.url !== 'string' || !job.url.trim()) continue;
        unique.set(getAppliedJobKey(job), job);
      }
      return [...unique.values()];
    } catch (error) { return []; }
  }

  function isJobRejected(job) {
    const key = getAppliedJobKey(job);
    return rejectedJobs.some(rejected => getAppliedJobKey(rejected) === key);
  }

  function storeRejectedJobs(next) {
    try {
      localStorage.setItem(REJECTED_STORAGE_KEY, JSON.stringify(next));
      rejectedJobs = next;
      return true;
    } catch (error) {
      showToast('Could not save your rejected jobs. Check browser storage and try again.');
      return false;
    }
  }

  function rejectJob(job) {
    if (!job || isJobRejected(job) || isJobApplied(job)) return false;
    return storeRejectedJobs([{ title: job.title, company: job.company,
      location: job.location, url: job.url || job.direct_job_url,
      direct_job_url: job.direct_job_url, description: job.description || '',
      rejected_at: new Date().toISOString() }, ...rejectedJobs]);
  }

  function restoreRejectedJob(key) {
    const next = rejectedJobs.filter(job => getAppliedJobKey(job) !== key);
    return next.length !== rejectedJobs.length && storeRejectedJobs(next);
  }

  // DOM Elements
  const jobsGrid = document.getElementById("jobs-grid");
  const emptyState = document.getElementById("empty-state");
  const searchInput = document.getElementById("search-input");
  const clearSearchBtn = document.getElementById("clear-search-btn");
  const btnSearchExec = document.getElementById("btn-search-exec");
  const btnToggleFilters = document.getElementById("btn-toggle-filters");
  const activeFilterBadge = document.getElementById("active-filter-badge");
  const advancedFiltersDrawer = document.getElementById("advanced-filters-drawer");
  const btnCloseDrawer = document.getElementById("btn-close-drawer");
  const tierSelect = document.getElementById("tier-select");
  const scoreSlider = document.getElementById("score-slider");
  const scoreSliderVal = document.getElementById("score-slider-val");
  const sortSelect = document.getElementById("sort-select");
  const resultsCount = document.getElementById("results-count");
  const navJobCount = document.getElementById("nav-job-count");
  const resetFiltersBtn = document.getElementById("reset-filters-btn");
  const toast = document.getElementById("toast");
  const navRefreshBtn = document.getElementById("nav-refresh-btn");
  const navRefreshIcon = document.getElementById("nav-refresh-icon");
  const navRefreshLabel = document.getElementById("nav-refresh-label");
  const autoSyncIndicator = document.getElementById("auto-sync-indicator");
  const bannerJobCount = document.getElementById("banner-job-count");
  const bannerScopePill = document.getElementById("banner-scope-pill");
  const locationSelect = document.getElementById("location-select");
  const freshnessSelect = document.getElementById("freshness-select");
  const sourceSelect = document.getElementById("source-select");

  // State
  let currentFilter = {
    search: "",
    tier: "all",
    location: "all",
    source: "all",
    minScore: 0.50,
    sortBy: "latest",
    maxAgeHours: 120, // Live jobs from 1 minute to 5 days (120 hours)
    onlySaved: false,
    onlyZeroExp: true, // Strictly 0 experience / freshers by default
    roleType: "jobs" // Strictly "jobs" (full-time fresher roles) by default; internships isolated to Internships tab
  };

  let currentPage = 1;
  let pageSize = 24;

  const paginationContainer = document.getElementById("pagination-container");
  const paginationInfo = document.getElementById("pagination-info");
  const paginationButtons = document.getElementById("pagination-buttons");
  const pageSizeSelect = document.getElementById("page-size-select");

  // Helper source classification functions
  const isCompanyPortalJob = j => {
    return Boolean(getCompanyJobUrl(j));
  };

  const isUnstopJob = j => {
    if (!j) return false;
    const u = (j.url || '').toLowerCase();
    const d = (j.source_domain || '').toLowerCase();
    const t = (j.source_type || '').toLowerCase();
    return u.includes('unstop.com') || d.includes('unstop') || t.includes('unstop');
  };

  const isZeroExpJob = j => {
    if (!j) return false;
    const minExp = j.min_years_experience != null ? Number(j.min_years_experience) : null;
    const title = (j.title || '').toLowerCase();
    const desc = `${j.description || ''} ${j.raw_description || ''}`.toLowerCase();
    const text = `${title} ${desc}`;

    // Reject Senior / Lead / Principal / Staff / Manager
    if (/\b(?:senior|sr\b|sr\.|staff|principal|lead|head of|director|vp|manager|architect)\b/i.test(title)) {
      if (!/\b(?:associate product manager|apm|intern|trainee)\b/i.test(title)) return false;
    }

    // Reject Level II, III, IV, etc. (e.g. Applied Scientist II, Research Scientist III)
    if (/\b(?:ii|iii|iv|v|2|3|4)\b/i.test(title) && /(?:scientist|engineer|analyst|specialist|researcher|consultant|developer)/i.test(title)) {
      return false;
    }

    // Reject if minimum years of experience > 0
    if (minExp !== null && minExp > 0) return false;

    // Reject if demands 1+ years experience without explicit zero / fresher
    const hasExpReq = /\b(?:[1-9]\d*)\+?\s*(?:-|to)?\s*\d*\s*years?(?:\s+of)?\s*(?:relevant\s+|work\s+|professional\s+)?experience\b/i.test(text);
    const isExplicitZero = /\b(?:0|zero)\s*(?:-|to)?\s*0?\s*years?\b|\bfresher\b|\bintern\b|\binternship\b|\btrainee\b|\bcampus\b|\bbatch\s*202[4567]\b|\bno\s+experience\b|\bnew\s+grad\b|\bentry\s*level\b/i.test(text);
    if (hasExpReq && !isExplicitZero) return false;

    // Require entry-level / fresher marker for full-time jobs
    const isIntern = (typeof isInternshipJob === 'function') ? isInternshipJob(j) : false;
    if (!isIntern) {
      const hasEntryMarker = /\b(?:fresher|intern|internship|trainee|campus|graduate|new\s*grad|junior|associate|entry|0\s*years?|zero|batch\s*202[4567])\b/i.test(text);
      if (!hasEntryMarker) return false;
    }

    return true;
  };

  const isInternshipJob = j => {
    if (!j) return false;
    const title = (j.title || '').toLowerCase();
    const desc = (j.raw_description || j.description || '').toLowerCase();
    const url = (j.url || j.direct_job_url || '').toLowerCase();
    const internKw = ['intern', 'internship', 'trainee', 'apprentice', 'apprenticeship', 'co-op', 'fellowship'];
    
    // 1. Keyword in title or URL is a guaranteed internship
    if (internKw.some(kw => title.includes(kw))) return true;
    if (url.includes('/internships/') || url.includes('-intern-') || url.includes('-internship-')) return true;
    
    // 2. Explicit flag from server/pipeline
    if (j.is_internship === true) return true;
    if (j.is_internship === false) {
      // Catch any edge case where flag was false but description explicitly states internship/trainee
      return /\b(?:internship|intern\s+position|graduate\s+trainee|management\s+trainee|apprenticeship)\b/.test(desc);
    }
    
    // 3. Fallback description pattern match
    return /\b(?:internship|intern\s+position|graduate\s+trainee|management\s+trainee|apprenticeship)\b/.test(desc);
  };

  const isExactJobUrl = u => {
    if (!u) return false;
    const s = u.toLowerCase();
    // Exclude any fake generated slugs that return 404
    if (s.includes('-2026') || s.includes('job-opening/?id=') || s.includes('#!/job-view/')) return false;
    // Any /posts/ URL without a 10+ digit numeric activity ID is an unverified vanity slug that throws 'Invalid post link' on LinkedIn
    if (s.includes('/posts/') && !s.includes('activity-') && !/\d{10,}/.test(s)) return false;
    if (s.includes('/jobs/view/') || s.includes('/internships/') || s.includes('/posting/') || 
        s.includes('greenhouse.io') || s.includes('lever.co') || s.includes('ashbyhq.com') || 
        s.includes('smartrecruiters.com') || s.includes('activity-') || s.includes('/search/results/content/')) {
      return true;
    }
    return false;
  };

  const resolveJobTargetUrl = j => {
    if (!j) return '#';
    let directUrl = (j.direct_job_url || '').trim();
    let url = (j.url || '').trim();
    const linkedinUrl = (j.linkedin_url || '').trim();
    const companyUrl = (j.company_url || '').trim();

    // Strip legacy broken fake slug URLs
    if (directUrl.includes('-2026') || directUrl.includes('job-opening/?id=') || directUrl.includes('#!/job-view/')) directUrl = '';
    if (url.includes('-2026') || url.includes('job-opening/?id=') || url.includes('#!/job-view/')) url = '';

    // Strip unverified /posts/ vanity URLs that cause LinkedIn 'Invalid post link' 404s
    if (directUrl.includes('/posts/') && !directUrl.includes('activity-') && !/\d{10,}/.test(directUrl)) directUrl = '';
    if (url.includes('/posts/') && !url.includes('activity-') && !/\d{10,}/.test(url)) url = '';

    // 1. Direct specific job link on verified ATS or platforms
    if (directUrl && isExactJobUrl(directUrl)) return directUrl;
    if (url && isExactJobUrl(url)) return url;

    // 2. Official verified company career portal URL
    if (companyUrl && !companyUrl.includes('-2026')) return companyUrl;
    if (directUrl && !directUrl.includes('-2026') && !directUrl.includes('/posts/')) return directUrl;
    if (url && !url.includes('-2026') && !url.includes('linkedin.com/jobs/search') && !url.includes('/posts/')) return url;

    // 3. Exact LinkedIn post link or verified content search
    if (j.is_post || j.source_type === "LinkedIn Post") {
      if (directUrl && isExactJobUrl(directUrl)) return directUrl;
      if (url && isExactJobUrl(url)) return url;
      const query = encodeURIComponent(`"${j.company || ''}" "${j.title || ''}" hiring`.trim());
      return `https://www.linkedin.com/search/results/content/?keywords=${query}&sortBy=%22date_posted%22`;
    }
    if (linkedinUrl && isExactJobUrl(linkedinUrl)) return linkedinUrl;

    // 4. Targeted search query for company + title so user lands on exact role
    if (j.company && j.title) {
      const query = encodeURIComponent(`${j.company} ${j.title}`.trim());
      return `https://www.linkedin.com/jobs/search/?keywords=${query}&location=India&f_TPR=r604800`;
    }

    return companyUrl || url || '#';
  };

  // ==========================================================================
  // 2. Initial Setup & Stats Display
  // ==========================================================================

  function updateShortlistStats() {
    const savedCount = getAvailableSavedJobIds().length;
    const statSavedEl = document.getElementById("stat-saved-val");
    if (statSavedEl) statSavedEl.textContent = savedCount;
    const countSavedEl = document.getElementById("count-saved");
    if (countSavedEl) countSavedEl.textContent = savedCount;
  }

  function initStats() {
    const availableJobs = jobs.filter(job => !isJobApplied(job) && !isJobRejected(job));
    const fullTimeJobsCount = availableJobs.filter(j => !isInternshipJob(j)).length;
    const internshipJobsCount = availableJobs.filter(isInternshipJob).length;
    const primaryCount = availableJobs.filter(j => j.priority === "Primary" || [1, 2, 3, 4, 5, 6, 7].includes(j.tier)).length;
    const portalCount = availableJobs.filter(isCompanyPortalJob).length;
    const unstopCount = availableJobs.filter(isUnstopJob).length;
    const savedCount = getAvailableSavedJobIds().length;

    const statFullJobsEl = document.getElementById("stat-full-jobs-val");
    const statInternshipsEl = document.getElementById("stat-internships-val");
    const statPrimaryEl = document.getElementById("stat-primary-val");
    const statPortalsEl = document.getElementById("stat-portals-val");
    const statUnstopEl = document.getElementById("stat-unstop-val");
    const statSavedEl = document.getElementById("stat-saved-val");
    const statAvgScoreEl = document.getElementById("stat-avg-score-val");

    if (statFullJobsEl) statFullJobsEl.textContent = fullTimeJobsCount;
    if (statInternshipsEl) statInternshipsEl.textContent = internshipJobsCount;
    if (statPrimaryEl) statPrimaryEl.textContent = primaryCount;
    if (statPortalsEl) statPortalsEl.textContent = portalCount;
    if (statUnstopEl) statUnstopEl.textContent = unstopCount;
    if (statSavedEl) statSavedEl.textContent = savedCount;

    const validScores = availableJobs.map(j => j.score || 0).filter(s => typeof s === "number");
    const topScore = validScores.length > 0 ? Math.max(...validScores) : 0;
    if (statAvgScoreEl) statAvgScoreEl.textContent = `${Math.round(topScore * 100)}%`;

    const navJobCountEl = document.getElementById("nav-job-count");
    const navInternCountEl = document.getElementById("nav-intern-count");
    if (navJobCountEl) navJobCountEl.textContent = fullTimeJobsCount;
    if (navInternCountEl) navInternCountEl.textContent = internshipJobsCount;

    const segJobsEl = document.getElementById("segment-count-jobs");
    const segInternEl = document.getElementById("segment-count-internships");
    const segAllEl = document.getElementById("segment-count-all");
    if (segJobsEl) segJobsEl.textContent = fullTimeJobsCount;
    if (segInternEl) segInternEl.textContent = internshipJobsCount;
    if (segAllEl) segAllEl.textContent = availableJobs.length;

    updateFilterPillCounts();
  }

  function updateFilterPillCounts() {
    const availableJobs = jobs.filter(job => !isJobApplied(job) && !isJobRejected(job));
    const savedIds = getAvailableSavedJobIds();
    const countAllEl = document.getElementById("count-all");
    const countCompanyEl = document.getElementById("count-company");
    const countUnstopEl = document.getElementById("count-unstop");
    const countZeroExpEl = document.getElementById("count-zero-exp");
    const countSavedEl = document.getElementById("count-saved");
    const countAsEl = document.getElementById("count-as");
    const countDsEl = document.getElementById("count-ds");
    const countDecEl = document.getElementById("count-dec");
    const countOrEl = document.getElementById("count-or");
    const countMleEl = document.getElementById("count-mle");
    const count24hEl = document.getElementById("count-24h");

    if (countAllEl) countAllEl.textContent = availableJobs.length;
    if (countZeroExpEl) countZeroExpEl.textContent = availableJobs.filter(isZeroExpJob).length;
    if (countCompanyEl) countCompanyEl.textContent = availableJobs.filter(isCompanyPortalJob).length;
    if (countUnstopEl) countUnstopEl.textContent = availableJobs.filter(isUnstopJob).length;
    if (countSavedEl) countSavedEl.textContent = savedIds.length;
    if (countAsEl) countAsEl.textContent = availableJobs.filter(j => j.tier === 1).length;
    if (countDsEl) countDsEl.textContent = availableJobs.filter(j => j.tier === 2).length;
    if (countDecEl) countDecEl.textContent = availableJobs.filter(j => j.tier === 3).length;
    if (countOrEl) countOrEl.textContent = availableJobs.filter(j => j.tier === 4).length;
    if (countMleEl) countMleEl.textContent = availableJobs.filter(j => j.tier === 8).length;
    if (count24hEl) count24hEl.textContent = availableJobs.filter(j => getJobFreshness(j).hours <= 24).length;
    const countInternEl = document.getElementById("count-internships");
    const countFullJobEl = document.getElementById("count-full-jobs");
    if (countInternEl) countInternEl.textContent = availableJobs.filter(isInternshipJob).length;
    if (countFullJobEl) countFullJobEl.textContent = availableJobs.filter(j => !isInternshipJob(j)).length;
  }

  // ==========================================================================
  
  // Role Type Separation Controller
  function setRoleTypeFilter(roleType, shouldScroll = false) {
    currentFilter.roleType = roleType || "jobs";

    // Update segmented control buttons
    document.querySelectorAll(".type-segment-btn").forEach(btn => {
      const type = btn.getAttribute("data-role-type");
      const isActive = (type === currentFilter.roleType);
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    // Update nav tab active state
    const tabJobs = document.getElementById("tab-btn-jobs");
    const tabIntern = document.getElementById("tab-btn-internships");
    if (tabJobs && tabIntern) {
      if (currentFilter.roleType === "internships") {
        tabIntern.classList.add("active");
        tabJobs.classList.remove("active");
      } else {
        tabJobs.classList.add("active");
        tabIntern.classList.remove("active");
      }
    }

    // Update Drawer select if exists
    const roleTypeSelect = document.getElementById("role-type-select");
    if (roleTypeSelect) roleTypeSelect.value = currentFilter.roleType;

    // Update stat card active indicators
    const statFull = document.getElementById("stat-full-jobs");
    const statIntern = document.getElementById("stat-internships");
    if (statFull) statFull.classList.toggle("active-stat", currentFilter.roleType === "jobs");
    if (statIntern) statIntern.classList.toggle("active-stat", currentFilter.roleType === "internships");

    currentPage = 1;
    renderJobs();
    if (shouldScroll) scrollToResults();
  }

  // 3. Navigation Tabs
  // ==========================================================================

  const tabButtons = document.querySelectorAll(".nav-tab");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach(button => {
    button.addEventListener("click", () => {
      const targetTab = button.getAttribute("data-tab");

      if (targetTab === "internships") {
        tabButtons.forEach(btn => btn.classList.remove("active"));
        button.classList.add("active");
        tabContents.forEach(content => content.classList.remove("active"));
        const targetContent = document.getElementById("view-jobs");
        if (targetContent) targetContent.classList.add("active");
        setRoleTypeFilter("internships", true);
        return;
      }

      if (targetTab === "jobs") {
        tabButtons.forEach(btn => btn.classList.remove("active"));
        button.classList.add("active");
        tabContents.forEach(content => content.classList.remove("active"));
        const targetContent = document.getElementById("view-jobs");
        if (targetContent) targetContent.classList.add("active");
        setRoleTypeFilter("jobs", true);
        return;
      }

      if (targetTab === "company-sites") {
        tabButtons.forEach(btn => btn.classList.remove("active"));
        button.classList.add("active");
        tabContents.forEach(content => content.classList.remove("active"));
        const targetContent = document.getElementById("view-company-sites");
        if (targetContent) targetContent.classList.add("active");
        renderCompanySites();
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      tabButtons.forEach(btn => btn.classList.remove("active"));
      tabContents.forEach(content => content.classList.remove("active"));

      button.classList.add("active");
      const targetContent = document.getElementById(`view-${targetTab}`);
      if (targetContent) {
        targetContent.classList.add("active");
      }
    });
  });

  // ==========================================================================
  // 4. Job Rendering & Filtering
  // ==========================================================================

  function getTierBadgeClass(tier) {
    if (tier === 1) return "tier-badge-1";
    if (tier === 2) return "tier-badge-2";
    if (tier === 3) return "tier-badge-3";
    if (tier === 4) return "tier-badge-4";
    if (tier === 5) return "tier-badge-5";
    if (tier === 6) return "tier-badge-6";
    if (tier === 7) return "tier-badge-7";
    if (tier === 8) return "tier-badge-secondary";
    return "tier-badge-adjacent";
  }

  function getJobFreshness(job) {
    if (!job) return { hours: Infinity, label: "Date unavailable", badgeText: "Posted date unavailable", isMinute: false };

    // 1. If job has an absolute posted_at timestamp, calculate exact real-time elapsed age
    if (job.posted_at) {
      try {
        const postedMs = new Date(String(job.posted_at).replace(" ", "T")).getTime();
        const nowMs = Date.now();
        if (!isNaN(postedMs) && postedMs <= nowMs) {
          const diffMs = nowMs - postedMs;
          const totalMins = Math.max(1, Math.floor(diffMs / (60 * 1000)));
          const totalHours = diffMs / (60 * 60 * 1000);
          
          if (totalMins < 60) {
            const label = `${totalMins}m ago`;
            return { hours: totalHours, label, badgeText: `⚡ Just now (${label})`, isMinute: true };
          } else if (totalHours < 24) {
            const hrs = Math.floor(totalHours);
            const label = `${hrs}h ago`;
            return { hours: totalHours, label, badgeText: `⚡ Posted ${label}`, isMinute: false };
          } else {
            const days = Math.floor(totalHours / 24);
            const label = `${days}d ago`;
            return { hours: totalHours, label, badgeText: `⚡ Posted ${label}`, isMinute: false };
          }
        }
      } catch (e) {}
    }

    // 2. Explicit relative time string (e.g. "5 minutes ago", "17 hours ago", "1 day ago")
    if (job.relative_time) {
      const match = String(job.relative_time).match(/(\d+)\s*(h|hr|hour|d|day|m|min|w|week)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        let hours = num;
        let isMinute = false;
        if (unit.startsWith('d')) hours = num * 24;
        else if (unit.startsWith('w')) hours = num * 168;
        else if (unit.startsWith('m')) {
          hours = Math.max(0.01, num / 60);
          isMinute = true;
        }
        let label = `${hours}h ago`;
        if (isMinute) label = `${num}m ago`;
        else if (hours >= 24) label = `${Math.floor(hours / 24)}d ago`;
        return { hours, label, badgeText: isMinute ? `⚡ Just now (${label})` : `⚡ Posted ${label}`, isMinute };
      }
    }

    // Use a collector-computed age only when the listing carries a verified source timestamp.
    const fallbackHours = Number(job.hours_ago);
    if (!Number.isFinite(fallbackHours) || fallbackHours < 0) {
      return { hours: Infinity, label: "Date unavailable", badgeText: "Posted date unavailable", isMinute: false };
    }
    if (fallbackHours < 1) {
      const mins = Math.max(1, Math.round(fallbackHours * 60));
      return {
        hours: fallbackHours,
        label: `${mins}m ago`,
        badgeText: `⚡ Just now (${mins}m ago)`,
        isMinute: true
      };
    }
    const label = fallbackHours >= 24 ? `${Math.floor(fallbackHours / 24)}d ago` : `${Math.floor(fallbackHours)}h ago`;
    return {
      hours: fallbackHours,
      label,
      badgeText: `⚡ Posted ${label}`,
      isMinute: false
    };
  }

  // Synonym & Domain Knowledge Mapping
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

  const DOMAIN_EXPANSIONS = {
    'as': ['applied scientist', 'applied science', 'as'],
    'applied scientist': ['applied scientist', 'applied ml', 'research scientist', 'applied science', 'applied ai'],
    'applied': ['applied scientist', 'applied ml', 'applied ai', 'applied machine learning'],
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

  function renderJobs() {
    let filtered = jobs.filter(job => {
      if (isJobApplied(job) || isJobRejected(job)) return false;
      // Shortlist filter
      if (currentFilter.onlySaved) {
        const jId = getJobId(job);
        if (!isJobSaved(jId)) return false;
      }

      // Score filter
      if (job.score < currentFilter.minScore) return false;

      // Tier filter
      if (currentFilter.tier !== "all") {
        if (currentFilter.tier === "primary" && ![1, 2, 3, 4, 5, 6, 7].includes(job.tier)) return false;
        if (currentFilter.tier === "secondary" && job.tier !== 8) return false;
        if ((currentFilter.tier === "adjacent" || currentFilter.tier === "optional") && job.tier !== 9) return false;
        if (!isNaN(currentFilter.tier) && job.tier !== parseInt(currentFilter.tier, 10)) return false;
      }

      // Search query (intelligent multi-field & token matching with synonym expansion)
      if (currentFilter.search) {
        const q = currentFilter.search.toLowerCase().trim();
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

        let matchesQuery = false;
        // Direct exact match in title or company gets immediate pass (unless short 2-letter token)
        if (q.length > 2 && (title.includes(q) || company.includes(q))) {
          matchesQuery = true;
        } else if (q === 'or') {
          // Operations Research / Tier 4 match
          if (job.tier === 4 || category.includes('optimization') || category.includes('or')) {
            matchesQuery = true;
          } else {
            const orExpansions = ['operations research', 'linear programming', 'integer programming', 'simplex', 'gurobi', 'cplex', 'scipy.optimize'];
            matchesQuery = orExpansions.some(exp => allText.includes(exp));
          }
        } else if (['ai', 'ml', 'ds', 'da', 'as'].includes(q)) {
          const regex = new RegExp(`\\b${q}\\b`, 'i');
          if (regex.test(title) || regex.test(company) || regex.test(category) || skills.some(s => regex.test(s))) {
            matchesQuery = true;
          } else {
            const expansions = DOMAIN_EXPANSIONS[q] || [];
            matchesQuery = expansions.some(exp => allText.includes(exp));
          }
        } else if (allText.includes(q)) {
          matchesQuery = true;
        } else {
          // Token-based matching with city and domain expansions
          const tokens = normalizeTokens(q);
          if (tokens.length > 0) {
            matchesQuery = tokens.every(token => {
              if (allText.includes(token)) return true;
              if (CITY_SYNONYMS[token] && CITY_SYNONYMS[token].some(syn => allText.includes(syn))) return true;
              if (DOMAIN_EXPANSIONS[token] && DOMAIN_EXPANSIONS[token].some(exp => allText.includes(exp))) return true;
              if (token.length <= 3) {
                const tokenRegex = new RegExp(`\\b${token}\\b`, 'i');
                return tokenRegex.test(allText);
              }
              return false;
            });
          }
        }

        if (!matchesQuery) return false;
      }

      // Location filter (matches Indian cities & Remote)
      if (currentFilter.location && currentFilter.location !== "all") {
        const locTarget = currentFilter.location.toLowerCase();
        const jobLoc = (job.location || '').toLowerCase();
        const isRemote = job.is_remote || jobLoc.includes("remote");

        if (locTarget === "remote") {
          if (!isRemote) return false;
        } else {
          const syns = CITY_SYNONYMS[locTarget] || [locTarget];
          const locMatches = syns.some(s => jobLoc.includes(s));
          if (!locMatches) return false;
        }
      }

      // Freshness filter: Strictly exclude jobs older than selected hours (unless Anytime / 9999)
      if (currentFilter.maxAgeHours < 9000) {
        const freshness = getJobFreshness(job);
        if (freshness.hours > currentFilter.maxAgeHours) return false;
      }

      // Source filter
      if (currentFilter.source && currentFilter.source !== "all") {
        const urlLower = (job.url || '').toLowerCase();
        const domainLower = (job.source_domain || '').toLowerCase();
        const typeLower = (job.source_type || '').toLowerCase();
        const isPost = Boolean(job.is_post) || typeLower.includes('post') || urlLower.includes('/posts/');
        const isUnstop = urlLower.includes('unstop.com') || domainLower.includes('unstop') || typeLower.includes('unstop');
        const isAts = urlLower.includes('greenhouse.io') || urlLower.includes('lever.co') || urlLower.includes('ashbyhq') || urlLower.includes('workday') || typeLower.includes('ats');
        const isCompanyPortal = typeLower.includes('portal') || typeLower.includes('official') || isAts || (!urlLower.includes('linkedin.com') && !urlLower.includes('unstop.com') && !isPost && !domainLower.includes('remotive') && !domainLower.includes('jobicy'));
        const isLinkedIn = (urlLower.includes('linkedin.com') || domainLower.includes('linkedin') || typeLower.includes('linkedin')) && !isPost && !typeLower.includes('portal') && !isAts && !isUnstop;

        if (currentFilter.source === "LinkedIn Post" && !isPost) return false;
        if (currentFilter.source === "LinkedIn" && !isLinkedIn) return false;
        if (currentFilter.source === "Unstop" && !isUnstop) return false;
        if (currentFilter.source === "Direct ATS" && !isAts) return false;
        if ((currentFilter.source === "Company Portal" || currentFilter.source === "Direct") && !isCompanyPortal) return false;

        const sourceDomains = {
          Jobicy: "jobicy.com",
          Remotive: "remotive.com",
          Himalayas: "himalayas.app",
          Adzuna: "adzuna.com",
          JSearch: "jsearch.p.rapidapi.com"
        };
        const selectedDomain = sourceDomains[currentFilter.source];
        if (selectedDomain && !domainLower.includes(selectedDomain)) return false;
      }

      // Zero experience filter (strictly 0 years / freshers & interns only)
      if (currentFilter.onlyZeroExp && !isZeroExpJob(job)) {
        return false;
      }

      // Role Type Separation: Jobs vs Internships (Strict Exclusions)
      const isIntern = isInternshipJob(job);
      if ((currentFilter.roleType === "jobs" || currentFilter.onlyFullJobs) && isIntern) {
        return false; // Strictly exclude ALL internships from full-time jobs view
      }
      if ((currentFilter.roleType === "internships" || currentFilter.onlyInternships) && !isIntern) {
        return false; // Strictly exclude full-time jobs from internships view
      }

      return true;
    });

    // Sorting: Default is "latest" (latest to farthest / newest to oldest based on dynamic elapsed time)
    filtered.sort((a, b) => {
      const aFreshness = getJobFreshness(a);
      const bFreshness = getJobFreshness(b);
      const aHours = aFreshness.hours;
      const bHours = bFreshness.hours;

      if (currentFilter.sortBy === "latest") {
        if (aHours !== bHours) return aHours - bHours; // lowest hours (latest) first
        return (b.score || 0) - (a.score || 0); // secondary tie-breaker: highest match score
      }
      if (currentFilter.sortBy === "farthest" || currentFilter.sortBy === "oldest") {
        if (aHours !== bHours) return bHours - aHours; // highest hours (farthest) first
        return (b.score || 0) - (a.score || 0);
      }
      if (currentFilter.sortBy === "score-desc") {
        if (b.score !== a.score) return b.score - a.score;
        return aHours - bHours; // secondary: latest first
      }
      if (currentFilter.sortBy === "tier-asc") {
        if (a.tier !== b.tier) return (a.tier || 99) - (b.tier || 99);
        return aHours - bHours;
      }
      if (currentFilter.sortBy === "company-asc") return a.company.localeCompare(b.company);
      return aHours - bHours;
    });

    const totalJobs = filtered.length;

    // Update banner & counter elements
    if (bannerJobCount) bannerJobCount.textContent = totalJobs;
    const bannerHeadlineEl = document.getElementById("banner-headline");
    if (bannerHeadlineEl) {
      const freshnessText = currentFilter.maxAgeHours >= 9000
        ? "Anytime"
        : currentFilter.maxAgeHours % 24 === 0
          ? `${currentFilter.maxAgeHours / 24} Days`
          : `${currentFilter.maxAgeHours} Hours`;
      let roleLabel = "Opportunities";
      if (currentFilter.roleType === "jobs") {
        roleLabel = "Full-Time Jobs (Internships Separated)";
      } else if (currentFilter.roleType === "internships") {
        roleLabel = "Verified Internships & Traineeships";
      } else {
        roleLabel = "Roles (Jobs & Internships Combined)";
      }

      if (currentFilter.search) {
        bannerHeadlineEl.innerHTML = `🎯 Found <span id="banner-job-count" class="highlight-count">${totalJobs}</span> ${roleLabel} Matching "${escapeHTML(currentFilter.search)}"`;
      } else {
        bannerHeadlineEl.innerHTML = `🎯 Found <span id="banner-job-count" class="highlight-count">${totalJobs}</span> ${roleLabel} Posted Within ${freshnessText}`;
      }
    }
    if (bannerScopePill) {
      const scopeHrs = currentFilter.maxAgeHours || 120;
      bannerScopePill.textContent = scopeHrs >= 9000
        ? '🌐 Anytime (All Jobs)'
        : scopeHrs % 24 === 0
          ? `📅 Past ${scopeHrs / 24} days`
          : `⚡ Past ${scopeHrs} hours`;
    }

    // Render cards
    if (totalJobs === 0) {
      jobsGrid.innerHTML = "";
      emptyState.style.display = "block";
      resultsCount.textContent = `Showing 0 matching jobs`;
      if (paginationContainer) paginationContainer.style.display = "none";

      const emptyTitle = document.getElementById("empty-state-title");
      const emptyDesc = document.getElementById("empty-state-desc");
      const emptyClearBtn = document.getElementById("empty-clear-search-btn");
      const emptyExpandBtn = document.getElementById("empty-expand-freshness-btn");

      if (emptyTitle) {
        if (currentFilter.onlySaved) {
          emptyTitle.textContent = "Your shortlist is empty";
        } else if (jobs.length === 0) {
          emptyTitle.textContent = "Waiting for verified job listings";
        } else if (currentFilter.search) {
          emptyTitle.textContent = `No jobs matched "${currentFilter.search}"`;
        } else {
          emptyTitle.textContent = `No jobs matched your current filters`;
        }
      }
      if (emptyDesc) {
        if (currentFilter.onlySaved) {
          emptyDesc.textContent = "Click the ★ star on any job card to bookmark roles you want to save and track.";
        } else if (jobs.length === 0) {
          emptyDesc.textContent = "Listings appear here after the scheduled feeds return jobs with a source-provided posting date. Collection is scheduled every 5 minutes. New listings depend on source availability.";
        } else if (currentFilter.maxAgeHours <= 24) {
          emptyDesc.textContent = `No jobs found within the past ${currentFilter.maxAgeHours}h window. Try expanding to Anytime or clearing your search.`;
        } else {
          emptyDesc.textContent = `Try lowering your minimum match score or checking for other role keywords.`;
        }
      }
      if (emptyClearBtn) {
        emptyClearBtn.style.display = currentFilter.search ? "inline-block" : "none";
      }
      if (emptyExpandBtn) {
        emptyExpandBtn.style.display = currentFilter.maxAgeHours < 9000 ? "inline-block" : "none";
      }
      return;
    }

    emptyState.style.display = "none";

    // Pagination calculations
    const totalPages = Math.ceil(totalJobs / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalJobs);
    const pagedJobs = filtered.slice(startIndex, endIndex);

    // Update results header
    resultsCount.textContent = `Showing ${startIndex + 1}–${endIndex} of ${totalJobs} matching jobs (Posted within past ${currentFilter.maxAgeHours} hours)`;

    jobsGrid.innerHTML = pagedJobs.map(job => {
      const tierClass = getTierBadgeClass(job.tier);
      const scorePct = Math.round(job.score * 100);
      const matchedTags = (job.matched_skills || []).map(s => 
        `<span class="skill-tag matched">✓ ${s.replace(/_/g, ' ')}</span>`
      ).join("");

      const freshness = getJobFreshness(job);
      const freshnessPill = freshness.isMinute
        ? `<span class="freshness-minute-badge"><span class="live-pulse-dot"></span> ⚡ Just Now (${freshness.label})</span>`
        : `<span class="freshness-badge">⚡ Posted ${freshness.label}</span>`;

      // Resolve exact application URL:
      // We NEVER redirect users to generic company homepages when a specific post or targeted search is available!
      const targetUrl = resolveJobTargetUrl(job);
      const urlLower = targetUrl.toLowerCase();
      const domainLower = (job.source_domain || '').toLowerCase();
      const typeLower = (job.source_type || '').toLowerCase();

      const isPost = Boolean(job.is_post) || typeLower.includes('post') || urlLower.includes('/posts/');
      const isUnstop = urlLower.includes('unstop.com') || domainLower.includes('unstop') || typeLower.includes('unstop');
      const isNaukri = urlLower.includes('naukri.com') || domainLower.includes('naukri') || typeLower.includes('naukri');
      const isIndeed = urlLower.includes('indeed.com') || domainLower.includes('indeed') || typeLower.includes('indeed');
      const isFoundit = urlLower.includes('foundit.in') || domainLower.includes('foundit') || typeLower.includes('foundit');
      const isShine = urlLower.includes('shine.com') || domainLower.includes('shine') || typeLower.includes('shine');
      const isInstahyre = urlLower.includes('instahyre.com') || domainLower.includes('instahyre') || typeLower.includes('instahyre');
      const isCutshort = urlLower.includes('cutshort.io') || domainLower.includes('cutshort') || typeLower.includes('cutshort');
      const isWellfound = urlLower.includes('wellfound.com') || domainLower.includes('wellfound') || typeLower.includes('wellfound');
      const isHirist = urlLower.includes('hirist.tech') || domainLower.includes('hirist') || typeLower.includes('hirist');
      const isInternshala = urlLower.includes('internshala.com') || domainLower.includes('internshala') || typeLower.includes('internshala');
      const isApna = urlLower.includes('apna.co') || domainLower.includes('apna') || typeLower.includes('apna');
      const isRemoteOK = urlLower.includes('remoteok.com') || domainLower.includes('remoteok') || typeLower.includes('remoteok');
      const isAts = urlLower.includes('greenhouse.io') || urlLower.includes('lever.co') || urlLower.includes('ashbyhq') || urlLower.includes('workday') || typeLower.includes('ats');
      const isLinkedInSearch = urlLower.includes('linkedin.com/jobs/search') || urlLower.includes('linkedin.com/search');
      const isLinkedInView = urlLower.includes('linkedin.com/jobs/view');
      const isLinkedIn = (urlLower.includes('linkedin.com') || domainLower.includes('linkedin') || typeLower.includes('linkedin')) && !isPost;
      const isRemotive = domainLower.includes('remotive.com') || urlLower.includes('remotive.com');
      const isJobicy = domainLower.includes('jobicy.com') || urlLower.includes('jobicy.com');
      const isJSearch = domainLower.includes('jsearch.p.rapidapi.com');
      const isPortal = isAts || typeLower.includes('portal') || typeLower.includes('official');

      let platformPill = '';
      let applyBtnText = '🏢 Apply to Exact Post ↗';
      let applyBtnClass = 'btn btn-primary btn-direct-portal';

      if (isPost) {
        platformPill = `<span class="source-domain-badge source-linkedin-post">👤 Individual Public Post</span>`;
        if (job.post_author) {
          const authorShort = job.post_author.split('(')[0].trim();
          platformPill += ` <span class="author-badge" title="${escapeHTML(job.post_author)}">📢 By: ${escapeHTML(authorShort)}</span>`;
        }
        applyBtnText = '💼 Apply on LinkedIn ↗';
        applyBtnClass = 'btn btn-primary btn-linkedin';
      } else if (isUnstop) {
        platformPill = `<span class="source-domain-badge source-unstop">🎯 Unstop</span>`;
        applyBtnText = '🎯 Apply on Unstop ↗';
        applyBtnClass = 'btn btn-primary btn-unstop';
      } else if (isNaukri) {
        platformPill = `<span class="source-domain-badge source-naukri">🔷 Naukri</span>`;
        applyBtnText = '🔷 Apply on Naukri ↗';
        applyBtnClass = 'btn btn-primary btn-naukri';
      } else if (isIndeed) {
        platformPill = `<span class="source-domain-badge source-indeed">🎯 Indeed</span>`;
        applyBtnText = '🎯 Apply on Indeed ↗';
        applyBtnClass = 'btn btn-primary btn-indeed';
      } else if (isInternshala) {
        platformPill = `<span class="source-domain-badge source-unstop">🎓 Internshala</span>`;
        applyBtnText = '🎓 Apply on Internshala ↗';
        applyBtnClass = 'btn btn-primary btn-unstop';
      } else if (isInstahyre) {
        platformPill = `<span class="source-domain-badge source-direct">⚡ Instahyre</span>`;
        applyBtnText = '⚡ Apply on Instahyre ↗';
        applyBtnClass = 'btn btn-primary btn-direct-portal';
      } else if (isCutshort) {
        platformPill = `<span class="source-domain-badge source-direct">✂️ Cutshort</span>`;
        applyBtnText = '✂️ Apply on Cutshort ↗';
        applyBtnClass = 'btn btn-primary btn-direct-portal';
      } else if (isWellfound) {
        platformPill = `<span class="source-domain-badge source-direct">✌️ Wellfound</span>`;
        applyBtnText = '✌️ Apply on Wellfound ↗';
        applyBtnClass = 'btn btn-primary btn-direct-portal';
      } else if (isHirist) {
        platformPill = `<span class="source-domain-badge source-direct">💻 Hirist</span>`;
        applyBtnText = '💻 Apply on Hirist ↗';
        applyBtnClass = 'btn btn-primary btn-direct-portal';
      } else if (isFoundit) {
        platformPill = `<span class="source-domain-badge source-direct">⚡ Foundit</span>`;
        applyBtnText = '⚡ Apply on Foundit ↗';
        applyBtnClass = 'btn btn-primary btn-direct-portal';
      } else if (isShine) {
        platformPill = `<span class="source-domain-badge source-direct">✨ Shine</span>`;
        applyBtnText = '✨ Apply on Shine ↗';
        applyBtnClass = 'btn btn-primary btn-direct-portal';
      } else if (isApna) {
        platformPill = `<span class="source-domain-badge source-direct">📱 Apna</span>`;
        applyBtnText = '📱 Apply on Apna ↗';
        applyBtnClass = 'btn btn-primary btn-direct-portal';
      } else if (isRemoteOK) {
        platformPill = `<span class="source-domain-badge source-direct">🏝️ RemoteOK</span>`;
        applyBtnText = '🏝️ Apply on RemoteOK ↗';
        applyBtnClass = 'btn btn-primary btn-direct-portal';
      } else if (isAts) {
        platformPill = `<span class="source-domain-badge source-portal">🏢 ${escapeHTML(job.company || 'Direct ATS')} ATS</span>`;
        applyBtnText = `🏢 Apply on ${escapeHTML(job.company || 'Company')} Portal ↗`;
        applyBtnClass = 'btn btn-primary btn-direct-portal';
      } else if (isLinkedInView) {
        platformPill = `<span class="source-domain-badge source-linkedin">💼 LinkedIn Direct</span>`;
        applyBtnText = '💼 Apply on LinkedIn ↗';
        applyBtnClass = 'btn btn-primary btn-linkedin';
      } else if (isLinkedInSearch) {
        platformPill = `<span class="source-domain-badge source-linkedin">💼 LinkedIn Jobs</span>`;
        applyBtnText = '💼 View & Apply on LinkedIn ↗';
        applyBtnClass = 'btn btn-primary btn-linkedin';
      } else if (isRemotive) {
        platformPill = `<span class="source-domain-badge source-direct">🌐 Remotive</span>`;
        applyBtnText = '🌐 View on Remotive ↗';
        applyBtnClass = 'btn btn-primary btn-direct-portal';
      } else if (isJobicy) {
        platformPill = `<span class="source-domain-badge source-direct">🌐 Jobicy</span>`;
        applyBtnText = '🌐 View on Jobicy ↗';
        applyBtnClass = 'btn btn-primary btn-direct-portal';
      } else if (isJSearch) {
        const publisher = job.job_publisher ? ` via ${escapeHTML(job.job_publisher)}` : '';
        platformPill = `<span class="source-domain-badge source-direct">JSearch${publisher}</span>`;
        applyBtnText = 'Apply via JSearch ↗';
        applyBtnClass = 'btn btn-primary';
      } else if (isLinkedIn) {
        platformPill = `<span class="source-domain-badge source-linkedin">💼 LinkedIn</span>`;
        applyBtnText = '💼 Apply on LinkedIn ↗';
        applyBtnClass = 'btn btn-primary btn-linkedin';
      } else {
        const portalLabel = job.company ? `${escapeHTML(job.company)} Portal` : 'Direct Portal';
        platformPill = `<span class="source-domain-badge source-portal">🏢 ${portalLabel}</span>`;
        applyBtnText = `🏢 Apply on ${escapeHTML(job.company || 'Company')} Portal ↗`;
        applyBtnClass = 'btn btn-primary btn-direct-portal';
      }

      let fresherPill = '';
      if (isZeroExpJob(job)) {
        fresherPill = `<span class="fresher-badge" title="Strictly 0 years experience required / freshers & interns eligible">🎓 0 Exp • Fresher</span>`;
      } else {
        fresherPill = `<span class="fresher-badge badge-early-career" title="0–2 years / early career eligible">🌱 Early Career (0–2 Yrs)</span>`;
      }
      const internPill = isInternshipJob(job)
        ? `<span class="intern-badge" title="Internship / Traineeship position">🎓 Internship</span>`
        : `<span class="fulltime-badge" title="Full-time entry-level job">💼 Full-Time</span>`;
      const remotePill = (job.is_remote || (job.location && job.location.toLowerCase().includes('remote')))
        ? `<span class="remote-badge">🌐 Remote</span>`
        : '';
      const locationCheckPill = job.location_unverified
        ? `<span class="source-domain-badge" title="The source does not specify whether this remote job accepts applications from India. Verify location eligibility on the listing.">⚠️ Verify location</span>`
        : '';
      const applicantPill = job.applicants_count
        ? `<span class="applicant-badge">👥 ${escapeHTML(job.applicants_count)}</span>`
        : '';

      const jobId = getJobId(job);
      const isSaved = isJobSaved(jobId);
      const hasRecruiterOutreach = Boolean(job.contact_email || job.outreach_dm);
      const recruiterPill = hasRecruiterOutreach
        ? `<span class="recruiter-avail-badge" title="Recruiter outreach contact available in details">✉️ Recruiter Available</span>`
        : '';

      return `
        <article class="job-card ${isSaved ? 'is-saved' : ''}" id="job-${job.tier}-${job.company.replace(/\s+/g, '-').toLowerCase()}">
          <div>
            <div class="job-card-header">
              <div>
                <div class="job-meta-badges">
                  <span class="job-tier-badge ${tierClass}">
                    ${job.badge || '📌'} Tier ${job.tier} • ${job.category}
                  </span>
                  ${fresherPill}
                  ${internPill}
                  ${freshnessPill}
                  ${platformPill}
                  ${remotePill}
                  ${recruiterPill}
                  ${locationCheckPill}
                  ${applicantPill}
                </div>
                <h3 class="job-title">${escapeHTML(job.title)}</h3>
                <div class="job-company-loc">
                  <span class="job-company">${escapeHTML(job.company)}</span>
                  <span>•</span>
                  <span class="job-location">📍 ${escapeHTML(job.location)}</span>
                </div>
              </div>
              <div class="card-header-actions">
                <button class="card-star-btn ${isSaved ? 'saved' : ''}" data-job-url="${escapeHTML(job.url)}" title="${isSaved ? 'Remove from your shortlist' : 'Bookmark role to your shortlist'}">★</button>
                <div class="score-badge-circle" title="Calculated Match Score: ${scorePct}%">
                  <span class="score-badge-val">${scorePct}%</span>
                  <span class="score-badge-label">FIT</span>
                </div>
              </div>
            </div>

            <p class="job-description">${escapeHTML(job.description)}</p>

            ${job.matched_skills && job.matched_skills.length > 0 ? `
              <div class="skills-container">
                <div class="skills-label">Matched Skills (${job.matched_skills.length}):</div>
                <div class="skills-tags">
                  ${matchedTags}
                </div>
              </div>
            ` : ''}

            ${job.missing_skills && job.missing_skills.length > 0 ? `
              <div class="skills-container skill-gaps-container" style="margin-top: -0.5rem;">
                <div class="skills-label gaps-label">⚡ Semantic Skill Gaps (${job.missing_skills.length}):</div>
                <div class="skills-tags">
                  ${job.missing_skills.slice(0, 3).map(s => `<span class="skill-tag missing">⚡ ${escapeHTML(s.replace(/_/g, ' '))}</span>`).join("")}
                </div>
              </div>
            ` : ''}
          </div>

          <div class="card-actions">
            <button type="button" class="btn btn-secondary btn-reject-job" data-reject-job="${escapeHTML(getJobId(job))}">Reject Job</button>
            <button type="button" class="btn btn-secondary btn-mark-applied" data-mark-applied="${escapeHTML(getJobId(job))}">✓ Mark as Applied</button>
            <a href="${escapeHTML(targetUrl)}" target="_blank" rel="noopener noreferrer" class="${applyBtnClass}" title="Direct application link for ${escapeHTML(job.title)} at ${escapeHTML(job.company)}">
              <span>${applyBtnText}</span>
            </a>
            <a href="https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent((job.company || '') + ' ' + (job.title || '')).trim()}&location=India&f_TPR=r604800" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-backup-search" title="Search all active openings on LinkedIn & Naukri if direct posting closed">
              <span>🔍 Active Openings ↗</span>
            </a>
            <button class="btn btn-secondary view-details-btn" data-job-url="${escapeHTML(job.url)}" title="View complete details, roadmap and recruiter pitch">
              <span>⚡ Skill Gap &amp; Roadmap</span>
            </button>
            <button class="btn btn-secondary btn-icon copy-btn" data-info="${escapeHTML(`${job.title} at ${job.company}\nApplication Link: ${targetUrl}`)}" title="Copy direct application link">
              <span>📋</span>
            </button>
          </div>
        </article>
      `;
    }).join("");

    // Attach bookmark star buttons
    document.querySelectorAll(".card-star-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const jobUrl = e.currentTarget.getAttribute("data-job-url");
        const found = jobs.find(j => j.url === jobUrl);
        const jId = getJobId(found || { url: jobUrl });
        const isNowSaved = toggleSavedJob(jId);
        if (isNowSaved) {
          btn.classList.add("saved");
          btn.title = "Remove from your shortlist";
          showToast("⭐ Added role to your shortlist!");
        } else {
          btn.classList.remove("saved");
          btn.title = "Bookmark role to your shortlist";
          showToast("Removed role from your shortlist");
        }
        const card = btn.closest(".job-card");
        if (card) {
          if (isNowSaved) card.classList.add("is-saved");
          else card.classList.remove("is-saved");
        }
        if (currentFilter.onlySaved) {
          renderJobs();
        }
      });
    });

    // Attach copy buttons
    document.querySelectorAll(".copy-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const text = e.currentTarget.getAttribute("data-info");
        navigator.clipboard.writeText(text).then(() => {
          showToast(`Copied: ${text.split(' - ')[0]}`);
        });
      });
    });

    // Attach Details & Skill Gap buttons
    document.querySelectorAll(".view-details-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const jobUrl = e.currentTarget.getAttribute("data-job-url");
        const found = jobs.find(j => j.url === jobUrl);
        if (found) openJobModal(found);
      });
    });

    document.querySelectorAll(".job-card").forEach(card => {
      card.addEventListener("click", (e) => {
        // Prevent opening if clicking an <a> tag, copy button, or bookmark star
        if (e.target.closest("[data-reject-job]") || e.target.closest("[data-restore-rejected]") || e.target.closest("a") || e.target.closest(".copy-btn") || e.target.closest(".card-star-btn") || e.target.closest("[data-mark-applied]") || e.target.closest("[data-restore-applied]")) return;
        const cardId = card.id;
        const found = jobs.find(j => cardId.includes((j.company || '').replace(/\s+/g, '-').toLowerCase()));
        if (found) openJobModal(found);
      });
    });

    // Update active filters badge & pills
    updateActiveFilterBadge();
    updatePillActiveState();

    // Render Pagination Controls ("Many Pages")
    renderPagination(totalJobs, totalPages);
  }

  function renderPagination(totalJobs, totalPages) {
    if (!paginationContainer) return;
    if (totalJobs <= pageSize) {
      paginationContainer.style.display = "none";
      return;
    }

    paginationContainer.style.display = "flex";
    const startNum = (currentPage - 1) * pageSize + 1;
    const endNum = Math.min(currentPage * pageSize, totalJobs);
    if (paginationInfo) {
      paginationInfo.textContent = `Showing ${startNum}–${endNum} of ${totalJobs} jobs (Page ${currentPage} of ${totalPages})`;
    }

    if (!paginationButtons) return;

    let buttonsHTML = '';
    // Previous button
    buttonsHTML += `<button class="pagination-btn" id="pg-prev" ${currentPage === 1 ? 'disabled' : ''} title="Previous Page">‹ Prev</button>`;

    // Page buttons
    for (let p = 1; p <= totalPages; p++) {
      if (totalPages > 7) {
        if (p > 1 && p < currentPage - 1 && p === 2) {
          buttonsHTML += `<span style="padding:0 0.3rem;color:var(--text-dim)">...</span>`;
          continue;
        }
        if (p > currentPage + 1 && p < totalPages && p === totalPages - 1) {
          buttonsHTML += `<span style="padding:0 0.3rem;color:var(--text-dim)">...</span>`;
          continue;
        }
        if (p !== 1 && p !== totalPages && Math.abs(p - currentPage) > 1) {
          continue;
        }
      }
      buttonsHTML += `<button class="pagination-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }

    // Next button
    buttonsHTML += `<button class="pagination-btn" id="pg-next" ${currentPage === totalPages ? 'disabled' : ''} title="Next Page">Next ›</button>`;

    paginationButtons.innerHTML = buttonsHTML;

    // Attach listeners
    paginationButtons.querySelectorAll(".pagination-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        if (btn.id === "pg-prev" && currentPage > 1) {
          currentPage--;
          renderJobs();
          jobsGrid.scrollIntoView({ behavior: 'smooth' });
        } else if (btn.id === "pg-next" && currentPage < totalPages) {
          currentPage++;
          renderJobs();
          jobsGrid.scrollIntoView({ behavior: 'smooth' });
        } else if (btn.hasAttribute("data-page")) {
          currentPage = parseInt(btn.getAttribute("data-page"), 10);
          renderJobs();
          jobsGrid.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }

  // ==========================================================================
  // Modal Management
  // ==========================================================================
  const modalOverlay = document.getElementById("job-modal-overlay");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const modalJobTitle = document.getElementById("modal-job-title");
  const modalTierBadge = document.getElementById("modal-tier-badge");
  const modalCompany = document.getElementById("modal-company");
  const modalLocation = document.getElementById("modal-location");
  const modalScoreVal = document.getElementById("modal-score-val");
  const modalDescription = document.getElementById("modal-description");
  const modalSkillsMatched = document.getElementById("modal-skills-matched");
  const modalSkillsMissing = document.getElementById("modal-skills-missing");
  const modalStrategyAdvice = document.getElementById("modal-strategy-advice");
  const modalApplyLinkedin = document.getElementById("modal-apply-linkedin");
  const modalApplyCompany = document.getElementById("modal-apply-company");
  const modalApplyGoogle = document.getElementById("modal-apply-google");
  const modalCopyBtn = document.getElementById("modal-copy-btn");

  function openJobModal(job) {
    if (!job) return;

    const scorePct = Math.round(job.score * 100);
    modalJobTitle.textContent = job.title;
    modalCompany.textContent = job.company;
    modalLocation.textContent = `📍 ${job.location || 'India / Remote'}`;
    modalScoreVal.textContent = `${scorePct}%`;
    modalTierBadge.textContent = `${job.badge || '📌'} Tier ${job.tier} • ${job.category} (${job.priority || 'Standard'})`;
    modalTierBadge.className = `job-tier-badge ${getTierBadgeClass(job.tier)}`;
    modalDescription.textContent = job.description || "Entry-level position aligned with your target role category.";

    // Render skills
    const matched = (job.matched_skills || []);
    const missing = (job.missing_skills || []);

    modalSkillsMatched.innerHTML = matched.length > 0
      ? `<strong>Matched (${matched.length}):</strong> ` + matched.map(s => `<span class="skill-tag matched">✓ ${s.replace(/_/g, ' ')}</span>`).join(" ")
      : "<span style='color:var(--text-dim)'>No exact skills matched yet</span>";

    modalSkillsMissing.innerHTML = missing.length > 0
      ? `<strong>Missing / Gaps (${missing.length}):</strong> ` + missing.map(s => `<span class="skill-tag missing">⚡ ${s.replace(/_/g, ' ')}</span>`).join(" ")
      : "<span style='color:var(--accent-emerald)'>✓ 0 critical gaps identified</span>";

    // Populate Semantic Skill Gap & Bridge Roadmap
    const gapData = job.semantic_skill_gap || null;
    const modalGapFitTag = document.getElementById("modal-gap-fit-tag");
    const modalGapItems = document.getElementById("modal-gap-items");
    const modalGapBridgeText = document.getElementById("modal-gap-bridge-text");
    const modalGapInterviewText = document.getElementById("modal-gap-interview-text");

    if (modalGapFitTag) {
      modalGapFitTag.textContent = gapData ? `${gapData.fit_percentage} • ${gapData.gap_percentage}` : `${scorePct}% Core Fit`;
    }

    if (modalGapItems) {
      if (gapData && gapData.gaps && gapData.gaps.length > 0) {
        modalGapItems.innerHTML = gapData.gaps.map(g => {
          const impactClass = (g.impact || '').toLowerCase().includes('high') ? 'high' : 'medium';
          return `
            <div class="gap-item">
              <div class="gap-item-top">
                <span class="gap-skill-name">⚡ ${escapeHTML(g.skill)}</span>
                <span class="impact-badge ${impactClass}">${escapeHTML(g.impact || 'Impact')}</span>
              </div>
              <p class="gap-action-text">${escapeHTML(g.action || '')}</p>
            </div>
          `;
        }).join("");
      } else if (missing.length > 0) {
        modalGapItems.innerHTML = missing.map(s => `
          <div class="gap-item">
            <div class="gap-item-top">
              <span class="gap-skill-name">⚡ ${escapeHTML(s)}</span>
              <span class="impact-badge high">High Impact</span>
            </div>
            <p class="gap-action-text">Build a dedicated portfolio mini-project demonstrating practical hands-on application.</p>
          </div>
        `).join("");
      } else {
        modalGapItems.innerHTML = `<div style="color:var(--accent-emerald); font-size:0.85rem; font-weight:600;">✓ Excellent Semantic Fit: No critical skill gaps identified for your profile!</div>`;
      }
    }

    if (modalGapBridgeText) {
      modalGapBridgeText.textContent = gapData && gapData.bridge_roadmap
        ? gapData.bridge_roadmap
        : `Tailor your resume and portfolio for ${job.company} by building 1 dedicated project highlighting ${matched.slice(0, 2).join(' and ') || 'data analytics'}.`;
    }

    if (modalGapInterviewText) {
      modalGapInterviewText.textContent = gapData && gapData.interview_talk_track
        ? gapData.interview_talk_track
        : `Frame your background by demonstrating strong core problem-solving and rapid learning agility in quantitative modeling.`;
    }

    // Strategy advice based on Tier
    let advice = "";
    if (job.is_post) {
      advice = `Informal LinkedIn Hiring Post: Reach out directly to ${job.post_author || 'the hiring manager'} on LinkedIn DM or via email (${job.contact_email || 'the post link'}). Use the generated outreach pitch highlighting your relevant skills: ${matched.join(', ') || 'data & quantitative modeling'}.`;
    } else if (job.tier === 1) advice = "Top Priority Tier 1 (Applied Scientist / ML Research): Tailor your resume to highlight PyTorch, deep learning foundation models/LLMs, scientific experimentation, and research projects.";
    else if (job.tier === 2) advice = "Top Priority Tier 2: Emphasize A/B testing methodologies, SQL analytics pipelines, business experimentation, and predictive modeling.";
    else if (job.tier === 3) advice = "Top Priority Tier 3: Showcase statistical modeling, hypothesis testing, causal inference, and decision optimization.";
    else if (job.tier === 4) advice = "Top Priority Tier 4: Highlight linear programming (PuLP/SciPy), operations research algorithms, routing, and constraint optimization.";
    else if (job.tier === 5) advice = "Top Priority Tier 5: Feature product teardowns, telemetry metrics, SQL analytics, and customer problem roadmaps.";
    else if (job.tier === 6) advice = "Top Priority Tier 6: Highlight business operations, merchant growth financial modeling, market sizing, and board decks.";
    else if (job.tier === 7) advice = "Top Priority Tier 7: Highlight Prophet, ARIMA, demand forecasting, time-series feature engineering, and inventory planning.";
    else if (job.tier === 8) advice = "Secondary Priority Tier 8: Feature deployed ML models, FastAPI REST APIs, Docker containerization, and scikit-learn.";
    else advice = "Strategic Adjacent Role Tier 9: Highlight data modeling, dbt pipelines, SQL transformations, and dimensional warehousing.";

    modalStrategyAdvice.textContent = advice;

    // Direct Exact Application URL
    const modalTargetUrl = resolveJobTargetUrl(job);
    const isModalUnstop = modalTargetUrl.toLowerCase().includes('unstop.com');
    const isModalAts = modalTargetUrl.toLowerCase().includes('greenhouse.io') || modalTargetUrl.toLowerCase().includes('lever.co') || modalTargetUrl.toLowerCase().includes('ashbyhq') || modalTargetUrl.toLowerCase().includes('workday');
    const isModalLinkedIn = modalTargetUrl.toLowerCase().includes('linkedin.com');

    modalApplyLinkedin.textContent = isModalLinkedIn
      ? (modalTargetUrl.includes('search') ? "💼 View & Apply on LinkedIn ↗" : "💼 Apply on LinkedIn ↗")
      : isModalUnstop
        ? "🎯 Apply on Unstop ↗"
        : isModalAts
          ? `🏢 Apply on ${job.company || 'Company'} ATS Portal ↗`
          : `🏢 Apply to Exact Post ↗`;
    modalApplyLinkedin.href = modalTargetUrl;
    modalApplyLinkedin.className = isModalLinkedIn ? "btn btn-primary btn-linkedin" : (isModalUnstop ? "btn btn-primary btn-unstop" : (isModalAts ? "btn btn-primary btn-ats" : "btn btn-primary btn-direct-portal"));
    const rejectButton = document.getElementById('modal-reject-job');
    if (rejectButton) rejectButton.setAttribute('data-reject-job', getJobId(job));
    const appliedButton = document.getElementById('modal-mark-applied');
    if (appliedButton) {
      appliedButton.setAttribute('data-mark-applied', getJobId(job));
      appliedButton.disabled = isJobApplied(job);
      appliedButton.textContent = isJobApplied(job) ? '✓ Applied' : '✓ Mark as Applied';
    }
    modalApplyLinkedin.title = `Direct application link for ${job.title} at ${job.company}`;
    // Populate Cross-Platform Application Hub in Modal
    const multiGrid = document.getElementById("modal-multi-source-grid");
    if (multiGrid) {
      const title = job.title || 'Data Scientist';
      const company = job.company || '';
      const cleanTitle = title.replace(/\(.*?\)/g, '').replace(/-\s*(Fresher|Campus|0-1 Yrs|Batch\s*\d+).*/i, '').trim();
      const encTitle = encodeURIComponent(cleanTitle);
      const encAll = encodeURIComponent(`${cleanTitle} ${company}`.trim());
      const slug = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      const channels = [
        { name: "💼 LinkedIn (Past 24h)", url: `https://www.linkedin.com/jobs/search/?keywords=${encAll}&location=India&f_TPR=r86400&f_E=1%2C2` },
        { name: "🔷 Naukri (0 Yrs)", url: `https://www.naukri.com/${slug}-jobs-in-india?experience=0` },
        { name: "🎯 Indeed India", url: `https://in.indeed.com/jobs?q=${encAll}&l=India&fromage=1&explvl=entry_level` },
        { name: "⚡ Foundit (Monster)", url: `https://www.foundit.in/srp/results?query=${encAll}&locations=India&experience=0` },
        { name: "🚪 Glassdoor", url: `https://www.glassdoor.co.in/Job/india-${slug}-jobs-SRCH_IL.0,5_IN115.htm?fromAge=1&seniorityType=entrylevel` },
        { name: "✨ Shine", url: `https://www.shine.com/job-search/${slug}-jobs-in-india?experience=0` },
        { name: "📰 TimesJobs", url: `https://www.timesjobs.com/candidate/job-search.html?searchType=personalizedSearch&from=submit&txtKeywords=${encAll}&cboWorkExp1=0` },
        { name: "✌️ Wellfound", url: `https://wellfound.com/jobs?role=${encTitle}&location=India` },
        { name: "⚡ Instahyre", url: `https://www.instahyre.com/jobs-search?search=${encAll}&experience=0` },
        { name: "✂️ Cutshort", url: `https://cutshort.io/jobs?query=${encTitle}&experience=0` },
        { name: "💻 Hirist", url: `https://www.hirist.tech/search?keyword=${encTitle}&exp=0-1` },
        { name: "🟧 YC Startups", url: `https://www.workatastartup.com/jobs?query=${encTitle}` },
        { name: "🎓 Internshala", url: `https://internshala.com/internships/${slug}-internship/` },
        { name: "🎯 Unstop", url: `https://unstop.com/internships?keyword=${encTitle}` },
        { name: "🌱 LetsIntern", url: `https://www.letsintern.com/internships/${slug}-internships` },
        { name: "📱 Apna", url: `https://apna.co/jobs?q=${encTitle}&experience=0` },
        { name: "📈 Analytics Vidhya", url: `https://jobs.analyticsvidhya.com/jobs?search=${encTitle}` },
        { name: "🏆 Kaggle Jobs", url: "https://www.kaggle.com/jobs" },
        { name: "📰 AIM Jobs", url: "https://analyticsindiamag.com/careers/" },
        { name: "💌 Data Elixir", url: "https://dataelixir.com/jobs" },
        { name: "🏝️ RemoteOK", url: `https://remoteok.com/remote-${slug}-jobs` },
        { name: "🌍 We Work Remotely", url: `https://weworkremotely.com/remote-jobs/search?term=${encTitle}` },
        { name: "🌐 Remotive", url: `https://remotive.com/remote-jobs?search=${encTitle}` },
        { name: "⛺ Working Nomads", url: `https://www.workingnomads.com/jobs?category=data&q=${encTitle}` },
        { name: "🔮 Otta", url: "https://app.otta.com/jobs" }
      ];

      multiGrid.innerHTML = channels.map(c => `
        <a href="${c.url}" target="_blank" rel="noopener noreferrer" class="modal-channel-pill" title="Search ${escapeHTML(cleanTitle)} on ${c.name}">
          <span>${c.name} ↗</span>
        </a>
      `).join("");
    }


    if (modalApplyGoogle) {
      const compUrl = job.company_url || '';
      if (compUrl && compUrl !== modalTargetUrl) {
        modalApplyGoogle.textContent = `🏢 ${job.company || 'Company'} Careers Site ↗`;
        modalApplyGoogle.href = compUrl;
        modalApplyGoogle.className = "btn btn-secondary";
        modalApplyGoogle.style.display = "inline-flex";
        modalApplyGoogle.title = `Visit official ${job.company} careers portal`;
      } else {
        modalApplyGoogle.style.display = "none";
      }
    }

    if (modalApplyCompany) {
      if (job.contact_email) {
        modalApplyCompany.href = `mailto:${job.contact_email}?subject=${encodeURIComponent(`Application for ${job.title} - Fresher/Early Career`)}&body=${encodeURIComponent(job.outreach_dm || `Hi,\n\nI am applying for the ${job.title} role at ${job.company}.`)}`;
        modalApplyCompany.style.display = "inline-flex";
        modalApplyCompany.textContent = "✉️ Email Recruiter Directly";
        modalApplyCompany.className = "btn btn-secondary";
      } else {
        modalApplyCompany.style.display = "none";
      }
    }

    modalCopyBtn.onclick = () => {
      const copyText = `${job.title} at ${job.company}\nApplication Link: ${modalTargetUrl}`;
      navigator.clipboard.writeText(copyText).then(() => {
        showToast("Copied direct application link!");
      });
    };

    modalOverlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeJobModal() {
    modalOverlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeJobModal);
  if (modalOverlay) {
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeJobModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalOverlay.classList.contains("open")) {
      closeJobModal();
    }
  });

  // ==========================================================================
  // 5. Filter & Real-Time Live Search Listeners
  // ==========================================================================

  let searchDebounceTimer = null;
  function handleLiveSearch(query) {
    currentFilter.search = (query || "").trim();

    // Toggle clear button
    const hasQuery = Boolean(currentFilter.search);
    if (clearSearchBtn) clearSearchBtn.style.display = hasQuery ? "block" : "none";

    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      currentPage = 1;
      renderJobs();
    }, 150);
  }

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      handleLiveSearch(e.target.value);
    });
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        executeJobSearch(true);
      }
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      handleLiveSearch("");
    });
  }

  const emptyClearBtn = document.getElementById("empty-clear-search-btn");
  if (emptyClearBtn) {
    emptyClearBtn.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      handleLiveSearch("");
    });
  }

  const emptyExpandBtn = document.getElementById("empty-expand-freshness-btn");
  if (emptyExpandBtn) {
    emptyExpandBtn.addEventListener("click", () => {
      currentFilter.maxAgeHours = 9999;
      if (freshnessSelect) freshnessSelect.value = "9999";
      currentPage = 1;
      renderJobs();
      showToast("⏱️ Expanded time window to Anytime (All Jobs)!");
    });
  }

  // Execute Search Command
  function executeJobSearch(feedback = true) {
    const jobsTabBtn = document.getElementById("tab-btn-jobs");
    if (jobsTabBtn && !jobsTabBtn.classList.contains("active")) {
      document.querySelectorAll(".nav-tab").forEach(btn => btn.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(content => content.classList.remove("active"));
      jobsTabBtn.classList.add("active");
      const jobsView = document.getElementById("view-jobs");
      if (jobsView) jobsView.classList.add("active");
    }

    if (searchInput) {
      currentFilter.search = searchInput.value.trim();
    }

    currentPage = 1;
    renderJobs();
    scrollToResults();

    if (feedback) {
      const bannerCount = document.getElementById("banner-job-count");
      const totalCount = bannerCount ? bannerCount.textContent : "0";
      showToast(`🎯 Found ${totalCount} valid jobs matching your search!`);
    }
  }

  if (btnSearchExec) {
    btnSearchExec.addEventListener("click", () => executeJobSearch(true));
  }

  // Filter Drawer Toggle
  if (btnToggleFilters && advancedFiltersDrawer) {
    btnToggleFilters.addEventListener("click", () => {
      const isHidden = advancedFiltersDrawer.style.display === "none";
      advancedFiltersDrawer.style.display = isHidden ? "block" : "none";
      btnToggleFilters.setAttribute("aria-expanded", isHidden ? "true" : "false");
    });
  }

  if (btnCloseDrawer && advancedFiltersDrawer) {
    btnCloseDrawer.addEventListener("click", () => {
      advancedFiltersDrawer.style.display = "none";
      if (btnToggleFilters) btnToggleFilters.setAttribute("aria-expanded", "false");
    });
  }

  
  // Segmented Control Buttons (Full-Time Jobs vs Internships vs All)
  document.querySelectorAll(".type-segment-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const selectedType = btn.getAttribute("data-role-type");
      setRoleTypeFilter(selectedType, false);
      const label = selectedType === "jobs" ? "💼 Showing Full-Time Jobs (Internships excluded)" : (selectedType === "internships" ? "🎓 Showing Internships & Traineeships" : "🔥 Showing All Roles Combined");
      showToast(label);
    });
  });

  // Role Type Drawer Select
  const roleTypeSelect = document.getElementById("role-type-select");
  if (roleTypeSelect) {
    roleTypeSelect.addEventListener("change", (e) => {
      setRoleTypeFilter(e.target.value, false);
    });
  }

  // Stat Cards for Full-Time Jobs and Internships
  const statFullJobsCard = document.getElementById("stat-full-jobs");
  if (statFullJobsCard) {
    statFullJobsCard.addEventListener("click", () => {
      setRoleTypeFilter("jobs", true);
      showToast("💼 Filtered to Full-Time Jobs (Internships excluded)!");
    });
  }

  const statInternshipsCard = document.getElementById("stat-internships");
  if (statInternshipsCard) {
    statInternshipsCard.addEventListener("click", () => {
      setRoleTypeFilter("internships", true);
      showToast("🎓 Filtered to Internships & Traineeships!");
    });
  }

  // Interactive Clickable Stats Cards
  const statPrimaryCard = document.getElementById("stat-primary");
  if (statPrimaryCard) {
    statPrimaryCard.addEventListener("click", () => {
      if (currentFilter.tier === "primary") {
        currentFilter.tier = "all";
        if (tierSelect) tierSelect.value = "all";
      } else {
        currentFilter.tier = "primary";
        currentFilter.source = "all";
        currentFilter.onlySaved = false;
        if (tierSelect) tierSelect.value = "primary";
        if (sourceSelect) sourceSelect.value = "all";
      }
      updatePillActiveState();
      currentPage = 1;
      renderJobs();
      scrollToResults();
    });
  }

  const statPortalsCard = document.getElementById("stat-portals");
  if (statPortalsCard) {
    statPortalsCard.addEventListener("click", () => {
      if (currentFilter.source === "Company Portal") {
        currentFilter.source = "all";
        if (sourceSelect) sourceSelect.value = "all";
      } else {
        currentFilter.source = "Company Portal";
        currentFilter.tier = "all";
        currentFilter.onlySaved = false;
        if (sourceSelect) sourceSelect.value = "Company Portal";
        if (tierSelect) tierSelect.value = "all";
      }
      updatePillActiveState();
      currentPage = 1;
      renderJobs();
      scrollToResults();
    });
  }

  const statUnstopCard = document.getElementById("stat-unstop");
  if (statUnstopCard) {
    statUnstopCard.addEventListener("click", () => {
      if (currentFilter.source === "Unstop") {
        currentFilter.source = "all";
        if (sourceSelect) sourceSelect.value = "all";
      } else {
        currentFilter.source = "Unstop";
        currentFilter.tier = "all";
        currentFilter.onlySaved = false;
        if (sourceSelect) sourceSelect.value = "Unstop";
        if (tierSelect) tierSelect.value = "all";
      }
      updatePillActiveState();
      currentPage = 1;
      renderJobs();
      scrollToResults();
    });
  }

  const statSavedCard = document.getElementById("stat-saved");
  if (statSavedCard) {
    statSavedCard.addEventListener("click", () => {
      currentFilter.onlySaved = !currentFilter.onlySaved;
      if (currentFilter.onlySaved) {
        currentFilter.tier = "all";
        currentFilter.source = "all";
        if (tierSelect) tierSelect.value = "all";
        if (sourceSelect) sourceSelect.value = "all";
      }
      updatePillActiveState();
      currentPage = 1;
      renderJobs();
      scrollToResults();
    });
  }

  const statScoreCard = document.getElementById("stat-score");
  if (statScoreCard) {
    statScoreCard.addEventListener("click", () => {
      currentFilter.sortBy = (currentFilter.sortBy === "score-desc") ? "latest" : "score-desc";
      if (sortSelect) sortSelect.value = currentFilter.sortBy;
      currentPage = 1;
      renderJobs();
      scrollToResults();
    });
  }

  // Quick Filter Pills in Command Deck
  document.querySelectorAll(".quick-filter-pills .quick-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      const type = pill.getAttribute("data-filter-type");
      if (type === "all") {
        currentFilter.tier = "all";
        currentFilter.source = "all";
        currentFilter.onlySaved = false;
        currentFilter.onlyZeroExp = false;
        currentFilter.onlyInternships = false;
        currentFilter.onlyFullJobs = false;
        currentFilter.maxAgeHours = 120;
        if (tierSelect) tierSelect.value = "all";
        if (sourceSelect) sourceSelect.value = "all";
        if (freshnessSelect) freshnessSelect.value = "48";
      } else if (type === "zero-exp") {
        currentFilter.onlyZeroExp = true;
        currentFilter.tier = "all";
        currentFilter.source = "all";
        currentFilter.onlySaved = false;
        if (sourceSelect) sourceSelect.value = "all";
        if (tierSelect) tierSelect.value = "all";
      } else if (type === "source-company") {
        currentFilter.onlyZeroExp = false;
        currentFilter.source = "Company Portal";
        currentFilter.tier = "all";
        currentFilter.onlySaved = false;
        if (sourceSelect) sourceSelect.value = "Company Portal";
        if (tierSelect) tierSelect.value = "all";
      } else if (type === "source-unstop") {
        currentFilter.onlyZeroExp = false;
        currentFilter.source = "Unstop";
        currentFilter.tier = "all";
        currentFilter.onlySaved = false;
        if (sourceSelect) sourceSelect.value = "Unstop";
        if (tierSelect) tierSelect.value = "all";
      } else if (type === "saved") {
        currentFilter.onlySaved = true;
        currentFilter.onlyZeroExp = false;
        currentFilter.tier = "all";
        currentFilter.source = "all";
        if (tierSelect) tierSelect.value = "all";
        if (sourceSelect) sourceSelect.value = "all";
      } else if (type.startsWith("tier-")) {
        const t = type.replace("tier-", "");
        currentFilter.tier = t;
        currentFilter.source = "all";
        currentFilter.onlySaved = false;
        currentFilter.onlyZeroExp = false;
        if (tierSelect) tierSelect.value = t;
        if (sourceSelect) sourceSelect.value = "all";
      } else if (type === "internships") {
        setRoleTypeFilter("internships", true);
        return;
      } else if (type === "full-jobs") {
        setRoleTypeFilter("jobs", true);
        return;
      } else if (type === "fresh-24") {
        currentFilter.maxAgeHours = 24;
        currentFilter.onlyZeroExp = false;
        currentFilter.onlyInternships = false;
        currentFilter.onlyFullJobs = false;
        if (freshnessSelect) freshnessSelect.value = "24";
      }

      updatePillActiveState();
      currentPage = 1;
      renderJobs();
    });
  });

  function updatePillActiveState() {
    document.querySelectorAll(".quick-filter-pills .quick-pill").forEach(p => {
      const type = p.getAttribute("data-filter-type");
      let isActive = false;
      if (type === "all" && currentFilter.tier === "all" && currentFilter.source === "all" && !currentFilter.onlySaved && !currentFilter.onlyZeroExp && !currentFilter.onlyInternships && !currentFilter.onlyFullJobs && currentFilter.maxAgeHours === 120) {
        isActive = true;
      } else if (type === "zero-exp" && currentFilter.onlyZeroExp) {
        isActive = true;
      } else if (type === "source-company" && currentFilter.source === "Company Portal") {
        isActive = true;
      } else if (type === "source-unstop" && currentFilter.source === "Unstop") {
        isActive = true;
      } else if (type === "saved" && currentFilter.onlySaved) {
        isActive = true;
      } else if (type === `tier-${currentFilter.tier}`) {
        isActive = true;
      } else if (type === "internships" && currentFilter.onlyInternships) {
        isActive = true;
      } else if (type === "full-jobs" && currentFilter.onlyFullJobs) {
        isActive = true;
      } else if (type === "fresh-24" && currentFilter.maxAgeHours === 24) {
        isActive = true;
      }

      if (isActive) p.classList.add("active");
      else p.classList.remove("active");
    });

    // Also update active-stat styling on stat cards!
    const statPrimaryEl = document.getElementById("stat-primary");
    const statPortalsEl = document.getElementById("stat-portals");
    const statUnstopEl = document.getElementById("stat-unstop");
    const statSavedEl = document.getElementById("stat-saved");
    const statScoreEl = document.getElementById("stat-score");

    if (statPrimaryEl) statPrimaryEl.classList.toggle("active-stat", currentFilter.tier === "primary");
    if (statPortalsEl) statPortalsEl.classList.toggle("active-stat", currentFilter.source === "Company Portal");
    if (statUnstopEl) statUnstopEl.classList.toggle("active-stat", currentFilter.source === "Unstop");
    if (statSavedEl) statSavedEl.classList.toggle("active-stat", Boolean(currentFilter.onlySaved));
    if (statScoreEl) statScoreEl.classList.toggle("active-stat", currentFilter.sortBy === "score-desc");
  }

  function updateActiveFilterBadge() {
    let count = 0;
    if (currentFilter.tier !== "all") count++;
    if (currentFilter.location !== "all") count++;
    if (currentFilter.maxAgeHours !== 48) count++;
    if (currentFilter.source !== "all") count++;
    if (currentFilter.minScore > 0.50) count++;
    if (currentFilter.sortBy !== "latest") count++;
    if (currentFilter.onlySaved) count++;
    if (currentFilter.onlyInternships) count++;
    if (currentFilter.onlyFullJobs) count++;
    if (currentFilter.search) count++;

    if (activeFilterBadge) {
      if (count > 0) {
        activeFilterBadge.style.display = "inline-block";
        activeFilterBadge.textContent = count;
      } else {
        activeFilterBadge.style.display = "none";
      }
    }
  }

  function scrollToResults() {
    setTimeout(() => {
      const resultsEl = document.getElementById("search-results-banner") || document.getElementById("jobs-grid");
      if (resultsEl) {
        const rect = resultsEl.getBoundingClientRect();
        const yOffset = -70;
        const targetY = window.pageYOffset + rect.top + yOffset;
        window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
      }
    }, 40);
  }

  // Drawer Form Controls
  if (tierSelect) {
    tierSelect.addEventListener("change", (e) => {
      currentFilter.tier = e.target.value;
      updatePillActiveState();
      currentPage = 1;
      renderJobs();
    });
  }

  if (scoreSlider) {
    scoreSlider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      currentFilter.minScore = val / 100;
      if (scoreSliderVal) scoreSliderVal.textContent = `${val}%`;
      currentPage = 1;
      renderJobs();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      currentFilter.sortBy = e.target.value;
      currentPage = 1;
      renderJobs();
    });
  }

  if (locationSelect) {
    locationSelect.addEventListener("change", (e) => {
      currentFilter.location = e.target.value;
      currentPage = 1;
      renderJobs();
    });
  }

  if (freshnessSelect) {
    freshnessSelect.addEventListener("change", (e) => {
      const val = e.target.value;
      currentFilter.maxAgeHours = (val === "any" || val === "9999") ? 9999 : (parseInt(val, 10) || 168);
      currentPage = 1;
      renderJobs();
    });
  }

  if (sourceSelect) {
    sourceSelect.addEventListener("change", (e) => {
      currentFilter.source = e.target.value;
      updatePillActiveState();
      currentPage = 1;
      renderJobs();
    });
  }

  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (clearSearchBtn) clearSearchBtn.style.display = "none";
      if (tierSelect) tierSelect.value = "all";
      if (locationSelect) locationSelect.value = "all";
      if (freshnessSelect) freshnessSelect.value = "48";
      if (sourceSelect) sourceSelect.value = "all";
      if (scoreSlider) scoreSlider.value = 50;
      if (scoreSliderVal) scoreSliderVal.textContent = "50%";
      if (sortSelect) sortSelect.value = "latest";

      currentFilter.search = "";
      currentFilter.tier = "all";
      currentFilter.location = "all";
      currentFilter.source = "all";
      currentFilter.minScore = 0.50;
      currentFilter.sortBy = "latest";
      currentFilter.maxAgeHours = 48;
      currentFilter.onlySaved = false;
      currentFilter.onlyInternships = false;
      currentFilter.onlyFullJobs = false;

      updatePillActiveState();
      currentPage = 1;
      renderJobs();
      showToast("↺ All filters reset to default!");
    });
  }

  if (pageSizeSelect) {
    pageSizeSelect.addEventListener("change", (e) => {
      pageSize = parseInt(e.target.value, 10);
      currentPage = 1;
      renderJobs();
    });
  }

  // ==========================================================================
  // 6. Strategy Table Population
  // ==========================================================================

  function renderStrategyTable() {
    const tbody = document.getElementById("strategy-table-body");
    const roleMapping = profile.role_mapping || [];

    if (roleMapping.length === 0) return;

    tbody.innerHTML = roleMapping.map(tier => {
      const rolesFormatted = tier.roles.slice(0, 4).map(r => `<code>${r}</code>`).join(", ");
      
      let competencies = "";
      if (tier.tier === 1) competencies = "PyTorch, Deep Learning, ML Research, Math";
      else if (tier.tier === 2) competencies = "A/B Testing, SQL, Product Analytics, Causal Inference";
      else if (tier.tier === 3) competencies = "Decision Analysis, Statistical Inference, Modeling";
      else if (tier.tier === 4) competencies = "Linear Programming, PuLP, Optimization, OR, Supply Chain";
      else if (tier.tier === 5) competencies = "APM, Roadmap, Product Analytics, SQL, Metrics";
      else if (tier.tier === 6) competencies = "BizOps, Strategic Modeling, Program KPIs";
      else if (tier.tier === 7) competencies = "ARIMA, Prophet, Time Series, Demand Planning";
      else if (tier.tier === 8) competencies = "MLOps, Docker, FastAPI, Scikit-learn, Deployments";
      else if (tier.tier === 9) competencies = "dbt, SQL, Data Modeling, Modern Data Stack";

      return `
        <tr>
          <td><strong style="color:var(--brand-primary)">Tier ${tier.tier}</strong></td>
          <td><span class="job-tier-badge ${getTierBadgeClass(tier.tier)}">${tier.badge} ${tier.priority}</span></td>
          <td><strong>${tier.category}</strong></td>
          <td>${rolesFormatted}</td>
          <td><span style="color:var(--text-muted); font-size:0.8rem">${competencies}</span></td>
          <td><strong style="font-family:var(--font-mono); color:var(--accent-emerald)">${Math.round(tier.weight * 100)}%</strong></td>
        </tr>
      `;
    }).join("");
  }

  // ==========================================================================
  // 7. Skills Matrix Inspector
  // ==========================================================================

  function renderSkillMatrix() {
    const container = document.getElementById("skills-category-grid");
    const skillsGroup = profile.skills || {};

    const categoryTitles = {
      ai_and_research: "🧠 AI, Deep Learning & Research",
      optimization_and_math: "📐 Optimization & Operations Research",
      forecasting_and_time_series: "📈 Forecasting & Time Series",
      decision_and_experimentation: "⚖️ Decision Science & Experimentation",
      languages: "💻 Core Languages",
      frameworks: "📦 Libraries & Frameworks",
      tools: "🛠️ Tools & DevOps",
      data_engineering_adjacent: "🏗️ Data & Analytics Engineering",
      soft_skills: "🤝 Soft Skills & Leadership"
    };

    container.innerHTML = Object.entries(skillsGroup).map(([groupKey, skillMap]) => {
      const title = categoryTitles[groupKey] || groupKey.replace(/_/g, ' ').toUpperCase();
      
      const barsHtml = Object.entries(skillMap).map(([skill, weight]) => {
        const pct = Math.round(weight * 100);
        return `
          <div class="skill-bar-row">
            <div class="skill-bar-info">
              <span class="skill-name">${skill.replace(/_/g, ' ')}</span>
              <span class="skill-score-pct">${pct}%</span>
            </div>
            <div class="skill-progress-track">
              <div class="skill-progress-fill" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      }).join("");

      return `
        <div class="skill-category-card">
          <div class="category-card-title">
            <span>${title}</span>
            <span style="font-size: 0.75rem; color: var(--text-dim)">${Object.keys(skillMap).length} skills</span>
          </div>
          ${barsHtml}
        </div>
      `;
    }).join("");
  }

  // ==========================================================================
  // 8. Live Client-Side Job Simulator / Scorer
  // ==========================================================================

  const testerForm = document.getElementById("tester-form");
  const resultPlaceholder = document.getElementById("result-placeholder");
  const resultCard = document.getElementById("result-card");
  const btnLoadPreset = document.getElementById("btn-load-preset");

  // Flatten profile skills for fast lookup
  const flatProfileSkills = {};
  if (profile.skills) {
    Object.values(profile.skills).forEach(grp => {
      Object.entries(grp).forEach(([k, v]) => {
        flatProfileSkills[k.toLowerCase()] = v;
      });
    });
  }

  function evaluateJobClient(input) {
    const title = input.title.toLowerCase().trim();
    const seniority = input.seniority.toLowerCase().trim();
    const exp = parseInt(input.exp, 10) || 0;
    const reqSkills = input.skills.split(",").map(s => s.trim().toLowerCase().replace(/[\s-]/g, '_')).filter(Boolean);

    // 1. Exclude keywords
    const excludeKeywords = profile.job_filters?.exclude_keywords || [
      "senior", "staff", "principal", "lead", "director", "manager", "architect", "5+ years"
    ];

    for (const bad of excludeKeywords) {
      if (bad === "manager" && (title.includes("associate product manager") || title.includes("apm"))) {
        continue;
      }
      const regex = new RegExp(`\\b${bad}\\b`, 'i');
      if (regex.test(title)) {
        return {
          rejected: true,
          reason: `Title contains excluded keyword: '${bad}'`,
          score: 0
        };
      }
    }

    // 2. Experience check (Fresher limit ≤ 1 year)
    if (exp > 1) {
      return {
        rejected: true,
        reason: `Requires ${exp} years experience (fresher threshold is ≤ 1 year; 2+ years excluded)`,
        score: 0
      };
    }

    // 3. Seniority exclusion
    if (["senior", "lead", "staff", "principal", "manager"].includes(seniority)) {
      return {
        rejected: true,
        reason: `Seniority '${seniority}' is excluded for entry-level matching`,
        score: 0
      };
    }

    // 3b. Location Check (Strict India-based)
    const locLower = (input.location || "").toLowerCase();
    const indiaTerms = ["bangalore", "bengaluru", "hyderabad", "pune", "gurgaon", "gurugram", "noida", "mumbai", "delhi", "chennai", "kolkata", "india"];
    if (locLower && !indiaTerms.some(term => locLower.includes(term))) {
      return {
        rejected: true,
        reason: `Location '${input.location}' is outside India (User requested India-based jobs only)`,
        score: 0
      };
    }

    // 4. Role Mapping Tier Match
    let matchedTier = null;
    const roleMapping = profile.role_mapping || [];

    // Check category match
    for (const t of roleMapping) {
      if (t.category.toLowerCase() === input.category.toLowerCase()) {
        matchedTier = t;
        break;
      }
    }

    // Check title match
    if (!matchedTier) {
      for (const t of roleMapping) {
        for (const rolePattern of t.roles) {
          if (title.includes(rolePattern)) {
            matchedTier = t;
            break;
          }
        }
        if (matchedTier) break;
      }
    }

    if (!matchedTier) {
      return {
        rejected: true,
        reason: "Job does not match any targeted entry-level role category",
        score: 0
      };
    }

    // 5. Skill overlap score
    let skillScore = 0.70;
    let matchedSkills = [];
    let missingSkills = [];

    if (reqSkills.length > 0) {
      let matchedSum = 0;
      reqSkills.forEach(s => {
        if (flatProfileSkills[s] !== undefined) {
          matchedSum += flatProfileSkills[s];
          matchedSkills.push(s);
        } else {
          missingSkills.push(s);
        }
      });
      skillScore = matchedSum / reqSkills.length;
    }

    // 6. Seniority fit & Fresher bonus
    const isEntry = ["intern", "fresher", "junior", "associate", "trainee"].includes(seniority) || 
                    ["intern", "fresher", "junior", "associate", "trainee", "campus", "new grad"].some(w => title.includes(w)) ||
                    exp === 0;
    const seniorityScore = isEntry ? 1.0 : 0.80;
    const fresherBonus = isEntry ? 0.05 : 0.0;

    // 7. Location fit
    const locScore = 1.0;

    // 8. Composite weighted score
    const finalScore = (
      skillScore * 0.40 +
      matchedTier.weight * 0.35 +
      seniorityScore * 0.15 +
      locScore * 0.10 +
      fresherBonus
    );

    const roundedScore = Math.round(finalScore * 1000) / 1000;
    const minThreshold = profile.job_filters?.minimum_match_score ?? 0.6;
    const rejected = roundedScore < minThreshold;

    return {
      rejected,
      reason: rejected ? `Score (${Math.round(roundedScore * 100)}%) below 60% threshold` : null,
      score: roundedScore,
      tier: matchedTier.tier,
      category: matchedTier.category,
      badge: matchedTier.badge,
      priority: matchedTier.priority,
      tierWeight: matchedTier.weight,
      skillRate: reqSkills.length > 0 ? Math.round((matchedSkills.length / reqSkills.length) * 100) : 100,
      matchedSkills,
      missingSkills
    };
  }

  testerForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const input = {
      title: document.getElementById("test-title").value,
      company: document.getElementById("test-company").value,
      category: document.getElementById("test-category").value,
      seniority: document.getElementById("test-seniority").value,
      exp: document.getElementById("test-exp").value,
      location: document.getElementById("test-location").value,
      skills: document.getElementById("test-skills").value
    };

    const res = evaluateJobClient(input);

    resultPlaceholder.style.display = "none";
    resultCard.style.display = "block";

    const statusPill = document.getElementById("result-status-pill");
    const tierBadge = document.getElementById("result-tier-badge");
    const scoreNum = document.getElementById("result-score-num");
    const roleWeight = document.getElementById("result-role-weight");
    const skillRate = document.getElementById("result-skill-rate");
    const senStatus = document.getElementById("result-seniority-status");
    const detailsDiv = document.getElementById("result-details");

    if (res.rejected) {
      statusPill.textContent = "REJECTED";
      statusPill.className = "result-status-pill status-rejected";
      tierBadge.textContent = "❌ Out of Scope";
      scoreNum.textContent = "0%";
      roleWeight.textContent = "0%";
      skillRate.textContent = "N/A";
      senStatus.textContent = "Filtered";

      detailsDiv.innerHTML = `
        <div style="background:rgba(244,63,94,0.1); border:1px solid rgba(244,63,94,0.3); padding:0.85rem; border-radius:8px; color:#fda4af;">
          <strong>Rejection Reason:</strong> ${res.reason}
        </div>
      `;
    } else {
      statusPill.textContent = "ACCEPTED";
      statusPill.className = "result-status-pill status-accepted";
      tierBadge.textContent = `${res.badge} Tier ${res.tier} (${res.priority})`;
      scoreNum.textContent = `${Math.round(res.score * 100)}%`;
      roleWeight.textContent = `${Math.round(res.tierWeight * 100)}%`;
      skillRate.textContent = `${res.skillRate}%`;
      senStatus.textContent = "Passed (0–2 Yrs)";

      const matchedHtml = res.matchedSkills.map(s => `<span class="skill-tag matched">✓ ${s}</span>`).join(" ") || "None listed";
      const missingHtml = res.missingSkills.map(s => `<span class="skill-tag missing">✗ ${s}</span>`).join(" ") || "None";

      detailsDiv.innerHTML = `
        <p style="margin-bottom:0.5rem"><strong>Role Category:</strong> ${res.category}</p>
        <div style="margin-bottom:0.5rem">
          <strong>Matched Skills (${res.matchedSkills.length}):</strong><br>
          <div style="display:flex; flex-wrap:wrap; gap:0.3rem; margin-top:0.3rem">${matchedHtml}</div>
        </div>
        ${res.missingSkills.length > 0 ? `
          <div>
            <strong>Missing Skills (${res.missingSkills.length}):</strong><br>
            <div style="display:flex; flex-wrap:wrap; gap:0.3rem; margin-top:0.3rem">${missingHtml}</div>
          </div>
        ` : ''}
      `;
    }
  });

  
  // ==========================================================================
  // Career Channels & Multi-Platform Hub Controller
  // ==========================================================================
  const channelRoleInput = document.getElementById("channel-role-input");
  const channelCompanyInput = document.getElementById("channel-company-input");

  function updateChannelLinks() {
    const role = (channelRoleInput ? channelRoleInput.value.trim() : "") || "Data Scientist";
    const company = (channelCompanyInput ? channelCompanyInput.value.trim() : "");
    const clean = role.replace(/\(.*?\)/g, '').replace(/-\s*(Fresher|Campus|0-1 Yrs|Batch\s*\d+).*/i, '').trim();
    const encRole = encodeURIComponent(clean);
    const encAll = encodeURIComponent(`${clean} ${company}`.trim());
    const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const platformSelectors = {
      linkedin: `https://www.linkedin.com/jobs/search/?keywords=${encAll}&location=India&f_TPR=r86400&f_E=1%2C2`,
      naukri: `https://www.naukri.com/${slug}-jobs-in-india?experience=0`,
      indeed: `https://in.indeed.com/jobs?q=${encAll}&l=India&fromage=1&explvl=entry_level`,
      foundit: `https://www.foundit.in/srp/results?query=${encAll}&locations=India&experience=0`,
      glassdoor: `https://www.glassdoor.co.in/Job/india-${slug}-jobs-SRCH_IL.0,5_IN115.htm?fromAge=1&seniorityType=entrylevel`,
      shine: `https://www.shine.com/job-search/${slug}-jobs-in-india?experience=0`,
      timesjobs: `https://www.timesjobs.com/candidate/job-search.html?searchType=personalizedSearch&from=submit&txtKeywords=${encAll}&cboWorkExp1=0`,
      wellfound: `https://wellfound.com/jobs?role=${encRole}&location=India`,
      instahyre: `https://www.instahyre.com/jobs-search?search=${encAll}&experience=0`,
      cutshort: `https://cutshort.io/jobs?query=${encRole}&experience=0`,
      hirist: `https://www.hirist.tech/search?keyword=${encRole}&exp=0-1`,
      ycombinator: `https://www.workatastartup.com/jobs?query=${encRole}`,
      internshala: `https://internshala.com/internships/${slug}-internship/`,
      unstop: `https://unstop.com/internships?keyword=${encRole}`,
      letsintern: `https://www.letsintern.com/internships/${slug}-internships`,
      apna: `https://apna.co/jobs?q=${encRole}&experience=0`,
      analyticsvidhya: `https://jobs.analyticsvidhya.com/jobs?search=${encRole}`,
      kaggle: "https://www.kaggle.com/jobs",
      aim: "https://analyticsindiamag.com/careers/",
      dataelixir: "https://dataelixir.com/jobs",
      remoteok: `https://remoteok.com/remote-${slug}-jobs`,
      weworkremotely: `https://weworkremotely.com/remote-jobs/search?term=${encRole}`,
      remotive: `https://remotive.com/remote-jobs?search=${encRole}`,
      workingnomads: `https://www.workingnomads.com/jobs?category=data&q=${encRole}`,
      otta: "https://app.otta.com/jobs"
    };

    Object.entries(platformSelectors).forEach(([plat, href]) => {
      const el = document.querySelector(`.channel-chip[data-platform="${plat}"]`);
      if (el) el.href = href;
    });
  }

  if (channelRoleInput) channelRoleInput.addEventListener("input", updateChannelLinks);
  if (channelCompanyInput) channelCompanyInput.addEventListener("input", updateChannelLinks);

  document.querySelectorAll(".channel-preset-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".channel-preset-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      const role = chip.getAttribute("data-role");
      if (channelRoleInput) channelRoleInput.value = role;
      updateChannelLinks();
      showToast(`⚡ Channels updated for: ${role}`);
    });
  });

  // Preset Rotator with LinkedIn, Naukri and ATS Presets
  const presets = [
    {
      title: "AI / Applied ML Research Intern (LinkedIn)",
      category: "Applied ML / Research",
      seniority: "intern",
      exp: 0,
      skills: "python, pytorch, deep_learning, machine_learning, statistics"
    },
    {
      title: "Fresher Data Scientist (0-1 Yrs) (Naukri)",
      category: "Data Science",
      seniority: "fresher",
      exp: 0,
      skills: "python, sql, predictive_modeling, machine_learning, pandas"
    },
    {
      title: "Associate Decision Scientist (Campus / Fresher)",
      category: "Decision Science",
      seniority: "fresher",
      exp: 0,
      skills: "sql, python, statistical_modeling, decision_analysis, ab_testing"
    },
    {
      title: "Operations Research Trainee (LinkedIn)",
      category: "OR / Optimization",
      seniority: "trainee",
      exp: 0,
      skills: "python, operations_research, linear_programming, optimization, pulp"
    },
    {
      title: "Senior Staff Applied Scientist (Rejection Test - 8 Yrs)",
      category: "Applied ML / Research",
      seniority: "senior",
      exp: 8,
      skills: "python, pytorch"
    }
  ];

  let presetIndex = 0;
  btnLoadPreset.addEventListener("click", () => {
    const p = presets[presetIndex % presets.length];
    presetIndex++;

    document.getElementById("test-title").value = p.title;
    document.getElementById("test-category").value = p.category;
    document.getElementById("test-seniority").value = p.seniority;
    document.getElementById("test-exp").value = p.exp;
    document.getElementById("test-skills").value = p.skills;

    showToast(`Loaded preset: ${p.title}`);
  });

  // ==========================================================================
  // 9. Helpers & Utilities
  // ==========================================================================

  function escapeHTML(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 2800);
  }

  // ==========================================================================
  // 10. Theme Switcher (White / Dark Background Toggle)
  // ==========================================================================
  const themeToggleBtn = document.getElementById("theme-toggle-btn");
  const themeIconIndicator = document.getElementById("theme-icon-indicator");
  const themeModeText = document.getElementById("theme-mode-text");

  function applyTheme(theme, persist = true) {
    document.documentElement.setAttribute("data-theme", theme);
    if (persist) {
      try {
        localStorage.setItem("targetmatch_theme", theme);
      } catch (e) {}
    }
    if (themeToggleBtn && themeIconIndicator && themeModeText) {
      if (theme === "dark") {
        themeIconIndicator.textContent = "☀️";
        themeModeText.textContent = "Light Mode";
        themeToggleBtn.setAttribute("title", "Switch to White / Light Background");
      } else {
        themeIconIndicator.textContent = "🌙";
        themeModeText.textContent = "Dark Mode";
        themeToggleBtn.setAttribute("title", "Switch to Dark Background");
      }
    }
  }

  // Initialize theme from storage or default to light
  let currentTheme = "light";
  try {
    currentTheme = localStorage.getItem("targetmatch_theme") || "light";
  } catch (e) {}
  applyTheme(currentTheme, false);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const active = document.documentElement.getAttribute("data-theme") || "light";
      const nextTheme = active === "dark" ? "light" : "dark";
      applyTheme(nextTheme, true);
      showToast(nextTheme === "dark" ? "🌙 Dark theme activated" : "☀️ Clean white theme activated");
    });
  }

  // ==========================================================================
  // 11. LinkedIn Post Harvester & Intelligent Parser
  // ==========================================================================
  const linkedinPostInput = document.getElementById("linkedin-post-input");
  const linkedinAuthorInput = document.getElementById("linkedin-author-input");
  const linkedinUrlInput = document.getElementById("linkedin-url-input");
  const linkedinFetchUrlInput = document.getElementById("linkedin-fetch-url-input");
  const btnFetchPostUrl = document.getElementById("btn-fetch-post-url");
  const fetchBtnLabel = document.getElementById("fetch-btn-label");
  const linkedinParseBtn = document.getElementById("linkedin-parse-btn");
  const linkedinClearBtn = document.getElementById("linkedin-clear-btn");
  const linkedinSaveJobBtn = document.getElementById("linkedin-save-job-btn");
  const linkedinCopyDmBtn = document.getElementById("linkedin-copy-dm-btn");
  const evalEmptyState = document.getElementById("linkedin-eval-empty");
  const evalResultCard = document.getElementById("linkedin-eval-result");
  const evalOutreachText = document.getElementById("eval-outreach-text");
  const curatedFeedGrid = document.getElementById("curated-feed-grid");

  let lastParsedPostJob = null;

  const LINKEDIN_SAMPLE_PRESETS = {
    swiggy: {
      author: "Priya Sharma (Principal PM, Consumer Marketplace @ Swiggy)",
      url: "https://careers.swiggy.com/",
      text: "We are expanding our consumer product team! Hiring 2 Associate Product Managers (APMs) in Bengaluru. Looking for 0-1 year experience / fresh graduates with high ownership, first-principles thinking, SQL, and telemetry analytics skills. Shoot a DM or email your resume and 1 teardown to apm-hiring@swiggy.in."
    },
    flipkart: {
      author: "Dr. Sumanth Rao (Lead Applied Scientist @ Flipkart)",
      url: "https://www.flipkartcareers.com/",
      text: "My team at Flipkart is hiring an Applied Scientist Intern in Bengaluru! Work on multi-modal generative recommendations and vector search using PyTorch, transformers, and deep learning. 0 years experience required (final-year students / fresh grads). Drop a DM or send your CV and GitHub to applied-scientist@flipkart.com."
    },
    razorpay: {
      author: "Arjun Mehta (VP Strategy & BizOps @ Razorpay)",
      url: "https://razorpay.com/jobs/",
      text: "I'm hiring an entry-level Strategy & BizOps Analyst for the Founder's Office at Razorpay Bengaluru. Work on new product line financial modeling, merchant growth KPIs, competitive intelligence, and board decks. 0-1 year experience, advanced Excel & SQL. Comment or DM your resume to bizops-talent@razorpay.com."
    },
    phonepe: {
      author: "Ananya Sen (Director of Data Science @ PhonePe)",
      url: "https://www.phonepe.com/careers/",
      text: "My team at PhonePe is looking for a Fresher Data Scientist in Bengaluru! Work on payment fraud detection, causal inference, and user behavior modeling using Python and SQL. 0 years experience required (2024/2025 batch graduates). DM me or send your resume to ds-careers@phonepe.com."
    },
    groww: {
      author: "Aakash Gupta (Head of Product @ Groww)",
      url: "https://groww.in/careers",
      text: "We are hiring 2 APMs at Groww Bengaluru for our core investing and payments team. Looking for 0-1 years exp, strong analytical mindset, telemetry metrics, and SQL. If you love fintech and building products from scratch, send a teardown and CV to apm-talent@groww.in or DM me."
    },
    cred: {
      author: "Tanvi Agarwal (Senior Decision Scientist @ CRED)",
      url: "https://careers.cred.club/",
      text: "Hiring alert! CRED's Decision Science team is expanding in Bengaluru. We are looking for entry-level Decision Scientists (0-1 yr exp) who excel at statistical modeling, hypothesis testing, A/B experimentation, and SQL. Comment 'Interested' or email decisionscience@cred.club."
    },
    delhivery: {
      author: "Kunal Singhal (Head of Network Optimization @ Delhivery)",
      url: "https://www.delhivery.com/careers",
      text: "Hiring alert! Looking for an Operations Research Trainee in Gurugram to solve large-scale vehicle routing, linehaul dispatch, and hub capacity optimization problems using Python and PuLP/Linear Programming. Freshers from mathematics, engineering, and stats welcome. Apply directly via optimization-hiring@delhivery.com."
    },
    zepto: {
      author: "Rohan Deshmukh (VP Supply Chain & Forecasting @ Zepto)",
      url: "https://www.zeptonow.com/careers",
      text: "Zepto is hiring a Time Series Forecasting Analyst in Bengaluru. Drive 10-minute dark store demand prediction models using Prophet, ARIMA, and Python pandas. 0-1 year experience. Send your resume directly to forecasting@zeptonow.com with subject 'Forecasting Analyst - Fresher'."
    },
    meesho: {
      author: "Vikramaditya Iyer (Director of Analytics @ Meesho)",
      url: "https://www.meesho.io/careers",
      text: "I am hiring a Fresher Data Scientist for Meesho's marketplace pricing team in Bengaluru. 2024/2025 batch graduates with Python, pandas, and predictive modeling experience. Work on real-time pricing and seller incentives. Email resume to analytics-hiring@meesho.com."
    },
    inmobi: {
      author: "Neha Bansal (Lead Optimization Scientist @ InMobi)",
      url: "https://www.inmobi.com/company/careers",
      text: "My team at InMobi is looking for an Optimization Trainee in Bengaluru. Freshers with strong linear programming, PuLP, and operations research background. Optimize real-time ad bidding allocation algorithms. Shoot me a message or email optimization@inmobi.com."
    },
    postman: {
      author: "Rajesh Menon (VP Engineering @ Postman)",
      url: "https://www.postman.com/company/careers/",
      text: "Postman is hiring a Junior ML Engineer in Bengaluru. Looking for 0-1 year exp with FastAPI, Docker, and machine learning model deployment pipelines. Send your portfolio and resume to ml-hiring@postman.com or connect directly on LinkedIn."
    },
    sarvam: {
      author: "Vivek Raghavan (Co-Founder @ Sarvam AI)",
      url: "https://www.sarvam.ai/careers",
      text: "We are looking for passionate Applied ML Research Interns in Bengaluru to work on multimodal Indic foundation models. Strong PyTorch fundamentals, deep learning, and transformer architectures required. 0 years experience required (final year / fresh grads). Drop a DM or email research@sarvam.ai with your top projects."
    },
    ifi: {
      author: "Hiring Lead @ India's Future Investors",
      url: "https://www.linkedin.com/search/results/content/?keywords=%22India%27s%20Future%20Investors%22%20Data%20Scientist%20hiring&sortBy=%22date_posted%22",
      text: "India's Future Investors - Money Entertainment Reality Show\nData Scientist\nIndia · 17 hours ago · Over 100 applicants\nPromoted by hirer · Remote · Full-time\n\nLooking for an analytical Data Scientist to model entertainment viewership metrics, algorithmic audience scoring, and contestant engagement predictors using Python and SQL. Early career freshers (0-1 yrs exp) eligible. DM me or apply directly!"
    }
  };

  function parseLinkedInPostClient(rawText, author, postUrl) {
    const text = (rawText || "").trim();
    const lower = text.toLowerCase();

    // 1. Detect Category & Tier
    let category = "Applied ML / Research";
    let tier = 1;
    let badge = "🥇";
    let priority = "Primary";
    let weight = 1.0;
    let title = "Early-Career Specialist";

    const TIER_MAPPINGS = [
      {
        tier: 1, category: "Applied ML / Research", badge: "🥇", priority: "Primary", weight: 1.0,
        patterns: ["applied scientist", "applied ml", "ml research", "research intern", "deep learning", "llm research", "ai research", "generative ai", "multimodal", "pytorch intern"],
        defaultTitle: "Applied ML Research Intern"
      },
      {
        tier: 2, category: "Data Science", badge: "🥈", priority: "Primary", weight: 0.96,
        patterns: ["data scientist", "data science fresher", "junior data scientist", "associate data scientist", "growth data scientist", "risk analytics", "experimentation data"],
        defaultTitle: "Fresher Data Scientist"
      },
      {
        tier: 3, category: "Decision Science", badge: "🥉", priority: "Primary", weight: 0.93,
        patterns: ["decision scientist", "decision science", "analytics scientist", "quantitative analyst", "statistical modeling", "decision analysis"],
        defaultTitle: "Associate Decision Scientist"
      },
      {
        tier: 4, category: "OR / Optimization", badge: "🏅", priority: "Primary", weight: 0.90,
        patterns: ["optimization scientist", "operations research", "or scientist", "linear programming", "vehicle routing", "network optimization", "supply chain optimization", "pulp"],
        defaultTitle: "Operations Research & Optimization Trainee"
      },
      {
        tier: 5, category: "Product", badge: "5", priority: "Primary", weight: 0.88,
        patterns: ["associate product manager", "apm", "junior product manager", "product analyst", "product management intern", "product manager fresher"],
        defaultTitle: "Associate Product Manager (APM)"
      },
      {
        tier: 6, category: "Strategy / Programs", badge: "6", priority: "Primary", weight: 0.85,
        patterns: ["strategy analyst", "business operations", "bizops", "founder's office", "program analyst", "strategy associate", "strategic planning"],
        defaultTitle: "Strategy & BizOps Analyst"
      },
      {
        tier: 7, category: "Forecasting", badge: "7", priority: "Primary", weight: 0.82,
        patterns: ["forecasting analyst", "time series", "demand forecasting", "forecasting scientist", "prophet", "arima", "demand prediction"],
        defaultTitle: "Time Series Forecasting Analyst"
      },
      {
        tier: 8, category: "ML Engineering", badge: "8", priority: "Secondary", weight: 0.78,
        patterns: ["machine learning engineer", "ml engineer", "applied mle", "mlops", "ml platform", "fastapi"],
        defaultTitle: "Junior ML Engineer"
      },
      {
        tier: 9, category: "Data Engineering Adjacent", badge: "9", priority: "Optional", weight: 0.70,
        patterns: ["analytics engineer", "dbt", "data modeling", "data engineer fresher", "pipeline engineer"],
        defaultTitle: "Analytics & Data Engineer"
      }
    ];

    for (const t of TIER_MAPPINGS) {
      if (t.patterns.some(p => lower.includes(p))) {
        tier = t.tier;
        category = t.category;
        badge = t.badge;
        priority = t.priority;
        weight = t.weight;
        title = t.defaultTitle;
        break;
      }
    }

    // Try extracting custom title from text
    const hiringMatch = text.match(/(?:hiring|looking for|seeking)\s+(?:an?\s+)?([A-Za-z\s/()\-]+?)(?:\s+(?:at|in|for|to|with)\b|[.,\n!])/i);
    if (hiringMatch && hiringMatch[1] && hiringMatch[1].trim().length < 50) {
      const cand = hiringMatch[1].trim();
      if (!cand.toLowerCase().includes("someone") && !cand.toLowerCase().includes("candidate")) {
        title = cand;
      }
    }

    // 2. Company Name
    let company = "Tech Venture (LinkedIn Post)";
    const firstLine = text.split("\n")[0].trim();
    if (firstLine.includes(" - ") && firstLine.split(" - ")[0].trim().length < 50) {
      company = firstLine.split(" - ")[0].trim();
    } else {
      const compMatch = text.match(/(?:at|@|joining|team at)\s+([A-Z][A-Za-z0-9&]{1,25})/);
      if (compMatch && compMatch[1]) {
        const candComp = compMatch[1].trim();
        const skipWords = ["our", "my", "the", "bengaluru", "bangalore", "india", "hiring", "gurgaon", "hyderabad", "delhi", "pune", "we", "this"];
        if (!skipWords.includes(candComp.toLowerCase())) {
          company = candComp;
        }
      }
    }
    if (author && author.includes("@") && company === "Tech Venture (LinkedIn Post)") {
      const authorComp = author.split("@")[1].trim().replace(/\)/g, "");
      if (authorComp.length > 1 && authorComp.length < 30) {
        company = authorComp;
      }
    }

    // 3. Location
    let location = "Bengaluru, Karnataka, India";
    const cities = [
      { name: "Bengaluru, Karnataka, India", match: ["bengaluru", "bangalore"] },
      { name: "Gurugram, Haryana, India", match: ["gurugram", "gurgaon"] },
      { name: "Hyderabad, Telangana, India", match: ["hyderabad"] },
      { name: "Pune, Maharashtra, India", match: ["pune"] },
      { name: "Mumbai, Maharashtra, India", match: ["mumbai"] },
      { name: "Noida, Uttar Pradesh, India", match: ["noida"] },
      { name: "Remote (India)", match: ["remote", "work from home", "wfh"] }
    ];
    for (const c of cities) {
      if (c.match.some(m => lower.includes(m))) {
        location = c.name;
        break;
      }
    }

    // 4. Fresher Eligibility Gate
    let isFresher = true;
    let minYears = 0;
    const expMatch = lower.match(/(\d+)\+?\s*years?(?:\s+of)?\s+exp/);
    if (expMatch) {
      minYears = parseInt(expMatch[1], 10);
      if (minYears > 1) isFresher = false;
    }
    if (lower.includes("fresher") || lower.includes("0-1") || lower.includes("fresh grad") || lower.includes("intern") || lower.includes("trainee") || lower.includes("batch")) {
      isFresher = true;
    }

    // 5. Contact Email
    const emailMatch = text.match(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/);
    const contactEmail = emailMatch ? emailMatch[0] : null;

    // 6. Skills extraction
    const SKILLS_LIST = [
      "python", "sql", "pytorch", "tensorflow", "excel", "docker",
      "fastapi", "machine_learning", "deep_learning", "ab_testing",
      "linear_programming", "optimization", "pulp", "forecasting",
      "prophet", "arima", "time_series", "dbt", "statistics", "pandas"
    ];
    const matchedSkills = SKILLS_LIST.filter(s => lower.includes(s.replace(/_/g, " ")) || lower.includes(s));

    // 7. Match score
    const skillBonus = Math.min(matchedSkills.length * 0.03, 0.15);
    const score = Math.min(Math.round((weight * 0.85 + skillBonus) * 1000) / 1000, 0.98);

    // 8. Generate personalized recruiter outreach pitch
    const authorClean = author ? author.split("(")[0].trim() : "Hiring Team";
    const skillsListStr = matchedSkills.length > 0
      ? matchedSkills.slice(0, 3).map(s => s.replace(/_/g, " ").toUpperCase()).join(", ")
      : "data analysis and applied quantitative modeling";

    const outreachPitch = `Hi ${authorClean},

I came across your LinkedIn post regarding the ${title} role at ${company}. As an early-career candidate with strong foundations in ${skillsListStr}, I have developed end-to-end practical projects tackling similar challenges.

I would love to connect and share my resume for consideration!

Best regards,
[Your Name]`;

    // 9. Detect Relative Posting Time (e.g. "17 hours ago", "2 days ago", "17h ago")
    let detectedHoursAgo = 2;
    let detectedPostedAt = "Just now";
    let detectedRelativeTime = "2 hours ago";
    const timeRegex = /(?:posted\s*|·\s*)?(\d+)\s*(hours?|hrs?|h|days?|d|minutes?|mins?|m|weeks?|w)\s*ago/i;
    const timeMatch = text.match(timeRegex);
    if (timeMatch) {
      const val = parseInt(timeMatch[1], 10);
      const unit = timeMatch[2].toLowerCase();
      if (unit.startsWith('d')) {
        detectedHoursAgo = val * 24;
        detectedPostedAt = `${val}d ago`;
        detectedRelativeTime = `${val} days ago`;
      } else if (unit.startsWith('w')) {
        detectedHoursAgo = val * 168;
        detectedPostedAt = `${val}w ago`;
        detectedRelativeTime = `${val} weeks ago`;
      } else if (unit.startsWith('m')) {
        detectedHoursAgo = val / 60;
        detectedPostedAt = `${val}m ago`;
        detectedRelativeTime = `${val} minutes ago`;
      } else {
        detectedHoursAgo = val;
        detectedPostedAt = `${val}h ago`;
        detectedRelativeTime = `${val} hours ago`;
      }
    }

    // 10. Detect Applicants Count (e.g. "Over 100 applicants")
    const appMatch = text.match(/(?:over\s+)?\d+\s+applicants/i);
    const applicantsCount = appMatch ? appMatch[0].trim() : null;

    // 11. Detect Remote
    const isRemote = lower.includes("remote");

    return {
      title,
      company,
      location,
      score,
      tier,
      priority,
      badge,
      category,
      is_fresher: isFresher,
      is_remote: isRemote,
      applicants_count: applicantsCount,
      min_years_experience: minYears,
      contact_email: contactEmail,
      url: postUrl || "https://www.linkedin.com/feed/",
      source_type: "LinkedIn Post",
      source_domain: "linkedin.com",
      is_post: true,
      post_author: author || "Hiring Manager (LinkedIn Feed)",
      matched_skills: matchedSkills,
      missing_skills: [],
      hours_ago: detectedHoursAgo,
      posted_at: detectedPostedAt,
      relative_time: detectedRelativeTime,
      raw_description: text,
      description: text.length > 300 ? text.substring(0, 297) + "..." : text,
      outreach_dm: outreachPitch
    };
  }

  // URL Post Fetcher Implementation
  async function fetchPostFromURL(url) {
    if (!url) return null;
    const cleanUrl = url.trim();

    // 1. Handle live LinkedIn content search queries
    if (cleanUrl.includes("/search/results/content/") || cleanUrl.includes("keywords=")) {
      try {
        const u = new URL(cleanUrl);
        const kw = u.searchParams.get("keywords") || "";
        const cleanKw = decodeURIComponent(kw).replace(/"/g, "");
        const matchedJob = jobs.find(j => j.is_post && (cleanKw.toLowerCase().includes(j.company.toLowerCase()) || j.company.toLowerCase().includes(cleanKw.toLowerCase())));
        if (matchedJob) {
          return {
            text: matchedJob.raw_description || matchedJob.description,
            author: matchedJob.post_author || `Hiring Team @ ${matchedJob.company}`,
            url: cleanUrl,
            company: matchedJob.company,
            title: matchedJob.title,
            contact_email: matchedJob.contact_email
          };
        }
        return {
          text: `Live LinkedIn hiring search for: "${cleanKw}". Freshers & entry-level candidate posts from the past 24 hours.`,
          author: `Hiring Leads for ${cleanKw}`,
          url: cleanUrl
        };
      } catch (e) {
        console.warn("Error parsing search URL:", e);
      }
    }

    // 2. Check if matches pre-indexed curated individual posts
    const match = jobs.find(j => j.url === cleanUrl || cleanUrl.includes(j.url) || (j.url && j.url.includes(cleanUrl)));
    if (match) {
      return {
        text: match.raw_description || match.description,
        author: match.post_author || "",
        url: match.url,
        company: match.company,
        title: match.title,
        contact_email: match.contact_email
      };
    }

    // 3. Try fetching OpenGraph metadata through CORS proxy
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(cleanUrl)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const resp = await fetch(proxyUrl, { headers: { "Accept": "text/html" }, signal: controller.signal });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const html = await resp.text();

        // Detect LinkedIn's "Invalid post link" page
        if (html.includes("Invalid post link") || html.includes("couldn't find a post at this URL") || html.includes("We couldn't find a post")) {
          return {
            isInvalidLink: true,
            error: "Invalid post link: LinkedIn reported that no post exists at this URL (the link is invalid or the post was deleted/expired).",
            url: cleanUrl
          };
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const ogDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute("content") ||
                       doc.querySelector('meta[name="description"]')?.getAttribute("content") || "";
        const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
                        doc.querySelector('title')?.textContent || "";

        if (ogTitle.includes("Invalid post link") || ogDesc.includes("couldn't find a post")) {
          return {
            isInvalidLink: true,
            error: "Invalid post link: LinkedIn reported that no post exists at this URL.",
            url: cleanUrl
          };
        }

        let author = "";
        if (ogTitle.includes(" on LinkedIn:")) {
          author = ogTitle.split(" on LinkedIn:")[0].trim();
        } else if (ogTitle.includes(" | LinkedIn")) {
          author = ogTitle.split(" | LinkedIn")[0].trim();
        }

        if (ogDesc && ogDesc.length > 25) {
          return {
            text: ogDesc,
            author: author || "LinkedIn Hiring Manager",
            url: cleanUrl
          };
        }
      }
    } catch (e) {
      console.warn("CORS fetch failed, using fallback:", e);
    }

    // 4. Fallback extraction from URL slug if plausible
    const slugMatch = cleanUrl.match(/\/posts\/([a-zA-Z0-9\-]+?)(?:_|-activity|$)/);
    let authorGuess = "LinkedIn Hiring Manager";
    if (slugMatch && slugMatch[1]) {
      authorGuess = slugMatch[1].replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    }

    return {
      text: `Hiring entry-level / fresher specialist via public LinkedIn message. Check live post at ${cleanUrl}. Looking for 0-1 years exp, analytical problem-solving, and core quantitative skills.`,
      author: authorGuess,
      url: cleanUrl
    };
  }

  // Hook up Direct URL Fetcher Button
  if (btnFetchPostUrl) {
    btnFetchPostUrl.addEventListener("click", async () => {
      const url = linkedinFetchUrlInput ? linkedinFetchUrlInput.value.trim() : "";
      if (!url) {
        showToast("⚠️ Please enter a public LinkedIn post URL first!");
        return;
      }

      if (fetchBtnLabel) fetchBtnLabel.textContent = "⏳ Fetching Public Post...";
      btnFetchPostUrl.disabled = true;

      try {
        const fetched = await fetchPostFromURL(url);
        if (fetched && fetched.isInvalidLink) {
          showToast(`⚠️ ${fetched.error}`);
          if (linkedinPostInput) {
            linkedinPostInput.value = "";
            linkedinPostInput.placeholder = "⚠️ Post URL was invalid or expired on LinkedIn. Please paste the post text directly here, or click the Live LinkedIn Post Search buttons above!";
          }
          return;
        }

        if (fetched) {
          if (linkedinPostInput) linkedinPostInput.value = fetched.text;
          if (linkedinAuthorInput) linkedinAuthorInput.value = fetched.author;
          if (linkedinUrlInput) linkedinUrlInput.value = fetched.url;

          // Automatically trigger evaluation!
          if (linkedinParseBtn) linkedinParseBtn.click();
          showToast(`✅ Successfully loaded post for ${fetched.author || 'LinkedIn'}!`);
        } else {
          showToast("⚠️ Could not extract text from URL. Please paste the message text directly.");
        }
      } catch (err) {
        showToast("⚠️ Error fetching post. Please paste text directly.");
      } finally {
        if (fetchBtnLabel) fetchBtnLabel.textContent = "⚡ Fetch & Parse Public Post";
        btnFetchPostUrl.disabled = false;
      }
    });
  }

  // Preset Buttons Listener
  document.querySelectorAll(".preset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const presetKey = btn.getAttribute("data-preset");
      const preset = LINKEDIN_SAMPLE_PRESETS[presetKey];
      if (!preset) return;

      if (linkedinPostInput) linkedinPostInput.value = preset.text;
      if (linkedinAuthorInput) linkedinAuthorInput.value = preset.author;
      if (linkedinUrlInput) linkedinUrlInput.value = preset.url;
      if (linkedinFetchUrlInput) linkedinFetchUrlInput.value = preset.url;

      if (linkedinParseBtn) linkedinParseBtn.click();
      showToast(`Loaded preset post: ${btn.textContent}`);
    });
  });

  // Parse Button Listener
  if (linkedinParseBtn) {
    linkedinParseBtn.addEventListener("click", () => {
      const rawText = linkedinPostInput ? linkedinPostInput.value.trim() : "";
      if (!rawText) {
        showToast("⚠️ Please paste some LinkedIn post text first!");
        return;
      }

      const author = linkedinAuthorInput ? linkedinAuthorInput.value.trim() : "";
      const postUrl = linkedinUrlInput ? linkedinUrlInput.value.trim() : "";

      const job = parseLinkedInPostClient(rawText, author, postUrl);
      lastParsedPostJob = job;

      // Populate Evaluation Card
      if (evalEmptyState) evalEmptyState.style.display = "none";
      if (evalResultCard) evalResultCard.style.display = "block";

      const evalTierBadge = document.getElementById("eval-tier-badge");
      const evalJobTitle = document.getElementById("eval-job-title");
      const evalCompany = document.getElementById("eval-company");
      const evalLocation = document.getElementById("eval-location");
      const evalScoreVal = document.getElementById("eval-score-val");
      const evalFresherStatus = document.getElementById("eval-fresher-status");
      const evalCategory = document.getElementById("eval-category");
      const evalPriority = document.getElementById("eval-priority");
      const evalContact = document.getElementById("eval-contact");
      const evalSkillsTags = document.getElementById("eval-skills-tags");
      const evalViewPostLink = document.getElementById("eval-view-post-link");

      if (evalTierBadge) {
        evalTierBadge.textContent = `${job.badge} Tier ${job.tier} • ${job.category} (${job.priority})`;
        evalTierBadge.className = `job-tier-badge ${getTierBadgeClass(job.tier)}`;
      }
      if (evalJobTitle) evalJobTitle.textContent = job.title;
      if (evalCompany) evalCompany.textContent = job.company;
      if (evalLocation) evalLocation.textContent = `📍 ${job.location}`;
      if (evalScoreVal) evalScoreVal.textContent = `${Math.round(job.score * 100)}%`;

      if (evalFresherStatus) {
        if (isZeroExpJob(job)) {
          evalFresherStatus.innerHTML = `<span style="color:#10b981">✓ 100% Fresher Eligible: 0 Years Experience Required</span>`;
        } else {
          evalFresherStatus.innerHTML = `<span style="color:#3b82f6">ℹ Early Career: 0–2 Years Experience Preferred</span>`;
        }
      }

      if (evalCategory) evalCategory.textContent = job.category;
      if (evalPriority) evalPriority.textContent = job.priority;
      if (evalContact) {
        evalContact.innerHTML = job.contact_email
          ? `<a href="mailto:${escapeHTML(job.contact_email)}" style="color:var(--brand-primary); font-weight:700;">✉️ ${escapeHTML(job.contact_email)}</a>`
          : `<span style="color:var(--text-dim)">Direct DM on LinkedIn</span>`;
      }

      if (evalSkillsTags) {
        evalSkillsTags.innerHTML = job.matched_skills.length > 0
          ? job.matched_skills.map(s => `<span class="skill-tag matched">✓ ${s.replace(/_/g, " ")}</span>`).join(" ")
          : `<span style="color:var(--text-dim)">General analytical problem-solving</span>`;
      }

      // Populate Semantic Skill Gaps in Harvester
      const evalSkillsGapsTags = document.getElementById("eval-skills-gaps-tags");
      const evalGapBridgeBox = document.getElementById("eval-gap-bridge-box");
      const evalGapBridgeText = document.getElementById("eval-gap-bridge-text");

      const postGaps = job.missing_skills || [];
      if (evalSkillsGapsTags) {
        evalSkillsGapsTags.innerHTML = postGaps.length > 0
          ? postGaps.map(g => `<span class="skill-tag missing">⚡ ${escapeHTML(g)}</span>`).join(" ")
          : `<span class="skill-tag matched">✓ Strong Core Alignment</span>`;
      }

      if (evalGapBridgeBox && evalGapBridgeText) {
        if (job.semantic_skill_gap && job.semantic_skill_gap.bridge_roadmap) {
          evalGapBridgeText.textContent = job.semantic_skill_gap.bridge_roadmap;
          evalGapBridgeBox.style.display = "block";
        } else {
          evalGapBridgeBox.style.display = "none";
        }
      }

      if (evalOutreachText) {
        evalOutreachText.value = job.outreach_dm;
      }

      if (evalViewPostLink) {
        evalViewPostLink.href = resolveJobTargetUrl(job);
      }

      showToast(`⚡ Evaluated: ${job.title} (${Math.round(job.score * 100)}% Match)`);
    });
  }

  // Clear Button Listener
  if (linkedinClearBtn) {
    linkedinClearBtn.addEventListener("click", () => {
      if (linkedinPostInput) linkedinPostInput.value = "";
      if (linkedinAuthorInput) linkedinAuthorInput.value = "";
      if (linkedinUrlInput) linkedinUrlInput.value = "";
      if (evalEmptyState) evalEmptyState.style.display = "flex";
      if (evalResultCard) evalResultCard.style.display = "none";
      lastParsedPostJob = null;
      showToast("Cleared inputs");
    });
  }

  // Copy Outreach DM Button Listener
  if (linkedinCopyDmBtn) {
    linkedinCopyDmBtn.addEventListener("click", () => {
      if (!evalOutreachText || !evalOutreachText.value) return;
      navigator.clipboard.writeText(evalOutreachText.value).then(() => {
        showToast("📋 Cold recruiter outreach pitch copied!");
      });
    });
  }

  // Save to Matched Jobs Listener
  if (linkedinSaveJobBtn) {
    linkedinSaveJobBtn.addEventListener("click", () => {
      if (!lastParsedPostJob) {
        showToast("⚠️ Please parse a post first!");
        return;
      }

      const exists = jobs.some(j => j.url === lastParsedPostJob.url && j.title === lastParsedPostJob.title);
      if (exists) {
        showToast("ℹ️ This job is already in your matched catalog!");
        return;
      }

      jobs.unshift(lastParsedPostJob);
      try {
        const savedCustomJobs = JSON.parse(localStorage.getItem("targetmatch_custom_jobs") || "[]");
        if (!savedCustomJobs.some(j => j.url === lastParsedPostJob.url && j.title === lastParsedPostJob.title)) {
          savedCustomJobs.unshift(lastParsedPostJob);
          localStorage.setItem("targetmatch_custom_jobs", JSON.stringify(savedCustomJobs));
        }
      } catch (e) {}

      initStats();
      renderJobs();
      renderCuratedFeed();
        renderCompanySites();
      showToast(`✅ "${lastParsedPostJob.title}" saved to Matched Jobs board!`);

      // Switch to jobs board tab
      const tabBtnJobs = document.getElementById("tab-btn-jobs");
      if (tabBtnJobs) tabBtnJobs.click();
    });
  }

  // Render Curated Feed Section
  function renderCuratedFeed() {
    if (!curatedFeedGrid) return;
    const postJobs = jobs.filter(j => !isJobApplied(j) && !isJobRejected(j) && (j.is_post || j.source_type === "LinkedIn Post"));
    if (postJobs.length === 0) {
      curatedFeedGrid.innerHTML = `<p style="color:var(--text-dim)">No curated LinkedIn feed posts found.</p>`;
      return;
    }

    curatedFeedGrid.innerHTML = postJobs.map((p, idx) => {
      const skillsTags = (p.matched_skills || []).map(s => `<span class="skill-tag matched" style="font-size:0.7rem">✓ ${s.replace(/_/g, " ")}</span>`).join(" ");
      return `
        <div class="curated-card">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
              <span class="source-domain-badge source-linkedin-post">👤 Individual Public Post</span>
              <span class="freshness-badge">${getJobFreshness(p).badgeText}</span>
            </div>
            <h4 style="font-size:1.05rem; font-weight:700; color:var(--text-main); margin-bottom:0.25rem;">${escapeHTML(p.title)}</h4>
            <div style="font-size:0.85rem; color:var(--brand-primary); font-weight:600; margin-bottom:0.4rem;">
              ${escapeHTML(p.company)} • 📍 ${escapeHTML(p.location)}
            </div>
            ${p.post_author ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.5rem;">📢 Posted by: ${escapeHTML(p.post_author)}</div>` : ''}
            <p style="font-size:0.8rem; color:var(--text-muted); line-height:1.45; margin-bottom:0.75rem;">
              ${escapeHTML(p.description)}
            </p>
            ${skillsTags ? `<div style="display:flex; flex-wrap:wrap; gap:0.25rem; margin-bottom:0.75rem;">${skillsTags}</div>` : ''}
          </div>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap; padding-top:0.75rem; border-top:1px solid var(--border-color);">
            <button class="btn btn-secondary btn-sm load-preset-feed-btn" data-feed-index="${idx}" title="Load this post into parser for full evaluation">
              ⚡ Load in Parser
            </button>
            <a href="${escapeHTML(resolveJobTargetUrl(p))}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm btn-linkedin-post" title="Open verified live LinkedIn post search or portal">
              <span>💬 View & DM ↗</span>
            </a>
            ${p.contact_email ? `
              <a href="mailto:${escapeHTML(p.contact_email)}?subject=${encodeURIComponent(`Application: ${p.title}`)}" class="btn btn-secondary btn-sm" title="Email Resume">
                <span>✉️ Email</span>
              </a>
            ` : ''}
            <button class="btn btn-secondary btn-sm copy-feed-pitch-btn" data-outreach="${escapeHTML(p.outreach_dm || '')}" title="Copy Outreach DM">
              📋 DM
            </button>
          </div>
        </div>
      `;
    }).join("");

    // Attach load preset buttons
    curatedFeedGrid.querySelectorAll(".load-preset-feed-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-feed-index"), 10);
        const p = postJobs[idx];
        if (!p) return;
        if (linkedinPostInput) linkedinPostInput.value = p.raw_description || p.description;
        if (linkedinAuthorInput) linkedinAuthorInput.value = p.post_author || "";
        if (linkedinUrlInput) linkedinUrlInput.value = p.url || "";
        if (linkedinParseBtn) linkedinParseBtn.click();
        showToast(`Loaded ${p.title} at ${p.company} into parser!`);
        window.scrollTo({ top: document.getElementById("view-linkedin").offsetTop - 80, behavior: "smooth" });
      });
    });

    // Attach copy pitch buttons
    curatedFeedGrid.querySelectorAll(".copy-feed-pitch-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const text = e.currentTarget.getAttribute("data-outreach");
        if (text) {
          navigator.clipboard.writeText(text).then(() => {
            showToast("📋 Recruiter outreach pitch copied to clipboard!");
          });
        }
      });
    });
  }


  // ==========================================================================
  // 13. Individual Company Sites & Direct ATS Hub
  // ==========================================================================
  const companySitesGrid = document.getElementById("company-sites-grid");
  const companySitesSearchInput = document.getElementById("company-sites-search-input");
  const companySitesLiveCount = document.getElementById("company-sites-live-count");
  const navCompanySitesCount = document.getElementById("nav-company-sites-count");
  const chipCompanyAllCount = document.getElementById("chip-company-all-count");

  let currentCompanyEcosystem = "all";
  let currentCompanySearch = "";

  const COMPANY_ECOSYSTEM_MAP = {
    unicorns: ["swiggy", "flipkart", "meesho", "zepto", "cred", "razorpay", "phonepe", "groww", "paytm", "delhivery", "zomato", "blinkit", "1mg", "tata 1mg"],
    fintech: ["razorpay", "phonepe", "groww", "cred", "paytm", "slice", "navi", "fampay", "fi", "fi money"],
    ai: ["sarvam", "inmobi", "postman", "atlan", "toplyne", "clevertap", "squadstack"],
    consulting: ["tiger analytics", "mu sigma", "fractal", "latentview"]
  };

  function getCompanyJobUrl(job) {
    if (!job || job.is_post) return '';
    if (job.source_type === 'Official Company Portal' && job.company_job_verified !== true) return '';
    for (const candidate of [job.direct_job_url, job.url]) {
      try {
        const parsed = new URL(candidate);
        if (!['https:', 'http:'].includes(parsed.protocol)) continue;
        const host = parsed.hostname.toLowerCase();
        const path = parsed.pathname.replace(/\/$/, '');
        const patterns = [
          ['greenhouse.io', /^\/[^/]+\/jobs\/\d+(?:\/.*)?$/i],
          ['lever.co', /^\/[^/]+\/[0-9a-f-]{36}(?:\/apply)?$/i],
          ['ashbyhq.com', /^\/[^/]+\/[0-9a-f-]{36}(?:\/application)?$/i],
          ['smartrecruiters.com', /^\/[^/]+\/\d+[^/]*$/i],
          ['myworkdayjobs.com', /^\/.*\/job\/.+\/.+$/i]
        ];
        if (patterns.some(([domain, pattern]) =>
          (host === domain || host.endsWith('.' + domain)) && pattern.test(path))) return candidate;
      } catch (e) {}
    }
    return '';
  }

  function isCompanySiteJob(job) {
    if (!getCompanyJobUrl(job) || !isZeroExpJob(job)) return false;
    const age = getJobFreshness(job).hours;
    if (typeof age !== 'number' || age < 0 || age > 120) return false;
    const title = (job.title || '').toLowerCase();
    const roles = [...(profile.target_roles || []),
      ...(profile.role_mapping || []).flatMap(tier => tier.roles || [])];
    return roles.some(role => title.includes(role.toLowerCase()));
  }

  function renderCompanySites() {
    // 1. Filter company site jobs
    const allCompanyJobs = jobs.filter(job => !isJobApplied(job) && !isJobRejected(job) && isCompanySiteJob(job));

    // Update global counters
    if (navCompanySitesCount) navCompanySitesCount.textContent = allCompanyJobs.length;
    if (chipCompanyAllCount) chipCompanyAllCount.textContent = allCompanyJobs.length;

    let filtered = allCompanyJobs;

    // Filter by Ecosystem
    if (currentCompanyEcosystem !== "all" && COMPANY_ECOSYSTEM_MAP[currentCompanyEcosystem]) {
      const allowed = COMPANY_ECOSYSTEM_MAP[currentCompanyEcosystem];
      filtered = filtered.filter(j => {
        const comp = (j.company || '').toLowerCase();
        return allowed.some(a => comp.includes(a));
      });
    }

    // Filter by Search Query
    if (currentCompanySearch.trim()) {
      const q = currentCompanySearch.trim().toLowerCase();
      filtered = filtered.filter(j => {
        const c = (j.company || '').toLowerCase();
        const t = (j.title || '').toLowerCase();
        const s = (j.matched_skills || []).map(x => x.toLowerCase()).join(' ');
        return c.includes(q) || t.includes(q) || s.includes(q);
      });
    }

    if (companySitesLiveCount) {
      companySitesLiveCount.textContent = filtered.length;
    }

    // 2. Render Company Openings Grid
    if (companySitesGrid) {
      if (filtered.length === 0) {
        companySitesGrid.innerHTML = `
          <div class="empty-state" style="display:block; grid-column: 1 / -1; padding: 2.5rem; text-align: center;">
            <span class="empty-icon">🏢</span>
            <h3>No direct company site openings match your search</h3>
            <p>No matching requisitions are available in this feed. Refresh after the next sync, or adjust your company and role search.</p>
          </div>
        `;
      } else {
        companySitesGrid.innerHTML = filtered.map(job => {
          const tierClass = getTierBadgeClass(job.tier);
          const scorePct = Math.round(job.score * 100);
          const matchedTags = (job.matched_skills || []).map(s => 
            `<span class="skill-tag matched">✓ ${s.replace(/_/g, ' ')}</span>`
          ).join("");

          const freshness = getJobFreshness(job);
          const freshnessPill = freshness.isMinute
            ? `<span class="freshness-minute-badge"><span class="live-pulse-dot"></span> ⚡ Just Now (${freshness.label})</span>`
            : `<span class="freshness-badge">⚡ ${job.posted_at_source === "updated_at" ? "Updated" : "Posted"} ${freshness.label}</span>`;

          const targetUrl = getCompanyJobUrl(job);
          const isSaved = isJobSaved(job.id || job.url);
          const saveBtnClass = isSaved ? "btn-save-job saved" : "btn-save-job";
          const saveBtnText = isSaved ? "★ Saved" : "☆ Save";

          let atsTag = "🏢 Official Career Site";
          const uLow = targetUrl.toLowerCase();
          if (uLow.includes("greenhouse.io")) atsTag = "🏢 Greenhouse ATS";
          else if (uLow.includes("lever.co")) atsTag = "🏢 Lever ATS";
          else if (uLow.includes("ashbyhq.com")) atsTag = "🏢 Ashby ATS";
          else if (uLow.includes("smartrecruiters.com")) atsTag = "🏢 SmartRecruiters";

          return `
            <div class="job-card" data-job-id="${escapeHTML(job.id || job.url)}">
              <div class="job-card-header">
                <div class="score-badge">
                  <span class="score-val">${scorePct}%</span>
                  <span class="score-lbl">Fit Score</span>
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.25rem;">
                  <span class="job-tier-badge ${tierClass}">${job.badge} Tier ${job.tier} • ${job.category}</span>
                  ${freshnessPill}
                </div>
              </div>

              <div class="job-card-body">
                <h3 class="job-title">${escapeHTML(job.title)}</h3>
                <div class="job-company-row">
                  <span class="job-company">${escapeHTML(job.company)}</span>
                  <span class="source-domain-badge source-company-portal">${atsTag}</span>
                </div>
                <div class="job-meta">
                  <span class="meta-item">📍 ${escapeHTML(job.location || 'India')}</span>
                  <span class="meta-item">💼 Direct Company ATS</span>
                  <span class="meta-item fresher-pill" style="color: #10b981; font-weight:700;">✓ Fresher Match</span>
                </div>
                <div class="job-skills-matched">
                  ${matchedTags || '<span class="skill-tag matched">✓ Direct Application</span>'}
                </div>
                <p class="job-desc-snippet">${escapeHTML(job.description || '')}</p>
              </div>

              <div class="job-card-footer">
                <button type="button" class="btn btn-secondary btn-reject-job" data-reject-job="${escapeHTML(getJobId(job))}">Reject Job</button>
            <button type="button" class="btn btn-secondary btn-mark-applied" data-mark-applied="${escapeHTML(getJobId(job))}">✓ Mark as Applied</button>
                <a href="${escapeHTML(targetUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-direct-portal" style="flex:1; justify-content:center;">
                  <span>🚀 View Job &amp; Apply ↗</span>
                </a>
                <button class="${saveBtnClass}" data-job-id="${escapeHTML(job.id || job.url)}">
                  ${saveBtnText}
                </button>
              </div>
            </div>
          `;
        }).join("");

        // Attach save button listeners
        companySitesGrid.querySelectorAll(".btn-save-job").forEach(btn => {
          btn.addEventListener("click", e => {
            e.stopPropagation();
            const jobId = btn.getAttribute("data-job-id");
            toggleSavedJob(jobId);
            const nowSaved = isJobSaved(jobId);
            btn.className = nowSaved ? "btn-save-job saved" : "btn-save-job";
            btn.textContent = nowSaved ? "★ Saved" : "☆ Save";
            updateShortlistStats();
          });
        });
      }
    }

  }

  // Hook up Company Sites Search Input & Ecosystem Filter Chips
  if (companySitesSearchInput) {
    companySitesSearchInput.addEventListener("input", e => {
      currentCompanySearch = e.target.value;
      renderCompanySites();
    });
  }

  document.querySelectorAll(".company-filter-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".company-filter-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      currentCompanyEcosystem = chip.getAttribute("data-ecosystem") || "all";
      renderCompanySites();
    });
  });

  // Hook up Hero Stat Card for Indian Portals to Switch to Company Sites Tab
  if (statPortalsCard) {
    statPortalsCard.addEventListener("click", () => {
      const tabCompany = document.getElementById("tab-btn-company-sites");
      if (tabCompany) tabCompany.click();
    });
  }

  // ==========================================================================
  // 12. Hourly Auto-Sync & Live Refresh Engine
  // ==========================================================================

  function renderAppliedJobs() {
    const grid = document.getElementById('applied-jobs-grid');
    const navCount = document.getElementById('nav-applied-count');
    if (navCount) navCount.textContent = appliedJobs.length;
    if (!grid) return;
    const query = (document.getElementById('applied-jobs-search')?.value || '').trim().toLowerCase();
    const filtered = appliedJobs.filter(job => `${job.title} ${job.company} ${job.location || ''}`.toLowerCase().includes(query))
      .sort((a, b) => (Date.parse(b.applied_at) || 0) - (Date.parse(a.applied_at) || 0));
    const count = document.getElementById('applied-jobs-count');
    if (count) count.textContent = `${filtered.length} of ${appliedJobs.length} applied jobs`;
    if (!filtered.length) {
      grid.innerHTML = `<div class="empty-state applied-empty-state"><h3>${query ? 'No applied jobs match your search' : 'No applied jobs yet'}</h3><p>${query ? 'Try another company or job title.' : 'After applying, choose Mark as Applied on a job card to move it here.'}</p></div>`;
      return;
    }
    grid.innerHTML = filtered.map(job => {
      let target = '';
      try {
        const url = new URL(job.applied_url || job.direct_job_url || job.url);
        if (['https:', 'http:'].includes(url.protocol)) target = url.href;
      } catch (error) {}
      const appliedAt = Date.parse(job.applied_at);
      const date = Number.isFinite(appliedAt) ? new Date(appliedAt).toLocaleString() : 'Date not recorded';
      return `<article class="job-card applied-job-card">
        <div>
          <span class="applied-status-badge">✓ Applied</span>
          <h3 class="job-title">${escapeHTML(job.title)}</h3>
          <div class="job-company-loc"><span class="job-company">${escapeHTML(job.company)}</span><span class="job-location">${escapeHTML(job.location || '')}</span></div>
          <p class="applied-date">Marked applied: ${escapeHTML(date)}</p>
          <p class="job-description">${escapeHTML(job.description || '')}</p>
        </div>
        <div class="card-actions">
          ${target ? `<a class="btn btn-primary" href="${escapeHTML(target)}" target="_blank" rel="noopener noreferrer">View Job ↗</a>` : ''}
          <button type="button" class="btn btn-secondary" data-restore-applied="${escapeHTML(getAppliedJobKey(job))}">Move Back to Jobs</button>
        </div>
      </article>`;
    }).join('');
  }

  function renderRejectedJobs() {
    const grid = document.getElementById('rejected-jobs-grid');
    const navCount = document.getElementById('nav-rejected-count');
    if (navCount) navCount.textContent = rejectedJobs.length;
    if (!grid) return;
    const query = (document.getElementById('rejected-jobs-search')?.value || '').trim().toLowerCase();
    const filtered = rejectedJobs.filter(job => `${job.title} ${job.company} ${job.location || ''}`.toLowerCase().includes(query))
      .sort((a, b) => (Date.parse(b.rejected_at) || 0) - (Date.parse(a.rejected_at) || 0));
    const count = document.getElementById('rejected-jobs-count');
    if (count) count.textContent = `${filtered.length} of ${rejectedJobs.length} rejected jobs`;
    if (!filtered.length) {
      grid.innerHTML = `<div class="empty-state applied-empty-state"><h3>${query ? 'No rejected jobs match your search' : 'No rejected jobs yet'}</h3><p>${query ? 'Try another company or job title.' : 'Choose Reject Job on a job card to hide it from your feed. Restore it here anytime.'}</p></div>`;
      return;
    }
    grid.innerHTML = filtered.map(job => {
      let target = '';
      try {
        const url = new URL(job.direct_job_url || job.url);
        if (['https:', 'http:'].includes(url.protocol)) target = url.href;
      } catch (error) {}
      const rejectedAt = Date.parse(job.rejected_at);
      const date = Number.isFinite(rejectedAt) ? new Date(rejectedAt).toLocaleString() : 'Date not recorded';
      return `<article class="job-card applied-job-card">
        <div>
          <span class="applied-status-badge">Rejected</span>
          <h3 class="job-title">${escapeHTML(job.title)}</h3>
          <div class="job-company-loc"><span class="job-company">${escapeHTML(job.company)}</span><span class="job-location">${escapeHTML(job.location || '')}</span></div>
          <p class="applied-date">Rejected: ${escapeHTML(date)}</p>
          <p class="job-description">${escapeHTML(job.description || '')}</p>
        </div>
        <div class="card-actions">
          ${target ? `<a class="btn btn-primary" href="${escapeHTML(target)}" target="_blank" rel="noopener noreferrer">View Job ↗</a>` : ''}
          <button type="button" class="btn btn-secondary" data-restore-rejected="${escapeHTML(getAppliedJobKey(job))}">Move Back to Jobs</button>
        </div>
      </article>`;
    }).join('');
  }


  function refreshApplicationViews() {
    currentPage = 1;
    initStats();
    updateShortlistStats();
    renderJobs();
    renderCompanySites();
    renderCuratedFeed();
    renderAppliedJobs();
    renderRejectedJobs();
  }

  document.addEventListener('click', event => {
    const mark = event.target.closest('[data-mark-applied]');
    const restore = event.target.closest('[data-restore-applied]');
    if (!mark && !restore) return;
    event.preventDefault();
    event.stopPropagation();
    if (mark) {
      const job = jobs.find(candidate => getJobId(candidate) === mark.getAttribute('data-mark-applied'));
      if (markJobApplied(job)) {
        closeJobModal();
        refreshApplicationViews();
        showToast('Moved to Applied Jobs.');
      }
    } else {
      const key = restore.getAttribute('data-restore-applied');
      if (restoreAppliedJob(key)) {
        refreshApplicationViews();
        const inFeed = jobs.some(job => getAppliedJobKey(job) === key);
        showToast(inFeed ? 'Moved back to available jobs.' : 'Removed from Applied Jobs. This role is no longer in the live feed.');
      }
    }
  });

  document.getElementById('applied-jobs-search')?.addEventListener('input', renderAppliedJobs);
  window.addEventListener('storage', event => {
    if (event.key === APPLIED_STORAGE_KEY || event.key === null) {
      appliedJobs = readAppliedJobs();
      refreshApplicationViews();
    }
  });

  document.addEventListener('click', event => {
    const reject = event.target.closest('[data-reject-job]');
    const restore = event.target.closest('[data-restore-rejected]');
    if (!reject && !restore) return;
    event.preventDefault();
    event.stopPropagation();
    if (reject) {
      const job = jobs.find(candidate => getJobId(candidate) === reject.getAttribute('data-reject-job'));
      if (!rejectJob(job)) return;
      closeJobModal();
      refreshApplicationViews();
      showToast('Moved to Rejected Jobs. You can restore it there anytime.');
    } else {
      const key = restore.getAttribute('data-restore-rejected');
      if (!restoreRejectedJob(key)) return;
      refreshApplicationViews();
      const inFeed = jobs.some(job => getAppliedJobKey(job) === key);
      showToast(inFeed ? 'Moved back to available jobs.' : 'Removed from Rejected Jobs. This role is no longer in the live feed.');
    }
  });
  document.getElementById('rejected-jobs-search')?.addEventListener('input', renderRejectedJobs);
  window.addEventListener('storage', event => {
    if (event.key === REJECTED_STORAGE_KEY || event.key === null) {
      rejectedJobs = readRejectedJobs();
      refreshApplicationViews();
    }
  });

  let refreshInFlight = false;

  function chooseLatestFeed(feeds) {
    return feeds.filter(feed => feed && Array.isArray(feed.jobs) &&
      Number.isFinite(Date.parse(feed.last_updated)))
      .sort((a, b) => Date.parse(b.last_updated) - Date.parse(a.last_updated))[0] || null;
  }

  async function fetchFeedJson(endpoint, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(endpoint, { ...options, cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(`Feed request failed (${response.status})`);
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async function loadLatestFeed() {
    const stamp = Date.now();
    const endpoints = [...new Set([
      `./api/jobs?t=${stamp}`, `./data.json?t=${stamp}`,
      `https://jobmatcher-2.onrender.com/api/jobs?t=${stamp}`,
      `https://raw.githubusercontent.com/azij2023/jobmatcher/main/data.json?t=${stamp}`
    ].map(endpoint => new URL(endpoint, window.location.href).href))];
    const responses = await Promise.allSettled(endpoints.map(endpoint => fetchFeedJson(endpoint)));
    const latest = chooseLatestFeed(responses.filter(response => response.status === 'fulfilled').map(response => response.value));
    if (!latest) throw new Error('No dated feed snapshot is available.');
    return chooseLatestFeed([latest, data]);
  }

  function updateFeedStatus(message = '') {
    const collected = Date.parse(data.last_updated);
    const delayed = !Number.isFinite(collected) || Date.now() - collected > 10 * 60 * 1000;
    const timestamp = Number.isFinite(collected) ? new Date(collected).toLocaleString() : 'unavailable';
    const newest = jobs.reduce((latest, job) => {
      const freshness = getJobFreshness(job);
      return freshness.hours < latest.hours ? freshness : latest;
    }, { hours: Infinity });
    const newestText = Number.isFinite(newest.hours) ? `Newest listing: ${newest.label}` : 'No dated listings available';
    const collecting = data.sync && ['queued', 'running'].includes(data.sync.status);
    const label = message || (collecting ? 'Collecting jobs' : delayed ? 'Feed delayed' : 'Feed available');
    document.querySelectorAll('.auto-sync-badge').forEach(badge => {
      badge.innerHTML = `<span class="sync-pulse-dot"></span> <span class="sync-badge-text">${escapeHTML(label)}<span class="sync-time-info"> • Last collection: ${escapeHTML(timestamp)} &bull; ${escapeHTML(newestText)}</span></span>`;
    });
  }

  function applyPublishedFeed(freshData) {
    data = freshData;
    jobs = freshData.jobs.filter(hasVerifiedPublicationTime);
    stats = freshData.stats || stats;
    profile = freshData.profile || profile;
    window.JOB_MATCHER_DATA = window.JOB_DATA = freshData;
    mergeSavedCustomJobs(jobs);
    initStats();
    updateFilterPillCounts();
    renderJobs();
    renderCuratedFeed();
    renderCompanySites();
    renderAppliedJobs();
    updateFeedStatus();
  }

  async function refreshJobsLive(isSilent = false) {
    if (refreshInFlight) return;
    refreshInFlight = true;
    if (navRefreshIcon) navRefreshIcon.classList.add('spinning');
    if (navRefreshBtn) navRefreshBtn.disabled = true;
    if (navRefreshLabel && !isSilent) navRefreshLabel.textContent = 'Refreshing...';
    try {
      applyPublishedFeed(await loadLatestFeed());
      let collectionRequested = false;
      let collectionComplete = false;
      if (!isSilent) {
        try {
          const request = await fetchFeedJson('./api/sync', { method: 'POST' });
          collectionRequested = request.status === 'processing';
          if (collectionRequested) {
            updateFeedStatus('Collecting jobs');
            const deadline = Date.now() + 60000;
            while (Date.now() < deadline) {
              await new Promise(resolve => setTimeout(resolve, 3000));
              const state = await fetchFeedJson('./api/sync/status');
              if (state.status === 'error') throw new Error(state.error || 'Collection failed.');
              if (state.status === 'complete') {
                collectionComplete = true;
                break;
              }
            }
            applyPublishedFeed(await loadLatestFeed());
            if (!collectionComplete) updateFeedStatus('Collection running; results will refresh automatically');
          }
        } catch (error) {
          // Static hosting can read published feeds without running the collector.
          if (collectionRequested) {
            updateFeedStatus('Collection could not finish; showing last available feed');
            showToast('Collection could not finish. Showing the last available feed.');
            return;
          }
        }
        showToast(collectionRequested && !collectionComplete
          ? 'Collection is still running. New results will appear automatically.'
          : `Loaded ${jobs.length} listings. Last collection: ${new Date(data.last_updated).toLocaleString()}.`);
      }
    } catch (error) {
      console.error('[TargetMatch AI] Feed refresh failed:', error);
      updateFeedStatus('Refresh failed; showing last available feed');
      if (!isSilent) showToast('Could not refresh listings. Showing the last available feed.');
    } finally {
      refreshInFlight = false;
      if (navRefreshIcon) navRefreshIcon.classList.remove('spinning');
      if (navRefreshLabel) navRefreshLabel.textContent = 'Refresh Jobs';
      if (navRefreshBtn) navRefreshBtn.disabled = false;
    }
  }

  function setupRealtimeLiveStream() {
    setInterval(() => { refreshJobsLive(true); }, 30000);
  }

  if (navRefreshBtn) {
    navRefreshBtn.addEventListener("click", () => {
      refreshJobsLive(false);
    });
  }

  // Initial Runs: Enforce Full-Time Jobs isolation on load
  setRoleTypeFilter("jobs", false);
  initStats();
  renderJobs();
  renderStrategyTable();
  renderSkillMatrix();
  renderCuratedFeed();
        renderCompanySites();
  // Immediately re-validate data.json with zero cache on startup
  setTimeout(() => { refreshJobsLive(true); }, 50);
  renderAppliedJobs();
  renderRejectedJobs();
  updateFeedStatus();
  setupRealtimeLiveStream();
});
