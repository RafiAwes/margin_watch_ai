import uuid
from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _


class ProjectStatus(models.TextChoices):
    PLANNING = "PLANNING", _("Planning")
    ACTIVE = "ACTIVE", _("Active")
    ON_HOLD = "ON_HOLD", _("On Hold")
    COMPLETED = "COMPLETED", _("Completed")
    CANCELLED = "CANCELLED", _("Cancelled")


class Project(models.Model):
    """
    Core delivery monitoring entity containing commercial contract baselines,
    cost ceilings, labor estimation rates, remaining scope estimates, and delivery lifecycle states.
    Follows docs/backend/backend-apps-and-data-models.md §3.3.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(
        "clients.Client",
        on_delete=models.PROTECT,
        related_name="projects",
        verbose_name=_("commercial client"),
        help_text=_("The commercial client funding this project. Protected against deletion."),
    )
    name = models.CharField(
        _("project name"),
        max_length=200,
        db_index=True,
    )
    description = models.TextField(
        _("project description"),
        null=True,
        blank=True,
        help_text=_("Delivery scope summary, key milestones, and deliverables."),
    )
    contract_revenue = models.DecimalField(
        _("contract revenue cap"),
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text=_("Total fixed-price commercial revenue contract value from client."),
    )
    planned_cost_budget = models.DecimalField(
        _("planned cost budget"),
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text=_("Strictly positive internal delivery cost ceiling (B) allocated by agency."),
    )
    planned_hourly_cost = models.DecimalField(
        _("planned hourly labor cost"),
        max_digits=10,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        help_text=_(
            "Blended hourly direct labor rate used to value estimated remaining hours."
        ),
    )
    currency = models.CharField(
        _("currency"),
        max_length=3,
        default="USD",
        help_text=_("ISO 4217 uppercase 3-letter currency code (e.g. USD, EUR, GBP)."),
    )
    estimated_remaining_hours = models.DecimalField(
        _("estimated remaining hours"),
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text=_(
            "Estimated hours to complete remaining scope. "
            "NULL means estimate is unknown (suppresses forecast, triggers INSUFFICIENT_DATA). "
            "0.00 explicitly means 100% of delivery is complete."
        ),
    )
    expected_remaining_expenses = models.DecimalField(
        _("expected remaining expenses"),
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text=_("Forecasted future direct expenses. Excluded from actual incurred costs."),
    )
    status = models.CharField(
        _("project status"),
        max_length=20,
        choices=ProjectStatus.choices,
        default=ProjectStatus.PLANNING,
        db_index=True,
    )
    start_date = models.DateField(
        _("scheduled start date"),
        null=True,
        blank=True,
    )
    deadline = models.DateField(
        _("target deadline"),
        null=True,
        blank=True,
    )
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_projects",
        verbose_name=_("created by"),
    )
    is_archived = models.BooleanField(
        _("is archived"),
        default=False,
        db_index=True,
        help_text=_("Soft-archiving flag. Excluded from default active lists."),
    )
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        verbose_name = _("project")
        verbose_name_plural = _("projects")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.client.name})"

    def clean(self):
        super().clean()
        if self.start_date and self.deadline and self.deadline < self.start_date:
            raise ValidationError(
                {"deadline": _("Project deadline cannot be earlier than its start date.")}
            )

    @property
    def planned_hourly_cost_rate(self):
        """Compatibility alias for planned_hourly_cost."""
        return self.planned_hourly_cost

    @planned_hourly_cost_rate.setter
    def planned_hourly_cost_rate(self, value):
        self.planned_hourly_cost = value


class ProjectAssignment(models.Model):
    """
    Connects eligible team members to projects, establishing the authoritative
    object-level access control boundary.
    Follows docs/backend/backend-apps-and-data-models.md §3.4.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="assignments",
        verbose_name=_("project"),
    )
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="project_assignments",
        verbose_name=_("assigned staff member"),
    )
    assigned_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="delegated_assignments",
        verbose_name=_("assigned by"),
    )
    assigned_at = models.DateTimeField(_("assigned at"), auto_now_add=True)
    is_active = models.BooleanField(
        _("is active"),
        default=True,
        db_index=True,
        help_text=_("If False, member access is revoked while preserving audit logs."),
    )

    class Meta:
        verbose_name = _("project assignment")
        verbose_name_plural = _("project assignments")
        ordering = ["-assigned_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "user"],
                name="unique_project_user_assignment",
            )
        ]

    def __str__(self):
        status = "Active" if self.is_active else "Revoked"
        return f"{self.user.email} -> {self.project.name} [{status}]"
