from datetime import timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone

from users.models import User, UserRole
from clients.models import Client
from projects.models import Project, ProjectAssignment, ProjectStatus


class Command(BaseCommand):
    help = "Seed database with 10 commercial clients, 3-5 projects per client (with varied statuses and financial risk profiles), and dummy team members."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete existing clients, projects, and assignments before seeding.",
        )

    def handle(self, *args, **options):
        if options.get("clear"):
            self.stdout.write(self.style.WARNING("Clearing existing projects, assignments, and clients..."))
            ProjectAssignment.objects.all().delete()
            Project.objects.all().delete()
            Client.objects.all().delete()

        today = timezone.now().date()

        # 1. Ensure Manager User exists for attribution
        manager_email = "alex.morgan@vanguard-agency.io"
        manager, _ = User.objects.get_or_create(
            email=manager_email,
            defaults={
                "first_name": "Alex",
                "last_name": "Morgan",
                "role": UserRole.MANAGER,
                "default_hourly_cost_rate": Decimal("135.0000"),
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if _:
            manager.set_password("Manager123!")
            manager.save()

        # 2. Seed Team Members
        team_members_spec = [
            {
                "email": "elena.rostova@vanguard-agency.io",
                "first_name": "Elena",
                "last_name": "Rostova",
                "role": UserRole.TEAM_MEMBER,
                "rate": Decimal("115.0000"),
            },
            {
                "email": "marcus.chen@vanguard-agency.io",
                "first_name": "Marcus",
                "last_name": "Chen",
                "role": UserRole.TEAM_MEMBER,
                "rate": Decimal("125.0000"),
            },
            {
                "email": "priya.nair@vanguard-agency.io",
                "first_name": "Priya",
                "last_name": "Nair",
                "role": UserRole.TEAM_MEMBER,
                "rate": Decimal("110.0000"),
            },
            {
                "email": "david.kim@vanguard-agency.io",
                "first_name": "David",
                "last_name": "Kim",
                "role": UserRole.TEAM_MEMBER,
                "rate": Decimal("120.0000"),
            },
            {
                "email": "sophia.martinez@vanguard-agency.io",
                "first_name": "Sophia",
                "last_name": "Martinez",
                "role": UserRole.TEAM_MEMBER,
                "rate": Decimal("95.0000"),
            },
            {
                "email": "james.wilson@vanguard-agency.io",
                "first_name": "James",
                "last_name": "Wilson",
                "role": UserRole.TEAM_MEMBER,
                "rate": Decimal("130.0000"),
            },
            {
                "email": "amara.okafor@vanguard-agency.io",
                "first_name": "Amara",
                "last_name": "Okafor",
                "role": UserRole.TEAM_MEMBER,
                "rate": Decimal("90.0000"),
            },
            {
                "email": "liam.oconnor@vanguard-agency.io",
                "first_name": "Liam",
                "last_name": "O'Connor",
                "role": UserRole.TEAM_MEMBER,
                "rate": Decimal("95.0000"),
            },
            {
                "email": "zara.patel@vanguard-agency.io",
                "first_name": "Zara",
                "last_name": "Patel",
                "role": UserRole.TEAM_MEMBER,
                "rate": Decimal("85.0000"),
            },
        ]

        seeded_members = []
        for tm in team_members_spec:
            user, created = User.objects.get_or_create(
                email=tm["email"],
                defaults={
                    "first_name": tm["first_name"],
                    "last_name": tm["last_name"],
                    "role": tm["role"],
                    "default_hourly_cost_rate": tm["rate"],
                    "is_staff": False,
                    "is_superuser": False,
                },
            )
            if created:
                user.set_password("Member123!")
                user.save()
            seeded_members.append(user)

        self.stdout.write(self.style.SUCCESS(f"Verified {len(seeded_members)} team members available for assignment."))

        # 3. Exactly 10 Commercial Clients with 3 to 5 projects each
        # (Total 39 projects with diverse statuses and deterministic analysis outcomes)
        clients_data = [
            # 1. Acme Cloud Systems (4 projects)
            {
                "name": "Acme Cloud Systems",
                "contact_name": "Arthur Pendelton",
                "contact_email": "arthur.p@acmecloud.com",
                "contact_phone": "+1-415-555-0101",
                "notes": "Enterprise SaaS client specializing in distributed multi-tenant storage infrastructure.",
                "projects": [
                    {
                        "name": "Multi-Region Kubernetes Migration",
                        "description": "Migrate core microservices from legacy compute instances to EKS with multi-region failover.",
                        "contract_revenue": Decimal("95000.00"),
                        "planned_cost_budget": Decimal("65000.00"),
                        "planned_hourly_cost": Decimal("110.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("350.00"),  # Projected cost: $38.5k -> HEALTHY (Planned $65k)
                        "status": ProjectStatus.ACTIVE,
                        "start_offset": -40,
                        "deadline_offset": 60,
                        "assignee_indices": [0, 1, 3],  # Elena, Marcus, David
                    },
                    {
                        "name": "Zero-Trust Identity Access Gateway",
                        "description": "Implement OAuth2/OIDC mutual TLS perimeter proxy and device trust validation.",
                        "contract_revenue": Decimal("60000.00"),
                        "planned_cost_budget": Decimal("45000.00"),
                        "planned_hourly_cost": Decimal("100.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("480.00"),  # Projected cost: $48k > $45k -> WARNING: Projected Overrun
                        "status": ProjectStatus.ACTIVE,
                        "start_offset": -30,
                        "deadline_offset": 45,
                        "assignee_indices": [1, 5],  # Marcus, James
                    },
                    {
                        "name": "Audit Log Aggregator Engine",
                        "description": "Centralized clickhouse ingestion pipeline for high-throughput immutable audit traces.",
                        "contract_revenue": Decimal("40000.00"),
                        "planned_cost_budget": Decimal("28000.00"),
                        "planned_hourly_cost": Decimal("95.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": None,  # Missing estimate -> INCOMPLETE_DATA
                        "status": ProjectStatus.PLANNING,
                        "start_offset": 10,
                        "deadline_offset": 90,
                        "assignee_indices": [3, 6],  # David, Amara
                    },
                    {
                        "name": "Legacy Storage Deprecation",
                        "description": "Decommission cold S3 buckets, verify checksum parity, and audit archive retention.",
                        "contract_revenue": Decimal("30000.00"),
                        "planned_cost_budget": Decimal("22000.00"),
                        "planned_hourly_cost": Decimal("90.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("0.00"),  # Completed scope (0h remaining) -> HEALTHY / Complete
                        "status": ProjectStatus.COMPLETED,
                        "start_offset": -120,
                        "deadline_offset": -10,
                        "assignee_indices": [5, 8],  # James, Zara
                    },
                ],
            },

            # 2. BioHealth Dynamics (3 projects)
            {
                "name": "BioHealth Dynamics",
                "contact_name": "Dr. Evelyn Vance",
                "contact_email": "e.vance@biohealthdyn.org",
                "contact_phone": "+1-617-555-0142",
                "notes": "Biotech clinical trial data provider handling high-throughput genomic data pipelines.",
                "projects": [
                    {
                        "name": "Genomic Variant Pipeline Accelerator",
                        "description": "Nextflow and AWS Batch automated pipeline for rapid somatic mutation alignment and variant calling.",
                        "contract_revenue": Decimal("120000.00"),
                        "planned_cost_budget": Decimal("80000.00"),
                        "planned_hourly_cost": Decimal("125.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("750.00"),  # Projected cost: $93,750 > $80k * 1.1 ($88k) -> CRITICAL: Severe Overrun
                        "status": ProjectStatus.ACTIVE,
                        "start_offset": -50,
                        "deadline_offset": 40,
                        "assignee_indices": [1, 3, 5],
                    },
                    {
                        "name": "HIPAA-Compliant Patient Portal v2",
                        "description": "Next.js frontend with biometric authentication and end-to-end encrypted medical report sharing.",
                        "contract_revenue": Decimal("85000.00"),
                        "planned_cost_budget": Decimal("60000.00"),
                        "planned_hourly_cost": Decimal("100.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("380.00"),  # Projected cost: $38k -> HEALTHY (healthy margin)
                        "status": ProjectStatus.ACTIVE,
                        "start_offset": -25,
                        "deadline_offset": 65,
                        "assignee_indices": [0, 4, 8],
                    },
                    {
                        "name": "Telemetry Ingestion Service",
                        "description": "High-frequency vital sign streaming microservice for hospital telemetry monitors.",
                        "contract_revenue": Decimal("45000.00"),
                        "planned_cost_budget": Decimal("32000.00"),
                        "planned_hourly_cost": Decimal("95.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": None,  # Suspended / estimate unknown -> INCOMPLETE_DATA
                        "status": ProjectStatus.ON_HOLD,
                        "start_offset": -60,
                        "deadline_offset": 30,
                        "assignee_indices": [3, 6],
                    },
                ],
            },

            # 3. FinTech Global Capital (5 projects)
            {
                "name": "FinTech Global Capital",
                "contact_name": "Jonathan Sterling",
                "contact_email": "j.sterling@fintechcapital.io",
                "contact_phone": "+44-20-7946-0921",
                "notes": "Institutional foreign exchange and algorithmic settlement network.",
                "projects": [
                    {
                        "name": "Real-Time Settlement Ledger",
                        "description": "Distributed double-entry ledger database with idempotent event-driven audit log.",
                        "contract_revenue": Decimal("150000.00"),
                        "planned_cost_budget": Decimal("105000.00"),
                        "planned_hourly_cost": Decimal("130.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("550.00"),  # Projected cost: $71.5k -> HEALTHY
                        "status": ProjectStatus.ACTIVE,
                        "start_offset": -45,
                        "deadline_offset": 90,
                        "assignee_indices": [1, 2, 3],
                    },
                    {
                        "name": "SEPA & SWIFT Payment Gateway",
                        "description": "Direct bank API settlement connector supporting instant SEPA and ISO 20022 messaging.",
                        "contract_revenue": Decimal("75000.00"),
                        "planned_cost_budget": Decimal("72000.00"),
                        "planned_hourly_cost": Decimal("110.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("670.00"),  # Projected cost: $73.7k -> Margin $1,300 (1.7% < 10%) -> CRITICAL: Margin Compression
                        "status": ProjectStatus.ACTIVE,
                        "start_offset": -35,
                        "deadline_offset": 50,
                        "assignee_indices": [1, 6],
                    },
                    {
                        "name": "Regulatory KYC / AML Onboarding Flow",
                        "description": "Automated passport OCR, sanctions database screening, and PEP risk scoring flow.",
                        "contract_revenue": Decimal("55000.00"),
                        "planned_cost_budget": Decimal("40000.00"),
                        "planned_hourly_cost": Decimal("100.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("420.00"),  # Projected cost: $42k > $40k -> WARNING: Projected Overrun
                        "status": ProjectStatus.ACTIVE,
                        "start_offset": -20,
                        "deadline_offset": 40,
                        "assignee_indices": [0, 4, 8],
                    },
                    {
                        "name": "Fraud Pattern Neural Classifier",
                        "description": "Real-time anomaly detector running on card swipe webhook streams.",
                        "contract_revenue": Decimal("90000.00"),
                        "planned_cost_budget": Decimal("65000.00"),
                        "planned_hourly_cost": Decimal("120.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": None,  # Scope in planning -> INCOMPLETE_DATA
                        "status": ProjectStatus.PLANNING,
                        "start_offset": 14,
                        "deadline_offset": 120,
                        "assignee_indices": [3, 5],
                    },
                    {
                        "name": "High-Frequency FIX Feed Adapter",
                        "description": "Ultra-low latency C++ socket bridge for market maker quote streaming.",
                        "contract_revenue": Decimal("35000.00"),
                        "planned_cost_budget": Decimal("25000.00"),
                        "planned_hourly_cost": Decimal("120.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("0.00"),
                        "status": ProjectStatus.CANCELLED,
                        "start_offset": -80,
                        "deadline_offset": -20,
                        "assignee_indices": [1, 5],
                    },
                ],
            },

            # 4. Nexus Retail Omni (4 projects)
            {
                "name": "Nexus Retail Omni",
                "contact_name": "Maya Lin",
                "contact_email": "mlin@nexusretail.com",
                "contact_phone": "+1-206-555-0188",
                "notes": "Omnichannel consumer lifestyle apparel brand operating across digital and 200+ physical stores.",
                "projects": [
                    {
                        "name": "Headless Shopify Storefront Redesign",
                        "description": "Next.js 14 App Router storefront powered by Shopify Storefront API and Algolia instant search.",
                        "contract_revenue": Decimal("70000.00"),
                        "planned_cost_budget": Decimal("48000.00"),
                        "planned_hourly_cost": Decimal("95.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("320.00"),  # Projected cost: $30.4k -> HEALTHY
                        "status": ProjectStatus.ACTIVE,
                        "start_offset": -30,
                        "deadline_offset": 60,
                        "assignee_indices": [0, 4, 7],
                    },
                    {
                        "name": "In-Store Point of Sale Mobile Sync",
                        "description": "Offline-first React Native tablet POS syncing offline cart checks with warehouse ERP.",
                        "contract_revenue": Decimal("80000.00"),
                        "planned_cost_budget": Decimal("55000.00"),
                        "planned_hourly_cost": Decimal("105.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("560.00"),  # Projected cost: $58.8k > $55k -> WARNING: Projected Overrun
                        "status": ProjectStatus.ACTIVE,
                        "start_offset": -40,
                        "deadline_offset": 45,
                        "assignee_indices": [2, 7],
                    },
                    {
                        "name": "Real-Time Inventory Mesh",
                        "description": "Kafka CDC pipeline streaming store register sales directly into centralized SAP inventory.",
                        "contract_revenue": Decimal("65000.00"),
                        "planned_cost_budget": Decimal("42000.00"),
                        "planned_hourly_cost": Decimal("110.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("450.00"),  # Projected cost: $49.5k > $42k * 1.1 ($46.2k) -> CRITICAL: Severe Overrun
                        "status": ProjectStatus.ACTIVE,
                        "start_offset": -25,
                        "deadline_offset": 35,
                        "assignee_indices": [1, 3],
                    },
                    {
                        "name": "Loyalty Rewards Microservice",
                        "description": "Tiered customer points calculation engine and digital wallet barcode generator.",
                        "contract_revenue": Decimal("35000.00"),
                        "planned_cost_budget": Decimal("24000.00"),
                        "planned_hourly_cost": Decimal("90.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("0.00"),
                        "status": ProjectStatus.COMPLETED,
                        "start_offset": -100,
                        "deadline_offset": -15,
                        "assignee_indices": [0, 6],
                    },
                ],
            },

            # 5. Apex Mobility Systems (3 projects)
            {
                "name": "Apex Mobility Systems",
                "contact_name": "Carlos Santana",
                "contact_email": "carlos@apexmobility.io",
                "contact_phone": "+1-512-555-0193",
                "notes": "Connected electric vehicle charging station network and commercial fleet tracking.",
                "projects": [
                    {
                        "name": "Fleet Telematics OBD-II Collector",
                        "description": "Cellular gateway collecting GPS coords, battery degradation, and driver acceleration spikes.",
                        "contract_revenue": Decimal("110000.00"),
                        "planned_cost_budget": Decimal("75000.00"),
                        "planned_hourly_cost": Decimal("115.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("400.00"),  # Projected: $46k -> HEALTHY
                        "status": ProjectStatus.ACTIVE,
                        "start_offset": -35,
                        "deadline_offset": 75,
                        "assignee_indices": [3, 5, 8],
                    },
                    {
                        "name": "Driver Dispatch Mobile App",
                        "description": "Turn-by-turn routing and emergency towing dispatch interface for logistics drivers.",
                        "contract_revenue": Decimal("50000.00"),
                        "planned_cost_budget": Decimal("48000.00"),
                        "planned_hourly_cost": Decimal("90.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("520.00"),  # Projected: $46.8k -> Margin $3.2k (6.4% < 10%) -> CRITICAL: Margin Compression
                        "status": ProjectStatus.ACTIVE,
                        "start_offset": -20,
                        "deadline_offset": 50,
                        "assignee_indices": [4, 7],
                    },
                    {
                        "name": "EV Route Charging Optimizer",
                        "description": "Graph algorithms calculating fastest route with dynamic EV charging station reservation slots.",
                        "contract_revenue": Decimal("60000.00"),
                        "planned_cost_budget": Decimal("42000.00"),
                        "planned_hourly_cost": Decimal("105.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": None,  # Estimate unknown -> INCOMPLETE_DATA
                        "status": ProjectStatus.PLANNING,
                        "start_offset": 20,
                        "deadline_offset": 100,
                        "assignee_indices": [1, 2],
                    },
                ],
            },

            # 6. Hyperion Logistics Worldwide (4 projects)
            {
                "name": "Hyperion Logistics Worldwide",
                "contact_name": "Rachel Green",
                "contact_email": "rachel.green@hyperionlogistics.net",
                "contact_phone": "+1-312-555-0164",
                "notes": "Multimodal freight forwarding and international customs automation platform.",
                "projects": [
                    {
                        "name": "Automated Customs Clearance Portal",
                        "description": "Digital bill of lading ingestion and customs harmonized tariff code classifier.",
                        "contract_revenue": Decimal("88000.00"),
                        "planned_cost_budget": Decimal("60000.00"),
                        "planned_hourly_cost": Decimal("105.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("350.00"),  # Projected: $36.75k -> HEALTHY
                        "status": ProjectStatus.ACTIVE,
                        "start_offset": -45,
                        "deadline_offset": 55,
                        "assignee_indices": [0, 2, 6],
                    },
                    {
                        "name": "Warehouse Barcode & RFID Scanner App",
                        "description": "Handheld Zebra terminal app communicating over gRPC with local distribution center inventory.",
                        "contract_revenue": Decimal("45000.00"),
                        "planned_cost_budget": Decimal("32000.00"),
                        "planned_hourly_cost": Decimal("90.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("370.00"),  # Projected: $33.3k > $32k -> WARNING: Projected Overrun
                        "status": ProjectStatus.ACTIVE,
                        "start_offset": -15,
                        "deadline_offset": 40,
                        "assignee_indices": [4, 7],
                    },
                    {
                        "name": "Global Container Tracking API",
                        "description": "Maritime AIS vessel position tracking bridge with estimated port arrival recalculation.",
                        "contract_revenue": Decimal("52000.00"),
                        "planned_cost_budget": Decimal("36000.00"),
                        "planned_hourly_cost": Decimal("100.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": None,  # On hold -> INCOMPLETE_DATA
                        "status": ProjectStatus.ON_HOLD,
                        "start_offset": -50,
                        "deadline_offset": 20,
                        "assignee_indices": [3, 8],
                    },
                    {
                        "name": "Carrier Rate Negotiation Matrix",
                        "description": "Spot market contract comparison calculator for air freight versus ocean dry bulk.",
                        "contract_revenue": Decimal("28000.00"),
                        "planned_cost_budget": Decimal("19000.00"),
                        "planned_hourly_cost": Decimal("85.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("0.00"),
                        "status": ProjectStatus.COMPLETED,
                        "start_offset": -110,
                        "deadline_offset": -25,
                        "assignee_indices": [6, 8],
                    },
                ],
            },

            # 7. Solaris Renewable Energy (5 projects)
            {
                "name": "Solaris Renewable Energy",
                "contact_name": "Henrik Lindqvist",
                "contact_email": "henrik@solarisenergy.eu",
                "contact_phone": "+46-8-555-0145",
                "notes": "Grid-scale solar farm management and decentralized virtual power plant operator.",
                "projects": [
                    {
                        "name": "Solar Array Inverter Telemetry Gateway",
                        "description": "Modbus TCP to MQTT translator collecting string-level solar irradiance and inverter faults.",
                        "contract_revenue": Decimal("135000.00"),
                        "planned_cost_budget": Decimal("92000.00"),
                        "planned_hourly_cost": Decimal("115.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("520.00"),  # Projected: $59.8k -> HEALTHY
                        "status": ProjectStatus.ACTIVE,
                        "start_offset": -55,
                        "deadline_offset": 80,
                        "assignee_indices": [1, 3, 5],
                    },
                    {
                        "name": "Virtual Power Plant Grid Balancer",
                        "description": "High-speed frequency stabilization controller dispatching battery storage reserves in <200ms.",
                        "contract_revenue": Decimal("95000.00"),
                        "planned_cost_budget": Decimal("65000.00"),
                        "planned_hourly_cost": Decimal("120.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("620.00"),  # Projected: $74.4k > $65k * 1.1 ($71.5k) -> CRITICAL: Severe Overrun
                        "status": ProjectStatus.ACTIVE,
                        "start_offset": -30,
                        "deadline_offset": 45,
                        "assignee_indices": [3, 5],
                    },
                    {
                        "name": "Homeowner Energy Savings Mobile Dashboard",
                        "description": "Consumer mobile app charting real-time solar production against domestic grid tariffs.",
                        "contract_revenue": Decimal("58000.00"),
                        "planned_cost_budget": Decimal("40000.00"),
                        "planned_hourly_cost": Decimal("95.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("440.00"),  # Projected: $41.8k > $40k -> WARNING: Projected Overrun
                        "status": ProjectStatus.ACTIVE,
                        "start_offset": -25,
                        "deadline_offset": 55,
                        "assignee_indices": [0, 4, 7],
                    },
                    {
                        "name": "Commercial Battery Storage Forecaster",
                        "description": "Predictive peak-shaving dispatch engine factoring weather forecasts and day-ahead electricity prices.",
                        "contract_revenue": Decimal("70000.00"),
                        "planned_cost_budget": Decimal("48000.00"),
                        "planned_hourly_cost": Decimal("110.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": None,  # Planning -> INCOMPLETE_DATA
                        "status": ProjectStatus.PLANNING,
                        "start_offset": 15,
                        "deadline_offset": 110,
                        "assignee_indices": [1, 2],
                    },
                    {
                        "name": "Wind Farm Anemometer Sensor Collector",
                        "description": "LoRaWAN sensor collection network reading turbine wind shear and ambient temperature.",
                        "contract_revenue": Decimal("42000.00"),
                        "planned_cost_budget": Decimal("29000.00"),
                        "planned_hourly_cost": Decimal("100.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("0.00"),
                        "status": ProjectStatus.COMPLETED,
                        "start_offset": -130,
                        "deadline_offset": -20,
                        "assignee_indices": [5, 8],
                    },
                ],
            },

            # 8. Veritas Legal Tech (3 projects)
            {
                "name": "Veritas Legal Tech",
                "contact_name": "Eleanor Vance",
                "contact_email": "evance@veritaslegal.com",
                "contact_phone": "+1-212-555-0177",
                "notes": "Enterprise corporate counsel e-discovery and automated contract clause analysis.",
                "projects": [
                    {
                        "name": "NLP Contract Clause Extractor",
                        "description": "Legal document parser identifying indemnity, non-solicitation, and force majeure risk clauses.",
                        "contract_revenue": Decimal("105000.00"),
                        "planned_cost_budget": Decimal("72000.00"),
                        "planned_hourly_cost": Decimal("125.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("360.00"),  # Projected: $45k -> HEALTHY
                        "status": ProjectStatus.ACTIVE,
                        "start_offset": -40,
                        "deadline_offset": 70,
                        "assignee_indices": [1, 2, 8],
                    },
                    {
                        "name": "Court Docket Scraper & Alert System",
                        "description": "Daily crawler monitoring PACER court docket entries and notifying lead trial attorneys.",
                        "contract_revenue": Decimal("42000.00"),
                        "planned_cost_budget": Decimal("38000.00"),
                        "planned_hourly_cost": Decimal("95.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("410.00"),  # Projected: $38.95k -> Margin $3,050 (7.2% < 10%) -> CRITICAL: Margin Compression
                        "status": ProjectStatus.ACTIVE,
                        "start_offset": -20,
                        "deadline_offset": 40,
                        "assignee_indices": [0, 6],
                    },
                    {
                        "name": "Client Billing & Retainer Portal",
                        "description": "Self-service trust accounting portal for law firm clients to view billing drawdowns.",
                        "contract_revenue": Decimal("36000.00"),
                        "planned_cost_budget": Decimal("25000.00"),
                        "planned_hourly_cost": Decimal("90.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": None,  # Estimate unknown -> INCOMPLETE_DATA
                        "status": ProjectStatus.PLANNING,
                        "start_offset": 10,
                        "deadline_offset": 80,
                        "assignee_indices": [4, 6],
                    },
                ],
            },

            # 9. Pulse Media Group (4 projects)
            {
                "name": "Pulse Media Group",
                "contact_name": "Marcus Brody",
                "contact_email": "mbrody@pulsemediagroup.tv",
                "contact_phone": "+1-310-555-0131",
                "notes": "Digital OTT content syndication network and programmatic video advertising platform.",
                "projects": [
                    {
                        "name": "Video Transcoding & HLS Stream Packager",
                        "description": "FFmpeg GPU-accelerated video pipeline outputting multi-bitrate HLS and DASH manifests.",
                        "contract_revenue": Decimal("80000.00"),
                        "planned_cost_budget": Decimal("54000.00"),
                        "planned_hourly_cost": Decimal("110.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("300.00"),  # Projected: $33k -> HEALTHY
                        "status": ProjectStatus.ACTIVE,
                        "start_offset": -30,
                        "deadline_offset": 60,
                        "assignee_indices": [3, 5],
                    },
                    {
                        "name": "Ad Impression Analytics Pipeline",
                        "description": "Aggregating 50M daily VAST ad beacon pings into Snowflake for revenue reconciliation.",
                        "contract_revenue": Decimal("64000.00"),
                        "planned_cost_budget": Decimal("44000.00"),
                        "planned_hourly_cost": Decimal("100.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("460.00"),  # Projected: $46k > $44k -> WARNING: Projected Overrun
                        "status": ProjectStatus.ACTIVE,
                        "start_offset": -25,
                        "deadline_offset": 50,
                        "assignee_indices": [1, 6],
                    },
                    {
                        "name": "Creator Royalty Distribution Portal",
                        "description": "Quarterly payout calculation portal with Stripe Connect automated direct deposits.",
                        "contract_revenue": Decimal("50000.00"),
                        "planned_cost_budget": Decimal("35000.00"),
                        "planned_hourly_cost": Decimal("95.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": None,  # On hold -> INCOMPLETE_DATA
                        "status": ProjectStatus.ON_HOLD,
                        "start_offset": -40,
                        "deadline_offset": 30,
                        "assignee_indices": [2, 4],
                    },
                    {
                        "name": "Podcast Dynamic Ad Insertion Engine",
                        "description": "Server-side audio stitcher dynamically splicing geo-targeted audio ads on podcast download.",
                        "contract_revenue": Decimal("38000.00"),
                        "planned_cost_budget": Decimal("26000.00"),
                        "planned_hourly_cost": Decimal("100.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("0.00"),
                        "status": ProjectStatus.COMPLETED,
                        "start_offset": -90,
                        "deadline_offset": -15,
                        "assignee_indices": [5, 7],
                    },
                ],
            },

            # 10. Quantum Cyber Labs (4 projects)
            {
                "name": "Quantum Cyber Labs",
                "contact_name": "Dr. Aris Thorne",
                "contact_email": "athorne@quantumcyber.tech",
                "contact_phone": "+1-650-555-0119",
                "notes": "Post-quantum cryptography protocols and enterprise kernel security monitoring.",
                "projects": [
                    {
                        "name": "Cryptographic Key Rotation Daemon",
                        "description": "Hardware Security Module (HSM) microservice orchestrating automated asymmetric key rotation.",
                        "contract_revenue": Decimal("140000.00"),
                        "planned_cost_budget": Decimal("95000.00"),
                        "planned_hourly_cost": Decimal("135.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("420.00"),  # Projected: $56.7k -> HEALTHY
                        "status": ProjectStatus.ACTIVE,
                        "start_offset": -40,
                        "deadline_offset": 85,
                        "assignee_indices": [1, 3, 8],
                    },
                    {
                        "name": "Kernel-Level EDR Agent (Rust)",
                        "description": "Lightweight eBPF Linux kernel probe detecting unauthorized process privilege escalations.",
                        "contract_revenue": Decimal("115000.00"),
                        "planned_cost_budget": Decimal("80000.00"),
                        "planned_hourly_cost": Decimal("130.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("730.00"),  # Projected: $94.9k > $80k * 1.1 ($88k) -> CRITICAL: Severe Overrun
                        "status": ProjectStatus.ACTIVE,
                        "start_offset": -30,
                        "deadline_offset": 45,
                        "assignee_indices": [3, 5],
                    },
                    {
                        "name": "Cloud Posture Compliance Scanner",
                        "description": "Multi-cloud CIS benchmark rule engine validating AWS, Azure, and GCP IAM permissions.",
                        "contract_revenue": Decimal("75000.00"),
                        "planned_cost_budget": Decimal("52000.00"),
                        "planned_hourly_cost": Decimal("115.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": None,  # Planning -> INCOMPLETE_DATA
                        "status": ProjectStatus.PLANNING,
                        "start_offset": 15,
                        "deadline_offset": 105,
                        "assignee_indices": [0, 8],
                    },
                    {
                        "name": "Dark Web Threat Intelligence Feed",
                        "description": "Automated onion site crawler scraping credential dump alerts and compromised domain leaks.",
                        "contract_revenue": Decimal("45000.00"),
                        "planned_cost_budget": Decimal("30000.00"),
                        "planned_hourly_cost": Decimal("110.0000"),
                        "currency": "USD",
                        "estimated_remaining_hours": Decimal("0.00"),
                        "status": ProjectStatus.CANCELLED,
                        "start_offset": -70,
                        "deadline_offset": -10,
                        "assignee_indices": [1, 5],
                    },
                ],
            },
        ]

        total_clients_created = 0
        total_projects_created = 0
        total_assignments_created = 0

        for client_info in clients_data:
            client, c_created = Client.objects.get_or_create(
                name=client_info["name"],
                defaults={
                    "contact_name": client_info.get("contact_name"),
                    "contact_email": client_info.get("contact_email"),
                    "contact_phone": client_info.get("contact_phone"),
                    "notes": client_info.get("notes"),
                    "created_by": manager,
                    "is_archived": False,
                },
            )
            if c_created:
                total_clients_created += 1

            for prj_info in client_info["projects"]:
                start_date = today + timedelta(days=prj_info["start_offset"])
                deadline = today + timedelta(days=prj_info["deadline_offset"])

                project, p_created = Project.objects.get_or_create(
                    client=client,
                    name=prj_info["name"],
                    defaults={
                        "description": prj_info["description"],
                        "contract_revenue": prj_info["contract_revenue"],
                        "planned_cost_budget": prj_info["planned_cost_budget"],
                        "planned_hourly_cost": prj_info["planned_hourly_cost"],
                        "currency": prj_info.get("currency", "USD"),
                        "estimated_remaining_hours": prj_info["estimated_remaining_hours"],
                        "status": prj_info["status"],
                        "start_date": start_date,
                        "deadline": deadline,
                        "created_by": manager,
                        "is_archived": False,
                    },
                )
                if p_created:
                    total_projects_created += 1
                else:
                    # Update parameters to match desired financial & status state
                    project.description = prj_info["description"]
                    project.contract_revenue = prj_info["contract_revenue"]
                    project.planned_cost_budget = prj_info["planned_cost_budget"]
                    project.planned_hourly_cost = prj_info["planned_hourly_cost"]
                    project.estimated_remaining_hours = prj_info["estimated_remaining_hours"]
                    project.status = prj_info["status"]
                    project.start_date = start_date
                    project.deadline = deadline
                    project.save()

                # Assign team members
                assignee_indices = prj_info.get("assignee_indices", [0, 1])
                for idx in assignee_indices:
                    if idx < len(seeded_members):
                        member = seeded_members[idx]
                        assignment, a_created = ProjectAssignment.objects.get_or_create(
                            project=project,
                            user=member,
                            defaults={
                                "assigned_by": manager,
                                "is_active": True,
                            },
                        )
                        if a_created:
                            total_assignments_created += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully seeded database: "
                f"{len(clients_data)} clients verified, "
                f"{total_projects_created} new projects created, "
                f"{total_assignments_created} new member assignments created."
            )
        )
