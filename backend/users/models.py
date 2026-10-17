import uuid
from decimal import Decimal
from django.db import models
from django.contrib.auth.models import (
    AbstractBaseUser,
    PermissionsMixin,
    BaseUserManager,
)
from django.core.validators import MinValueValidator
from django.utils.translation import gettext_lazy as _


class UserRole(models.TextChoices):
    AGENCY_MANAGER = "AGENCY_MANAGER", _("Agency Manager")
    TEAM_MEMBER = "TEAM_MEMBER", _("Team Member")


class CustomUserManager(BaseUserManager):
    """
    Custom manager for MarginWatch User model where email is the unique identifier
    for authentication instead of a username.
    """

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError(_("An email address must be provided."))
        email = self.normalize_email(email).lower()
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("role", UserRole.TEAM_MEMBER)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", UserRole.AGENCY_MANAGER)

        if extra_fields.get("is_staff") is not True:
            raise ValueError(_("Superuser must have is_staff=True."))
        if extra_fields.get("is_superuser") is not True:
            raise ValueError(_("Superuser must have is_superuser=True."))

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    MarginWatch Custom User representing agency staff members (Agency Managers and Team Members).
    Follows docs/data-model.md §3.1 specification.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(
        _("email address"),
        max_length=254,
        unique=True,
        db_index=True,
        error_messages={
            "unique": _("A user with this email address already exists."),
        },
    )
    first_name = models.CharField(_("first name"), max_length=100)
    last_name = models.CharField(_("last name"), max_length=100)
    role = models.CharField(
        _("role"),
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.TEAM_MEMBER,
        db_index=True,
    )
    default_hourly_cost_rate = models.DecimalField(
        _("default hourly cost rate"),
        max_digits=10,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
        help_text=_("The user's internal hourly cost to the agency (wages + overhead)."),
    )
    is_active = models.BooleanField(
        _("active"),
        default=True,
        help_text=_(
            "Designates whether this user should be treated as active. "
            "Unselect this instead of deleting accounts to preserve relational audit history."
        ),
    )
    is_staff = models.BooleanField(
        _("staff status"),
        default=False,
        help_text=_("Designates whether the user can log into this admin site."),
    )
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    objects = CustomUserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    class Meta:
        verbose_name = _("user")
        verbose_name_plural = _("users")
        ordering = ["email"]

    def __str__(self):
        full_name = self.get_full_name()
        return f"{self.email} ({full_name or self.role})"

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def get_short_name(self):
        return self.first_name

    @property
    def is_manager(self):
        return self.role == UserRole.AGENCY_MANAGER
