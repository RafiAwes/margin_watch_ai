# MarginWatch — Private Project Context, Phased Roadmap & Control System

> **Confidentiality Notice:** This document is maintained for the repository owner's private development workflow and local AI coding agent sessions. It is the authoritative control system, roadmap, and state-synchronization file for MarginWatch.
>
> **Authoritative Specification Links:**
> - System Architecture: [`docs/architecture.md`](docs/architecture.md)
> - Architectural Decision Records: [`docs/decisions/`](docs/decisions/)
>   - [ADR-001: Initial Architecture](docs/decisions/ADR-001-initial-architecture.md)
>   - [ADR-002: Single-Agency Architecture](docs/decisions/ADR-002-single-agency-architecture.md)
>   - [ADR-003: Financial Rules & Classification](docs/decisions/ADR-003-financial-rules-and-risk-classification.md)
> - Requirements & Scope: [`docs/requirements.md`](docs/requirements.md)
> - Financial Rules & Calculations: [`docs/financial-rules.md`](docs/financial-rules.md)
> - Data Model & ERD: [`docs/data-model.md`](docs/data-model.md)
> - Backend Apps & Models Blueprint: [`docs/backend/backend-apps-and-data-models.md`](docs/backend/backend-apps-and-data-models.md)
> - API Specification: [`docs/api-specification.md`](docs/api-specification.md)
> - Security & Permissions: [`docs/security-and-permissions.md`](docs/security-and-permissions.md)
> - Testing Strategy: [`docs/testing-strategy.md`](docs/testing-strategy.md)
> - AI Risk Advisor: [`docs/ai-risk-advisor.md`](docs/ai-risk-advisor.md)
> - Frontend Blueprint Suite: [`frontend/docs/frontend/`](frontend/docs/frontend/)

---

