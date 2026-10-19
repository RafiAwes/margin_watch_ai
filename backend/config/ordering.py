from rest_framework.filters import OrderingFilter


class StableOrderingFilter(OrderingFilter):
    """
    OrderingFilter that always ends with the primary key as a tie-breaker.

    Without it, rows that share the sort value (same work_date, or the same created_at from a
    bulk insert) have no defined order, so the database may return a row on two pages and skip
    another while a client pages through a list (DEC-008).
    """

    def get_ordering(self, request, queryset, view):
        ordering = list(super().get_ordering(request, queryset, view) or [])
        if not any(field.lstrip("-") in ("pk", "id") for field in ordering):
            ordering.append("-pk" if ordering and ordering[0].startswith("-") else "pk")
        return ordering
