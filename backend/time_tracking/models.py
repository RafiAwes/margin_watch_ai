import uuid
from datetime import timedelta
from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class TimeEntry(models.Model):
    """
    Records individual labor durations logged against an authorized project.
    Captures an immutable snapshot of the user's hourly cost rate at creation time.
    Follows docs/data-model.md §3.5 and docs/financial-rules.md §2.1.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.PROTECT,
        related_name="time_entries",
        verbose_name=_("project"),
        help_text=_("The delivery project incurring this labor cost. Protected against deletion."),
    )
    user = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        related_name="time_entries",
        verbose_name=_("staff member"),
        help_text=_("The staff member performing the work. Protected against deletion."),
    )
    work_date = models.DateField(
        _("work date"),
        help_text=_("Calendar date work occurred. Cannot be more than 1 day in the future."),
    )
    recorded_hours = models.DecimalField(
        _("recorded hours"),
        max_digits=5,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.01")),
            MaxValueValidator(Decimal("24.00")),
        ],
        help_text=_("Labor duration in decimal hours (0.01 to 24.00)."),
    )
    hourly_cost_snapshot = models.DecimalField(
        _("hourly cost snapshot"),
        max_digits=10,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
        help_text=_(
            "Internal hourly cost rate captured permanently at creation. "
            "Immutable: subsequent changes to user's default rate do not affect this record."
        ),
    )
    description = models.CharField(
        _("description"),
        max_length=500,
        help_text=_("Summary of work completed."),
    )
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        verbose_name = _("time entry")
        verbose_name_plural = _("time entries")
        ordering = ["-work_date", "-created_at"]
        indexes = [
            models.Index(fields=["project", "work_date"]),
            models.Index(fields=["user", "work_date"]),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.project.name} ({self.recorded_hours}h on {self.work_date})"

    def clean(self):
        super().clean()
        if self.recorded_hours is not None:
            if self.recorded_hours <= Decimal("0.00"):
                raise ValidationError(
                    {"recorded_hours": _("Recorded hours must be strictly greater than 0.00.")}
                )
            if self.recorded_hours > Decimal("24.00"):
                raise ValidationError(
                    {"recorded_hours": _("Recorded hours cannot exceed 24.00 hours per entry.")}
                )

        if self.work_date:
            max_future = timezone.now().date() + timedelta(days=1)
            if self.work_date > max_future:
                raise ValidationError(
                    {"work_date": _("Work date cannot be more than 1 day in the future.")}
                )

    def save(self, *args, **kwargs):
        is_new = self._state.adding or not self.pk or not TimeEntry.objects.filter(pk=self.pk).exists()
        if is_new:
            # Populate hourly cost snapshot from user rate if not explicitly set
            if (not self.hourly_cost_snapshot or self.hourly_cost_snapshot == Decimal("0.0000")) and self.user_id:
                self.hourly_cost_snapshot = self.user.default_hourly_cost_rate
        else:
            # Enforce rate snapshot immutability on updates
            original = TimeEntry.objects.only("hourly_cost_snapshot").get(pk=self.pk)
            self.hourly_cost_snapshot = original.hourly_cost_snapshot

        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def computed_cost(self):
        """
        Authoritative calculated labor cost: recorded_hours * hourly_cost_snapshot.
        """
        hours = self.recorded_hours or Decimal("0.00")
        rate = self.hourly_cost_snapshot or Decimal("0.0000")
        return (hours * rate).quantize(Decimal("0.01"))
