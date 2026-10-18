# MarginWatch — Requirements and Acceptance Criteria

**Document Status:** Approved Specification (Phase 0)  
**Last Updated:** October 2026  
**Audience:** Technical Reviewers, Architects, Full-Stack Developers  
**Architecture Authority:** [ADR-001: Initial Architecture](decisions/ADR-001-initial-architecture.md) | [ADR-002: Single-Agency Architecture](decisions/ADR-002-single-agency-architecture.md)  
**Financial Rules Authority:** [docs/financial-rules.md](financial-rules.md) | [ADR-003: Financial Rules](decisions/ADR-003-financial-rules-and-risk-classification.md)

---

## 1. Problem Definition & Scope

Small to mid-sized software agencies operate on tight margins. A common failure mode in agency operations is delivering projects that substantially exceed their planned delivery-cost budgets before management detects the overrun.

This problem stems from three core operational challenges:
1. **Unrecorded or Delayed Time Tracking:** Labor costs accumulate invisibly between billing cycles without real-time tracking against budget baselines.
2. **Untracked Direct Expenses:** Subcontractor invoices, software licenses, and staging infrastructure costs are tallied after project completion or client invoicing rather than reviewed in real time.
3. **Flawed Cost Forecasting:** Agencies frequently conflate **budget consumed** with **project completion percentage**, failing to anticipate the cost required to complete the remaining scope, or silently converting missing estimates to zero.

### The Question MarginWatch Answers
> *"Based on recorded work hours, approved expenses, and estimated remaining work, is this project likely to exceed its planned delivery-cost budget?"*

### Single-Agency Scope Boundary
MarginWatch is designed as a focused, high-integrity project profitability and budget risk tracker for **one software agency only**.
- **Implicit Agency:** The single software agency is represented implicitly by the application itself; it is not modeled as an `Agency` or `Tenant` table in the database.
- **Core Entity Set:** Exactly six core models are defined: `User`, `Client`, `Project`, `ProjectAssignment`, `TimeEntry`, and `Expense`.
- **Application Roles:** Users are assigned an application-level role: `MANAGER` or `TEAM_MEMBER`.
- **Out of Scope for MVP:** Multi-tenant SaaS infrastructure, agency-switching contexts, automated invoice generation, payment gateway processing, automated timesheet desktop trackers, multi-currency live conversion, external payroll synchronization, and autonomous AI agents (the AI advisor is strictly read-only and holds zero write permissions).

---

## 2. Target Users, Roles & Security Governance

MarginWatch implements a controlled, role-based identity model rooted in Django's authentication architecture.

| Role | Operational Context | Primary Needs & Permissions |
| :--- | :--- | :--- |
| **Manager (`MANAGER`)** | Agency leadership, delivery director, or operational manager with complete oversight across the single agency. | - Manage clients and projects.<br>- Configure contract revenues, delivery budgets, and planned rates.<br>- Assign and revoke team member project allocations.<br>- Review, approve, or reject logged project expenses.<br>- View unmasked financial summaries, margins, burn rates, and risk statuses across all projects.<br>- Trigger server-side AI risk analyses with concrete operational advice. |
| **Team Member (`TEAM_MEMBER`)** | Software developer, designer, or QA engineer executing project deliverables. | - View authorized projects to which they hold an active `ProjectAssignment`.<br>- Log work hours against assigned projects with minimal friction.<br>- View and edit only their own unbilled time entries.<br>- Submit project expenses with receipt references.<br>- Completely insulated from agency profit margins, contract revenues, client financial agreements, and colleague hourly rates. |

