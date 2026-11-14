"""Recognize entry-level management tracks without admitting senior managers."""
import re


def is_entry_management_title(title: str) -> bool:
    title = (title or "").lower()
    if re.search(r"\b(?:senior|sr\.?|lead|staff|principal|director|head|vp|vice president)\b", title):
        return False
    if re.search(r"\b(?:associate product manager|junior product manager|apm)\b", title):
        return True
    domain = re.search(r"\b(?:data|analytics|ai|ml|machine learning|artificial intelligence)\b", title)
    track = re.search(r"\b(?:manager|management|project|program|product)\b", title)
    entry = re.search(r"\b(?:associate|junior|intern|internship|trainee|graduate|fresher|entry[ -]level|new grad)\b|\bmanager\s+i\b", title)
    return bool(domain and track and entry)


def has_excluded_title(title: str, exclusions) -> bool:
    title = (title or "").lower()
    entry_management = is_entry_management_title(title)
    return any(term in title for term in exclusions if not (term == "manager" and entry_management))
