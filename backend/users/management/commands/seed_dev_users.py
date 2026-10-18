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

        # 3. Seed Frontend Demo Users (for direct frontend integration)
        frontend_demo_users = [
            {
                "email": "alex.morgan@vanguard-agency.io",
                "password": "Manager123!",
                "first_name": "Alex",
                "last_name": "Morgan",
                "role": UserRole.MANAGER,
                "rate": Decimal("135.0000"),
                "is_staff": True,
                "is_superuser": True,
            },
            {
                "email": "elena.rostova@vanguard-agency.io",
                "password": "Member123!",
                "first_name": "Elena",
                "last_name": "Rostova",
                "role": UserRole.TEAM_MEMBER,
                "rate": Decimal("115.0000"),
                "is_staff": False,
                "is_superuser": False,
            },
            {
                "email": "marcus.chen@vanguard-agency.io",
                "password": "Member123!",
                "first_name": "Marcus",
                "last_name": "Chen",
                "role": UserRole.TEAM_MEMBER,
                "rate": Decimal("125.0000"),
                "is_staff": False,
                "is_superuser": False,
            },
            {
                "email": "priya.nair@vanguard-agency.io",
                "password": "Member123!",
                "first_name": "Priya",
                "last_name": "Nair",
                "role": UserRole.TEAM_MEMBER,
                "rate": Decimal("110.0000"),
                "is_staff": False,
                "is_superuser": False,
            },
        ]

        for u_data in frontend_demo_users:
            email = u_data["email"]
            u, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "first_name": u_data["first_name"],
                    "last_name": u_data["last_name"],
                    "role": u_data["role"],
                    "default_hourly_cost_rate": u_data["rate"],
                    "is_staff": u_data["is_staff"],
                    "is_superuser": u_data["is_superuser"],
                },
            )
            if created:
                u.set_password(u_data["password"])
                u.save()
                self.stdout.write(self.style.SUCCESS(f"Created demo user: {email}"))
            else:
                self.stdout.write(self.style.WARNING(f"Demo user already exists: {email}"))

        self.stdout.write(self.style.SUCCESS("Dev user seeding complete."))