### Application Role Security Governance
1. **Controlled Application Field:** The user `role` is an enumerated application field (`MANAGER`, `TEAM_MEMBER`), not an arbitrary user-supplied string.
2. **Separation from Administrative Flags:** Django's built-in `is_staff` and `is_superuser` attributes are infrastructure-level administrative flags for the Django admin portal; they are **never** used as substitutes for application roles.
3. **Manager-Only Role Configuration:** Only authenticated users with the `MANAGER` role can create user accounts, assign roles, or modify employee cost rates.
4. **Self-Elevation Prohibition:** A user can never elevate their own role through profile updates, PATCH requests, or manipulated API payloads.
5. **Inactive User Invalidation:** Users with `is_active = False` are strictly rejected at authentication time and cannot access any protected endpoints.
6. **Custom User Model Architectural Rule:** In accordance with Django best practices, a custom `User` model inheriting from `AbstractBaseUser` and `PermissionsMixin` with email-based login (`USERNAME_FIELD = 'email'`) must be finalized and configured prior to executing the initial database migration.

---

## 3. User Stories

### Manager Stories
- **US-M1:** *As a Manager*, I want to create clients and projects with contract revenue and planned cost budgets so that I establish financial baselines for monitoring.
- **US-M2:** *As a Manager*, I want to assign team members to projects via project assignments so that only authorized personnel can log hours and expenses against those projects.
- **US-M3:** *As a Manager*, I want to update estimated remaining hours and anticipated expenses as delivery progresses so that the system recalculates projected final costs.
- **US-M4:** *As a Manager*, I want the system to clearly distinguish between an unestimated project (`null`) and a finished project (`0.0` hours remaining) so that I am not misled by false zero-estimate optimism.
- **US-M5:** *As a Manager*, I want to review pending expenses and either approve or reject them with a mandatory explanation so that unvetted expenses do not skew financial reporting.
- **US-M6:** *As a Manager*, I want to view a real-time financial summary displaying budget consumption, projected profit, and deterministic risk status so that I can intervene before overruns occur.
- **US-M7:** *As a Manager*, I want to trigger an AI Risk Advisor analysis so that I receive an executive summary of risk drivers and prioritized corrective actions grounded strictly in calculated data.

### Team Member Stories
- **US-T1:** *As a Team Member*, I want to log in securely with my email and see a list of projects I am assigned to so that I know where my effort can be billed.
- **US-T2:** *As a Team Member*, I want to log daily time entries (date, hours, description) so that my work is recorded accurately.
- **US-T3:** *As a Team Member*, I want to edit or delete my own unbilled time entries within an active project so that I can correct accidental logging errors.
- **US-T4:** *As a Team Member*, I want to submit direct project expenses (amount, category, description) so that management can review and approve them.
- **US-T5:** *As a Team Member*, I want to track the approval status (`PENDING`, `APPROVED`, `REJECTED`) of my submitted expenses.

---

## 4. Functional Requirements (FR)

### Authentication & Authorization
- **FR-001:** The system shall authenticate users via secure email and password credentials, issuing signed JWT or session-based authentication tokens.
- **FR-002:** The system shall enforce two distinct application roles: `MANAGER` and `TEAM_MEMBER`.
- **FR-003:** Unauthenticated users shall be prohibited from accessing any API endpoints or resources, except public authentication routes (`/api/v1/auth/login/`, `/api/v1/auth/refresh/`).
- **FR-004:** Inactive user accounts (`is_active = False`) shall be strictly barred from authenticating or accessing protected endpoints.
- **FR-005:** Team members shall access only projects to which they hold an active `ProjectAssignment`.
- **FR-006:** Team members shall never receive financial data regarding project budgets, contract revenues, agency profit margins, or internal hourly cost rates of other users.

### Client & Project Management
- **FR-007:** The system shall allow Managers to create, view, update, and archive Client records.
- **FR-008:** The system shall allow Managers to create Projects associated with a valid Client, defining:
  - Project name and optional description.
  - Contract revenue ($R \ge 0.00$).
  - Planned cost budget ($B > 0.00$).
  - Default project currency (ISO 4217 code, e.g., `USD`).
  - Planned internal hourly cost rate ($C_{hourly\_plan} > 0.00$).
  - Estimated remaining hours ($H_{rem} \ge 0.00$, nullable).
  - Expected remaining expenses ($E_{rem} \ge 0.00$, default `$0.00$`).
