"""
AI Risk Advisor orchestration: Phase 6 summary → sanitized context → Gemini → validated advice.

Read-only by construction: nothing here writes to the database. Results are cached by a hash of
the sanitized context and model (plan D4), so identical figures never trigger a second paid call,
while any change to the figures produces a fresh analysis.
"""

import hashlib
import json
import logging
from dataclasses import dataclass

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from ai_advisor import validation
from ai_advisor.client import AdvisorResponseInvalid, GeminiClient
from ai_advisor.context import build_context
from ai_advisor.prompts import OUTPUT_SCHEMA, SYSTEM_PROMPT, user_message
from profitability.selectors import summarize_projects

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AdvisorResult:
    project_id: str
    deterministic_status: str
    advice: dict
    generated_at: str
    model: str
    cached: bool


def get_client() -> GeminiClient:
    """Factory (patched in tests). Raises AdvisorNotConfigured when no API key is set."""
    return GeminiClient(
        api_key=settings.GEMINI_API_KEY,
        model=settings.GEMINI_MODEL,
        timeout_seconds=settings.GEMINI_TIMEOUT_SECONDS,
    )


def cache_key(context: dict, model: str) -> str:
    digest = hashlib.sha256(
        json.dumps({"model": model, "context": context}, sort_keys=True).encode("utf-8")
    ).hexdigest()
    return f"ai_advisor:{digest}"


def advise(context: dict, client: GeminiClient) -> dict:
    """One model call + validation. Raises Advisor* API errors on any failure."""
    raw = client.generate(
        system_prompt=SYSTEM_PROMPT,
        user_message=user_message(context),
        response_schema=OUTPUT_SCHEMA,
    )
    try:
        return validation.parse_and_validate(raw, context)
    except validation.InvalidAdvice as exc:
        logger.warning("Rejected AI advice for %s: %s", context.get("project_code"), exc)
        raise AdvisorResponseInvalid() from exc


def analyze_project(project) -> AdvisorResult:
    [(project, summary)] = summarize_projects([project])
    context = build_context(project, summary)
    model = settings.GEMINI_MODEL
    key = cache_key(context, model)

    hit = cache.get(key)
    if hit is not None:
        return AdvisorResult(**{**hit, "cached": True})

    advice = advise(context, get_client())
    result = {
        "project_id": str(project.id),
        "deterministic_status": summary.risk.status,
        "advice": advice,
        "generated_at": timezone.now().isoformat().replace("+00:00", "Z"),
        "model": model,
        "cached": False,
    }
    cache.set(key, result, settings.MARGINWATCH_AI_CACHE_SECONDS)
    return AdvisorResult(**result)
