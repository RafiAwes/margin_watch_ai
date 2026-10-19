"""
Bulk, realistic demo data for a software agency ("Brightloop Studio") so the dashboards, the
financial engine, the AI advisor and performance can be explored with production-like volume.

    python manage.py seed_demo_data                   # medium: ~34 staff, 80 projects, ~16 months
    python manage.py seed_demo_data --scale large     # performance testing volume
    python manage.py seed_demo_data --reset           # replace existing demo data
    python manage.py seed_demo_data --delete          # remove demo data only

Every generated record is tagged so it can be removed without touching real data:
staff emails end with @brightloop-demo.io and client notes start with "[demo-seed]"; projects,
assignments, time entries and expenses belong to those clients/staff. Deterministic for a given
--seed. Demo staff sign in with the password printed at the end.

Budgets are derived from the generated actuals per project "archetype" so the portfolio contains a
realistic mix of healthy, at-risk, over-budget and missing-estimate projects; the deterministic
engine (profitability) still decides every status.
"""

import random
from collections import defaultdict
from datetime import datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal as D

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from clients.models import Client
from expenses.models import Expense, ExpenseCategory, ExpenseStatus
from profitability.selectors import summarize_projects
from projects.models import Project, ProjectAssignment, ProjectStatus
from time_tracking.models import TimeEntry
from users.models import User, UserRole

DEMO_DOMAIN = "@brightloop-demo.io"
DEMO_TAG = "[demo-seed]"
DEMO_PASSWORD = "DemoPass123!"

SCALES = {
    #          managers staff clients projects months
    "tiny": (1, 6, 3, 8, 3),
    "medium": (4, 30, 24, 80, 16),
    "large": (6, 60, 45, 180, 24),
}

FIRST_NAMES = [
    "Ava", "Noah", "Mia", "Liam", "Zoe", "Ethan", "Isla", "Lucas", "Maya", "Owen", "Leah", "Ravi",
    "Nina", "Omar", "Chloe", "Diego", "Hana", "Felix", "Priya", "Jonas", "Sara", "Kenji", "Elena",
    "Tariq", "Lena", "Mateo", "Aisha", "Hugo", "Ingrid", "Samir", "Yara", "Theo", "Freya", "Malik",
    "Clara", "Arjun", "Nora", "Emil", "Sofia", "Kai", "Amara", "Leo", "Iris", "Ronan", "Mei",
    "Victor", "Lucia", "Idris", "Greta", "Ezra", "Talia", "Rafael", "Ines", "Bodhi", "Selin",
    "Marek", "Dalia", "Anton", "Esme", "Joaquin", "Wren", "Haruto", "Odile", "Kofi", "Livia",
]
LAST_NAMES = [
    "Hart", "Okafor", "Lindqvist", "Moreau", "Tanaka", "Reyes", "Novak", "Fischer", "Kaur", "Brennan",
    "Duarte", "Haddad", "Ivanova", "Sato", "Walsh", "Mensah", "Romano", "Berg", "Castillo", "Nguyen",
    "Ali", "Kowalski", "Byrne", "Silva", "Petrov", "Larsen", "Chowdhury", "Ferreira", "Yilmaz", "Park",
]

# (title, low rate, high rate, weight) — internal hourly cost, not billing rate
DISCIPLINES = [
    ("Principal Engineer", 140, 165, 2),
    ("Senior Engineer", 105, 130, 7),
    ("Software Engineer", 80, 98, 8),
    ("Junior Engineer", 50, 66, 4),
    ("Product Designer", 72, 95, 3),
    ("QA Engineer", 56, 72, 3),
    ("DevOps Engineer", 100, 125, 2),
    ("Data Engineer", 95, 118, 2),
]
MANAGER_RATE = (118, 138)

