from rest_framework import status
from rest_framework.exceptions import APIException, NotFound, PermissionDenied, ValidationError
from rest_framework.views import exception_handler
from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from django.utils.translation import gettext_lazy as _


VALIDATION_MESSAGE = _("The submitted payload contains one or more invalid attributes.")


class BusinessRuleViolation(APIException):
    """
    A well-formed request that breaks a domain rule (e.g. re-reviewing or deleting a reviewed expense).
    Follows docs/api-specification.md §6.2 (422 Unprocessable Entity).
    """

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_detail = _("The request violates a business rule.")
    default_code = "business_rule_violation"


def _flatten_details(data, field=None):
    """
    Flattens DRF error data into [{"field": ..., "issue": ...}] entries.
    Nested serializer errors are joined with dots (e.g. "client.name"); non-field errors have field None.
    """
    if isinstance(data, dict):
        details = []
        for key, value in data.items():
            if key in ("non_field_errors", "detail"):
                child = field
            else:
                child = f"{field}.{key}" if field else str(key)
            details.extend(_flatten_details(value, child))
        return details
    if isinstance(data, list):
        details = []
        for item in data:
            details.extend(_flatten_details(item, field))
        return details
    return [{"field": field, "issue": str(data)}]


def api_exception_handler(exc, context):
    """
    Wraps every DRF error response in the uniform envelope from docs/api-specification.md §1.4:
    {"error": {"code": "...", "message": "...", "details": [{"field": ..., "issue": ...}]}}
    """
    # Normalize Django's exceptions up front so they carry DRF error codes
    if isinstance(exc, Http404):
        exc = NotFound()
    elif isinstance(exc, DjangoPermissionDenied):
        exc = PermissionDenied()

    response = exception_handler(exc, context)
    if response is None:
        return None

    if isinstance(exc, ValidationError):
        code = "VALIDATION_ERROR"
        message = str(VALIDATION_MESSAGE)
        details = _flatten_details(response.data)
    else:
        code = str(getattr(exc, "default_code", "error")).upper()
        data = response.data
        # SimpleJWT token errors carry {"detail", "code", "messages"}; plain DRF errors carry {"detail"}
        if isinstance(data, dict) and "detail" in data:
            message = str(data["detail"])
            if data.get("code"):
                code = str(data["code"]).upper()
        else:
            message = str(getattr(exc, "detail", exc))
        details = []

    response.data = {"error": {"code": code, "message": message, "details": details}}
    return response
