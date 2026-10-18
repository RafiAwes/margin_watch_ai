import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _


class Client(models.Model):
    """
    Represents a commercial customer or organization contracting the software agency
    for project delivery. Follows docs/backend/backend-apps-and-data-models.md §3.2.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(
        _("client name"),
        max_length=200,
        unique=True,
        db_index=True,
        error_messages={
            "unique": _("A client with this name already exists."),
        },
    )
    contact_name = models.CharField(
        _("contact name"),
        max_length=150,
        null=True,
        blank=True,
    )
    contact_email = models.EmailField(
        _("contact email"),
        max_length=254,
        null=True,
        blank=True,
    )
    contact_phone = models.CharField(
        _("contact phone"),
        max_length=50,
        null=True,
        blank=True,
    )
    notes = models.TextField(
        _("internal notes"),
        null=True,
        blank=True,
        help_text=_("Internal agency account notes and contract history."),
    )
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_clients",
        verbose_name=_("created by"),
    )
    is_archived = models.BooleanField(
        _("is archived"),
        default=False,
        db_index=True,
        help_text=_(
            "Designates whether this client is archived. Deletion is blocked if projects exist."
        ),
    )
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        verbose_name = _("client")
        verbose_name_plural = _("clients")
        ordering = ["name"]

    def __str__(self):
        return self.name
