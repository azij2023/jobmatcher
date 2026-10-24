import re

def flatten_skills(skills: dict) -> dict:
    flat = {}
    for group in skills.values():
        for k, v in group.items():
            flat[k] = v
    return flat

def match_role_category(job: dict, profile: dict) -> dict | None:
    """
    Matches the job title and extracted role against the prioritized role mapping.
    1. First evaluates specific role title matches (sorted by pattern length descending,
       with lower tier number as tie-breaker so Tier 1 Applied Scientist takes precedence).
    2. Then evaluates direct category match if no specific role title matched.
    3. Finally checks fallback in general target_roles list.
    """
    title = job.get("title", "").lower()
    extracted_role = job.get("role_type", "").lower()
    extracted_category = job.get("role_category", "").lower().strip()

    role_mapping = profile.get("role_mapping", [])

    # Pass 1: Most specific role pattern match (sorted by length descending, lower tier number tiebreaker)
    all_role_candidates = []
    for tier_info in role_mapping:
        for role_pattern in tier_info["roles"]:
            all_role_candidates.append((len(role_pattern), -tier_info["tier"], role_pattern.lower(), tier_info))

    all_role_candidates.sort(key=lambda x: (x[0], x[1]), reverse=True)

    for _, _, role_pattern, tier_info in all_role_candidates:
        pattern = rf"\b{re.escape(role_pattern)}\b"
        if re.search(pattern, title) or re.search(pattern, extracted_role) or role_pattern in title:
            return tier_info

    # Pass 2: Direct Category match fallback
    if extracted_category:
        for tier_info in role_mapping:
            cat_name = tier_info["category"].lower()
            if extracted_category == cat_name or extracted_category in cat_name or cat_name in extracted_category:
                return tier_info

    # Pass 3: Fallback check in general target_roles list
    for target in profile.get("target_roles", []):
        target_lower = target.lower()
        if target_lower in title or target_lower in extracted_role:
            return {
                "tier": 99,
                "priority": "General",
                "badge": "[*]",
                "category": "Target Role",
                "weight": 0.70
            }

    return None

