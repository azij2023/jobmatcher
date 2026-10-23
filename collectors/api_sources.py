"""Compatibility entry point for the configured public job feeds."""

from collectors.live_job_collector import (
    fetch_live_jobicy_jobs,
    fetch_live_linkedin_jobs,
    fetch_live_remotive_jobs,
)


def fetch_api_jobs(include_remotive: bool = False) -> list[dict]:
    jobs = fetch_live_linkedin_jobs() + fetch_live_jobicy_jobs()
    if include_remotive:
        jobs += fetch_live_remotive_jobs()
    unique_jobs = []
    seen = set()
    for job in jobs:
        key = job.get("url") or (
            job.get("company", "").strip().lower(),
            job.get("title", "").strip().lower(),
        )
        if key not in seen:
            seen.add(key)
            unique_jobs.append(job)
    return unique_jobs