- **FR-009:** The system shall prevent modification of project financial baselines (`contract_revenue`, `planned_cost_budget`, `planned_hourly_cost_rate`) by any user other than a Manager.
- **FR-010:** The system shall support assigning and revoking Team Members to Projects via `ProjectAssignment` records, enforcing a unique constraint on `(project_id, user_id)`.

### Time Entry Logging & Rate Snapshots
- **FR-011:** The system shall allow Team Members to log time entries against assigned projects, specifying work date, duration in hours ($0.00 < \text{recorded\_hours} \le 24.00$), and a textual description.
- **FR-012:** Upon creation of a time entry, the backend shall automatically capture and persist the logging user's current internal hourly cost rate as `hourly_cost_snapshot`.
- **FR-013:** Historical `hourly_cost_snapshot` values on existing time entries shall remain permanently immutable even if the user's default cost rate or the project's planned hourly rate is changed at a later date.
- **FR-014:** Team members shall be permitted to edit or delete only their own unbilled time entries. Managers may view all time entries across all agency projects.

### Expense Tracking & Approval State Machine
- **FR-015:** The system shall allow users to submit project expenses for assigned projects, specifying category (`SOFTWARE_LICENSE`, `SUBCONTRACTOR`, `TRAVEL`, `HARDWARE`, `OTHER`), monetary amount ($> 0.00$), description, and expense date.
- **FR-016:** Submitted expenses shall automatically initialize in the `PENDING` status.
- **FR-017:** Only Managers shall be authorized to approve or reject expenses.
- **FR-018:** When rejecting an expense, the Manager must provide a non-empty `review_note`.
- **FR-019:** Once an expense is marked `APPROVED` or `REJECTED`, its monetary amount, category, and project assignment shall become permanently immutable.
- **FR-020:** The system shall exclude `PENDING` and `REJECTED` expenses from actual project cost calculations. Only `APPROVED` expenses shall contribute to `actual_expense_cost` ($C_{expense}$) and `actual_total_cost` ($C_{actual}$).
- **FR-021:** The system shall prevent double-counting between approved expenses and expected remaining expenses ($E_{rem}$) by defining $E_{rem}$ as un-incurred future costs only.

### Deterministic Financial Engine
- **FR-022:** The system shall calculate financial metrics deterministically on the backend using exact decimal arithmetic as specified in [`docs/financial-rules.md`](financial-rules.md):
  - Actual Labor Cost: $C_{labor} = \sum (H_{entry} \times C_{entry})$.
  - Actual Expense Cost: $C_{expense} = \sum E_{appr}$.
  - Actual Total Cost: $C_{actual} = C_{labor} + C_{expense}$.
  - Budget Consumption Percentage: $P_{consumed} = (C_{actual} / B) \times 100$.
  - Estimated Remaining Labor Cost: $C_{rem\_labor} = H_{rem} \times C_{hourly\_plan}$.
  - Projected Final Cost: $C_{projected} = C_{actual} + C_{rem\_labor} + E_{rem}$.
  - Projected Profit: $P_{profit} = R - C_{projected}$.
  - Projected Profit Margin Percentage: $M_{profit} = (P_{profit} / R) \times 100$.
- **FR-023:** The system shall strictly preserve `null` for unknown estimated remaining hours ($H_{rem}$), distinguishing it from `0.0` (completed scope).
- **FR-024:** When $H_{rem}$ is `null`, the system shall:
  - Compute and return valid actual costs ($C_{labor}$, $C_{expense}$, $C_{actual}$) and budget consumption ($P_{consumed}$).
  - Return `null` for projected metrics ($C_{projected}$, $P_{profit}$, $M_{profit}$), accompanied by an explanatory warning string.
  - Never silently substitute zero for a missing estimate.
- **FR-025:** The system shall classify project risk into one of four mutually exclusive statuses following this exact precedence order:
  1. `over_budget`: When $C_{actual} > B$. (Takes priority over missing forecast data).
  2. `insufficient_data`: When $C_{actual} \le B$ and required forecast data is missing ($B \le 0$ or $H_{rem}$ is `null`).
  3. `at_risk`: When forecast data is valid and ($C_{projected} > B$ OR $P_{consumed} \ge 80.0\%$ with $H_{rem} > 0$).
  4. `healthy`: When $C_{actual} \le B$, $C_{projected} \le B$, and no warning heuristic has triggered.
