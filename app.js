/**
 * TargetMatch AI - Interactive Dashboard & Scoring Engine
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Data Initialization
  const data = window.JOB_MATCHER_DATA || {
    jobs: [],
    profile: {},
    stats: {}
  };

  const jobs = data.jobs || [];
  const profile = data.profile || {};
  const stats = data.stats || {};

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

  // State
  let currentFilter = {
    search: "",
    tier: "all",
    minScore: 0.60,
    sortBy: "score-desc"
  };

  // ==========================================================================
  // 2. Initial Setup & Stats Display
  // ==========================================================================

  function initStats() {
    document.getElementById("stat-primary-val").textContent = stats.primary_matches || 0;
    document.getElementById("stat-secondary-val").textContent = stats.secondary_matches || 0;
    document.getElementById("stat-adjacent-val").textContent = stats.adjacent_matches || 0;
    
    const topScore = jobs.length > 0 ? Math.max(...jobs.map(j => j.score)) : 0;
    document.getElementById("stat-avg-score-val").textContent = `${Math.round(topScore * 100)}%`;
    navJobCount.textContent = jobs.length;
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
    if (tier >= 4 && tier <= 6) return "tier-badge-secondary";
    return "tier-badge-adjacent";
  }

  function renderJobs() {
    let filtered = jobs.filter(job => {
      // Score filter
      if (job.score < currentFilter.minScore) return false;

      // Tier filter
      if (currentFilter.tier !== "all") {
        if (currentFilter.tier === "primary" && ![1, 2, 3].includes(job.tier)) return false;
        if (currentFilter.tier === "secondary" && ![4, 5, 6].includes(job.tier)) return false;
        if (currentFilter.tier === "adjacent" && ![7, 8, 9].includes(job.tier)) return false;
        if (!isNaN(currentFilter.tier) && job.tier !== parseInt(currentFilter.tier, 10)) return false;
      }

      // Search query
      if (currentFilter.search) {
        const q = currentFilter.search.toLowerCase();
        const titleMatch = job.title.toLowerCase().includes(q);
        const compMatch = job.company.toLowerCase().includes(q);
        const catMatch = job.category.toLowerCase().includes(q);
        const skillMatch = (job.matched_skills || []).some(s => s.toLowerCase().includes(q));
        if (!titleMatch && !compMatch && !catMatch && !skillMatch) return false;
      }

      return true;
    });

    // Sorting
    filtered.sort((a, b) => {
      if (currentFilter.sortBy === "score-desc") return b.score - a.score;
      if (currentFilter.sortBy === "tier-asc") return (a.tier || 99) - (b.tier || 99);
      if (currentFilter.sortBy === "company-asc") return a.company.localeCompare(b.company);
      return 0;
    });

    // Update results header
    resultsCount.textContent = `Showing ${filtered.length} matching jobs`;

    // Render cards
    if (filtered.length === 0) {
      jobsGrid.innerHTML = "";
      emptyState.style.display = "block";
      return;
    }

    emptyState.style.display = "none";
    jobsGrid.innerHTML = filtered.map(job => {
      const tierClass = getTierBadgeClass(job.tier);
      const scorePct = Math.round(job.score * 100);
      const matchedTags = (job.matched_skills || []).map(s => 
        `<span class="skill-tag matched">✓ ${s.replace(/_/g, ' ')}</span>`
      ).join("");

      // Resolve realistic Apply URL if url is placeholder
      let applyUrl = job.url;
      if (!applyUrl || applyUrl.includes("example.com")) {
        const query = `${job.title} ${job.location || 'India'}`.trim();
        applyUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}`;
      }
      const googleJobsUrl = `https://www.google.com/search?q=${encodeURIComponent(job.title + ' jobs in ' + (job.location || 'India'))}`;

      return `
        <article class="job-card" id="job-${job.tier}-${job.company.replace(/\s+/g, '-').toLowerCase()}">
          <div>
            <div class="job-card-header">
              <div>
                <span class="job-tier-badge ${tierClass}">
                  ${job.badge || '📌'} Tier ${job.tier} • ${job.category}
                </span>
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
          </div>

          <div class="card-actions">
            <button class="btn btn-secondary view-details-btn" data-job-url="${escapeHTML(job.url)}" title="View complete details and skill breakdown">
              🔍 Details
            </button>
            <a href="${escapeHTML(applyUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" title="Search & Apply on LinkedIn">
              <span>Apply on LinkedIn ↗</span>
            </a>
            <a href="${escapeHTML(googleJobsUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" title="Search on Google Jobs">
              <span>Google ↗</span>
            </a>
            <button class="btn btn-secondary copy-btn" data-info="${escapeHTML(`${job.title} at ${job.company} - Match: ${scorePct}%`)}" title="Copy role details">
              📋
            </button>
          </div>
        </article>
      `;
    }).join("");

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

    // Attach Details buttons & card clicks
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
        // Prevent opening if clicking an <a> tag or copy button
        if (e.target.closest("a") || e.target.closest(".copy-btn")) return;
        const cardId = card.id;
        const found = jobs.find(j => cardId.includes(j.company.replace(/\s+/g, '-').toLowerCase()));
        if (found) openJobModal(found);
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
      ? `<strong>Missing / Gaps (${missing.length}):</strong> ` + missing.map(s => `<span class="skill-tag missing">✗ ${s.replace(/_/g, ' ')}</span>`).join(" ")
      : "";

    // Strategy advice based on Tier
    let advice = "";
    if (job.tier === 1) advice = "Top Priority Tier: Tailor your resume to highlight PyTorch, deep learning model architectures, and applied research/thesis work.";
    else if (job.tier === 2) advice = "Top Priority Tier: Emphasize A/B testing methodologies, SQL analytics pipelines, product metrics, and business experimentation.";
    else if (job.tier === 3) advice = "Top Priority Tier: Showcase statistical hypothesis testing, decision trees, modeling, and data-driven optimization.";
    else if (job.tier === 4) advice = "Secondary Priority Tier: Highlight linear programming (PuLP/SciPy), operations research algorithms, and constraint optimization.";
    else if (job.tier === 5) advice = "Secondary Priority Tier: Feature deployed ML models, FastAPI REST APIs, Docker containerization, and scikit-learn.";
    else if (job.tier === 6) advice = "Secondary Priority Tier: Highlight ARIMA, Prophet, time-series feature engineering, and demand forecasting projects.";
    else advice = "Strategic Adjacent Role: Highlight analytical problem-solving, stakeholder communication, and domain knowledge.";

    modalStrategyAdvice.textContent = advice;

    // Apply links
    let applyUrl = job.url;
    if (!applyUrl || applyUrl.includes("example.com")) {
      const query = `${job.title} ${job.location || 'India'}`.trim();
      applyUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}`;
    }
    const googleJobsUrl = `https://www.google.com/search?q=${encodeURIComponent(job.title + ' jobs in ' + (job.location || 'India'))}`;

    modalApplyLinkedin.href = applyUrl;
    modalApplyGoogle.href = googleJobsUrl;

    modalCopyBtn.onclick = () => {
      const copyText = `${job.title} at ${job.company} (Tier ${job.tier} - Match: ${scorePct}%)\nApply: ${applyUrl}`;
      navigator.clipboard.writeText(copyText).then(() => {
        showToast("Copied role information!");
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
    renderJobs();
  });

  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    currentFilter.search = "";
    clearSearchBtn.style.display = "none";
    renderJobs();
  });

  tierSelect.addEventListener("change", (e) => {
    currentFilter.tier = e.target.value;
    updateChipSelection(e.target.value);
    renderJobs();
  });

  scoreSlider.addEventListener("input", (e) => {
    const val = parseInt(e.target.value, 10);
    currentFilter.minScore = val / 100;
    scoreSliderVal.textContent = `${val}%`;
    renderJobs();
  });

  sortSelect.addEventListener("change", (e) => {
    currentFilter.sortBy = e.target.value;
    renderJobs();
  });

  resetFiltersBtn.addEventListener("click", () => {
    searchInput.value = "";
    currentFilter.search = "";
    currentFilter.tier = "all";
    currentFilter.minScore = 0.60;
    scoreSlider.value = 60;
    scoreSliderVal.textContent = "60%";
    sortSelect.value = "score-desc";
    tierSelect.value = "all";
    clearSearchBtn.style.display = "none";
    updateChipSelection("all");
    renderJobs();
  });

  // Quick Chips
  tierChipsContainer.addEventListener("click", (e) => {
    if (e.target.classList.contains("chip")) {
      const chipVal = e.target.getAttribute("data-chip");
      currentFilter.tier = chipVal;
      tierSelect.value = chipVal;
      updateChipSelection(chipVal);
      renderJobs();
    }
  });

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
      else if (tier.tier === 4) competencies = "Linear Programming, PuLP, Optimization, OR";
      else if (tier.tier === 5) competencies = "MLOps, Docker, FastAPI, Scikit-learn, Deployments";
      else if (tier.tier === 6) competencies = "ARIMA, Prophet, Time Series, Demand Planning";
      else if (tier.tier === 7) competencies = "APM, Roadmap, Product Analytics, SQL, Metrics";
      else if (tier.tier === 8) competencies = "BizOps, Strategic Modeling, Program KPIs";
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

    // 2. Experience check
    if (exp > 2) {
      return {
        rejected: true,
        reason: `Requires ${exp} years experience (entry-level threshold is ≤ 2 years)`,
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

    // 6. Seniority fit
    const isEntry = ["intern", "fresher", "junior", "associate"].includes(seniority) || 
                    ["intern", "junior", "associate"].some(w => title.includes(w));
    const seniorityScore = isEntry ? 1.0 : 0.80;

    // 7. Location fit
    const locScore = 1.0;

    // 8. Composite weighted score
    const finalScore = (
      skillScore * 0.40 +
      matchedTier.weight * 0.35 +
      seniorityScore * 0.15 +
      locScore * 0.10
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

  // Preset Rotator
  const presets = [
    {
      title: "Junior Applied Scientist",
      category: "Applied ML / Research",
      seniority: "junior",
      exp: 1,
      skills: "python, pytorch, deep_learning, machine_learning, statistics"
    },
    {
      title: "Associate Decision Scientist",
      category: "Decision Science",
      seniority: "associate",
      exp: 0,
      skills: "sql, python, statistical_modeling, decision_analysis, power_bi"
    },
    {
      title: "Junior Operations Research Scientist",
      category: "OR / Optimization",
      seniority: "junior",
      exp: 0,
      skills: "python, operations_research, linear_programming, optimization, pulp"
    },
    {
      title: "Senior Staff Applied Scientist (Rejection Test)",
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

  // Initial Runs
  initStats();
  renderJobs();
  renderStrategyTable();
  renderSkillMatrix();
});
