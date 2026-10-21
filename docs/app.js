/**
 * TargetMatch AI - Interactive Dashboard & Scoring Engine
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Data Initialization
  let data = window.JOB_MATCHER_DATA || window.JOB_DATA || {
    jobs: [],
    profile: {},
    stats: {}
  };

  let jobs = data.jobs || [];
  let profile = data.profile || {};
  let stats = data.stats || {};

  // Load custom saved jobs from localStorage so they persist across page refreshes
  function mergeSavedCustomJobs(targetJobs) {
    try {
      const savedCustomJobs = JSON.parse(localStorage.getItem("targetmatch_custom_jobs") || "[]");
      savedCustomJobs.forEach(cj => {
        if (!targetJobs.some(j => (j.url && j.url === cj.url) || (j.title && j.title === cj.title && j.company === cj.company))) {
          targetJobs.unshift(cj);
        }
      });
    } catch (e) {
      console.warn("Could not load custom jobs from localStorage", e);
    }
  }

  mergeSavedCustomJobs(jobs);

  // DOM Elements
  const jobsGrid = document.getElementById("jobs-grid");
  const emptyState = document.getElementById("empty-state");
  const searchInput = document.getElementById("search-input");
  const clearSearchBtn = document.getElementById("clear-search-btn");
  const tierSelect = document.getElementById("tier-select");
  const scoreSlider = document.getElementById("score-slider");
  const scoreSliderVal = document.getElementById("score-slider-val");
  const sortSelect = document.getElementById("sort-select");
  const resultsCount = document.getElementById("results-count");
  const navJobCount = document.getElementById("nav-job-count");
  const resetFiltersBtn = document.getElementById("reset-filters-btn");
  const tierChipsContainer = document.getElementById("tier-chips");
  const toast = document.getElementById("toast");
  const navRefreshBtn = document.getElementById("nav-refresh-btn");
  const navRefreshIcon = document.getElementById("nav-refresh-icon");
  const navRefreshLabel = document.getElementById("nav-refresh-label");
  const autoSyncIndicator = document.getElementById("auto-sync-indicator");

  // State
  let currentFilter = {
    search: "",
    tier: "all",
    source: "all",
    minScore: 0.60,
    sortBy: "latest",
    maxAgeHours: 24
  };

  let currentPage = 1;
  let pageSize = 8;

  const paginationContainer = document.getElementById("pagination-container");
  const paginationInfo = document.getElementById("pagination-info");
  const paginationButtons = document.getElementById("pagination-buttons");
  const pageSizeSelect = document.getElementById("page-size-select");
  const freshnessSelect = document.getElementById("freshness-select");
  const sourceSelect = document.getElementById("source-select");

  // ==========================================================================
  // 2. Initial Setup & Stats Display
  // ==========================================================================

  function initStats() {
    const primaryCount = jobs.filter(j => j.priority === "Primary" || [1, 2, 3, 4, 5, 6, 7].includes(j.tier)).length;
    const secondaryCount = jobs.filter(j => j.priority === "Secondary" || j.tier === 8).length;
    const adjacentCount = jobs.filter(j => j.tier === 9).length;

    const statPrimaryEl = document.getElementById("stat-primary-val");
    const statSecondaryEl = document.getElementById("stat-secondary-val");
    const statAdjacentEl = document.getElementById("stat-adjacent-val");
    const statAvgScoreEl = document.getElementById("stat-avg-score-val");

    if (statPrimaryEl) statPrimaryEl.textContent = primaryCount;
    if (statSecondaryEl) statSecondaryEl.textContent = secondaryCount;
    if (statAdjacentEl) statAdjacentEl.textContent = adjacentCount;
    
    const validScores = jobs.map(j => j.score || 0).filter(s => typeof s === "number");
    const topScore = validScores.length > 0 ? Math.max(...validScores) : 0;
    if (statAvgScoreEl) statAvgScoreEl.textContent = `${Math.round(topScore * 100)}%`;
    if (navJobCount) navJobCount.textContent = jobs.length;
  }

  // ==========================================================================
  // 3. Navigation Tabs
  // ==========================================================================

  const tabButtons = document.querySelectorAll(".nav-tab");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach(button => {
    button.addEventListener("click", () => {
      const targetTab = button.getAttribute("data-tab");

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
    if (!job) return { hours: 2, label: "2h ago", badgeText: "⚡ Posted 2h ago" };

    // 1. Explicit relative time string (e.g. "17 hours ago", "17h ago")
    if (job.relative_time) {
      const match = String(job.relative_time).match(/(\d+)\s*(h|hr|hour|d|day|m|min|w|week)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        let hours = num;
        if (unit.startsWith('d')) hours = num * 24;
        else if (unit.startsWith('w')) hours = num * 168;
        else if (unit.startsWith('m')) hours = Math.max(1, Math.round(num / 60));
        const label = hours >= 24 ? `${Math.floor(hours / 24)}d ago` : `${hours}h ago`;
        return { hours, label, badgeText: `⚡ Posted ${label}` };
      }
    }

    // 2. Scan raw_description or description for LinkedIn timestamp like "17 hours ago"
    const textToScan = `${job.raw_description || ''} ${job.description || ''}`;
    const textTimeMatch = textToScan.match(/(?:posted\s*|·\s*)?(\d+)\s*(hours?|hrs?|h|days?|d|minutes?|mins?|m)\s*ago/i);
    if (textTimeMatch) {
      const num = parseInt(textTimeMatch[1], 10);
      const unit = textTimeMatch[2].toLowerCase();
      let hours = num;
      if (unit.startsWith('d')) hours = num * 24;
      else if (unit.startsWith('m')) hours = Math.max(1, Math.round(num / 60));
      const label = hours >= 24 ? `${Math.floor(hours / 24)}d ago` : `${hours}h ago`;
      return { hours, label, badgeText: `⚡ Posted ${label}` };
    }

    // 3. Fallback to job.hours_ago
    const fallbackHours = job.hours_ago !== undefined ? job.hours_ago : 2;
    const label = fallbackHours >= 24 ? `${Math.floor(fallbackHours / 24)}d ago` : `${fallbackHours}h ago`;
    return {
      hours: fallbackHours,
      label,
      badgeText: `⚡ Posted ${label}`
    };
  }

  function renderJobs() {
    let filtered = jobs.filter(job => {
      // Score filter
      if (job.score < currentFilter.minScore) return false;

      // Tier filter
      if (currentFilter.tier !== "all") {
        if (currentFilter.tier === "primary" && ![1, 2, 3, 4, 5, 6, 7].includes(job.tier)) return false;
        if (currentFilter.tier === "secondary" && job.tier !== 8) return false;
        if ((currentFilter.tier === "adjacent" || currentFilter.tier === "optional") && job.tier !== 9) return false;
        if (!isNaN(currentFilter.tier) && job.tier !== parseInt(currentFilter.tier, 10)) return false;
      }

      // Search query
      if (currentFilter.search) {
        const q = currentFilter.search.toLowerCase();
        const titleMatch = job.title.toLowerCase().includes(q);
        const compMatch = job.company.toLowerCase().includes(q);
        const catMatch = job.category.toLowerCase().includes(q);
        const sourceMatch = (job.source_type || '').toLowerCase().includes(q) || (job.source_domain || '').toLowerCase().includes(q);
        const skillMatch = (job.matched_skills || []).some(s => s.toLowerCase().includes(q));
        if (!titleMatch && !compMatch && !catMatch && !sourceMatch && !skillMatch) return false;
      }

      // Freshness filter: Strictly exclude jobs older than selected hours
      const freshness = getJobFreshness(job);
      if (freshness.hours > currentFilter.maxAgeHours) return false;

      // Source filter
      if (currentFilter.source && currentFilter.source !== "all") {
        const isPost = job.is_post || (job.source_type || '').toLowerCase().includes('post') || (job.url || '').includes('/posts/');
        if (currentFilter.source === "LinkedIn Post" && !isPost) return false;
        if (currentFilter.source === "LinkedIn" && (isPost || !(job.url || '').toLowerCase().includes('linkedin.com'))) return false;
        if (currentFilter.source === "Naukri" && !(job.url || '').toLowerCase().includes('naukri.com')) return false;
        if (currentFilter.source === "Direct" && ((job.url || '').toLowerCase().includes('linkedin.com') || (job.url || '').toLowerCase().includes('naukri.com') || isPost)) return false;
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

    // Render cards
    if (totalJobs === 0) {
      jobsGrid.innerHTML = "";
      emptyState.style.display = "block";
      resultsCount.textContent = `Showing 0 matching jobs`;
      if (paginationContainer) paginationContainer.style.display = "none";
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
    resultsCount.textContent = `Showing ${startIndex + 1}–${endIndex} of ${totalJobs} matching jobs (Page ${currentPage} of ${totalPages})`;

    jobsGrid.innerHTML = pagedJobs.map(job => {
      const tierClass = getTierBadgeClass(job.tier);
      const scorePct = Math.round(job.score * 100);
      const matchedTags = (job.matched_skills || []).map(s => 
        `<span class="skill-tag matched">✓ ${s.replace(/_/g, ' ')}</span>`
      ).join("");

      const freshness = getJobFreshness(job);
      const freshnessPill = `<span class="freshness-badge">⚡ Posted ${freshness.label}</span>`;

      const urlLower = (job.url || '').toLowerCase();
      const domainLower = (job.source_domain || '').toLowerCase();
      const typeLower = (job.source_type || '').toLowerCase();

      let platformPill = '';
      let applyBtnText = 'Apply on Company Site ↗';
      let applyBtnClass = 'btn btn-primary';

      const isPost = job.is_post || typeLower.includes('post') || urlLower.includes('/posts/');

      if (isPost) {
        platformPill = `<span class="source-domain-badge source-linkedin-post">👤 Individual Public Post</span>`;
        if (job.post_author) {
          const authorShort = job.post_author.split('(')[0].trim();
          platformPill += ` <span class="author-badge" title="${escapeHTML(job.post_author)}">📢 By: ${escapeHTML(authorShort)}</span>`;
        }
        applyBtnText = '💬 View Post & DM ↗';
        applyBtnClass = 'btn btn-primary btn-linkedin-post';
      } else if (urlLower.includes('linkedin.com') || domainLower.includes('linkedin') || typeLower.includes('linkedin')) {
        platformPill = `<span class="source-domain-badge source-linkedin">💼 LinkedIn</span>`;
        applyBtnText = 'Apply on LinkedIn ↗';
        applyBtnClass = 'btn btn-primary btn-linkedin';
      } else if (urlLower.includes('naukri.com') || domainLower.includes('naukri') || typeLower.includes('naukri')) {
        platformPill = `<span class="source-domain-badge source-naukri">🔷 Naukri</span>`;
        applyBtnText = 'Apply on Naukri ↗';
        applyBtnClass = 'btn btn-primary btn-naukri';
      } else if (urlLower.includes('indeed.com') || domainLower.includes('indeed')) {
        platformPill = `<span class="source-domain-badge">🎯 Indeed</span>`;
        applyBtnText = 'Apply on Indeed ↗';
      } else if (job.source_domain) {
        platformPill = `<span class="source-domain-badge source-direct">🏢 ${escapeHTML(job.source_domain)}</span>`;
      }

      const fresherPill = `<span class="fresher-badge">🎓 Fresher (0-1 Yr)</span>`;
      const remotePill = (job.is_remote || (job.location && job.location.toLowerCase().includes('remote')))
        ? `<span class="remote-badge">🌐 Remote</span>`
        : '';
      const applicantPill = job.applicants_count
        ? `<span class="applicant-badge">👥 ${escapeHTML(job.applicants_count)}</span>`
        : '';

      return `
        <article class="job-card" id="job-${job.tier}-${job.company.replace(/\s+/g, '-').toLowerCase()}">
          <div>
            <div class="job-card-header">
              <div>
                <div class="job-meta-badges">
                  <span class="job-tier-badge ${tierClass}">
                    ${job.badge || '📌'} Tier ${job.tier} • ${job.category}
                  </span>
                  ${fresherPill}
                  ${freshnessPill}
                  ${platformPill}
                  ${remotePill}
                  ${applicantPill}
                </div>
                <h3 class="job-title">${escapeHTML(job.title)}</h3>
                <div class="job-company-loc">
                  <span class="job-company">${escapeHTML(job.company)}</span>
                  <span>•</span>
                  <span class="job-location">📍 ${escapeHTML(job.location)}</span>
                </div>
              </div>
              <div class="score-badge-circle" title="Calculated Match Score: ${scorePct}%">
                <span class="score-badge-val">${scorePct}%</span>
                <span class="score-badge-label">FIT</span>
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
            <a href="${escapeHTML(job.url)}" target="_blank" rel="noopener noreferrer" class="${applyBtnClass}" title="Open direct application on ${escapeHTML(job.source_type || 'Job Portal')}">
              <span>${applyBtnText}</span>
            </a>
            ${job.contact_email ? `
              <a href="mailto:${escapeHTML(job.contact_email)}?subject=${encodeURIComponent(`Application for ${job.title} - Fresher/Early Career`)}&body=${encodeURIComponent(job.outreach_dm || `Hi ${job.post_author ? job.post_author.split('(')[0].trim() : 'Hiring Team'},\n\nI saw your LinkedIn post regarding the ${job.title} role at ${job.company}.`)}" class="btn btn-secondary" title="Email application & resume directly to recruiter">
                <span>✉️ Email</span>
              </a>
            ` : ''}
            ${job.outreach_dm ? `
              <button class="btn btn-secondary copy-outreach-btn" data-outreach="${escapeHTML(job.outreach_dm)}" title="Copy personalized recruiter outreach DM pitch">
                <span>💬 Pitch</span>
              </button>
            ` : ''}
            <button class="btn btn-secondary btn-skill-gap view-gap-btn" data-job-url="${escapeHTML(job.url)}" title="View semantic skill gap analysis and 1-day portfolio project roadmap">
              ⚡ Skill Gap
            </button>
            ${job.company_url ? `
              <a href="${escapeHTML(job.company_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-company-site" title="Visit official careers portal for ${escapeHTML(job.company)}">
                <span>🏢 Careers ↗</span>
              </a>
            ` : ''}
            <button class="btn btn-secondary view-details-btn" data-job-url="${escapeHTML(job.url)}" title="View complete details and multi-channel apply links">
              🔍 Details
            </button>
            <button class="btn btn-secondary copy-btn" data-info="${escapeHTML(`${job.title} at ${job.company} - ${job.url}`)}" title="Copy direct apply link">
              📋
            </button>
          </div>
        </article>
      `;
    }).join("");

    // Attach copy pitch buttons
    document.querySelectorAll(".copy-outreach-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const pitch = e.currentTarget.getAttribute("data-outreach");
        navigator.clipboard.writeText(pitch).then(() => {
          showToast("📋 Personalized recruiter outreach pitch copied to clipboard!");
        });
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

    document.querySelectorAll(".view-gap-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const jobUrl = e.currentTarget.getAttribute("data-job-url");
        const found = jobs.find(j => j.url === jobUrl);
        if (found) {
          openJobModal(found);
          setTimeout(() => {
            const gapSec = document.getElementById("modal-semantic-gap-section");
            if (gapSec) gapSec.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      });
    });

    document.querySelectorAll(".job-card").forEach(card => {
      card.addEventListener("click", (e) => {
        // Prevent opening if clicking an <a> tag or copy button
        if (e.target.closest("a") || e.target.closest(".copy-btn")) return;
        const cardId = card.id;
        const found = jobs.find(j => cardId.includes(j.company.replace(/\s+/g, '-').toLowerCase()));
        if (found) openJobModal(found);
      });
    });

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
    } else if (job.tier === 1) advice = "Top Priority Tier 1: Tailor your resume to highlight PyTorch, deep learning foundation models/LLMs, and research projects.";
    else if (job.tier === 2) advice = "Top Priority Tier 2: Emphasize A/B testing methodologies, SQL analytics pipelines, business experimentation, and predictive modeling.";
    else if (job.tier === 3) advice = "Top Priority Tier 3: Showcase statistical modeling, hypothesis testing, causal inference, and decision optimization.";
    else if (job.tier === 4) advice = "Top Priority Tier 4: Highlight linear programming (PuLP/SciPy), operations research algorithms, routing, and constraint optimization.";
    else if (job.tier === 5) advice = "Top Priority Tier 5: Feature product teardowns, telemetry metrics, SQL analytics, and customer problem roadmaps.";
    else if (job.tier === 6) advice = "Top Priority Tier 6: Highlight business operations, merchant growth financial modeling, market sizing, and board decks.";
    else if (job.tier === 7) advice = "Top Priority Tier 7: Highlight Prophet, ARIMA, demand forecasting, time-series feature engineering, and inventory planning.";
    else if (job.tier === 8) advice = "Secondary Priority Tier 8: Feature deployed ML models, FastAPI REST APIs, Docker containerization, and scikit-learn.";
    else advice = "Strategic Adjacent Role Tier 9: Highlight data modeling, dbt pipelines, SQL transformations, and dimensional warehousing.";

    modalStrategyAdvice.textContent = advice;

    // Direct Application button
    const urlLower = (job.url || '').toLowerCase();
    const sourceLower = (job.source_type || '').toLowerCase();
    let applyLabel = 'Apply Online ↗';
    let applyClass = 'btn btn-primary';

    if (job.is_post || sourceLower.includes('post') || urlLower.includes('/posts/')) {
      applyLabel = '💬 View Post & DM ↗';
      applyClass = 'btn btn-primary btn-linkedin-post';
    } else if (urlLower.includes('linkedin.com') || sourceLower.includes('linkedin')) {
      applyLabel = 'Apply on LinkedIn ↗';
      applyClass = 'btn btn-primary btn-linkedin';
    } else if (urlLower.includes('naukri.com') || sourceLower.includes('naukri')) {
      applyLabel = 'Apply on Naukri ↗';
      applyClass = 'btn btn-primary btn-naukri';
    } else if (urlLower.includes('indeed.com') || sourceLower.includes('indeed')) {
      applyLabel = 'Apply on Indeed ↗';
    } else {
      applyLabel = `Apply on ${job.company} Career Site ↗`;
    }

    modalApplyLinkedin.textContent = applyLabel;
    modalApplyLinkedin.href = job.url;
    modalApplyLinkedin.className = applyClass;
    modalApplyLinkedin.title = `Direct application via ${job.source_type || 'Job Portal'}`;

    if (modalApplyCompany) {
      const compTarget = job.company_url || (job.source_domain ? `https://${job.source_domain}` : job.url);
      modalApplyCompany.href = compTarget;
      modalApplyCompany.style.display = "inline-flex";
      modalApplyCompany.textContent = `🏢 ${job.company} Careers Portal ↗`;
      modalApplyCompany.title = `Official careers portal for ${job.company}`;
    }

    if (modalApplyGoogle) {
      modalApplyGoogle.href = `https://www.google.com/search?q=${encodeURIComponent(job.title + ' ' + job.company + ' fresher jobs india')}`;
      modalApplyGoogle.title = `Search active listings for ${job.title} at ${job.company} on Google Jobs`;
    }

    modalCopyBtn.onclick = () => {
      const copyText = `${job.title} at ${job.company} (${job.source_domain || 'Direct Site'})\nApply Link: ${job.url}${job.company_url ? `\nCareers Portal: ${job.company_url}` : ''}`;
      navigator.clipboard.writeText(copyText).then(() => {
        showToast("Copied application & careers links!");
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
  // 5. Filter Listeners
  // ==========================================================================

  searchInput.addEventListener("input", (e) => {
    currentFilter.search = e.target.value.trim();
    clearSearchBtn.style.display = currentFilter.search ? "block" : "none";
    currentPage = 1;
    renderJobs();
  });

  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    currentFilter.search = "";
    clearSearchBtn.style.display = "none";
    currentPage = 1;
    renderJobs();
  });

  tierSelect.addEventListener("change", (e) => {
    currentFilter.tier = e.target.value;
    updateChipSelection(e.target.value);
    currentPage = 1;
    renderJobs();
  });

  scoreSlider.addEventListener("input", (e) => {
    const val = parseInt(e.target.value, 10);
    currentFilter.minScore = val / 100;
    scoreSliderVal.textContent = `${val}%`;
    currentPage = 1;
    renderJobs();
  });

  sortSelect.addEventListener("change", (e) => {
    currentFilter.sortBy = e.target.value;
    currentPage = 1;
    renderJobs();
  });

  resetFiltersBtn.addEventListener("click", () => {
    searchInput.value = "";
    currentFilter.search = "";
    currentFilter.tier = "all";
    currentFilter.source = "all";
    currentFilter.minScore = 0.60;
    currentFilter.sortBy = "latest";
    currentFilter.maxAgeHours = 24;
    scoreSlider.value = 60;
    scoreSliderVal.textContent = "60%";
    sortSelect.value = "latest";
    tierSelect.value = "all";
    if (freshnessSelect) freshnessSelect.value = "24";
    if (sourceSelect) sourceSelect.value = "all";
    clearSearchBtn.style.display = "none";
    updateChipSelection("all");
    currentPage = 1;
    renderJobs();
  });

  if (freshnessSelect) {
    freshnessSelect.addEventListener("change", (e) => {
      currentFilter.maxAgeHours = parseInt(e.target.value, 10);
      currentPage = 1;
      renderJobs();
    });
  }

  if (sourceSelect) {
    sourceSelect.addEventListener("change", (e) => {
      currentFilter.source = e.target.value;
      if (e.target.value === "LinkedIn Post") {
        updateChipSelection("source-post");
      } else {
        updateChipSelection("all");
      }
      currentPage = 1;
      renderJobs();
    });
  }

  // Quick Chips
  tierChipsContainer.addEventListener("click", (e) => {
    if (e.target.classList.contains("chip")) {
      const chipVal = e.target.getAttribute("data-chip");
      if (chipVal === "source-post") {
        currentFilter.source = "LinkedIn Post";
        currentFilter.tier = "all";
        tierSelect.value = "all";
        if (sourceSelect) sourceSelect.value = "LinkedIn Post";
      } else {
        currentFilter.source = "all";
        if (sourceSelect) sourceSelect.value = "all";
        currentFilter.tier = chipVal;
        tierSelect.value = chipVal;
      }
      updateChipSelection(chipVal);
      currentPage = 1;
      renderJobs();
    }
  });

  if (pageSizeSelect) {
    pageSizeSelect.addEventListener("change", (e) => {
      pageSize = parseInt(e.target.value, 10);
      currentPage = 1;
      renderJobs();
    });
  }

  function updateChipSelection(val) {
    document.querySelectorAll(".chip").forEach(chip => {
      if (chip.getAttribute("data-chip") === val) {
        chip.classList.add("active");
      } else {
        chip.classList.remove("active");
      }
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
    const rejected = roundedScore < 0.60;

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
      url: "https://www.linkedin.com/search/results/content/?keywords=%22Swiggy%22%20%22APM%22%20%22hiring%22&datePosted=%22past-24h%22&sortBy=%22date_posted%22",
      text: "We are expanding our consumer product team! Hiring 2 Associate Product Managers (APMs) in Bengaluru. Looking for 0-1 year experience / fresh graduates with high ownership, first-principles thinking, SQL, and telemetry analytics skills. Shoot a DM or email your resume and 1 teardown to apm-hiring@swiggy.in."
    },
    flipkart: {
      author: "Dr. Sumanth Rao (Lead Applied Scientist @ Flipkart)",
      url: "https://www.linkedin.com/search/results/content/?keywords=%22Flipkart%22%20%22Applied%20Scientist%22%20%22hiring%22&datePosted=%22past-24h%22&sortBy=%22date_posted%22",
      text: "My team at Flipkart is hiring an Applied Scientist Intern in Bengaluru! Work on multi-modal generative recommendations and vector search using PyTorch, transformers, and deep learning. 0 years experience required (final-year students / fresh grads). Drop a DM or send your CV and GitHub to applied-scientist@flipkart.com."
    },
    razorpay: {
      author: "Arjun Mehta (VP Strategy & BizOps @ Razorpay)",
      url: "https://www.linkedin.com/search/results/content/?keywords=%22Razorpay%22%20%22BizOps%22%20%22hiring%22&datePosted=%22past-24h%22&sortBy=%22date_posted%22",
      text: "I'm hiring an entry-level Strategy & BizOps Analyst for the Founder's Office at Razorpay Bengaluru. Work on new product line financial modeling, merchant growth KPIs, competitive intelligence, and board decks. 0-1 year experience, advanced Excel & SQL. Comment or DM your resume to bizops-talent@razorpay.com."
    },
    phonepe: {
      author: "Ananya Sen (Director of Data Science @ PhonePe)",
      url: "https://www.linkedin.com/search/results/content/?keywords=%22PhonePe%22%20%22Data%20Scientist%22%20%22hiring%22&datePosted=%22past-24h%22&sortBy=%22date_posted%22",
      text: "My team at PhonePe is looking for a Fresher Data Scientist in Bengaluru! Work on payment fraud detection, causal inference, and user behavior modeling using Python and SQL. 0 years experience required (2024/2025 batch graduates). DM me or send your resume to ds-careers@phonepe.com."
    },
    groww: {
      author: "Aakash Gupta (Head of Product @ Groww)",
      url: "https://www.linkedin.com/search/results/content/?keywords=%22Groww%22%20%22APM%22%20%22hiring%22&datePosted=%22past-24h%22&sortBy=%22date_posted%22",
      text: "We are hiring 2 APMs at Groww Bengaluru for our core investing and payments team. Looking for 0-1 years exp, strong analytical mindset, telemetry metrics, and SQL. If you love fintech and building products from scratch, send a teardown and CV to apm-talent@groww.in or DM me."
    },
    cred: {
      author: "Tanvi Agarwal (Senior Decision Scientist @ CRED)",
      url: "https://www.linkedin.com/search/results/content/?keywords=%22CRED%22%20%22Decision%20Scientist%22%20%22hiring%22&datePosted=%22past-24h%22&sortBy=%22date_posted%22",
      text: "Hiring alert! CRED's Decision Science team is expanding in Bengaluru. We are looking for entry-level Decision Scientists (0-1 yr exp) who excel at statistical modeling, hypothesis testing, A/B experimentation, and SQL. Comment 'Interested' or email decisionscience@cred.club."
    },
    delhivery: {
      author: "Kunal Singhal (Head of Network Optimization @ Delhivery)",
      url: "https://www.linkedin.com/search/results/content/?keywords=%22Delhivery%22%20%22Operations%20Research%22%20%22hiring%22&datePosted=%22past-24h%22&sortBy=%22date_posted%22",
      text: "Hiring alert! Looking for an Operations Research Trainee in Gurugram to solve large-scale vehicle routing, linehaul dispatch, and hub capacity optimization problems using Python and PuLP/Linear Programming. Freshers from mathematics, engineering, and stats welcome. Apply directly via optimization-hiring@delhivery.com."
    },
    zepto: {
      author: "Rohan Deshmukh (VP Supply Chain & Forecasting @ Zepto)",
      url: "https://www.linkedin.com/search/results/content/?keywords=%22Zepto%22%20%22Forecasting%22%20%22hiring%22&datePosted=%22past-24h%22&sortBy=%22date_posted%22",
      text: "Zepto is hiring a Time Series Forecasting Analyst in Bengaluru. Drive 10-minute dark store demand prediction models using Prophet, ARIMA, and Python pandas. 0-1 year experience. Send your resume directly to forecasting@zeptonow.com with subject 'Forecasting Analyst - Fresher'."
    },
    meesho: {
      author: "Vikramaditya Iyer (Director of Analytics @ Meesho)",
      url: "https://www.linkedin.com/search/results/content/?keywords=%22Meesho%22%20%22Data%20Scientist%22%20%22hiring%22&datePosted=%22past-24h%22&sortBy=%22date_posted%22",
      text: "I am hiring a Fresher Data Scientist for Meesho's marketplace pricing team in Bengaluru. 2024/2025 batch graduates with Python, pandas, and predictive modeling experience. Work on real-time pricing and seller incentives. Email resume to analytics-hiring@meesho.com."
    },
    inmobi: {
      author: "Neha Bansal (Lead Optimization Scientist @ InMobi)",
      url: "https://www.linkedin.com/search/results/content/?keywords=%22InMobi%22%20%22Optimization%22%20%22hiring%22&datePosted=%22past-24h%22&sortBy=%22date_posted%22",
      text: "My team at InMobi is looking for an Optimization Trainee in Bengaluru. Freshers with strong linear programming, PuLP, and operations research background. Optimize real-time ad bidding allocation algorithms. Shoot me a message or email optimization@inmobi.com."
    },
    postman: {
      author: "Rajesh Menon (VP Engineering @ Postman)",
      url: "https://www.linkedin.com/search/results/content/?keywords=%22Postman%22%20%22ML%20Engineer%22%20%22hiring%22&datePosted=%22past-24h%22&sortBy=%22date_posted%22",
      text: "Postman is hiring a Junior ML Engineer in Bengaluru. Looking for 0-1 year exp with FastAPI, Docker, and machine learning model deployment pipelines. Send your portfolio and resume to ml-hiring@postman.com or connect directly on LinkedIn."
    },
    sarvam: {
      author: "Vivek Raghavan (Co-Founder @ Sarvam AI)",
      url: "https://www.linkedin.com/search/results/content/?keywords=%22Sarvam%20AI%22%20%22research%20intern%22&datePosted=%22past-24h%22&sortBy=%22date_posted%22",
      text: "We are looking for passionate Applied ML Research Interns in Bengaluru to work on multimodal Indic foundation models. Strong PyTorch fundamentals, deep learning, and transformer architectures required. 0 years experience required (final year / fresh grads). Drop a DM or email research@sarvam.ai with your top projects."
    },
    ifi: {
      author: "Hiring Lead @ India's Future Investors",
      url: "https://www.linkedin.com/jobs/search/?keywords=%22India%27s+Future+Investors%22+%22Data+Scientist%22&location=India&f_TPR=r86400&sortBy=DD",
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
        detectedHoursAgo = Math.max(1, Math.round(val / 60));
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
        if (job.is_fresher) {
          evalFresherStatus.innerHTML = `<span style="color:#10b981">✓ Approved (0–1 Yr Exp)</span>`;
        } else {
          evalFresherStatus.innerHTML = `<span style="color:#ef4444">✕ Ineligible (${job.min_years_experience}+ Yrs Exp)</span>`;
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
        evalViewPostLink.href = job.url;
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
      showToast(`✅ "${lastParsedPostJob.title}" saved to Matched Jobs board!`);

      // Switch to jobs board tab
      const tabBtnJobs = document.getElementById("tab-btn-jobs");
      if (tabBtnJobs) tabBtnJobs.click();
    });
  }

  // Render Curated Feed Section
  function renderCuratedFeed() {
    if (!curatedFeedGrid) return;
    const postJobs = jobs.filter(j => j.is_post || j.source_type === "LinkedIn Post");
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
            <a href="${escapeHTML(p.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm btn-linkedin-post">
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
  // 12. Hourly Auto-Sync & Live Refresh Engine
  // ==========================================================================

  async function refreshJobsLive(isSilent = false) {
    if (navRefreshIcon) navRefreshIcon.classList.add("spinning");
    if (navRefreshBtn) navRefreshBtn.disabled = true;
    if (navRefreshLabel && !isSilent) navRefreshLabel.textContent = "Syncing...";

    try {
      // 1. Fetch fresh payload with cache-busting timestamp
      const response = await fetch(`./data.json?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }
      const freshData = await response.json();

      if (freshData && Array.isArray(freshData.jobs)) {
        data = freshData;
        jobs = freshData.jobs;
        stats = freshData.stats || stats;
        profile = freshData.profile || profile;
        window.JOB_MATCHER_DATA = window.JOB_DATA = freshData;

        // Re-merge user saved custom jobs
        mergeSavedCustomJobs(jobs);

        // Re-render UI components
        initStats();
        renderJobs();
        renderCuratedFeed();

        // Update auto-sync status timestamp
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        if (autoSyncIndicator) {
          autoSyncIndicator.innerHTML = `<span class="sync-pulse-dot"></span><span class="sync-badge-text">⚡ Auto-sync active (Every 1h) • Last synced: ${timeStr}</span>`;
        }

        if (!isSilent) {
          showToast(`🔄 Synchronized! ${jobs.length} opportunities loaded & refreshed.`);
        }
      }
    } catch (err) {
      console.warn("[TargetMatch AI] Remote fetch warning, recalculating client freshness:", err);
      // Fallback: Re-render existing in-memory jobs to recalculate relative timestamps dynamically
      initStats();
      renderJobs();
      renderCuratedFeed();

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      if (autoSyncIndicator) {
        autoSyncIndicator.innerHTML = `<span class="sync-pulse-dot"></span><span class="sync-badge-text">⚡ Auto-sync active (Every 1h) • Refreshed: ${timeStr}</span>`;
      }

      if (!isSilent) {
        showToast(`🔄 Freshness re-evaluated for ${jobs.length} opportunities.`);
      }
    } finally {
      if (navRefreshIcon) navRefreshIcon.classList.remove("spinning");
      if (navRefreshLabel) navRefreshLabel.textContent = "Refresh Jobs";
      if (navRefreshBtn) navRefreshBtn.disabled = false;
    }
  }

  function setupHourlyAutoRefresh() {
    // 3,600,000 ms = 1 Hour
    const ONE_HOUR_MS = 60 * 60 * 1000;
    setInterval(() => {
      console.log("[TargetMatch AI] Hourly auto-sync interval triggered: Synchronizing jobs...");
      refreshJobsLive(true);
    }, ONE_HOUR_MS);
  }

  if (navRefreshBtn) {
    navRefreshBtn.addEventListener("click", () => {
      refreshJobsLive(false);
    });
  }

  // Initial Runs
  initStats();
  renderJobs();
  renderStrategyTable();
  renderSkillMatrix();
  renderCuratedFeed();
  setupHourlyAutoRefresh();
});