CLIENT_NAMES = [
    "Harborview Health Network", "Northwind Freight Co", "Lumen Financial Partners", "Cobalt Retail Group",
    "Evergreen Insurance Mutual", "Atlas Civic Services", "Meridian Hotels & Resorts", "Sable Energy Grid",
    "Kestrel Aerospace Parts", "Orchard Lane Grocers", "Granite Peak Construction", "Bluebird Learning Labs",
    "Tidewater Port Authority", "Vantage Sports Media", "Juniper Biotech", "Ironclad Security Systems",
    "Willow & Finch Legal", "Polar Logistics Nordic", "Summit Credit Union", "Crescent Telecom",
    "Aurora Museum Trust", "Redwood Property Group", "Silverline Rail", "Beacon Mental Health Alliance",
    "Copperleaf Agritech", "Starboard Marine Supply", "Nimbus Weather Analytics", "Foxglove Fashion House",
    "Trellis Nonprofit Network", "Quarry Mining Analytics", "Halcyon Travel Collective", "Pinnacle Dental Group",
    "Sterling Wealth Advisors", "Driftwood Breweries", "Keystone Public Library", "Monarch Car Rentals",
    "Obsidian Game Studio", "Prairie Wind Utilities", "Riverside City Council", "Saffron Restaurant Group",
    "Tundra Outdoor Gear", "Umbra Film Distribution", "Verdant Waste Solutions", "Wavecrest Telehealth",
    "Zephyr Drone Logistics", "Alder Street Bank", "Briarwood Senior Living", "Cascade Water District",
]
PROJECT_TYPES = [
    ("Customer Portal Rebuild", 900), ("Mobile App v2", 1100), ("Data Warehouse Migration", 800),
    ("Booking Engine Modernization", 1000), ("Internal Analytics Dashboard", 500), ("Payments Integration", 600),
    ("Design System Rollout", 450), ("API Platform Hardening", 700), ("CRM Integration", 550),
    ("E-commerce Replatform", 1300), ("Field Service App", 850), ("Reporting Automation", 400),
    ("Identity & SSO Upgrade", 450), ("Cloud Cost Optimization", 350), ("Accessibility Remediation", 300),
    ("Partner Self-Service Portal", 750), ("IoT Telemetry Pipeline", 950), ("Search Relevance Overhaul", 500),
    ("Legacy Monolith Decomposition", 1400), ("Marketing Site Relaunch", 380),
]
TASKS = {
    "Principal Engineer": ["Architecture review", "Technical design session", "Performance profiling", "Code review and mentoring"],
    "Senior Engineer": ["Feature implementation", "API endpoint development", "Refactoring legacy module", "Code review"],
    "Software Engineer": ["Feature implementation", "Bug fixing", "Unit test coverage", "UI component work"],
    "Junior Engineer": ["Bug fixing", "Test writing", "Pairing session", "Documentation updates"],
    "Product Designer": ["Wireframes", "High-fidelity mockups", "Usability testing", "Design system updates"],
    "QA Engineer": ["Regression testing", "Test plan authoring", "Exploratory testing", "Automation scripts"],
    "DevOps Engineer": ["CI/CD pipeline work", "Infrastructure as code", "Monitoring setup", "Release support"],
    "Data Engineer": ["ETL job development", "Schema design", "Data quality checks", "Query optimization"],
    "Delivery Manager": ["Sprint planning", "Client status meeting", "Scope review", "Stakeholder workshop"],
}
EXPENSES = {
    ExpenseCategory.SOFTWARE_LICENSE: ((40, 900), 5, ["Design tool seats", "Staging database plan", "Monitoring SaaS subscription", "Load testing service", "Map API usage"]),
    ExpenseCategory.HARDWARE: ((150, 2400), 2, ["Test devices", "Barcode scanners for pilot", "Kiosk tablet units", "Network test kit"]),
    ExpenseCategory.SUBCONTRACTOR: ((1200, 9000), 2, ["Penetration test", "Accessibility audit", "Specialist iOS contractor", "Copywriting agency"]),
    ExpenseCategory.TRAVEL: ((120, 1800), 3, ["Client workshop travel", "Onsite go-live support", "Discovery week travel"]),
    ExpenseCategory.OTHER: ((15, 400), 2, ["Workshop catering", "Stock photography", "Courier for hardware", "Printing user guides"]),
}
REJECTION_NOTES = [
    "Not covered by the statement of work.", "Duplicate of an existing claim.",
    "Personal equipment; not billable to the project.", "Missing receipt; resubmit with invoice.",
    "Should be charged to the internal tooling budget.",
]

