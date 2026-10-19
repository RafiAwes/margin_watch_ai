import uuid
from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _


class ExpenseCategory(models.TextChoices):
    SUBCONTRACTOR = "SUBCONTRACTOR", _("Subcontractor")
    SOFTWARE_LICENSE = "SOFTWARE_LICENSE", _("Software License")
    HARDWARE = "HARDWARE", _("Hardware")
    TRAVEL = "TRAVEL", _("Travel")
    OTHER = "OTHER", _("Other")


class ExpenseStatus(models.TextChoices):
    PENDING = "PENDING", _("Pending")
    APPROVED = "APPROVED", _("Approved")
    REJECTED = "REJECTED", _("Rejected")


class Expense(models.Model):
    """
    Records direct project expenditures (subcontractors, software licenses, travel, materials).
    Governed by an explicit review workflow (Pending -> Approved / Rejected).
    Follows docs/data-model.md §3.6 and docs/financial-rules.md §3.1.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.PROTECT,
        related_name="expenses",
        verbose_name=_("project"),
        help_text=_("The delivery project bearing this expenditure. Protected against deletion."),
    )
    user = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        related_name="expenses",
        verbose_name=_("submitted by"),
        help_text=_("The staff member who incurred or submitted this expense. Protected against deletion."),
    )
    category = models.CharField(
        _("expense category"),
        max_length=30,
        choices=ExpenseCategory.choices,
        db_index=True,
    )
    amount = models.DecimalField(
        _("expense amount"),
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text=_("Expenditure amount in project currency. Must be strictly positive."),
    )
    description = models.CharField(
        _("description"),
        max_length=500,
        help_text=_("Purpose and business context of expenditure."),
    )
    expense_date = models.DateField(
        _("expense date"),
        help_text=_("Date expenditure was incurred."),
    )
    status = models.CharField(
        _("review status"),
        max_length=20,
        choices=ExpenseStatus.choices,
        default=ExpenseStatus.PENDING,
        db_index=True,
    )
    reviewed_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_expenses",
        verbose_name=_("reviewed by"),
        help_text=_("The manager who reviewed (approved or rejected) this expense."),
    )
    reviewed_at = models.DateTimeField(
        _("reviewed at"),
        null=True,
        blank=True,
        help_text=_("Timestamp when expense was approved or rejected."),
    )
    review_note = models.TextField(
        _("review note"),
        null=True,
        blank=True,
        help_text=_("Review commentary. Mandatory when an expense is rejected."),
    )
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        verbose_name = _("expense")
        verbose_name_plural = _("expenses")
        ordering = ["-expense_date", "-created_at"]
        indexes = [
            models.Index(fields=["project", "status"]),
            models.Index(fields=["user", "status"]),
        ]

    def __str__(self):
        return f"{self.project.name} - {self.category} ({self.amount}) [{self.status}]"

    def clean(self):
        super().clean()
        if self.amount is not None and self.amount <= Decimal("0.00"):
            raise ValidationError({"amount": _("Expense amount must be strictly greater than 0.00.")})

        # Mandatory rejection note validation (BR-INT-09)
        if self.status == ExpenseStatus.REJECTED and not (self.review_note and self.review_note.strip()):
            raise ValidationError(
                {"review_note": _("A non-empty review note is mandatory when rejecting an expense.")}
            )

        # Financial immutability: approved or rejected expenses cannot have amount, category, or project altered
        if not self._state.adding and self.pk:
            try:
                original = Expense.objects.get(pk=self.pk)
                if original.status in [ExpenseStatus.APPROVED, ExpenseStatus.REJECTED]:
                    if (
                        original.amount != self.amount
                        or original.category != self.category
                        or original.project_id != self.project_id
                    ):
                        raise ValidationError(
                            _("Core financial attributes (amount, category, project) cannot be modified on an already reviewed expense.")
                        )
            except Expense.DoesNotExist:
                pass

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
