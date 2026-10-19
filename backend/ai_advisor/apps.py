from django.apps import AppConfig


class AiAdvisorConfig(AppConfig):
    """
    Server-side Gemini risk advisor. Read-only and advisory: explains the deterministic
    financial summary, never calculates or changes it. Defines no models.
    Follows docs/ai-risk-advisor.md and docs/plans/phase-08-ai-risk-advisor-plan.md.
    """

    default_auto_field = "django.db.models.BigAutoField"
    name = "ai_advisor"