# Active-project mix in percent (status is still decided by the engine)
ACTIVE_MIX = {"healthy": 45, "forecast_overrun": 14, "consumption_warning": 10, "over_budget": 16, "missing_estimate": 15}
STATUS_MIX = [ProjectStatus.ACTIVE] * 44 + [ProjectStatus.COMPLETED] * 30 + [ProjectStatus.ON_HOLD] * 8 + \
             [ProjectStatus.PLANNING] * 10 + [ProjectStatus.CANCELLED] * 8

MONEY = D("0.01")


def money(value):
    return D(value).quantize(MONEY, rounding=ROUND_HALF_UP)


def round_to(value, step):
    step = D(step)
    return max(step, (D(value) / step).quantize(D("1"), rounding=ROUND_HALF_UP) * step)


def workdays(start, end):
    day = start
    while day <= end:
        if day.weekday() < 5:
            yield day
        day += timedelta(days=1)


class Command(BaseCommand):
    help = "Populate the database with a large, realistic, removable demo agency dataset."

    def add_arguments(self, parser):
        parser.add_argument("--scale", choices=sorted(SCALES), default="medium")
        parser.add_argument("--seed", type=int, default=2026)
        parser.add_argument("--reset", action="store_true", help="Delete existing demo data first.")
        parser.add_argument("--delete", action="store_true", help="Only delete demo data.")

    # Entry
    def handle(self, *args, **options):
        if options["delete"]:
            self.stdout.write(self.delete_demo_data())
            return

        if self.demo_exists():
            if not options["reset"]:
                raise CommandError("Demo data already exists. Use --reset to replace it or --delete to remove it.")
            self.stdout.write(self.delete_demo_data())

        self.rng = random.Random(options["seed"])
        self.today = timezone.now().date()
        managers, staff, clients, projects, months = SCALES[options["scale"]]
        self.history_start = self.today - timedelta(days=int(months * 30.4))

        with transaction.atomic():
            people = self.create_people(managers, staff)
            demo_clients = self.create_clients(clients, people["managers"])
            plans = self.plan_projects(projects, demo_clients, people)
            self.create_projects(plans)
            entries = self.create_time_entries(plans)
            expenses = self.create_expenses(plans)
            self.set_baselines(plans)

        self.report(people, demo_clients, plans, entries, expenses)

    # Tagging/reset
    def demo_users(self):
        return User.objects.filter(email__endswith=DEMO_DOMAIN)

    def demo_projects(self):
        return Project.objects.filter(client__notes__startswith=DEMO_TAG)

    def demo_exists(self):
        return self.demo_users().exists() or Client.objects.filter(notes__startswith=DEMO_TAG).exists()

    def delete_demo_data(self):
        with transaction.atomic():
            projects = self.demo_projects()
            users = self.demo_users()
            counts = {
                "time entries": TimeEntry.objects.filter(project__in=projects).delete()[0]
                + TimeEntry.objects.filter(user__in=users).delete()[0],
                "expenses": Expense.objects.filter(project__in=projects).delete()[0]
                + Expense.objects.filter(user__in=users).delete()[0],
            }
            ProjectAssignment.objects.filter(user__in=users).delete()
            counts["projects"] = projects.delete()[0]
            counts["clients"] = Client.objects.filter(notes__startswith=DEMO_TAG).delete()[0]
            counts["users"] = users.delete()[0]
        return "Deleted demo data: " + ", ".join(f"{v} {k}" for k, v in counts.items())

    # People
    def unique_names(self, count):
        pairs = [(f, l) for f in FIRST_NAMES for l in LAST_NAMES]
        self.rng.shuffle(pairs)
        return pairs[:count]

    def create_people(self, manager_count, staff_count):
        password = make_password(DEMO_PASSWORD)  # hashed once, shared by all demo staff
        names = self.unique_names(manager_count + staff_count)
        weights = [w for *_, w in DISCIPLINES]
        users, profiles = [], {}

        for i, (first, last) in enumerate(names):
            is_manager = i < manager_count
            if is_manager:
                title, low, high = "Delivery Manager", *MANAGER_RATE
            else:
                title, low, high, _ = self.rng.choices(DISCIPLINES, weights=weights)[0]
            base = D(self.rng.randint(low, high))
            # One raise during the history so rate snapshots differ over time
            raise_on = self.history_start + timedelta(days=self.rng.randint(60, max(61, (self.today - self.history_start).days)))
            raised = money(base * D(str(1 + self.rng.uniform(0.03, 0.09))))
            current = raised if raise_on <= self.today else base
            user = User(
                email=f"{first}.{last}{DEMO_DOMAIN}".lower(),
                first_name=first,
                last_name=last,
                role=UserRole.MANAGER if is_manager else UserRole.TEAM_MEMBER,
                default_hourly_cost_rate=current.quantize(D("0.0001")),
                password=password,
                is_active=True,
            )
            users.append(user)
            profiles[user.email] = {"title": title, "base": base, "raised": raised, "raise_on": raise_on}

        # Two former employees: inactive now, but their historical entries remain
        for user in (users[manager_count:manager_count + 2] if staff_count > 4 else []):
            user.is_active = False
            profiles[user.email]["left_on"] = self.today - timedelta(days=self.rng.randint(45, 120))

        User.objects.bulk_create(users, batch_size=500)
        self.profiles = profiles
        return {"managers": users[:manager_count], "staff": users[manager_count:]}

    def rate_on(self, user, day):
        p = self.profiles[user.email]
        return (p["raised"] if day >= p["raise_on"] else p["base"]).quantize(D("0.0001"))

    def works_on(self, user, day):
        left = self.profiles[user.email].get("left_on")
        return left is None or day <= left

    # Clients
    def create_clients(self, count, managers):
        existing = set(Client.objects.values_list("name", flat=True))
        names = [n for n in CLIENT_NAMES if n not in existing]
        if len(names) < count:
            raise CommandError(f"Only {len(names)} unused demo client names are available; use a smaller --scale.")
        clients = []
        for name in self.rng.sample(names, count):
            first, last = self.rng.choice(FIRST_NAMES), self.rng.choice(LAST_NAMES)
            slug = "".join(ch for ch in name.lower() if ch.isalnum())[:20]
            clients.append(Client(
                name=name,
                contact_name=f"{first} {last}",
                contact_email=f"{first}.{last}@{slug}.example".lower(),
                contact_phone=f"+1-555-{self.rng.randint(100, 999)}-{self.rng.randint(1000, 9999)}",
                notes=f"{DEMO_TAG} Generated demo client.",
                created_by=self.rng.choice(managers),
            ))
        Client.objects.bulk_create(clients)
        currency = {}
        for c in clients:
            currency[c.pk] = self.rng.choices(["USD", "EUR", "GBP"], weights=[80, 12, 8])[0]
        self.client_currency = currency
        return clients

    # Projects
    def plan_projects(self, count, clients, people):
        span = (self.today - self.history_start).days
        statuses = [self.rng.choice(STATUS_MIX) for _ in range(count)]
        active_types = self.proportional(ACTIVE_MIX, statuses.count(ProjectStatus.ACTIVE))
        plans = []
        for i, status in enumerate(statuses):
            project_type, typical_hours = self.rng.choice(PROJECT_TYPES)
            duration = int(typical_hours / self.rng.uniform(3.5, 6.0)) + self.rng.randint(20, 60)  # calendar days

            if status == ProjectStatus.PLANNING:
                start = self.today + timedelta(days=self.rng.randint(7, 75))
                work_end = None
            elif status == ProjectStatus.COMPLETED:
                end = self.today - timedelta(days=self.rng.randint(10, max(11, span // 2)))
                start = max(self.history_start, end - timedelta(days=duration))
                work_end = end
            elif status in (ProjectStatus.ON_HOLD, ProjectStatus.CANCELLED):
                start = self.history_start + timedelta(days=self.rng.randint(0, max(1, span - 120)))
                work_end = min(self.today - timedelta(days=self.rng.randint(30, 90)), start + timedelta(days=duration))
                work_end = max(work_end, start + timedelta(days=14))
            else:  # ACTIVE: started recently enough to still be running
                start = self.today - timedelta(days=self.rng.randint(25, min(span, max(30, duration - 10))))
                work_end = self.today

            team_size = self.rng.randint(2, 6 if typical_hours > 600 else 4)
            team = self.rng.sample(people["staff"], min(team_size, len(people["staff"])))
            manager = self.rng.choice(people["managers"])
            archetype = {
                ProjectStatus.ACTIVE: active_types.pop() if status == ProjectStatus.ACTIVE else None,
                ProjectStatus.COMPLETED: self.rng.choice(["completed_under"] * 3 + ["completed_over"]),
                ProjectStatus.ON_HOLD: self.rng.choice(["healthy", "missing_estimate"]),
                ProjectStatus.CANCELLED: "cancelled",
                ProjectStatus.PLANNING: "planning",
            }[status]
            client = clients[i % len(clients)] if i < len(clients) else self.rng.choice(clients)
            plans.append({
                "project": Project(
                    client=client,
                    name=f"{client.name.split()[0]} {project_type}",
                    description=f"{project_type} for {client.name}.",
                    status=status,
                    currency=self.client_currency[client.pk],
                    start_date=start,
                    deadline=start + timedelta(days=duration),
                    created_by=manager,
                    # placeholders; real baselines are set from actuals in set_baselines()
                    contract_revenue=D("1.00"), planned_cost_budget=D("1.00"), planned_hourly_cost=D("1.0000"),
                ),
                "archetype": archetype,
                "team": team,
                "manager": manager,
                "work_end": work_end,
                "typical_hours": typical_hours,
            })
        # A few long-finished projects are archived
        for plan in plans:
            p = plan["project"]
            if p.status == ProjectStatus.COMPLETED and plan["work_end"] < self.today - timedelta(days=200):
                p.is_archived = self.rng.random() < 0.5
        return plans

    def proportional(self, mix, total):
        """Exactly `total` labels in the given percentages (largest remainder), shuffled."""
        exact = {k: v * total / 100 for k, v in mix.items()}
        counts = {k: int(v) for k, v in exact.items()}
        for k in sorted(exact, key=lambda k: exact[k] - counts[k], reverse=True)[: total - sum(counts.values())]:
            counts[k] += 1
        labels = [k for k, n in counts.items() for _ in range(n)]
        self.rng.shuffle(labels)
        return labels

    def create_projects(self, plans):
        Project.objects.bulk_create([p["project"] for p in plans])
        assignments = []
        for plan in plans:
            for member in {*plan["team"], plan["manager"]}:
                assignments.append(ProjectAssignment(
                    project=plan["project"], user=member, assigned_by=plan["manager"], is_active=True,
                ))
        ProjectAssignment.objects.bulk_create(assignments, batch_size=1000)

    # Time entries
    def create_time_entries(self, plans):
        daily_hours = defaultdict(D)  # (user, day) -> hours, caps a person's day at 9 h
        entries = []
        for plan in plans:
            if plan["work_end"] is None:
                continue
            project = plan["project"]
            allocation = {m.pk: self.rng.uniform(0.25, 0.75) for m in plan["team"]}
            allocation[plan["manager"].pk] = 0.12
            members = [*plan["team"], plan["manager"]]
            # Lighter work at the start and end of a project
            days = list(workdays(project.start_date, min(plan["work_end"], self.today)))
            for idx, day in enumerate(days):
                ramp = 0.5 if idx < 5 or idx > len(days) - 5 else 1.0
                for member in members:
                    if not self.works_on(member, day) or self.rng.random() > allocation[member.pk] * ramp:
                        continue
                    hours = round_to(self.rng.uniform(1.0, 7.5), "0.25")
                    key = (member.pk, day)
                    hours = min(hours, D("9") - daily_hours[key])
                    if hours < D("0.5"):
                        continue
                    daily_hours[key] += hours
                    title = self.profiles[member.email]["title"]
                    entries.append(TimeEntry(
                        project=project, user=member, work_date=day, recorded_hours=hours,
                        hourly_cost_snapshot=self.rate_on(member, day),
                        description=self.rng.choice(TASKS[title]),
                    ))
        TimeEntry.objects.bulk_create(entries, batch_size=2000)
        return entries

    # Expenses
    def create_expenses(self, plans):
        categories = list(EXPENSES)
        weights = [EXPENSES[c][1] for c in categories]
        expenses = []
        now = timezone.now()
        for plan in plans:
            if plan["work_end"] is None:
                continue
            project = plan["project"]
            first, last = project.start_date, min(plan["work_end"], self.today)
            span = max(1, (last - first).days)
            count = self.rng.randint(1, 4) + span // 35
            for _ in range(count):
                category = self.rng.choices(categories, weights=weights)[0]
                (low, high), _w, descriptions = EXPENSES[category]
                day = first + timedelta(days=self.rng.randint(0, span))
                age = (self.today - day).days
                if age < 10:
                    status = ExpenseStatus.PENDING
                else:
                    status = self.rng.choices(
                        [ExpenseStatus.APPROVED, ExpenseStatus.REJECTED, ExpenseStatus.PENDING],
                        weights=[84, 12, 4 if age < 40 else 0],
                    )[0]
                reviewer = plan["manager"]
                reviewed_at = None
                if status != ExpenseStatus.PENDING:
                    review_day = day + timedelta(days=self.rng.randint(1, 8))
                    reviewed_at = min(now, timezone.make_aware(
                        datetime.combine(review_day, time(hour=self.rng.randint(9, 17)))
                    ))
                submitters = [m for m in plan["team"] if self.works_on(m, day)]
                if not submitters:
                    continue
                submitter = self.rng.choice(submitters)
                expenses.append(Expense(
                    project=project,
                    user=submitter,
                    category=category,
                    amount=money(self.rng.uniform(low, high)),
                    description=self.rng.choice(descriptions),
                    expense_date=day,
                    status=status,
                    reviewed_by=reviewer if status != ExpenseStatus.PENDING else None,
                    reviewed_at=reviewed_at,
                    review_note=self.rng.choice(REJECTION_NOTES) if status == ExpenseStatus.REJECTED else (
                        "Approved." if status == ExpenseStatus.APPROVED else ""
                    ),
                ))
        Expense.objects.bulk_create(expenses, batch_size=2000)
        return expenses

    # Baselines
    def set_baselines(self, plans):
        """Derives budget, revenue, rate and remaining hours from each project's actuals and archetype."""
        actuals = defaultdict(lambda: D("0"))
        hours_logged = defaultdict(lambda: D("0"))
        for (project_id, hours, rate) in TimeEntry.objects.filter(
            project__in=[p["project"] for p in plans]
        ).order_by().values_list("project_id", "recorded_hours", "hourly_cost_snapshot"):
            actuals[project_id] += money(hours * rate)
            hours_logged[project_id] += hours
        for (project_id, amount) in Expense.objects.filter(
            project__in=[p["project"] for p in plans], status=ExpenseStatus.APPROVED
        ).order_by().values_list("project_id", "amount"):
            actuals[project_id] += amount

        updated = []
        for plan in plans:
            p, kind, r = plan["project"], plan["archetype"], self.rng
            team_rates = [self.rate_on(m, self.today) for m in plan["team"]] or [D("90")]
            rate = (sum(team_rates) / len(team_rates) * D(str(r.uniform(0.93, 1.06)))).quantize(D("0.0001"))
            actual = actuals[p.pk]
            expected_rem = D("0.00")
            if kind in ("healthy", "forecast_overrun", "consumption_warning") and r.random() < 0.2:
                expected_rem = round_to(r.uniform(400, 5000), 50)

            def remaining_for(cost):
                return (D(cost) / rate).quantize(D("0.01")) if rate > 0 else D("0")

            if kind == "planning":
                remaining = D(plan["typical_hours"]) * D(str(r.uniform(0.8, 1.2)))
                remaining = remaining.quantize(D("0.01"))
                budget = remaining * rate / D(str(r.uniform(0.75, 0.92)))
            elif kind == "healthy":
                rem_cost = max(actual, D("2000")) * D(str(r.uniform(0.5, 1.6)))
                remaining = remaining_for(rem_cost)
                budget = (actual + rem_cost + expected_rem) / D(str(r.uniform(0.70, 0.88)))
            elif kind == "forecast_overrun":
                rem_cost = max(actual, D("2000")) * D(str(r.uniform(0.6, 1.4)))
                remaining = remaining_for(rem_cost)
                budget = (actual + rem_cost + expected_rem) / D(str(r.uniform(1.05, 1.22)))
            elif kind == "consumption_warning":
                budget = actual / D(str(r.uniform(0.83, 0.95)))
                remaining = remaining_for((budget - actual - expected_rem) * D(str(r.uniform(0.3, 0.8))))
                remaining = max(remaining, D("4.00"))
            elif kind == "over_budget":
                budget = actual / D(str(r.uniform(1.04, 1.35)))
                remaining = remaining_for(actual * D(str(r.uniform(0.05, 0.3)))) if r.random() < 0.6 else None
            elif kind == "missing_estimate":
                budget = actual / D(str(r.uniform(0.3, 0.75))) if actual else D("40000")
                remaining = None
            elif kind == "completed_under":
                budget = actual / D(str(r.uniform(0.78, 0.98)))
                remaining = D("0.00")
            elif kind == "completed_over":
                budget = actual / D(str(r.uniform(1.03, 1.18)))
                remaining = D("0.00")
            else:  # cancelled
                budget = max(actual, D("1000")) / D(str(r.uniform(0.35, 0.8)))
                remaining = D("0.00")

            budget = round_to(max(budget, D("5000")), 500)
            if kind in ("over_budget", "completed_over"):
                # Rounding to a $500 step must not lift the budget back above actual spend
                while budget >= actual and budget > D("500"):
                    budget -= D("500")
            margin = D(str(r.uniform(0.18, 0.42)))
            p.planned_cost_budget = budget
            p.contract_revenue = round_to(budget / (1 - margin), 1000)
            p.planned_hourly_cost = rate
            p.estimated_remaining_hours = remaining
            p.expected_remaining_expenses = expected_rem
            updated.append(p)

        Project.objects.bulk_update(
            updated,
            ["planned_cost_budget", "contract_revenue", "planned_hourly_cost",
             "estimated_remaining_hours", "expected_remaining_expenses"],
            batch_size=500,
        )

    # Report
    def report(self, people, clients, plans, entries, expenses):
        projects = [p["project"] for p in plans]
        statuses = defaultdict(int)
        risks = defaultdict(int)
        for project, summary in summarize_projects(Project.objects.filter(pk__in=[p.pk for p in projects])):
            statuses[project.status] += 1
            if project.status == ProjectStatus.ACTIVE:
                risks[summary.risk.status] += 1
        exp_status = defaultdict(int)
        for e in expenses:
            exp_status[e.status] += 1
        hours = sum((e.recorded_hours for e in entries), D("0"))
        snapshot_rates = len({(e.user_id, e.hourly_cost_snapshot) for e in entries})

        sample_member = next(u for u in people["staff"] if u.is_active)
        lines = [
            self.style.SUCCESS("Demo agency data created (Brightloop Studio)."),
            f"  Staff:        {len(people['managers'])} managers, {len(people['staff'])} team members "
            f"({sum(1 for u in people['staff'] if not u.is_active)} former, inactive)",
            f"  Clients:      {len(clients)}",
            f"  Projects:     {len(projects)} — " + ", ".join(f"{k}: {v}" for k, v in sorted(statuses.items())),
            f"  Active risk:  " + ", ".join(f"{k}: {v}" for k, v in sorted(risks.items())),
            f"  Time entries: {len(entries):,} ({hours:,.2f} h; {snapshot_rates} distinct person/rate snapshots)",
            f"  Expenses:     {len(expenses):,} — " + ", ".join(f"{k}: {v}" for k, v in sorted(exp_status.items())),
            "",
            f"  Sign in as any demo user with password: {DEMO_PASSWORD}",
            f"    Manager:     {people['managers'][0].email}",
            f"    Team member: {sample_member.email}",
            "  Remove everything with: python manage.py seed_demo_data --delete",
        ]
        self.stdout.write("\n".join(lines))
