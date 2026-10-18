# MarginWatch — Phased Development Roadmap

**Document Status:** Approved Roadmap (Phase 0)  
**Last Updated:** October 2026  
**Audience:** Full-Stack Engineers, Evaluators, Project Reviewers  
**Architecture Authority:** [ADR-001: Initial Architecture](decisions/ADR-001-initial-architecture.md) | [ADR-002: Single-Agency Architecture](decisions/ADR-002-single-agency-architecture.md)  
**Financial Rules Authority:** [docs/financial-rules.md](financial-rules.md) | [ADR-003: Financial Rules](decisions/ADR-003-financial-rules-and-risk-classification.md)

---

## 1. Roadmap Architecture & Execution Philosophy

This roadmap organizes the development of MarginWatch into **10 disciplined milestones (Phases 0 through 9)**. Development follows an independent, documentation-first approach where each milestone builds incrementally upon the tested outputs of the previous phase.

```
[Phase 0: Docs & Blueprint] ──► [Phase 1: Frameworks & Neon] ──► [Phase 2: Database Models]
                                                                        │
                                                                        ▼
[Phase 5: Financials] ◄──────── [Phase 4: CRUD APIs] ◄───────── [Phase 3: Auth & RBAC]
         │
         ▼
[Phase 6: Frontend] ──────────► [Phase 7: AI Advisor] ────────► [Phase 8: Hardening] ──► [Phase 9: Delivery]
```

### Single-Agency Scope Mandate
- MarginWatch supports **one software delivery agency only**.
- No `Agency`, `Tenant`, or `AgencyMembership` tables exist in the database schema.
- Roles are strictly `MANAGER` and `TEAM_MEMBER`.
- Team member access is governed by explicit `ProjectAssignment` records.
- Future multi-agency expansion is declared out of scope and must not introduce speculative abstractions.

---

## 2. Milestone Breakdown

---

### Phase 0: Requirements, Financial Rules & Repository Blueprint
* **Status:** Current Phase (Complete)
* **Objective:** Establish the comprehensive technical and domain foundation for the project prior to code generation.
* **Tasks:**
  1. Author functional and non-functional requirements (`docs/requirements.md`).
  2. Define authoritative mathematical formulas and precedence rules (`docs/financial-rules.md`).
  3. Define system architecture, data models, and API blueprints (`docs/architecture.md`, `docs/data-model.md`, `docs/api-specification.md`).
  4. Define security matrix, testing strategy, and AI advisor specifications (`docs/security-and-permissions.md`, `docs/testing-strategy.md`, `docs/ai-risk-advisor.md`).
  5. Author architectural decision records (`docs/decisions/ADR-001-initial-architecture.md`, `docs/decisions/ADR-002-single-agency-architecture.md`, `docs/decisions/ADR-003-financial-rules-and-risk-classification.md`).
  6. Establish `.gitignore`, `.env.example`, `CONTRIBUTING.md`, and top-level `README.md`.
* **Deliverables:** Complete documentation suite and clean repo scaffolding.
* **Definition of Done:** All documentation files cross-checked for consistency; single-agency architecture codified across all specifications.

---

### Phase 1: Repository, Framework & Database Initialization
* **Status:** Planned / Scaffolded
* **Objective:** Initialize clean Django and Next.js projects with cloud Neon PostgreSQL / local SQLite database wiring.
* **Tasks:**
  1. Activate Python 3.15 environment (`projectfinance`) and install Django, DRF, `psycopg`, and `django-cors-headers`.
  2. Configure `backend/config/settings.py` with environment variable loading via `python-dotenv` and database connection via `dj-database-url`.
  3. Initialize Next.js project with TypeScript and Tailwind CSS inside `frontend/`.
  4. Verify cross-origin connectivity with a basic health-check endpoint (`GET /api/v1/health/`).
* **Deliverables:** Runnable backend and frontend skeletons verifying basic local communications.
* **Definition of Done:** `manage.py check` passes cleanly; database connects; CORS is operational.

---

### Phase 2: Database Design, Models & Migrations
* **Status:** Planned
* **Objective:** Implement the six core relational database entities defined in `docs/data-model.md` using the Django ORM.
* **Core Models:**
  1. Custom `User` model with `role` (`MANAGER` / `TEAM_MEMBER`) and `default_hourly_cost_rate`.
  2. `Client` model with contact information and archiving status.
  3. `Project` model with decimal baselines (`contract_revenue`, `planned_cost_budget`, `planned_hourly_cost_rate`) and nullable `estimated_remaining_hours`.
  4. `ProjectAssignment` join model with composite unique constraint `(project_id, user_id)`.
  5. `TimeEntry` model with positive hours validation and immutable `hourly_cost_snapshot`.
  6. `Expense` model with status choices (`PENDING`, `APPROVED`, `REJECTED`) and reviewer tracking.
