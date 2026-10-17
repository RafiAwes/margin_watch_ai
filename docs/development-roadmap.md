# MarginWatch — Phased Development Roadmap

**Document Status:** Approved Roadmap (Phase 0)  
**Last Updated:** October 2026  
**Audience:** Full-Stack Engineers, Evaluators, Project Reviewers  

---

## 1. Roadmap Architecture & Execution Philosophy

This roadmap organizes the development of MarginWatch into **10 disciplined milestones (Phases 0 through 9)**. Development follows an independent, documentation-first approach where each milestone builds incrementally upon the tested outputs of the previous phase.

```
[Phase 0: Docs & Rules] ──► [Phase 1: Frameworks] ──► [Phase 2: Database Models]
                                                               │
                                                               ▼
[Phase 5: Financials] ◄── [Phase 4: CRUD APIs] ◄── [Phase 3: Auth & RBAC]
         │
         ▼
[Phase 6: Frontend] ──► [Phase 7: AI Advisor] ──► [Phase 8: Hardening] ──► [Phase 9: Delivery]
```

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
  5. Author architectural decision record (`docs/decisions/ADR-001-initial-architecture.md`).
  6. Establish `.gitignore`, `.env.example`, `CONTRIBUTING.md`, and top-level `README.md`.
* **Deliverables:** Complete documentation suite and clean repo scaffolding.
* **Definition of Done:** All documentation files cross-checked for consistency; zero premature source code written.

---

### Phase 1: Repository & Framework Initialization
* **Status:** Planned Next Phase
* **Objective:** Initialize clean Django and Next.js projects inside their respective directories without adding custom domain logic.
* **Tasks:**
  1. Initialize Python virtual environment and install Django, Django REST Framework, and `django-cors-headers`.
  2. Initialize Django project structure inside `backend/` with standard configuration.
  3. Initialize Next.js project with TypeScript and Tailwind CSS inside `frontend/`.
  4. Configure local environment loading (`.env`) for both frontend and backend.
  5. Verify cross-origin connectivity with a basic health-check endpoint (`GET /api/v1/health/`).
* **Dependencies:** Phase 0 completion.
* **Deliverables:** Runnable backend and frontend skeletons verifying basic local communications.
* **Definition of Done:** `manage.py check` passes cleanly; Next.js dev server builds and renders default home page; health endpoint returns `{"status": "ok"}`.

---

### Phase 2: Database Design, Models & Migrations
* **Status:** Planned
* **Objective:** Implement the relational database entities defined in `docs/data-model.md` using the Django ORM with SQLite.
* **Tasks:**
  1. Implement custom `User` model with `role` and `default_hourly_cost_rate`.
  2. Implement `Client` and `Project` models with decimal fields for financial baselines.
  3. Implement `ProjectMembership` join model.
  4. Implement `TimeEntry` model with `hours_worked` validation and `cost_rate_snapshot`.
  5. Implement `Expense` model with status choices and audit tracking fields.
  6. Generate and run initial database migrations.
  7. Seed local development database with realistic fixture data.
* **Dependencies:** Phase 1 completion.
* **Deliverables:** Django migration files; populated local SQLite database; Django admin configured for all models.
* **Definition of Done:** All migrations run without conflict; Django admin allows creating clients, projects, time entries, and expenses.

---

### Phase 3: Authentication, Authorization & User Roles
* **Status:** Planned
* **Objective:** Implement secure user authentication and server-side RBAC / OLAC.
* **Tasks:**
  1. Implement token or session authentication endpoints (`/auth/login/`, `/auth/me/`, `/auth/logout/`).
  2. Implement DRF custom permissions for `AGENCY_MANAGER` vs. `TEAM_MEMBER`.
  3. Implement object-level permission (`IsProjectMemberOrManager`) preventing unauthorized project access.
  4. Implement automated tests verifying role restrictions and IDOR protection.
* **Dependencies:** Phase 2 completion.
* **Deliverables:** Tested authentication endpoints; verified permission classes.
* **Definition of Done:** Unauthenticated requests are rejected; team members cannot access manager views; test suite TC-SEC-01 through TC-SEC-04 pass.

---