def score_job(job: dict, profile: dict) -> dict:
    title = job.get("title", "").lower()
    seniority = job.get("seniority", "").lower()
    min_exp = job.get("min_years_experience")
    hours_ago = job.get("hours_ago")
    url = job.get("url", "").lower()

    # 0. Check Freshness Filter (Retention window up to 30 days)
    max_age_hours = profile.get("freshness", {}).get("max_age_hours", 720)
    if hours_ago is not None and hours_ago > max_age_hours:
        return {
            "rejected": True,
            "final_score": 0.0,
            "rejection_reason": f"Job posted {hours_ago}h ago (older than {max_age_hours}h limit)"
        }

    # 0a. Guardrail against generic companies and SEO search redirect URLs
    company = job.get("company", "").lower().strip()
    if not company or company in ["tech company", "other organization not listed here", "unknown"]:
        return {
            "rejected": True,
            "final_score": 0.0,
            "rejection_reason": f"Generic or placeholder company: '{company}'"
        }
    if any(bad in title for bad in ["jobs in", "job vacancies", "salary in", "vacancies in", "mba fresher or"]):
        return {
            "rejected": True,
            "final_score": 0.0,
            "rejection_reason": f"Title appears to be an SEO aggregator category page: '{title}'"
        }
    if "indeed.com/jobs?q=" in url or "-jobs-in-india" in url:
        return {
            "rejected": True,
            "final_score": 0.0,
            "rejection_reason": f"URL is a search redirect rather than a direct requisition link"
        }

    # 0b. Platform Recognition (LinkedIn, Naukri, Indeed, Wellfound, Direct ATS)
    platform = "Direct Company Portal"
    if "linkedin.com" in url:
        platform = "LinkedIn"
    elif "naukri.com" in url:
        platform = "Naukri"
    elif "indeed.com" in url:
        platform = "Indeed"
    elif "wellfound.com" in url:
        platform = "Wellfound"
    elif "unstop.com" in url:
        platform = "Unstop"
    elif any(ats in url for ats in ["greenhouse.io", "lever.co", "workday", "smartrecruiters", "ashbyhq"]):
        platform = "Direct ATS"

    # Optional exclude check only if explicitly configured in profile
    exclude_aggs = profile.get("freshness", {}).get("exclude_aggregators", [])
    for agg in exclude_aggs:
        if agg and agg in url:
            return {
                "rejected": True,
                "final_score": 0.0,
                "rejection_reason": f"Platform '{agg}' excluded by profile configuration."
            }

    # 1. Check Hard Exclusion Keywords (Title & Description) using word boundaries
    raw_desc = job.get('raw_description', '').lower()
    for bad in profile.get("job_filters", {}).get("exclude_keywords", []):
        bad_lower = bad.lower().strip()
        
        # Exception: Allow APM / Associate Product Manager despite 'manager'
        if bad_lower == "manager":
            if "associate product manager" in title or "apm" in title or "junior product manager" in title:
                continue

        pattern = rf"\b{re.escape(bad_lower)}\b" if not bad_lower.endswith(("+", ".")) else re.escape(bad_lower)
        if re.search(pattern, title):
            return {
                "rejected": True,
                "final_score": 0.0,
                "rejection_reason": f"Title contains excluded keyword: '{bad}'"
            }
        
        # For domain-specific or stale keywords (accounting, bookkeeping, 2 weeks ago, etc.), reject if in description
        if any(term in bad_lower for term in ["accounting", "bookkeeping", "fixed asset", "taxation", "bank charges", "weeks ago", "month ago"]):
            if re.search(pattern, raw_desc):
                return {
                    "rejected": True,
                    "final_score": 0.0,
                    "rejection_reason": f"Description contains excluded domain/stale keyword: '{bad}'"
                }

    # 2. Check Experience Limit for Entry Level (Strict 0-1 year limit)
    max_allowed_exp = profile.get("job_filters", {}).get("max_experience_years", 1)
    if min_exp is not None and min_exp > max_allowed_exp:
        return {
            "rejected": True,
            "final_score": 0.0,
            "rejection_reason": f"Requires {min_exp} years experience (max allowed: {max_allowed_exp} year for entry-level)"
        }

    # 2b. Check Description for explicit 2+ years requirement
    full_text = f"{title} {job.get('raw_description', '')}".lower()
    two_plus_match = re.search(r"(?:minimum(?:\s+of)?|at\s+least|\b)\s*([2-9]|\d{2,})\+?\s*(?:-\s*\d+)?\s*years?", full_text)
    if two_plus_match:
        return {
            "rejected": True,
            "final_score": 0.0,
            "rejection_reason": f"Job demands '{two_plus_match.group(0).strip()}' (exceeds 0-1 year entry-level limit)"
        }

    # 3. Check Seniority / Level Filter
    acceptable_seniorities = set(profile.get("seniority", {}).get("acceptable", []))
    exclude_seniorities = set(profile.get("seniority", {}).get("exclude", []))

    if seniority in exclude_seniorities:
        return {
            "rejected": True,
            "final_score": 0.0,
            "rejection_reason": f"Seniority '{seniority}' is excluded"
        }

    # 4. Check Role Match against 9 Prioritized Categories
    role_match = match_role_category(job, profile)
    if not role_match:
        return {
            "rejected": True,
            "final_score": 0.0,
            "rejection_reason": "Job does not match any target entry-level role category"
        }

    role_priority_weight = role_match.get("weight", 0.7)

    # 5. Calculate Skill Alignment Score
    profile_skills = flatten_skills(profile.get("skills", {}))
    required_skills = [s.lower().strip().replace(" ", "_").replace("-", "_") for s in job.get("required_skills", [])]
    nice_to_have = [s.lower().strip().replace(" ", "_").replace("-", "_") for s in job.get("nice_to_have", [])]

    # If required_skills not pre-extracted, automatically discover matching skills from raw_description
    desc = job.get("raw_description", "").lower()
    if not required_skills and desc:
        found_skills = []
        for s in profile_skills.keys():
            s_clean = s.replace("_", " ")
            if re.search(rf"\b{re.escape(s_clean)}\b", desc):
                found_skills.append(s)
        required_skills = found_skills

    if required_skills:
        matched_required = [s for s in required_skills if s in profile_skills]
        missing_required = [s for s in required_skills if s not in profile_skills]
        skill_score = sum(profile_skills[s] for s in matched_required) / len(required_skills)
    else:
        matched_required = []
        missing_required = []
        skill_score = 0.70  # Default neutral score if no specific skills listed

    # Nice to have bonus (up to 0.08)
    matched_nice = [s for s in nice_to_have if s in profile_skills]
    nice_bonus = min(0.08, 0.02 * len(matched_nice))

    # 6. Seniority Fit Score (Reward pure entry-level indicators)
    entry_indicators = ["intern", "fresher", "trainee", "junior", "associate", "entry", "graduate", "new grad"]
    if seniority in acceptable_seniorities or any(ind in title for ind in entry_indicators):
        seniority_score = 1.0
    else:
        seniority_score = 0.80

    # 7. Location Filter & Fit Score (India-focused)
    job_location = job.get("location", "").lower()
    preferred_cities = [c.lower() for c in profile.get("locations", {}).get("preferred_cities", [])]
    acceptable_locs = [c.lower() for c in profile.get("locations", {}).get("acceptable", [])]

    is_india = (
        any(city in job_location for city in preferred_cities) or
        any(acc in job_location for acc in acceptable_locs) or
        "india" in job_location or
        any(term in job_location for term in ("apac", "asia pacific", "asia-pacific"))
    )
    is_worldwide_remote = (
        profile.get("locations", {}).get("allow_worldwide_remote", False) and
        any(term in job_location for term in ("worldwide", "anywhere", "global"))
    )
    is_remote_location_unverified = (
        job.get("location_unverified", False) and "remote" in job_location
    )

    if profile.get("locations", {}).get("require_india_only", True):
        if not is_india and not is_worldwide_remote and not is_remote_location_unverified:
            return {
                "rejected": True,
                "final_score": 0.0,
                "rejection_reason": f"Location '{job.get('location')}' is outside India or worldwide remote."
            }

    if any(city in job_location for city in preferred_cities):
        location_score = 1.0
    elif is_india:
        location_score = 0.95
    elif is_worldwide_remote:
        location_score = 0.85
    elif is_remote_location_unverified:
        location_score = 0.60
    else:
        location_score = 0.50

    # 8. Fresher Level Alignment Bonus (+0.05)
    fresher_indicators = [
        "fresher", "freshers", "0 year", "0-1 year", "0 to 1 year",
        "new grad", "new graduate", "graduate trainee", "campus",
        "entry level", "entry-level", "intern", "internship", "apprentice",
        "trainee", "associate", "batch 2024", "batch 2025", "batch 2026", "batch 2027"
    ]
    fresher_text = f"{title} {desc}".lower()
    is_fresher = (
        seniority in ["fresher", "intern", "associate", "trainee", "apprentice", "junior"] or
        any(ind in fresher_text for ind in fresher_indicators) or
        (min_exp is not None and min_exp == 0)
    )
    fresher_bonus = 0.05 if is_fresher else 0.0

    # 9. Composite Weighted Final Score Calculation
    # Weights: Skills (40%), Role Category Priority (35%), Seniority (15%), Location (10%) + bonuses
    final_score = (
        skill_score * 0.40 +
        role_priority_weight * 0.35 +
        seniority_score * 0.15 +
        location_score * 0.10 +
        nice_bonus +
        fresher_bonus
    )
    final_score = round(min(1.0, max(0.0, final_score)), 3)

    min_threshold = profile.get("job_filters", {}).get("minimum_match_score", 0.60)
    rejected = final_score < min_threshold

    return {
        "rejected": rejected,
        "final_score": final_score,
        "rejection_reason": f"Score {final_score} below minimum threshold {min_threshold}" if rejected else None,
        "tier": role_match.get("tier"),
        "priority": role_match.get("priority"),
        "badge": role_match.get("badge"),
        "category": role_match.get("category"),
        "platform": platform,
        "is_fresher": is_fresher,
        "skill_match_rate": round(len(matched_required) / len(required_skills), 2) if required_skills else 1.0,
        "matched_skills": matched_required,
        "missing_skills": missing_required,
        "matched_nice_to_have": matched_nice
    }