* **Seeding & Fixture Task:**
  - Implement a repeatable, idempotent Django management command: `seed_demo_data`.
  - **Demo Dataset Specification:**
    - 1 Manager account: `manager@agency.com` / `ManagerPass123!` (Rate: `$125.00/hr`).
    - 2 Team Member accounts: `dev1@agency.com` / `DevPass123!` (Rate: `$75.00/hr`), `dev2@agency.com` / `DevPass123!` (Rate: `$60.00/hr`).
    - 3 Clients: `Acme Corp`, `Apex Retail`, `Starlight Labs`.
    - 3+ Projects:
      - Project Alpha (`HEALTHY`): Low spend, valid remaining hours estimate, forecast well within budget.
      - Project Beta (`AT_RISK`): High spend ($> 80\%$ budget consumed) or forecasted overrun.
      - Project Gamma (`OVER_BUDGET`): Actual spend exceeds planned budget ceiling.
      - Project Delta (`INSUFFICIENT_DATA`): Active project with `estimated_remaining_hours = null`.
    - Project assignments establishing both authorized and unassigned project scenarios to support IDOR testing.
    - Multiple time entries whose costs reconcile exactly with project labor cost totals.
    - Expenses in `PENDING`, `APPROVED`, and `REJECTED` states.
* **Definition of Done:** Migrations apply cleanly; `seed_demo_data` can be run repeatedly without duplicating records or corrupting existing data.

---

### Phase 3: Authentication, Authorization & User Roles
* **Status:** Planned (JWT Prototype Verified)
* **Objective:** Finalize secure user authentication and server-side RBAC / OLAC.
* **Tasks:**
  1. Wire SimpleJWT authentication endpoints (`/api/v1/auth/login/`, `/api/v1/auth/refresh/`, `/api/v1/auth/me/`).
  2. Implement DRF custom permissions for `MANAGER` vs. `TEAM_MEMBER`.
  3. Implement object-level permission (`IsProjectAssigned`) preventing unassigned access.
  4. Enforce serializer field masking (concealing rates and profit margins from team members).
  5. Implement automated tests verifying role restrictions, IDOR protection, and inactive account rejection.
* **Deliverables:** Tested authentication endpoints; verified permission classes.
* **Definition of Done:** Unauthenticated requests are rejected; team members cannot access manager views; test cases TC-AUTH-01 through TC-AUTH-08 pass 100%.

---

### Phase 4: Core CRUD APIs & Expense State Machine
* **Status:** Planned
* **Objective:** Implement RESTful API endpoints for Clients, Projects, Assignments, Time Entries, and Expenses.
* **Tasks:**
  1. Implement Client CRUD views and serializers (`/api/v1/clients/`).
  2. Implement Project CRUD views with serializer data masking for team members (`/api/v1/projects/`).
  3. Implement Project Assignment endpoints (`/api/v1/projects/{project_id}/assignments/`).
  4. Implement TimeEntry views with automated `hourly_cost_snapshot` capture from `request.user` (`/api/v1/time-entries/`).
  5. Implement Expense views and review action (`/api/v1/expenses/{id}/review/`).
  6. Enforce validation rules: reject negative hours, negative amounts, and empty rejection notes.
* **Deliverables:** Fully functional CRUD API endpoints matching `docs/api-specification.md`.
* **Definition of Done:** All CRUD endpoints respond with correct status codes and error envelopes; TC-EXP-01 through TC-EXP-05 pass.

---

### Phase 5: Financial Calculation Engine & Comprehensive Testing
* **Status:** Planned
* **Objective:** Implement the pure, deterministic financial calculation service and dashboard summary endpoints.
* **Tasks:**
  1. Implement pure Python calculation service in `backend/finance/services.py` adhering to `docs/financial-rules.md`.
  2. Implement precedence-based deterministic risk status evaluator.
  3. Implement defensive checks against division by zero and null estimates.
  4. Expose `GET /api/v1/projects/{id}/financial-summary/` and `GET /api/v1/dashboard/summary/`.
  5. Implement complete unit test suite covering Scenarios 1 through 5 and TC-NUM-01 through TC-NUM-08.
