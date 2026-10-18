from decimal import Decimal
from django.core.management.base import BaseCommand
from users.models import User, UserRole


class Command(BaseCommand):
    help = "Seed initial development users (Agency Manager and Team Member)"

    def handle(self, *args, **options):
        # 1. Manager
        manager_email = "manager@agency.com"
        manager, created = User.objects.get_or_create(
            email=manager_email,
            defaults={
                "first_name": "Sarah",
                "last_name": "Connor",
                "role": UserRole.MANAGER,
                "default_hourly_cost_rate": Decimal("125.0000"),
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if created:
            manager.set_password("ManagerPass123!")
            manager.save()
            self.stdout.write(self.style.SUCCESS(f"Created manager user: {manager_email}"))
        else:
            self.stdout.write(self.style.WARNING(f"Manager user already exists: {manager_email}"))

        # 2. Team Member
        dev_email = "dev@agency.com"
        dev, created = User.objects.get_or_create(
            email=dev_email,
            defaults={
                "first_name": "Alex",
                "last_name": "Mercer",
                "role": UserRole.TEAM_MEMBER,
                "default_hourly_cost_rate": Decimal("65.0000"),
                "is_staff": False,
                "is_superuser": False,
            },
        )
        if created:
            dev.set_password("DevPass123!")
            dev.save()
            self.stdout.write(self.style.SUCCESS(f"Created dev team member: {dev_email}"))
        else:
            self.stdout.write(self.style.WARNING(f"Dev team member already exists: {dev_email}"))

        self.stdout.write(self.style.SUCCESS("Dev user seeding complete."))
