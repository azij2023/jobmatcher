import re

DEFAULT_MAX_EXPERIENCE_YEARS = 2


_EXPERIENCE_REQUIREMENT = re.compile(
    r"\b(?P<lower>\d{1,2})\s*(?:\+|plus)?"
    r"(?:\s*(?:-|–|to)\s*(?P<upper>\d{1,2}))?\s*"
    r"(?:years?|yrs?)\b\s*(?:(?:of\s+)?|['’]\s*)"
    r"(?:(?:relevant|work|professional)\s+)?(?:experience|exp)\b",
    re.IGNORECASE,
)

_FRESHER_SIGNAL = re.compile(
    r"\b(?:fresher|freshers|intern|internship|trainee|apprentice|apprenticeship|"
    r"campus|fresh\s+graduates?|new\s+grad(?:uate)?s?|graduate\s+trainee|entry[- _]level|early[- _]career)\b"
    r"|\b(?:no|zero)\s+(?:prior\s+)?experience\b|\bzero\s+years?\b"
    r"|\b0\s*(?:(?:-|–|to)\s*\d+\s*)?(?:years?|yrs?)\b",
    re.IGNORECASE,
)

_ZERO_EXPERIENCE_SIGNAL = re.compile(
    r"\b(?:no|zero)\s+(?:prior\s+)?experience\b|\bzero\s+years?\b|"
    r"\b0\s*(?:years?|yrs?)\b",
    re.IGNORECASE,
)


def experience_requirement_ranges(text: str) -> list[tuple[int, int]]:
    """Return explicit experience requirements as inclusive lower/upper year ranges."""
    ranges = []
    for match in _EXPERIENCE_REQUIREMENT.finditer(text or ""):
        lower = int(match.group("lower"))
        upper = int(match.group("upper") or lower)
        ranges.append((lower, upper))
    return ranges


def has_explicit_fresher_signal(text: str) -> bool:
    """Return whether text explicitly indicates fresher or zero-experience eligibility."""
    return bool(_FRESHER_SIGNAL.search(text or ""))


def has_explicit_zero_experience_signal(text: str) -> bool:
    """Return whether a posting explicitly allows zero years of experience."""
    return bool(_ZERO_EXPERIENCE_SIGNAL.search(text or "")) or any(
        lower == 0 for lower, _ in experience_requirement_ranges(text)
    )


def exceeds_experience_cap(text: str, max_years: int) -> bool:
    """Check whether any explicit experience requirement exceeds the configured cap."""
    return any(upper > max_years for _, upper in experience_requirement_ranges(text))


def meets_fresher_experience_rule(
    text: str,
    max_years: int = DEFAULT_MAX_EXPERIENCE_YEARS,
    min_years_experience: int | None = None,
) -> bool:
    """Require a fresher signal, explicit zero-year eligibility, and a zero-to-cap range."""
    if not has_explicit_fresher_signal(text):
        return False
    if min_years_experience != 0 and not has_explicit_zero_experience_signal(text):
        return False
    if min_years_experience is not None and min_years_experience > 0:
        return False
    if any(lower > 0 for lower, _ in experience_requirement_ranges(text)):
        return False
    return not exceeds_experience_cap(text, max_years)
