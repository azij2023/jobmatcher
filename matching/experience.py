import re


_EXPERIENCE_REQUIREMENT = re.compile(
    r"\b(?P<lower>\d{1,2})\s*(?:\+|plus)?"
    r"(?:\s*(?:-|–|to)\s*(?P<upper>\d{1,2}))?\s*"
    r"(?:years?|yrs?)\b\s*(?:(?:of\s+)?|['’]\s*)"
    r"(?:(?:relevant|work|professional)\s+)?(?:experience|exp)\b",
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


def exceeds_experience_cap(text: str, max_years: int) -> bool:
    """Check whether any explicit experience requirement exceeds the configured cap."""
    return any(upper > max_years for _, upper in experience_requirement_ranges(text))