### Phase 4: Core CRUD APIs & Expense State Machine
* **Status:** Planned
* **Objective:** Implement RESTful API endpoints for Clients, Projects, Time Entries, and Expenses.
* **Tasks:**
  1. Implement Client CRUD views and serializers.
  2. Implement Project CRUD views with serializer data masking for team members.
  3. Implement TimeEntry views with automated `cost_rate_snapshot` capture from `request.user`.
  4. Implement Expense views and approval actions (`/approve/`, `/reject/`).
  5. Enforce validation rules: reject negative hours, negative amounts, and empty rejection reasons.
* **Dependencies:** Phase 3 completion.
* **Deliverables:** Fully functional CRUD API endpoints matching `docs/api-specification.md`.
* **Definition of Done:** All CRUD endpoints respond with correct status codes and error envelopes; TC-EXP-01 through TC-EXP-04 pass.

---

### Phase 5: Financial Calculation Engine & Comprehensive Testing
* **Status:** Planned
* **Objective:** Implement the pure, deterministic financial calculation service and dashboard summary endpoints.
* **Tasks:**
  1. Implement pure Python calculation service in `backend/finance/services.py` adhering to `docs/financial-rules.md`.
  2. Implement precedence-based deterministic risk status evaluator.
  3. Implement defensive checks against division by zero and null estimates.
  4. Expose `GET /api/v1/projects/{id}/financial-summary/` and `GET /api/v1/dashboard/summary/`.
  5. Implement complete unit test suite covering Scenarios 1 through 5 and TC-FIN-01 through TC-FIN-07.
* **Dependencies:** Phase 4 completion.
* **Deliverables:** Tested, isolated financial calculation module; financial summary endpoints.
* **Definition of Done:** 100% of financial unit tests pass with zero floating-point usage; calculations match worked examples to the exact cent.

---

### Phase 6: Frontend Integration & Essential Workflows
* **Status:** Planned
* **Objective:** Build the responsive Next.js web application connecting to the backend API.
* **Tasks:**
  1. Build layout, authentication forms (Login), and role-based client routing.
  2. Build Agency Manager Dashboard displaying aggregate portfolio metrics and at-risk project alerts.
  3. Build Project Financial Details page with burn rate indicators, status badges, and budget metrics.
  4. Build Time Entry logging form and member timesheet view.
  5. Build Expense submission form and Manager Expense Approval/Rejection interface.
  6. Implement loading skeletons, empty states, and user-friendly error banners.
* **Dependencies:** Phase 5 completion.
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
  5. Expose `POST /api/v1/projects/{id}/ai-risk-analysis/` to Agency Managers.
  6. Build frontend "AI Risk Advisor" widget with clear "Advisory" labeling.
  7. Run 15 benchmark evaluation scenarios and document results.
* **Dependencies:** Phase 6 completion.
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
  5. Validate SQLite to PostgreSQL migration script and documentation.
* **Dependencies:** Phase 7 completion.
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
* **Dependencies:** Phase 8 completion.
* **Deliverables:** Public-ready portfolio repository; finalized documentation.
* **Definition of Done:** Repository is self-contained, easily installable from documentation, and ready for technical peer review.

---

## 3. Scope Boundaries: Must-Have (MVP) vs. Nice-to-Have (v1.1+)

| Feature | Must-Have (MVP) | Deferred to v1.1+ |
| :--- | :---: | :---: |
| Client & Project Management | Yes | |
| Role-Based Access (`MANAGER` vs `MEMBER`) | Yes | |
| Time Logging with Rate Snapshots | Yes | |
| Expense Tracking & Two-Stage Approval | Yes | |
| Pure Deterministic Financial Engine | Yes | |
| Four-State Risk Classification | Yes | |
| Server-Side Gemini AI Risk Advisor | Yes | |
| SQLite Local Development Setup | Yes | |
| Automated Invoice PDF Generation | | Yes |
| Stripe Payment Gateway Integration | | Yes |
| Live Multi-Currency Conversion | | Yes |
| Real-Time Desktop Stopwatch Tracker | | Yes |
| Cloud Object Storage for Receipts | | Yes |
| Multi-Tenant Schema Separation | | Yes |