- **FR-026:** The system shall return a structured financial summary payload on `GET /api/v1/projects/{id}/financial-summary/` distinguishing actuals from forecasts.

### AI Risk Advisor (Advisory Only)
- **FR-027:** The system shall provide an endpoint `POST /api/v1/projects/{id}/ai-risk-analysis/` restricted strictly to Managers.
- **FR-028:** The backend shall extract calculated financial metrics and the deterministic risk status, assemble a sanitized context payload, and query the Google Gemini API server-side.
- **FR-029:** The AI Risk Advisor response shall adhere to a strict structured schema containing an executive summary, primary risk drivers, 2 to 4 actionable recommendations, and data gap callouts.
- **FR-030:** The AI Risk Advisor shall be strictly read-only and advisory, structurally prohibited from mutating budgets, changing rates, or approving expenses.
- **FR-031:** If the AI provider fails (timeout, quota, or invalid key), the system shall return an informative error or fallback response without disrupting or masking the deterministic financial calculations.

---

## 5. Non-Functional Requirements (NFR)

| ID | Category | Requirement Specification |
| :--- | :--- | :--- |
| **NFR-001** | **Financial Precision** | All monetary amounts, hourly rates, and intermediate cost calculations must use exact fixed-point decimal arithmetic (`Decimal` in Python, `NUMERIC` in SQL). Floating-point arithmetic (`float`) is strictly prohibited. |
| **NFR-002** | **Zero-Tolerance Division by Zero** | All calculation paths involving ratios or percentages (margin, budget consumption) must defensively validate denominators. Zero denominators must yield explicit `null` representations and trigger `insufficient_data` rather than throwing exceptions. |
| **NFR-003** | **Security & Isolation** | The Gemini API key and database credentials must remain strictly encapsulated in backend environment variables, never exposed via client bundles or public endpoints. |
| **NFR-004** | **Object-Level Access Control** | Every API request modifying or retrieving project data must enforce object-level authorization checks on the server to prevent Insecure Direct Object References (IDOR). |
| **NFR-005** | **Response Latency** | Financial calculation endpoints (`GET /projects/{id}/financial-summary/`) must respond within 150ms under local development loads. AI analysis endpoints must implement a 10-second timeout. |
| **NFR-006** | **Auditability** | Every time entry and expense record must maintain immutable creation timestamps (`created_at`), update timestamps (`updated_at`), author identifiers (`user_id`), and approval metadata (`reviewed_by`, `reviewed_at`). |
| **NFR-007** | **Graceful Degradation** | An AI provider outage, HTTP 429 (rate limit), or malformed output must never prevent the user from viewing their deterministic financial metrics and risk status. |
| **NFR-008** | **Single Currency Consistency** | For the MVP, each project operates in a single specified currency. Calculations must never blend cross-currency transactions. |
| **NFR-009** | **Defensive Input Validation** | The API must reject negative values for hours worked, labor costs, expenses, contract revenues, and cost budgets with descriptive HTTP 400 validation envelopes. |
| **NFR-010** | **Testability** | Financial calculation routines must be decoupled into pure, deterministic service functions that can be tested independently of HTTP requests and database state. |

---

## 6. Acceptance Criteria for Critical Features

### AC-01: Time Entry Logging & Snapshot Immutability
- **Given** an authenticated Team Member assigned to Project Alpha with a personal cost rate of `$75.00/hr`,
- **When** the member logs a time entry for `4.0` hours,
- **Then** the time entry is saved with `hourly_cost_snapshot = 75.0000`,
- **And When** a Manager subsequently changes the member's profile cost rate to `$90.00/hr`,
- **Then** the previously recorded time entry retains its `hourly_cost_snapshot = 75.0000`, and all recalculations continue using `$75.00/hr` for that historical entry.