## Table of Contents
1. [Current Session State](#1-current-session-state)
2. [Master Phase Tracker](#2-master-phase-tracker)
3. [Project Identity & Architectural Blueprint](#3-project-identity--architectural-blueprint)
4. [Agent Operating Rules & Working Method](#4-agent-operating-rules--working-method)
5. [Phase Gate Protocol](#5-phase-gate-protocol)
6. [Detailed Phased Development Roadmap](#6-detailed-phased-development-roadmap)
   - [Phase 0: Repository Audit and Project Alignment](#phase-0--repository-audit-and-project-alignment)
   - [Phase 1: Requirements, Scope and Financial Rules](#phase-1--requirements-scope-and-financial-rules)
   - [Phase 2: Architecture, Data Models and API Contracts](#phase-2--architecture-data-models-and-api-contracts)
   - [Phase 3: Repository and Development Environment](#phase-3--repository-and-development-environment)
   - [Phase 4: Backend Foundation, Models and Authentication](#phase-4--backend-foundation-models-and-authentication)
   - [Phase 5: Core Backend APIs and CRUD Workflows](#phase-5--core-backend-apis-and-crud-workflows)
   - [Phase 6: Financial Engine and Deterministic Risk Assessment](#phase-6--financial-engine-and-deterministic-risk-assessment)
   - [Phase 7: Frontend Foundation and Main User Workflows](#phase-7--frontend-foundation-and-main-user-workflows)
   - [Phase 8: Gemini AI Risk Advisor](#phase-8--gemini-ai-risk-advisor)
   - [Phase 9: Integration, Security and Regression Testing](#phase-9--integration-security-and-regression-testing)
   - [Phase 10: Documentation, Demo Data and Submission Preparation](#phase-10--documentation-demo-data-and-submission-preparation)
   - [Phase 11: Final Review and Retrospective](#phase-11--final-review-and-retrospective)
7. [Decision, Discrepancy & Blocker Register](#7-decision-discrepancy--blocker-register)
8. [Assessment Readiness Tracker](#8-assessment-readiness-tracker)

---

## 1. Current Session State

| Field | Value | Notes / Evidence |
| :--- | :--- | :--- |
| **Current Phase** | **Phase 4: Backend Foundation, Models and Authentication** | Core `users` app extended with permissions (`IsManager`, `IsOwnerOrManager`), token blacklist logout (`/api/v1/auth/logout/`), and User Management API (`/api/v1/users/`). |
| **Current Task** | Run user test suite and apply database migrations for `rest_framework_simplejwt.token_blacklist`. | Awaiting user test run in terminal. |
| **Last Completed Task** | Implemented User Management ViewSet, custom RBAC permissions, and Logout endpoint in `users` app. | Files: `permissions.py`, `views.py`, `serializers.py`, `urls.py`, `settings.py`, `tests.py`. |
| **Current Blockers** | None. | Environment ready for test execution. |
| **Decisions Awaiting Approval** | Frontend architecture alignment (Vite + React 19 vs Next.js App Router). | `DEC-001` and `DEC-004` resolved. |
| **Next Recommended Action** | Run `python manage.py migrate` and `python manage.py test users --keepdb` to verify the 17 auth and user management tests. | User runs in active terminal. |
| **Last Synchronization Date** | October 18, 2026 | Session state updated. |

---

## 2. Master Phase Tracker

Statuses:
- `NOT_STARTED`: No implementation work has begun.
- `IN_PROGRESS`: Work has begun but acceptance criteria are not satisfied.
- `IMPLEMENTED`: Implementation exists, but verification may be incomplete.
- `VERIFIED`: Implementation has been checked against acceptance criteria and tests/checks pass.
- `BLOCKED`: Work cannot proceed due to external dependency, defect, or missing decision.
- `DEFERRED`: Intentionally postponed with documented rationale.

Gate States:
- `NOT_READY`: Prerequisites or acceptance criteria incomplete.
- `READY_FOR_REVIEW`: All phase tasks and verification completed; waiting for user review.
- `APPROVED`: Explicitly approved by the project owner.
- `REOPENED`: Previously verified work invalidated or requiring revision.

| Phase | Name | Status | Tasks Complete | Gate Status | Blocker |
| :---: | :--- | :---: | :---: | :---: | :--- |
| **0** | Repository Audit and Project Alignment | `VERIFIED` | 8 / 8 | `READY_FOR_REVIEW` | None |
| **1** | Requirements, Scope and Financial Rules | `VERIFIED` | 12 / 12 | `READY_FOR_REVIEW` | None |
| **2** | Architecture, Data Models and API Contracts | `VERIFIED` | 14 / 14 | `READY_FOR_REVIEW` | Open decision on `users` vs `accounts` app naming |
| **3** | Repository and Development Environment | `VERIFIED` | 10 / 10 | `READY_FOR_REVIEW` | None |
| **4** | Backend Foundation, Models & Authentication | `IN_PROGRESS` | 4 / 11 | `NOT_READY` | Needs user approval to proceed with core models |
| **5** | Core Backend APIs and CRUD Workflows | `NOT_STARTED` | 0 / 10 | `NOT_READY` | Depends on Phase 4 completion |
| **6** | Financial Engine & Deterministic Risk | `NOT_STARTED` | 0 / 13 | `NOT_READY` | Depends on Phase 5 completion |
| **7** | Frontend Foundation & Main User Workflows | `IN_PROGRESS` | 4 / 13 | `NOT_READY` | Mock prototype exists; real API integration pending backend |
| **8** | Gemini AI Risk Advisor | `NOT_STARTED` | 0 / 12 | `NOT_READY` | Depends on Phase 6 verified financial engine |
| **9** | Integration, Security & Regression Testing | `NOT_STARTED` | 0 / 14 | `NOT_READY` | Depends on Phases 4–8 completion |
| **10** | Documentation, Demo Data & Submission Prep | `IN_PROGRESS` | 5 / 14 | `NOT_READY` | Specs complete; demo data and rehearsed walk-through pending |
| **11** | Final Review and Retrospective | `NOT_STARTED` | 0 / 10 | `NOT_READY` | Depends on Phase 10 completion |

---

## 3. Project Identity & Architectural Blueprint

### 3.1 Core Problem Statement & Mission
Small-to-midsize software agencies executing fixed-price client delivery projects routinely suffer budget overruns because:
1. Labor hours accumulate invisibly without immediate financial visibility.
2. Direct project expenses are tallied long after invoicing.
3. Agency managers conflate budget consumed with completion progress or erroneously treat missing estimates as zero.

**The Question MarginWatch Answers:**
> *"Based on recorded labor hours, approved expenses, and estimated remaining work, is a project likely to finish within its planned delivery-cost budget?"*

### 3.2 System Users & Permissions
- **`MANAGER`**: Complete operational and financial authority. Manages clients, projects, budgets, contract revenues, user cost rates, and project assignments; reviews/approves expenses; inspects profit margins and deterministic risk classifications; requests AI risk advice.
- **`TEAM_MEMBER`**: Restricted strictly to assigned projects (`ProjectAssignment`). Logs work hours; views own time entries; submits direct expenses with receipts. Has zero visibility into client billing, profit margins, cost budgets, or colleague wage rates.

### 3.3 Core Architectural Law: Single-Agency
MarginWatch is built for **one software agency only**:
- The agency is represented implicitly by the application instance.
- **No `Agency`, `Tenant`, or `AgencyMembership` database models exist.**
- **No `agency_id` attribute exists** in any model, endpoint, request body, header, or query parameter.
- Multi-tenancy abstractions are strictly barred to preserve simplicity and prevent speculative complexity.

### 3.4 Technology Stack
| Layer | Verified Installed / Configured | Target Specification |
| :--- | :--- | :--- |
| **Backend Runtime** | Python 3.15 (Conda `projectfinance`) | Python 3.15+ |
| **Backend Framework** | Django 6.1.2, Django REST Framework 3.18.3 | Django 5.x / 6.x, DRF 3.15+ |
| **Authentication** | `djangorestframework-simplejwt` 5.5.0 | JWT (access + refresh tokens) |
| **Database** | Neon Cloud PostgreSQL (pooled runtime + unpooled test runner via `backend/config/test_runner.py`), SQLite compatible | PostgreSQL / SQLite |
| **Frontend Runtime** | Node.js / npm with React 19.0.1, TypeScript 7.0.2 | React 19 / TypeScript / Vite (Prototype running) vs. Next.js App Router (Documented target) |
| **Styling** | Tailwind CSS 4.3.3 (`@tailwindcss/vite`) | Tailwind CSS |
| **Icons & Motion** | `lucide-react` 0.546.0, `motion` 12.23.24 | Lucide Icons, Framer Motion / Motion |
| **AI Integration** | Google Gemini API (`gemini-2.5-flash`), server-to-server only | Google Gemini 2.5 Flash |

### 3.5 Foundational Architectural Principles
1. **Backend Financial Authority:** All calculations and risk classifications are computed exclusively on the backend using Python's fixed-point `Decimal` arithmetic.
2. **AI Advisory Decoupling:** AI explains and advises based on facts; it never calculates, modifies, or overrides deterministic financial metrics.
3. **Dedicated Service Layer:** Financial calculations live in `profitability/services.py` (pure functions with zero side effects).
4. **Historical Rate Immutability:** When a time entry is logged, the user's active rate is snapshotted (`hourly_cost_snapshot`). Future wage changes never alter historical delivery costs.
5. **Two-Stage Expense Accounting:** Expenses start as `PENDING`. Only `APPROVED` expenses contribute to actual project costs. `PENDING` and `REJECTED` contribute `$0.00`.
6. **No Silent Estimate Coercion:** Missing estimated remaining hours (`null`) means *unknown*, not zero. Forecasts are suppressed (`insufficient_data`) rather than falsified.
7. **Safe Data Retention:** Financial models enforce `on_delete=models.PROTECT` or `models.RESTRICT` to prevent accidental cascading destruction of financial audits.

---

## 4. Agent Operating Rules & Working Method

The coding assistant must abide strictly by these 10 operating rules across all turns and tasks:

### Rule 1: One Phase at a Time
- Work only on the currently authorized phase and task.
- Do not jump ahead to future phases.
- Do not implement unsolicited features or speculative abstractions.

### Rule 2: One Logical Task at a Time
Break work into digestible, transparent steps:
1. Explain the goal.
2. Explain why it is needed.
3. Identify files and components involved.
4. Describe the expected outcome.
5. Provide the verification mechanism.
6. Perform only the authorized scope.
7. Report exact results and anomalies.

### Rule 3: Stop at Checkpoints
At the conclusion of each authorized task, report:
- What was requested.
- What was changed.
- Files affected.
- Tests or verification commands executed and results.
- Remaining tasks in the current phase.
- Any decision requiring user approval.
- The next recommended task.
- *Wait for user instruction before executing the next task.*

### Rule 4: Never Silently Expand Scope
- Never add unapproved dependencies, apps, models, or architectural layers.
- Always prefer the simplest solution that fulfills the approved requirement.
- Highlight any requirement conflict immediately.

### Rule 5: Explain Decisions Without Overwhelming
- Explain what the decision is, why it matters, the recommended path, trade-offs, and downstream impacts.
- Keep discussions practical, concise, and grounded in code evidence.

### Rule 6: Preserve User Control Over Implementation
- Follow user-directed boundaries.
- When instructed to guide or review, explain steps clearly rather than blindly replacing files.
- Never claim success without verification.

### Rule 7: Respect Assessment Restrictions
- Verify applicable assessment rules before every task.
- When assessment rules restrict automated code generation, act strictly as a technical reviewer, documentation maintainer, architect, and debugging coach.
- If assessment constraints are ambiguous, stop and request clarification.

### Rule 8: Never Fabricate Verification
- Maintain strict distinction between `PLANNED`, `IMPLEMENTED`, and `VERIFIED`.
- If a command was not run, explicitly state that it was not run.
- If a test fails, report the exact failure and traceback honestly.

### Rule 9: Keep `PROJECT_CONTEXT.md` Synchronized
- Update this document when authorized or when completing milestones.
- Keep task checklists, session states, and decision logs up to date.
- Avoid full document rewrites; apply focused, clean updates.

### Rule 10: Ask Before Resolving Consequential Ambiguity
- Never guess on breaking changes, database schemas, financial formulas, authentication keys, or security rules.
- Clarify with the project owner first.

---

## 5. Phase Gate Protocol

Every phase must pass through an explicit review gate before progression:

```
[ NOT_READY ] ──► (All tasks verified) ──► [ READY_FOR_REVIEW ] ──► (Owner Approval) ──► [ APPROVED ]
                                                     │
                                            (Defect discovered)
                                                     ▼
                                                [ REOPENED ]
```

1. **Gate Prerequisites:**
   - All tasks in the phase have satisfied acceptance criteria.
   - Associated test suites or manual verification checks pass with zero unhandled errors.
   - Open issues and technical debt are documented.
   - `PROJECT_CONTEXT.md` reflects actual state.
2. **Approval Authority:**
   - **Only the project owner can mark a gate `APPROVED`.**
   - The AI agent may propose `READY_FOR_REVIEW` with supporting evidence, but must not self-approve or proceed into the next phase without explicit authorization.

---

## 6. Detailed Phased Development Roadmap

---

### Phase 0 — Repository Audit and Project Alignment
- **Phase ID:** `PHASE-00`
- **Purpose:** Audit existing repository structure, cross-verify all architectural documentation, and establish a single source of truth.
- **Status:** `VERIFIED`
- **Gate Status:** `READY_FOR_REVIEW`
- **Dependencies:** None
- **Tasks in Execution Order:**
  - [x] Task 0.1: Inspect repository structure, files, and Git branches (`master`, `backend`, `frontend`).
  - [x] Task 0.2: Review specifications (`docs/requirements.md`, `financial-rules.md`, `architecture.md`, `data-model.md`, `backend-apps-and-data-models.md`, `frontend/docs/frontend/`).
  - [x] Task 0.3: Inspect uncommitted files, branches, and synchronization status.
  - [x] Task 0.4: Compare actual implementation with documented specifications.
  - [x] Task 0.5: Reconcile single-agency terminology across documentation (eliminated lingering multi-tenant agency references).
  - [x] Task 0.6: Identify architectural and configuration discrepancies (app naming `users` vs `accounts`, frontend Vite vs Next.js).
  - [x] Task 0.7: Establish initial project status tracker and decision register in `PROJECT_CONTEXT.md`.
  - [x] Task 0.8: Review assessment constraints and development boundaries.
- **Expected Deliverables:** Clean Git tree, synchronized master/backend/frontend branches, and comprehensive `PROJECT_CONTEXT.md`.
- **Acceptance Criteria:** Repository state is grounded in verifiable evidence; documentation contains zero fabricated statuses; single-agency mandate is preserved throughout.
- **Verification Performed:** Git logs, directory listings, document text comparisons.
- **Common Mistakes Avoided:** Assuming features were implemented merely because they appeared in documentation.
- **Scope Exclusions:** No application code changes; Markdown documentation only.
- **Phase Results & Notes:**
  - *Started:* October 18, 2026 | *Completed:* October 18, 2026
  - *Verification Evidence:* Git history clean; `users` app verified in backend; `financial-engine.ts` created in frontend; all doc references reconciled.
  - *Next Task:* Await owner approval to close Phase 0 gate.

---

### Phase 1 — Requirements, Scope and Financial Rules
- **Phase ID:** `PHASE-01`
- **Purpose:** Freeze the single-agency MVP requirements, user roles, financial formulas, and deterministic risk precedence rules.
- **Status:** `VERIFIED`
- **Gate Status:** `READY_FOR_REVIEW`
- **Dependencies:** Phase 0 audit complete.
- **Tasks in Execution Order:**
  - [x] Task 1.1: Define primary user workflow (Manager configures client/project; Team member logs time/expenses; Manager reviews expenses & inspects financial burn).
  - [x] Task 1.2: Confirm role permissions (`MANAGER` vs `TEAM_MEMBER`).
  - [x] Task 1.3: Confirm single-agency architectural boundaries ([ADR-002](docs/decisions/ADR-002-single-agency-architecture.md)).
  - [x] Task 1.4: Define project lifecycle states (`PLANNING`, `ACTIVE`, `ON_HOLD`, `COMPLETED`, `CANCELLED`).
  - [x] Task 1.5: Finalize authoritative mathematical formulas in `docs/financial-rules.md`:
    - Actual Labor Cost: $C_{labor} = \sum (hours_i \times snapshot_i)$
    - Actual Expense Cost: $C_{expense} = \sum amount_j$ (approved only)
    - Actual Total Cost: $C_{actual} = C_{labor} + C_{expense}$
    - Budget Consumption %: $P_{consumed} = (C_{actual} / B) \times 100$
    - Remaining Labor Cost: $C_{rem\_labor} = H_{remaining} \times R_{planned}$
    - Projected Final Cost: $C_{projected} = C_{actual} + C_{rem\_labor} + E_{remaining}$
    - Projected Profit: $\Pi_{projected} = R_{contract} - C_{projected}$
    - Projected Margin %: $M_{projected} = (\Pi_{projected} / R_{contract}) \times 100$
  - [x] Task 1.6: Define expense approval state machine (`PENDING` $\rightarrow$ `APPROVED` / `REJECTED`).
  - [x] Task 1.7: Define missing-data behavior (`null` remaining hours suppresses forecast; produces `insufficient_data`).
  - [x] Task 1.8: Codify deterministic risk precedence hierarchy ([ADR-003](docs/decisions/ADR-003-financial-rules-and-risk-classification.md)):
    1. `OVER_BUDGET`: $C_{actual} > B$ (strict priority).
    2. `INSUFFICIENT_DATA`: Within budget, but $H_{remaining}$ or essential forecast input is `null`.
    3. `AT_RISK`: $C_{projected} > B$ or $P_{consumed} \ge 80.0\%$.
    4. `HEALTHY`: Spending and projection strictly within budget.
  - [x] Task 1.9: Define boundary edge cases (division by zero, negative revenue prevention, exact budget match).
  - [x] Task 1.10: Define assessment evaluation criteria.
  - [x] Task 1.11: Explicitly document out-of-scope features (multi-tenancy, invoice generation, automated payroll, real-time socket chat).
  - [x] Task 1.12: Formulate test scenario matrix with worked mathematical examples.
- **Expected Deliverables:** Approved `docs/requirements.md`, `docs/financial-rules.md`, and ADRs.
- **Acceptance Criteria:** Every financial rule is unambiguous and convertible into unit tests; zero conflicting formulas across documents.
- **Verification Performed:** Reconciled formulas in `docs/financial-rules.md` against ADR-003 and `frontend/src/lib/financial-engine.ts`.
- **Common Mistakes Avoided:** Treating missing remaining hours as zero; including pending expenses in actual cost; averaging margin percentages.
- **Scope Exclusions:** No source code or model implementations.
- **Phase Results & Notes:**
  - *Started:* October 18, 2026 | *Completed:* October 18, 2026
  - *Verification Evidence:* Complete documents present in repository with zero remaining `AGENCY_MANAGER` or multi-tenant references.

---

### Phase 2 — Architecture, Data Models and API Contracts
- **Phase ID:** `PHASE-02`
- **Purpose:** Establish relational database schemas, integrity constraints, deletion policies, permission matrices, and API contracts.
- **Status:** `VERIFIED`
- **Gate Status:** `READY_FOR_REVIEW`
- **Dependencies:** Phase 1 approved requirements.
- **Tasks in Execution Order:**
  - [x] Task 2.1: Finalize custom `User` model attributes (`email`, `full_name`, `role`, `default_hourly_cost_rate`, `is_active`).
  - [x] Task 2.2: Establish email as primary login identifier (`USERNAME_FIELD = "email"`).
  - [x] Task 2.3: Finalize JWT authentication architecture (`SimpleJWT`).
  - [x] Task 2.4: Finalize primary key strategy (BigAutoField integers for predictable relational integrity).
  - [x] Task 2.5: Document field types, decimal precisions (`max_digits=12, decimal_places=2`), and constraints.
  - [x] Task 2.6: Specify relational integrity rules (`models.PROTECT` on Client $\rightarrow$ Project; `models.PROTECT` on User $\rightarrow$ TimeEntry/Expense).
  - [x] Task 2.7: Define `ProjectAssignment` unique composite constraint `(project_id, user_id)`.
  - [x] Task 2.8: Document complete RESTful API contract in `docs/api-specification.md`.
  - [x] Task 2.9: Document permission matrix (`IsManager`, `IsAssignedTeamMember`, `IsOwnerOrManager`).
  - [x] Task 2.10: Define financial summary payload schema (`/api/v1/projects/{id}/financial-summary/`).
  - [x] Task 2.11: Define AI advisor request/response schema (`/api/v1/projects/{id}/ai-advice/`).
  - [x] Task 2.12: Standardize API error payload structure (`{"detail": "..."}`, `{"field_name": ["..."]}`).
  - [x] Task 2.13: Document query-optimization indexes (e.g. `[project, work_date]` on `TimeEntry`).
  - [x] Task 2.14: Document architectural blueprint in `docs/backend/backend-apps-and-data-models.md`.
- **Expected Deliverables:** `docs/data-model.md`, `docs/api-specification.md`, `docs/security-and-permissions.md`, `docs/backend/backend-apps-and-data-models.md`.
- **Acceptance Criteria:** Model attributes and foreign key behaviors fully specified; API payload schemas consistent across frontend and backend specs.
- **Verification Performed:** Document cross-referencing and schema review.
- **Scope Exclusions:** Writing migrations or views.
- **Phase Results & Notes:**
  - *Started:* October 18, 2026 | *Completed:* October 18, 2026
  - *Open Issue:* Blueprint uses app name `accounts` while existing working codebase uses `users`. Documented in Decision Register.

---

### Phase 3 — Repository and Development Environment
- **Phase ID:** `PHASE-03`
- **Purpose:** Establish clean, reproducible local and cloud development environments for backend and frontend.
- **Status:** `VERIFIED`
- **Gate Status:** `READY_FOR_REVIEW`
- **Dependencies:** Phase 0 audit and repository initialization.
- **Tasks in Execution Order:**
  - [x] Task 3.1: Verify root `.gitignore` ignores virtual environments, secrets, SQLite databases, and node_modules.
  - [x] Task 3.2: Verify `.env.example` documents all required configuration parameters without exposing credentials.
  - [x] Task 3.3: Configure `backend/config/settings.py` with `python-dotenv` and `dj-database-url`.
  - [x] Task 3.4: Configure database routing for Neon PostgreSQL and unpooled test runner connection (`NeonTestRunner`).
  - [x] Task 3.5: Configure CORS headers to permit local frontend requests (`http://localhost:3000`).
  - [x] Task 3.6: Verify backend dependencies installed in Conda environment `(projectfinance)`.
  - [x] Task 3.7: Fix frontend `package.json` esbuild peer dependency conflict with Vite 8 (`esbuild@^0.28.0`).
  - [x] Task 3.8: Update `frontend/vite.config.ts` to standard ESM `import.meta.dirname`.
  - [x] Task 3.9: Run `npm install` inside `frontend/` cleanly with 0 vulnerabilities.
  - [x] Task 3.10: Verify frontend dev server launches cleanly (`npm run dev` running on `http://localhost:3000`).
- **Expected Deliverables:** Working local backend and frontend development setups with verified network and database connectivity.
- **Acceptance Criteria:** `python manage.py check` passes with 0 issues; `npm run dev` compiles without errors; `.env.local` remains uncommitted.
- **Verification Performed:**
  - Backend: Django system checks pass; test runner verified against Neon test database.
  - Frontend: `npm install` succeeded (code 0, 180 packages added); dev server running on port 3000.
- **Scope Exclusions:** Production deployment scripts or CI/CD pipelines.
- **Phase Results & Notes:**
  - *Started:* October 18, 2026 | *Completed:* October 18, 2026
  - *Verification Evidence:* Frontend dev server actively running in terminal; backend `NeonTestRunner` operational.

---

### Phase 4 — Backend Foundation, Models and Authentication
- **Phase ID:** `PHASE-04`
- **Purpose:** Implement the custom User model, core domain models (`Client`, `Project`, `ProjectAssignment`, `TimeEntry`, `Expense`), database constraints, and JWT authentication.
- **Status:** `IN_PROGRESS`
- **Gate Status:** `NOT_READY`
- **Dependencies:** Phases 1–3 completed and approved.
- **Tasks in Execution Order:**
  - [x] Task 4.1: Implement custom `User` model in `backend/users/models.py` with roles `MANAGER` and `TEAM_MEMBER`, `default_hourly_cost_rate`, and email authentication.
  - [x] Task 4.2: Create and apply user migrations (`0001_initial.py`, `0002_alter_user_role.py`).
  - [x] Task 4.3: Implement `seed_dev_users` command to create default manager and team member accounts.
  - [x] Task 4.4: Author and pass comprehensive unit tests for `User` model, role properties, and authentication in `backend/users/tests.py` (8/8 tests pass).
  - [ ] Task 4.5: Create `clients` Django app and implement `Client` model (`name`, `contact_name`, `contact_email`, `is_archived`, timestamps) with deletion protection.
  - [ ] Task 4.6: Create `projects` Django app and implement `Project` model (`client`, `name`, `code`, `status`, `contract_revenue`, `planned_cost_budget`, `planned_hourly_cost_rate`, `estimated_remaining_hours`, `expected_remaining_expenses`, dates).
  - [ ] Task 4.7: Implement `ProjectAssignment` model in `projects` with composite unique constraint `(project, user)`.
  - [ ] Task 4.8: Create `time_tracking` Django app and implement `TimeEntry` model (`project`, `user`, `work_date`, `hours`, `hourly_cost_snapshot`, `notes`) with rate snapshot logic on save.
  - [ ] Task 4.9: Create `expenses` Django app and implement `Expense` model (`project`, `user`, `category`, `amount`, `expense_date`, `status`, `receipt_url`, `notes`, `reviewed_by`, `reviewed_at`, `rejection_reason`).
  - [ ] Task 4.10: Wire SimpleJWT authentication views (`/api/v1/auth/login/`, `/api/v1/auth/refresh/`, `/api/v1/auth/me/`).
  - [ ] Task 4.11: Author comprehensive model constraint and relationship tests for all 5 new entities.
- **Expected Deliverables:** Django models, migrations, admin configurations, and test suites across all core domain entities.
- **Acceptance Criteria:** All 6 domain models exist; migrations apply without conflicts; foreign keys enforce `PROTECT` on critical financial entities; unique constraints prevent duplicate assignments; user tests and model tests pass 100%.
- **Required Verification:** `python manage.py test --keepdb` runs and passes.
- **Common Mistakes to Avoid:** Allowing cascading deletion of projects when a client is deleted; forgetting immutable rate snapshots on `TimeEntry`.
- **Scope Exclusions:** Business calculation services (Phase 6) and Gemini AI integration (Phase 8).
- **Phase Results & Notes:**
  - *Started:* October 18, 2026 | *Last Updated:* October 18, 2026
  - *Current Progress:* `users` app is fully verified (8 tests passing). Next task is creating `clients` and `projects` models.

---

### Phase 5 — Core Backend APIs and CRUD Workflows
- **Phase ID:** `PHASE-05`
- **Purpose:** Build RESTful DRF endpoints, serializers, permissions, and validation for ordinary business operations.
- **Status:** `NOT_STARTED`
- **Gate Status:** `NOT_READY`
- **Dependencies:** Phase 4 models and authentication verified.
- **Tasks in Execution Order:**
  - [ ] Task 5.1: Implement `ClientSerializer`, `ClientViewSet`, filtering, archiving, and manager-only permissions.
  - [ ] Task 5.2: Implement `ProjectSerializer`, `ProjectViewSet`, lifecycle status validation, and role-based queryset filtering (Managers see all; Team Members see assigned only).
  - [ ] Task 5.3: Implement `ProjectAssignmentViewSet` with assignment creation, listing, and revocation.
  - [ ] Task 5.4: Implement `TimeEntrySerializer`, `TimeEntryViewSet` with hours validation ($0 < H \le 24$), assignment checks, and automatic rate-snapshot population.
  - [ ] Task 5.5: Implement `ExpenseSerializer` and submission endpoint for assigned team members.
  - [ ] Task 5.6: Implement expense review action endpoint (`POST /api/v1/expenses/{id}/review/`) with approval state transitions and mandatory rejection reasons.
  - [ ] Task 5.7: Implement object-level permission classes (`IsAssignedTeamMember`, `IsOwnerOrManager`).
  - [ ] Task 5.8: Add pagination, filtering (by project, client, date range, status), and search across list endpoints.
  - [ ] Task 5.9: Implement centralized DRF exception handling for consistent error formats.
  - [ ] Task 5.10: Author API endpoint tests covering happy paths, 400 Bad Request validations, 401 Unauthorized, and 403 Forbidden role checks.
- **Expected Deliverables:** DRF serializers, viewsets, URL routers, custom permission classes, and automated API test suite.
- **Acceptance Criteria:** CRUD workflows work against database; invalid inputs are rejected; team members cannot view or modify unassigned projects; expenses transition cleanly; managers control reviews.
- **Required Verification:** Complete test suite passing with APITestCase.
- **Common Mistakes to Avoid:** Trusting client-supplied `hourly_cost_snapshot` instead of pulling from `request.user.default_hourly_cost_rate`.
- **Scope Exclusions:** Advanced dashboard rollups and AI endpoints.

---

### Phase 6 — Financial Engine and Deterministic Risk Assessment
- **Phase ID:** `PHASE-06`
- **Purpose:** Implement the authoritative financial calculation engine, mathematical edge cases, and deterministic risk precedence hierarchy.
- **Status:** `NOT_STARTED`
- **Gate Status:** `NOT_READY`
- **Dependencies:** Phase 5 CRUD workflows verified.
- **Tasks in Execution Order:**
  - [ ] Task 6.1: Create `profitability` app with dedicated `services.py` module containing pure calculation functions.
  - [ ] Task 6.2: Implement labor cost aggregation from rate-snapshotted time entries.
  - [ ] Task 6.3: Implement expense cost aggregation filtering strictly for `status == APPROVED`.
  - [ ] Task 6.4: Implement actual total cost ($C_{actual} = C_{labor} + C_{expense}$).
  - [ ] Task 6.5: Implement budget consumption percentage with zero-budget guard.
  - [ ] Task 6.6: Implement estimated remaining labor cost ($H_{remaining} \times R_{planned}$) with `null` handling.
  - [ ] Task 6.7: Implement projected final cost and variance calculations.
  - [ ] Task 6.8: Implement projected profit and margin percentage with zero-revenue guard.
  - [ ] Task 6.9: Implement 4-tier risk precedence hierarchy (`OVER_BUDGET` $\rightarrow$ `INSUFFICIENT_DATA` $\rightarrow$ `AT_RISK` $\rightarrow$ `HEALTHY`).
  - [ ] Task 6.10: Implement project financial summary endpoint (`GET /api/v1/projects/{id}/financial-summary/`).
  - [ ] Task 6.11: Implement portfolio dashboard aggregation endpoint (`GET /api/v1/dashboard/summary/`) computing aggregate margin correctly.
  - [ ] Task 6.12: Mask financial metrics from `TEAM_MEMBER` role across all serializers.
  - [ ] Task 6.13: Author unit test suite covering all 11 required financial scenarios in `docs/financial-rules.md`.
- **Expected Deliverables:** `profitability/services.py`, financial endpoints, and scenario-based unit tests.
- **Acceptance Criteria:** All 8 formulas calculate with exact `Decimal` precision; risk hierarchy follows ADR-003 strictly; team members cannot access financial data; 100% test scenario pass rate.
- **Required Verification:** `python manage.py test profitability`.
- **Common Mistakes to Avoid:** Using floating-point arithmetic; averaging project margins; counting pending expenses.

---

### Phase 7 — Frontend Foundation and Main User Workflows
- **Phase ID:** `PHASE-07`
- **Purpose:** Connect the frontend user interface to live backend DRF APIs, replacing simulation state with persisted data.
- **Status:** `IN_PROGRESS`
- **Gate Status:** `NOT_READY`
- **Dependencies:** Phases 5 & 6 backend APIs complete.
- **Tasks in Execution Order:**
  - [x] Task 7.1: Create financial engine utility module (`frontend/src/lib/financial-engine.ts`) with currency, hour, and percentage formatters.
  - [x] Task 7.2: Verify frontend development server launches cleanly without runtime exceptions.
  - [x] Task 7.3: Review rich interactive UI prototype in `frontend/src/App.tsx` and modular view components.
  - [ ] Task 7.4: Implement real API client (`frontend/src/services/api-client.ts`) with JWT bearer token injection and automatic token refresh.
  - [ ] Task 7.5: Connect Login screen to backend `/api/v1/auth/login/` and persist auth session.
  - [ ] Task 7.6: Connect Dashboard view to `/api/v1/dashboard/summary/` and `/api/v1/projects/`.
  - [ ] Task 7.7: Connect Client management view to `/api/v1/clients/` (Manager-only).
  - [ ] Task 7.8: Connect Project detail and creation views to `/api/v1/projects/` with `estimated_remaining_hours` null handling.
  - [ ] Task 7.9: Connect Time Entry logging modal to `/api/v1/time-entries/`.
  - [ ] Task 7.10: Connect Expense submission and approval workflows to `/api/v1/expenses/`.
  - [ ] Task 7.11: Implement role-based navigation guards and UI element masking for `TEAM_MEMBER`.
  - [ ] Task 7.12: Add loading skeletons, empty states, and error banners.
  - [ ] Task 7.13: Verify responsive layouts (mobile, tablet, desktop) and keyboard accessibility.
- **Expected Deliverables:** Production-ready frontend integrated with backend APIs.
- **Acceptance Criteria:** Real data flows from Django to React; authentication persists; role restrictions are respected in UI; forms validate cleanly.
- **Scope Exclusions:** AI advisor widget (Phase 8).

---

### Phase 8 — Gemini AI Risk Advisor
- **Phase ID:** `PHASE-08`
- **Purpose:** Integrate server-side Google Gemini 2.5 Flash to generate grounded executive summaries, risk drivers, and operational recommendations.
- **Status:** `NOT_STARTED`
- **Gate Status:** `NOT_READY`
- **Dependencies:** Phase 6 financial engine verified.
- **Tasks in Execution Order:**
  - [ ] Task 8.1: Create `ai_advisor` Django app.
  - [ ] Task 8.2: Configure `GEMINI_API_KEY` in backend settings (strictly server-side, never exposed to client).
  - [ ] Task 8.3: Implement context preparation service extracting sanitized project financial facts from `profitability`.
  - [ ] Task 8.4: Implement structured prompt enforcing strict JSON schema output:
    - `risk_status`
    - `summary`
    - `key_findings` (list of strings)
    - `recommended_actions` (list of strings)
    - `limitations` (list of strings)
    - `generated_at`
  - [ ] Task 8.5: Implement Gemini client with temperature=0.2 and response schema validation.
  - [ ] Task 8.6: Implement robust fallback handling for timeouts, rate limits (HTTP 429), or malformed responses.
  - [ ] Task 8.7: Expose endpoint `POST /api/v1/projects/{id}/ai-advice/` (Manager-only).
  - [ ] Task 8.8: Connect frontend AI advisor panel to the endpoint.
  - [ ] Task 8.9: Add clear visual disclaimers distinguishing AI advice from deterministic financial calculations.
  - [ ] Task 8.10: Test advisor behavior across the 4 primary risk categories (`HEALTHY`, `AT_RISK`, `OVER_BUDGET`, `INSUFFICIENT_DATA`).
  - [ ] Task 8.11: Test failure resilience (API offline / simulated timeout).
  - [ ] Task 8.12: Document AI prompt engineering, limitations, and failure modes in `docs/ai-risk-advisor.md`.
- **Expected Deliverables:** Backend AI advisor service, API endpoint, frontend panel, and automated mock-based tests.
- **Acceptance Criteria:** API secrets never leak to browser; AI cannot alter calculated metrics; failures degrade gracefully with clear fallback.
- **Common Mistakes to Avoid:** Allowing AI to compute financial totals; making frontend call Gemini directly.

---

### Phase 9 — Integration, Security and Regression Testing
- **Phase ID:** `PHASE-09`
- **Purpose:** End-to-end verification of system workflows, security boundaries, IDOR resistance, and regression test suites.
- **Status:** `NOT_STARTED`
- **Gate Status:** `NOT_READY`
- **Dependencies:** Phases 4–8 implemented.
- **Tasks in Execution Order:**
  - [ ] Task 9.1: Run full backend test suite (`python manage.py test --keepdb`).
  - [ ] Task 9.2: Run frontend type checking (`npm run lint` / `tsc --noEmit`).
  - [ ] Task 9.3: Run frontend build check (`npm run build`).
  - [ ] Task 9.4: Execute end-to-end Manager workflow (create client $\rightarrow$ create project $\rightarrow$ assign member $\rightarrow$ review expenses $\rightarrow$ inspect financial risk $\rightarrow$ request AI advice).
  - [ ] Task 9.5: Execute end-to-end Team Member workflow (log in $\rightarrow$ view assigned projects only $\rightarrow$ log hours $\rightarrow$ submit expense $\rightarrow$ verify 0 access to financials).
  - [ ] Task 9.6: Verify IDOR prevention (attempt to log hours or access unassigned project as team member).
  - [ ] Task 9.7: Verify financial data masking (inspect raw API responses for team member).
  - [ ] Task 9.8: Test boundary inputs (zero budget, zero revenue, extreme hours, future dates).
  - [ ] Task 9.9: Test expense review state transitions (prevent approving already rejected expense without reset).
  - [ ] Task 9.10: Test AI failure resilience in frontend.
  - [ ] Task 9.11: Verify responsive layout on mobile (375px), tablet (768px), and desktop (1440px).
  - [ ] Task 9.12: Audit WCAG 2.2 AA contrast and keyboard accessibility.
  - [ ] Task 9.13: Document and fix any discovered defects.
  - [ ] Task 9.14: Compile regression test report.
- **Expected Deliverables:** Test execution logs, security verification notes, and defect remediation log.
- **Acceptance Criteria:** All unit, integration, and security tests pass; zero critical or high-severity vulnerabilities remain.

---

### Phase 10 — Documentation, Demo Data and Submission Preparation
- **Phase ID:** `PHASE-10`
- **Purpose:** Finalize all documentation, create safe reproducible seed data, and prepare a polished demonstration flow.
- **Status:** `IN_PROGRESS`
- **Gate Status:** `NOT_READY`
- **Dependencies:** Phase 9 verification complete.
- **Tasks in Execution Order:**
  - [x] Task 10.1: Complete comprehensive documentation suite in `docs/` and `docs/backend/`.
  - [x] Task 10.2: Author architectural decision records (ADR-001, ADR-002, ADR-003).
  - [x] Task 10.3: Document environment variables in `.env.example`.
  - [ ] Task 10.4: Implement idempotent `seed_demo_data` command in backend creating:
    - 1 Manager account (`manager@agency.com`)
    - 2 Team Member accounts (`dev1@agency.com`, `dev2@agency.com`)
    - 3 Clients (`Acme Corp`, `Apex Retail`, `Starlight Labs`)
    - 4 Projects demonstrating each risk status (`HEALTHY`, `AT_RISK`, `OVER_BUDGET`, `INSUFFICIENT_DATA`)
    - Reconciled time entries and multi-state expenses (`PENDING`, `APPROVED`, `REJECTED`)
  - [ ] Task 10.5: Verify clean environment setup from scratch (clone $\rightarrow$ virtualenv $\rightarrow$ migrations $\rightarrow$ seed $\rightarrow$ run).
  - [ ] Task 10.6: Verify Git commit history follows Conventional Commits.
  - [ ] Task 10.7: Verify repository cleanliness (no lingering `.env`, `.sqlite3`, or debug logs).
  - [ ] Task 10.8: Structure step-by-step live demonstration script.
  - [ ] Task 10.9: Rehearse verbal walkthrough of architectural decisions and trade-offs.
  - [ ] Task 10.10: Cross-check every assessment requirement against implementation evidence.
  - [ ] Task 10.11: Finalize top-level `README.md` with accurate quickstart instructions.
  - [ ] Task 10.12: Document known limitations and future roadmap items.
  - [ ] Task 10.13: Conduct full pre-submission dry run.
  - [ ] Task 10.14: Finalize `PROJECT_CONTEXT.md` synchronization.
- **Expected Deliverables:** Polished repository, repeatable demo dataset, rehearsal script, and submission-ready documentation.
- **Acceptance Criteria:** Anyone can clone the repo and run the app in < 5 minutes using documented steps; demo data illustrates all 4 risk tiers immediately.

---

### Phase 11 — Final Review and Retrospective
- **Phase ID:** `PHASE-11`
- **Purpose:** Review implementation against the assessment rubric, record architectural lessons learned, and confirm readiness for evaluation.
- **Status:** `NOT_STARTED`
- **Gate Status:** `NOT_READY`
- **Dependencies:** Phase 10 completed and approved.
- **Tasks in Execution Order:**
  - [ ] Task 11.1: Map each assessment rubric criterion to verified implementation evidence.
  - [ ] Task 11.2: Audit backend code quality, PEP 8 compliance, and docstrings.
  - [ ] Task 11.3: Audit frontend code quality, TypeScript strictness, and ESLint compliance.
  - [ ] Task 11.4: Verify database indexing and query counts (prevent N+1 queries).
  - [ ] Task 11.5: Verify test coverage report.
  - [ ] Task 11.6: Review Git commit history for narrative clarity.
  - [ ] Task 11.7: Compile lessons learned and architectural trade-offs retrospective.
  - [ ] Task 11.8: Document post-MVP roadmap (multi-currency, client portal, automated invoices).
  - [ ] Task 11.9: Final assessment readiness sign-off.
  - [ ] Task 11.10: Archive development context for submission.
- **Expected Deliverables:** Final readiness report, rubric compliance matrix, and technical retrospective.
- **Acceptance Criteria:** Every rubric criterion has concrete supporting evidence; zero unsupported completion claims.

---

## 7. Decision, Discrepancy & Blocker Register

| ID | Topic | Discrepancy / Question | Options & Trade-Offs | Recommended Action | Status |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **DEC-001** | Backend App Naming | `docs/backend/backend-apps-and-data-models.md` specifies app name `accounts`, while existing implemented code in `backend/` uses `users` (`users.apps.UsersConfig`, `AUTH_USER_MODEL = "users.User"`). | **A.** Retain `users` (preserves existing code, migrations, and settings without refactoring).<br/>**B.** Rename to `accounts` (aligns code with blueprint, requires updating settings, apps, tests, and migrations). | **Option A (Retain `users`):** Retained `users` app; aligned blueprint documentation and model foreign key references. | `RESOLVED` |
| **DEC-002** | Frontend Architecture Alignment | Documentation (`README.md`, `frontend/docs/frontend/`) describes Next.js App Router with TanStack Query. Existing working implementation in `frontend/` is a Vite + React 19 + TypeScript SPA (`src/App.tsx`, 3,097 lines). | **A.** Continue with Vite + React 19 SPA (fast iteration, working dev server, rich UI prototype already present).<br/>**B.** Migrate frontend to Next.js App Router (matches documentation, but requires rebuilding project structure). | **Option A (Vite + React 19):** For an assessment MVP, Vite + React 19 delivers a fast, responsive UI without SSR deployment overhead. Update documentation to specify Vite + React 19. | `AWAITING_APPROVAL` |
| **DEC-003** | Local Database Strategy | `settings.py` is currently configured to connect to Neon PostgreSQL, with fallback to SQLite if `DATABASE_URL` is unset. Running tests against Neon pooler originally caused session teardown locks (`NeonTestRunner` added). | **A.** Use Neon PostgreSQL for all development and tests via unpooled runner.<br/>**B.** Use local SQLite (`db.sqlite3`) for local testing/dev and Neon for cloud/staging. | **Option B for fast tests (`--keepdb` or local SQLite), Option A for staging verification.** | `AWAITING_APPROVAL` |
| **DEC-004** | Git Ignore for Private Context | `PROJECT_CONTEXT.md` is a private control document that should not be committed to public repository history if privacy is desired. | Add entry `/PROJECT_CONTEXT.md` to `.gitignore`. | Added `/PROJECT_CONTEXT.md` to root `.gitignore`. | `RESOLVED` |

---

## 8. Assessment Readiness Tracker

This section maps verified repository evidence against expected engineering assessment criteria:

| Category | Assessment Criteria | Current Status | Verifiable Evidence | Missing Requirements / Next Actions |
| :--- | :--- | :---: | :--- | :--- |
| **1. Problem Solving & Planning** | Clear understanding of business problem, domain models, and financial edge cases. | `VERIFIED` | `docs/financial-rules.md`, `docs/requirements.md`, ADR-002, ADR-003, `backend-apps-and-data-models.md`. | Ready to implement backend domain models. |
| **2. Security & Validation** | Authentication, RBAC, IDOR prevention, input validation, safe rate snapshots. | `IN_PROGRESS` | `users` app enforces `MANAGER` vs `TEAM_MEMBER` roles; `SimpleJWT` configured; rate snapshots designed in schema. | Implement DRF object permissions (`IsAssignedTeamMember`) and expense review checks in Phase 5. |
| **3. Financial Business Logic** | Authoritative calculations, fixed-point decimals, strict risk hierarchy, division-by-zero protection. | `IN_PROGRESS` | Formulas codified in docs and prototype `frontend/src/lib/financial-engine.ts`. | Implement authoritative Python `Decimal` service layer in Django (`profitability/services.py`) in Phase 6. |
| **4. Database Integrity** | Relational schema, deletion protections (`PROTECT`), composite constraints, index strategy. | `IN_PROGRESS` | `User` model and migrations exist; full ERD and constraints documented in `docs/data-model.md`. | Create `clients`, `projects`, `time_tracking`, and `expenses` Django models in Phase 4. |
| **5. Frontend UX & Quality** | Responsive layout, role-specific UI, clear risk indicators, accessibility, loading/empty states. | `IN_PROGRESS` | Vite + React 19 prototype running; Tailwind CSS styled; `financial-engine.ts` integrated. | Connect UI components to live Django API endpoints in Phase 7. |
| **6. AI/ML Engineering** | LLM advisory layer, context sanitization, prompt grounding, failure resilience, disclaimer. | `PLANNED` | Complete specification in `docs/ai-risk-advisor.md`. | Implement backend Gemini service and frontend panel in Phase 8. |
| **7. Code Quality & Testing** | Unit tests, integration tests, PEP 8, strict TypeScript, clean Git history. | `IN_PROGRESS` | 8/8 backend user tests passing; clean Git commits on `master`; frontend compiles with zero errors. | Author tests for domain models, CRUD endpoints, and financial engine in Phases 4–6. |
| **8. Demonstration & Defense** | Reproducible quickstart, demo data, clear explanation of architecture and trade-offs. | `IN_PROGRESS` | Detailed documentation suite; `seed_dev_users` command. | Build comprehensive `seed_demo_data` command in Phase 10. |

---

## 9. Synchronization & Maintenance Instructions

When updating this document in future agent sessions:
1. Always update the **Current Session State** table at the top.
2. Update the **Master Phase Tracker** tasks completed and statuses.
3. Check off tasks in the **Detailed Phased Development Roadmap** only when acceptance criteria and tests have been verified with evidence.
4. Record newly discovered decisions, trade-offs, or blockers in the **Decision Register**.
5. Do not modify application source code or run migrations unless specifically authorized for that task.
6. Present a concise checkpoint report to the user at the end of each session and await direction before advancing.
