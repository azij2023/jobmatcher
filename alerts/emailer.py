from collectors.career_urls import build_linkedin_jobs_url, build_naukri_jobs_url

def send_email(jobs: list[dict]):
    print("\n" + "=" * 70)
    print(" 🚀 DAILY ENTRY-LEVEL JOB ALERT (VERIFIED INDIAN TECH REQUISITIONS)")
    print("=" * 70)
    if not jobs:
        print("No matching jobs found today.")
        return

    for idx, j in enumerate(jobs, start=1):
        badge = j.get("badge", "📌")
        tier = j.get("tier", "-")
        category = j.get("category", "General")
        score = j.get("score", 0.0)
        title = j.get("title", "Unknown Role")
        company = j.get("company", "Unknown Company")
        li_url = j.get("linkedin_url") or build_linkedin_jobs_url(title, company)
        nk_url = j.get("naukri_url") or build_naukri_jobs_url(title)
        skills = ", ".join(j.get("matched_skills", [])) or "N/A"

        print(f"\n{idx}. {badge} [{category} | Tier {tier}] {title} @ {company}")
        print(f"   Match Score    : {score * 100:.1f}%")
        print(f"   Skills Matched : {skills}")
        print(f"   💼 LinkedIn Requisition (Past 24h & Fresher): {li_url}")
        print(f"   🔷 Naukri 0-Exp Requisition: {nk_url}")
        if j.get("contact_email"):
            print(f"   ✉️ Recruiter Email: {j['contact_email']}")
    print("\n" + "=" * 70)