### AC-02: Expense Approval Workflow
- **Given** a submitted expense in `PENDING` status for `$500.00`,
- **When** the project's financial summary is calculated,
- **Then** the `$500.00` is **excluded** from `actual_expense_cost` and `actual_total_cost`,
- **And When** a Manager approves the expense,
- **Then** the expense status transitions to `APPROVED`, `reviewed_by` is set to the manager's ID, `reviewed_at` is set to the current timestamp, and the `$500.00` is immediately included in `actual_total_cost`.
- **And When** a Team Member attempts to approve an expense,
- **Then** the API returns HTTP 403 Forbidden.

### AC-03: Rule 1 Priority (`over_budget` with Missing Forecast)
- **Given** a project with Planned Cost Budget = `$6,000.00` and Estimated Remaining Hours = `null`,
- **When** Actual Total Cost reaches `$6,200.00`,
- **Then** the risk status evaluates strictly to `over_budget`,
- **And** `budget_consumption_percentage` evaluates to `103.33%`,
- **And** `projected_final_cost` evaluates to `null` with a warning that forecasting is unavailable,
- **And** Rule 1 takes precedence over Rule 2 (`insufficient_data`).

### AC-04: Rule 2 Precedence (`insufficient_data` When Within Budget)
- **Given** a project with Planned Cost Budget = `$6,000.00`, Actual Total Cost = `$2,000.00`, and Estimated Remaining Hours = `null`,
- **When** the financial summary is calculated,
- **Then** `actual_total_cost` evaluates to `$2,000.00` and `budget_consumption_percentage` evaluates to `33.33%`,
- **And** `projected_final_cost`, `projected_profit`, and `projected_profit_margin_percentage` evaluate to `null`,
- **And** the risk status evaluates to `insufficient_data`.

### AC-05: Rule 3 Overrun & Consumption Heuristic
- **Given** a project with Budget = `$6,000.00` and planned rate = `$50.00/hr`,
- **Scenario A (Forecast Overrun):** When Actual Cost = `$4,000.00` and Remaining Hours = `50 hrs` ($C_{projected} = \$6,500.00$), the risk status evaluates to `at_risk`.
- **Scenario B (Consumption Warning):** When Actual Cost = `$4,900.00` ($81.67\%$ consumed) and Remaining Hours = `10 hrs` ($C_{projected} = \$5,400.00 \le \$6,000.00$), the status evaluates to `at_risk` when the 80% warning heuristic is active, and `healthy` if the heuristic is disabled.

### AC-06: Zero Remaining Hours (`0.0` vs `null`)
- **Given** a project with Planned Cost Budget = `$6,000.00`, Actual Total Cost = `$4,000.00`, and Estimated Remaining Hours = `0.0`,
- **When** the financial summary is calculated,
- **Then** `estimated_remaining_labor_cost` evaluates to `$0.00`,
- **And** `projected_final_cost` evaluates to `$4,000.00`,
- **And** the status evaluates to `healthy`.

---

## 7. MVP vs. Future Scope

| Capability | MVP (v1.0) | Future Enhancements (v1.1+) |
| :--- | :--- | :--- |
| **Architecture Scope** | Single agency deployment per instance | Multi-tenant schema separation (deferred) |
| **Authentication** | Token-based auth (SimpleJWT), email + password | OAuth2 / SSO (Google, GitHub) |
| **User Roles** | Application roles `MANAGER` and `TEAM_MEMBER` | `CLIENT_VIEWER`, `ACCOUNTANT`, `AUDITOR` |
| **Currencies** | Single fixed currency per project | Multi-currency with historical exchange rates |
| **Expense Attachments** | Textual URL / Receipt reference string | Cloud storage (S3 / GCS) direct upload & preview |
| **Time Tracking** | Manual date + hours logging | Real-time stopwatch timer widget, calendar view |
| **Invoicing** | Out of scope | PDF invoice generation, Stripe billing integration |
| **AI Capabilities** | Advisory analysis of calculated metrics | Historical velocity estimation, anomaly detection |
| **Database** | SQLite / Serverless PostgreSQL | Read replicas, high-availability clustering |
