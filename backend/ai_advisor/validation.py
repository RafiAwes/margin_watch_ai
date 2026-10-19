"""
Validation of the model's reply (docs/ai-risk-advisor.md §3) and the grounding check
(plan D3): every money figure, percentage or hour count quoted in the reply must exist in the
context the model was given.
"""

import json
import re
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from ai_advisor.prompts import OUTPUT_SCHEMA

MAX_SUMMARY_CHARS = 600
MAX_ITEM_CHARS = 400
LIST_LIMITS = {
    "primary_risk_drivers": (1, 3),
    "actionable_recommendations": (2, 4),
    "data_gaps_and_assumptions": (0, 4),
}
# Small integers are used for counts and ordinals ("2 pending expenses", "rule 3")
IGNORED_SMALL_INTEGERS = 10

# A number not glued to letters/digits: 1,234.56 / $1,234 / 81.67% / -500
NUMBER_PATTERN = re.compile(r"(?<![\w.])-?\$?\d[\d,]*(?:\.\d+)?%?(?![\w])")


class InvalidAdvice(Exception):
    """The reply could not be parsed, broke the schema, or quoted unverified figures."""


def _to_decimal(token: str):
    cleaned = token.replace("$", "").replace(",", "").replace("%", "").strip()
    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return None


def _numbers_in(text: str):
    for match in NUMBER_PATTERN.finditer(text):
        value = _to_decimal(match.group())
        if value is not None:
            yield match.group(), value


def allowed_numbers(context: dict) -> set:
    """Every numeric value in the context, plus its common display forms and a few safe derivations."""
    base = set()

    def collect(value):
        if isinstance(value, bool) or value is None:
            return
        if isinstance(value, int):
            base.add(Decimal(value))
        elif isinstance(value, str):
            direct = _to_decimal(value)
            if direct is not None:
                base.add(direct)
            for _, number in _numbers_in(value):  # figures inside reasons/assumptions
                base.add(number)
        elif isinstance(value, (list, tuple)):
            for item in value:
                collect(item)

    for value in context.values():
        collect(value)

    def num(key):
        value = context.get(key)
        return _to_decimal(value) if isinstance(value, str) else None

    derived = set()
    budget, actual = num("planned_cost_budget"), num("actual_total_cost")
    if budget is not None and actual is not None:
        derived.add(budget - actual)  # remaining budget
    for pct_key in ("budget_consumption_percentage", "warning_threshold_percentage"):
        pct = num(pct_key)
        if pct is not None:
            derived.add(Decimal("100") - pct)  # remaining buffer

    allowed = set()
    for value in base | derived:
        for candidate in (value, abs(value)):
            allowed.add(candidate)
            allowed.add(candidate.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
            allowed.add(candidate.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))
    return allowed


def unverified_numbers(advice: dict, context: dict) -> list:
    allowed = allowed_numbers(context)
    texts = [advice["executive_summary"], *advice["primary_risk_drivers"],
             *advice["actionable_recommendations"], *advice["data_gaps_and_assumptions"]]
    unverified = []
    for text in texts:
        for token, value in _numbers_in(text):
            if abs(value) <= IGNORED_SMALL_INTEGERS and value == value.to_integral_value():
                continue
            if value not in allowed and abs(value) not in allowed:
                unverified.append(token)
    return unverified


def parse_and_validate(raw_text: str, context: dict) -> dict:
    """Returns the cleaned advice dict, or raises InvalidAdvice."""
    try:
        data = json.loads(raw_text)
    except (TypeError, ValueError) as exc:
        raise InvalidAdvice(f"Reply is not valid JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise InvalidAdvice("Reply is not a JSON object.")

    expected = set(OUTPUT_SCHEMA["required"])
    if set(data) != expected:
        raise InvalidAdvice(
            f"Reply keys {sorted(data)} do not match the schema {sorted(expected)}."
        )

    summary = data["executive_summary"]
    if not isinstance(summary, str) or not summary.strip():
        raise InvalidAdvice("executive_summary must be a non-empty string.")
    if len(summary) > MAX_SUMMARY_CHARS:
        raise InvalidAdvice("executive_summary is too long.")

    advice = {"executive_summary": summary.strip()}
    for key, (low, high) in LIST_LIMITS.items():
        items = data[key]
        if not isinstance(items, list) or not all(isinstance(i, str) and i.strip() for i in items):
            raise InvalidAdvice(f"{key} must be a list of non-empty strings.")
        if not low <= len(items) <= high:
            raise InvalidAdvice(f"{key} must contain {low}–{high} items, got {len(items)}.")
        if any(len(i) > MAX_ITEM_CHARS for i in items):
            raise InvalidAdvice(f"{key} contains an item that is too long.")
        advice[key] = [i.strip() for i in items]

    unverified = unverified_numbers(advice, context)
    if unverified:
        raise InvalidAdvice(
            f"Reply quotes figures that are not in the project context: {', '.join(unverified[:5])}."
        )
    return advice
