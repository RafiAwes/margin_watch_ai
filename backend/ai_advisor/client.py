"""
Thin wrapper around the Google GenAI SDK (google-genai 2.x).

Every failure is converted into a typed error carrying its HTTP status and error code
(docs/ai-risk-advisor.md §5), so a provider problem can never surface as a 500 or affect
the deterministic financial endpoints.
"""

import logging

from django.utils.translation import gettext_lazy as _
from rest_framework import status
from rest_framework.exceptions import APIException

logger = logging.getLogger(__name__)

STILL_VALID = " Deterministic financials remain valid."


class AdvisorError(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE


class AdvisorNotConfigured(AdvisorError):
    default_code = "ai_not_configured"
    default_detail = _("AI advisor is not configured on this server." + STILL_VALID)


class AdvisorTimeout(AdvisorError):
    default_code = "ai_timeout"
    default_detail = _("AI advisory timed out." + STILL_VALID)


class AdvisorQuotaExceeded(AdvisorError):
    default_code = "ai_quota_exceeded"
    default_detail = _("AI quota reached. Please try again shortly." + STILL_VALID)


class AdvisorUnavailable(AdvisorError):
    default_code = "ai_unavailable"
    default_detail = _("AI advisor is temporarily unavailable." + STILL_VALID)


class AdvisorResponseInvalid(AdvisorError):
    status_code = status.HTTP_502_BAD_GATEWAY
    default_code = "ai_response_invalid"
    default_detail = _("AI response could not be validated." + STILL_VALID)


class GeminiClient:
    """Calls Gemini once (no retries) within `timeout_seconds` and returns the raw JSON text."""

    def __init__(self, *, api_key: str, model: str, timeout_seconds: int):
        if not api_key:
            raise AdvisorNotConfigured()
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = timeout_seconds

    def generate(self, *, system_prompt: str, user_message: str, response_schema: dict) -> str:
        import httpx
        from google import genai
        from google.genai import errors, types

        try:
            client = genai.Client(
                api_key=self.api_key,
                # HttpOptions.timeout is in milliseconds; retry_options unset = never retry
                http_options=types.HttpOptions(timeout=self.timeout_seconds * 1000),
            )
            response = client.models.generate_content(
                model=self.model,
                contents=user_message,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    response_mime_type="application/json",
                    response_json_schema=response_schema,
                    temperature=0.2,
                    max_output_tokens=4096,
                ),
            )
        except httpx.TimeoutException as exc:
            logger.warning("Gemini request timed out after %ss: %s", self.timeout_seconds, exc)
            raise AdvisorTimeout() from exc
        except errors.APIError as exc:
            logger.warning("Gemini API error %s: %s", exc.code, exc)
            if exc.code == 429:
                raise AdvisorQuotaExceeded() from exc
            if exc.code in (400, 401, 403, 404):
                raise AdvisorUnavailable(
                    _(
                        "AI provider rejected the request (check GEMINI_API_KEY and GEMINI_MODEL)."
                        + STILL_VALID
                    )
                ) from exc
            raise AdvisorUnavailable() from exc
        except Exception as exc:  # network failures or SDK errors must never become a 500
            logger.warning("Gemini request failed: %r", exc)
            raise AdvisorUnavailable() from exc

        text = getattr(response, "text", None)
        if not text:
            # e.g. the reply was blocked or cut off before any JSON was produced
            raise AdvisorResponseInvalid(_("AI returned an empty response." + STILL_VALID))
        return text
