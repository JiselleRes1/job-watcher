"""Title rule: is a posting in my role (financial analyst or a close equivalent)?

A title is in role when
  1. it names a finance function together with "analyst" (or is an FP&A title), and
  2. it is not a leadership title (director, VP, head of, chief), an intern/co-op
     posting, or an adviser/advisor/planner-of-clients type title.
"""
import re

FINANCE_WORDS = (
    r"financ\w*|fp\s*&\s*a|fp\s*and\s*a|fpa|cost|pricing|revenue|treasury|credit|"
    r"investment|budget\w*|controll\w*|accounting|valuation|underwriting"
)

# "financial analyst", "senior analyst, finance", "FP&A manager" style titles
_ANALYST_NEAR_FINANCE = re.compile(
    rf"\b({FINANCE_WORDS})\b[^,;]{{0,40}}\banalyst\b|\banalyst\b[^;]{{0,40}}\b({FINANCE_WORDS})\b",
    re.IGNORECASE,
)
_FPA = re.compile(r"\bfp\s*&\s*a\b|\bfp\s*and\s*a\b|\bfpa\b", re.IGNORECASE)

_EXCLUDE = re.compile(
    r"\b(director|vice president|vp|head of|chief|intern|internship|co-?op|"
    r"advisor|adviser|attorney|counsel)\b",
    re.IGNORECASE,
)


def is_in_role(title):
    """Return True when `title` matches the financial-analyst role."""
    if not title:
        return False
    if _EXCLUDE.search(title):
        return False
    return bool(_ANALYST_NEAR_FINANCE.search(title) or _FPA.search(title))