* **Deliverables:** Tested, isolated financial calculation module; financial summary endpoints.
* **Definition of Done:** 100% of financial unit tests pass with zero floating-point usage; calculations match worked examples to the exact cent.

---

### Phase 6: Frontend Integration & Essential Workflows
* **Status:** Planned
* **Objective:** Build the responsive Next.js web application connecting to the backend API.
* **Tasks:**
  1. Build layout, authentication forms (Login), and role-based client routing.
  2. Build Manager Dashboard displaying aggregate portfolio metrics and at-risk project alerts.
  3. Build Project Financial Details page with burn rate indicators, status badges, and budget metrics.
  4. Build Time Entry logging form and member timesheet view.
  5. Build Expense submission form and Manager Expense Review interface.
  6. Implement loading skeletons, empty states, and user-friendly error banners.
* **Deliverables:** Complete Next.js frontend integrated with Django backend.
* **Definition of Done:** User can log in, log time, approve expenses, and see immediate budget updates in the browser without manual page refreshes.

---

### Phase 7: AI Risk Advisor Integration & Evaluation
* **Status:** Planned
* **Objective:** Integrate the Google Gemini API server-side to provide plain-language risk explanations and recommendations.
* **Tasks:**
  1. Implement backend AI service in `backend/ai_advisor/services.py` with sanitized prompt assembly.
  2. Integrate official Google GenAI SDK using `GEMINI_API_KEY`.
  3. Implement structured output validation enforcing the schema defined in `docs/ai-risk-advisor.md`.
  4. Implement robust timeout (10s) and error handling fallback logic.
  5. Expose `POST /api/v1/projects/{id}/ai-risk-analysis/` to Managers.
  6. Build frontend "AI Risk Advisor" widget with clear "Advisory" labeling.
  7. Run 15 benchmark evaluation scenarios and document results.
* **Deliverables:** Server-side AI service; frontend advisor widget; evaluation report.
* **Definition of Done:** AI generates grounded recommendations; simulated Gemini outages do not break the financial dashboard; TC-AI-01 through TC-AI-05 pass.

---

### Phase 8: Security Hardening, Regression & Responsive Polish
* **Status:** Planned
* **Objective:** Perform end-to-end security audits, mobile responsive testing, and regression verification.
* **Tasks:**
  1. Review CORS, CSRF, and HTTP headers.
  2. Audit client bundles to ensure zero secret leakage (`NEXT_PUBLIC_` audit).
  3. Test interface responsiveness across mobile, tablet, and desktop breakpoints.
  4. Run complete backend and frontend test suites.
* **Deliverables:** Hardened, fully responsive web application with zero security regressions.
* **Definition of Done:** All automated tests pass; zero console errors; zero leaked secrets in build artifacts.

---

### Phase 9: Portfolio Polish, Documentation Finalization & Demo Prep
* **Status:** Planned
* **Objective:** Polish repository presentation for external review and portfolio demonstration.
* **Tasks:**
  1. Update `README.md` with final architecture notes, local setup commands, and project reflections.
  2. Record a brief video or animated walkthrough demonstration of key workflows.
  3. Document technical trade-offs and future architectural evolution in project retrospective.
  4. Verify clean Git commit history.
* **Deliverables:** Public-ready portfolio repository; finalized documentation.

---

## 3. Scope Boundaries: Must-Have (MVP) vs. Deferred

| Feature | Must-Have (MVP) | Deferred to Future |
| :--- | :---: | :---: |
| Single-Agency Architecture | Yes | |
| Role-Based Access (`MANAGER` vs `TEAM_MEMBER`) | Yes | |
| Project Assignments (`ProjectAssignment`) | Yes | |
| Time Logging with Immutable Rate Snapshots | Yes | |
| Expense Tracking & Two-Stage Review Lifecycle | Yes | |
| Pure Deterministic Financial Engine | Yes | |
| Four-State Risk Classification | Yes | |
| Server-Side Gemini AI Risk Advisor | Yes | |
| Automated Invoice PDF Generation | | Deferred |
| Stripe Payment Gateway Integration | | Deferred |
| Live Multi-Currency Conversion | | Deferred |
| Real-Time Desktop Stopwatch Tracker | | Deferred |
| Cloud Object Storage for Receipts | | Deferred |
| Multi-Tenant SaaS Infrastructure | | Deferred |
