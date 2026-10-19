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
    1. First tries an exact or fuzzy category match.
    2. Then evaluates role title matches prioritizing the longest/most specific title match first.
    """
    title = job.get("title", "").lower()
    extracted_role = job.get("role_type", "").lower()
    extracted_category = job.get("role_category", "").lower().strip()

    role_mapping = profile.get("role_mapping", [])

    # Pass 1: Direct Category match
    if extracted_category:
        for tier_info in role_mapping:
            cat_name = tier_info["category"].lower()
            if extracted_category == cat_name or extracted_category in cat_name or cat_name in extracted_category:
                return tier_info

    # Pass 2: Most specific role pattern match (sorted by length descending)
    all_role_candidates = []
    for tier_info in role_mapping:
        for role_pattern in tier_info["roles"]:
            all_role_candidates.append((len(role_pattern), role_pattern.lower(), tier_info))

    all_role_candidates.sort(key=lambda x: x[0], reverse=True)

    for _, role_pattern, tier_info in all_role_candidates:
        pattern = rf"\b{re.escape(role_pattern)}\b"
        if re.search(pattern, title) or re.search(pattern, extracted_role) or role_pattern in title:
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

    # 0. Check Freshness Filter (Within 24 Hours / 1 Day)
    max_age_hours = profile.get("freshness", {}).get("max_age_hours", 24)
    if hours_ago is not None and hours_ago > max_age_hours:
        return {
            "rejected": True,
            "final_score": 0.0,
            "rejection_reason": f"Job posted {hours_ago}h ago (older than {max_age_hours}h limit)"
        }

    # 0b. Exclude Aggregators like LinkedIn (Only allow direct company sites)
    exclude_aggs = profile.get("freshness", {}).get("exclude_aggregators", ["linkedin"])
    for agg in exclude_aggs:
        if agg in url:
            return {
                "rejected": True,
                "final_score": 0.0,
                "rejection_reason": f"Aggregator '{agg}' excluded. Only direct individual company websites allowed."
            }

    # 1. Check Hard Exclusion Keywords (Title) using word boundaries
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

    # 2. Check Experience Limit for Entry Level
    max_allowed_exp = profile.get("job_filters", {}).get("max_experience_years", 2)
    if min_exp is not None and min_exp > max_allowed_exp:
        return {
            "rejected": True,
            "final_score": 0.0,
            "rejection_reason": f"Requires {min_exp} years experience (max allowed: {max_allowed_exp})"
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
    required_skills = [s.lower().strip() for s in job.get("required_skills", [])]
    nice_to_have = [s.lower().strip() for s in job.get("nice_to_have", [])]

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

    # 7. Location Fit Score
    job_location = job.get("location", "").lower()
    preferred_cities = set(profile.get("locations", {}).get("preferred_cities", []))
    acceptable_locs = set(profile.get("locations", {}).get("acceptable", []))

    if any(city in job_location for city in preferred_cities) or "remote" in job_location:
        location_score = 1.0
    elif any(acc in job_location for acc in acceptable_locs):
        location_score = 0.85
    else:
        location_score = 0.60

    # 8. Composite Weighted Final Score Calculation
    # Weights: Skills (40%), Role Category Priority (35%), Seniority (15%), Location (10%)
    final_score = (
        skill_score * 0.40 +
        role_priority_weight * 0.35 +
        seniority_score * 0.15 +
        location_score * 0.10 +
        nice_bonus
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
        "skill_match_rate": round(len(matched_required) / len(required_skills), 2) if required_skills else 1.0,
        "matched_skills": matched_required,
        "missing_skills": missing_required,
        "matched_nice_to_have": matched_nice
    }
