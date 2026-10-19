import uuid
from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError


def uuid_param(request, name):
    """Returns the UUID query parameter `name`, or None if absent. Malformed values raise a 400."""
    value = request.query_params.get(name)
    if not value:
        return None
    try:
        return uuid.UUID(value)
    except ValueError:
        raise ValidationError({name: [f"'{value}' is not a valid UUID."]})


def date_param(request, name):
    """Returns the ISO date (YYYY-MM-DD) query parameter `name`, or None if absent. Malformed values raise a 400."""
    value = request.query_params.get(name)
    if not value:
        return None
    try:
        parsed = parse_date(value)
    except ValueError:
        parsed = None
    if parsed is None:
        raise ValidationError({name: [f"'{value}' is not a valid date. Use YYYY-MM-DD."]})
    return parsed
