from django.apps import AppConfig


class ProfitabilityConfig(AppConfig):
    """
    Authoritative financial calculations, risk evaluation and dashboard aggregation.
    Pure service and query layer: defines no models.
    Follows docs/backend/backend-apps-and-data-models.md §2 and docs/financial-rules.md.
    """

    default_auto_field = "django.db.models.BigAutoField"
    name = "profitability"
