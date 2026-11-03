"""Derive listing ages from source dates without assigning fresh dates to old jobs."""

import datetime


def parse_timestamp(value):
    try:
        timestamp = datetime.datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=datetime.timezone.utc)
        return timestamp.astimezone(datetime.timezone.utc)
    except (TypeError, ValueError):
        return None


def dated_jobs(jobs, now=None, max_hours=120):
    now = now or datetime.datetime.now(datetime.timezone.utc)
    result = []
    for original in jobs:
        posted = parse_timestamp(original.get('posted_at'))
        if posted is None:
            continue
        hours = (now - posted).total_seconds() / 3600
        if hours < 0 or (max_hours is not None and hours > max_hours):
            continue
        job = dict(original, hours_ago=round(hours, 4))
        if hours < 1:
            job['relative_time'] = f'{max(1, int(hours * 60))} minutes ago'
        elif hours < 24:
            job['relative_time'] = f'{int(hours)} hours ago'
        else:
            job['relative_time'] = f'{int(hours / 24)} days ago'
        result.append(job)
    return sorted(result, key=lambda job: job['hours_ago'])
