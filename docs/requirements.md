# MarginWatch — Requirements and Acceptance Criteria

**Document Status:** Approved Specification (Phase 0)  
**Last Updated:** October 2026  
**Audience:** Technical Reviewers, Architects, Full-Stack Developers  

---

## 1. Problem Definition & Scope

Small to mid-sized software agencies operate on tight margins. A common failure mode in agency operations is delivering projects that substantially exceed their planned delivery-cost budgets before management becomes aware of the overrun.

This problem stems from three core operational challenges:
1. **Unrecorded or Delayed Time Tracking:** Work is performed without immediate visibility into internal labor cost accumulation.
2. **Untracked and Delayed Expenses:** Subcontractor invoices, software licenses, and equipment purchases are tallied only after project completion or invoicing.
3. **Flawed Cost Forecasting:** Agencies frequently conflate **budget consumed** with **project completion percentage**, failing to factor in remaining hours and anticipated expenses needed to deliver the remaining scope.

### Core Question Answered by MarginWatch
> *"Based on recorded work hours, approved expenses, and estimated remaining work, is this project likely to exceed its planned delivery-cost budget?"*

### Project Scope Boundaries
- **In Scope (MVP):** Client management, project budgeting, role-based access control, time entry recording with historical cost snapshots, expense submission and two-stage manager approval, deterministic real-time financial metrics, deterministic risk status categorization, and a server-side AI Risk Advisor providing plain-language risk driver explanations and actionable interventions.
- **Out of Scope (Explicit Exclusions for MVP):** Automatic invoice generation, payment gateway integration (Stripe/PayPal), automated timesheet timer hardware/desktop tracking, multi-currency live conversions, external payroll integrations, and autonomous AI actions (the AI cannot alter budgets, modify hourly rates, or approve expenses).

---

## 2. Target Users & Needs

| Role | Operational Context | Primary Needs & Motivations |
| :--- | :--- | :--- |
| **Agency Manager** | Agency leadership, project director, or delivery manager with full financial responsibility across all agency accounts. | - Set contract revenues and internal cost budgets.<br>- Configure member cost rates.<br>- Review, approve, or reject logged project expenses.<br>- Monitor real-time profitability and deterministic overrun risks.<br>- Receive plain-language AI risk analysis with concrete mitigation options. |
| **Team Member** | Software engineer, designer, or consultant executing project deliverables. | - View authorized projects.<br>- Log work hours against authorized projects accurately with minimal friction.<br>- Submit project-related expenses with descriptions and receipt references.<br>- View only their own logged entries without exposure to agency profit margins, contract revenues, or colleague cost rates. |

---

## 3. User Stories

### Agency Manager Stories
- **US-M1:** *As an Agency Manager*, I want to create clients and projects with contract revenue and planned cost budgets so that I establish financial baselines for monitoring.
- **US-M2:** *As an Agency Manager*, I want to assign team members to projects so that only authorized personnel can log hours and expenses against those projects.
- **US-M3:** *As an Agency Manager*, I want to update estimated remaining hours and anticipated expenses as the project progresses so that the system recalculates projected final costs.
- **US-M4:** *As an Agency Manager*, I want to review pending expenses and either approve or reject them with a mandatory reason so that unvetted expenses do not skew financial reporting.
- **US-M5:** *As an Agency Manager*, I want to view a real-time financial summary displaying budget consumption, projected profit, and deterministic risk status so that I can intervene before overruns occur.
- **US-M6:** *As an Agency Manager*, I want to trigger an AI Risk Advisor analysis so that I receive an executive summary of risk drivers and prioritized corrective actions grounded strictly in calculated data.

### Team Member Stories
- **US-T1:** *As a Team Member*, I want to log in securely and see a list of projects I am assigned to so that I know where my time can be billed.
- **US-T2:** *As a Team Member*, I want to log time entries (date, hours, description) so that my effort is officially accounted for.
- **US-T3:** *As a Team Member*, I want to edit or delete my own unbilled time entries within an active project so that I can correct accidental logging errors.
- **US-T4:** *As a Team Member*, I want to submit reimbursable project expenses (amount, category, description) so that management can review and approve them.
- **US-T5:** *As a Team Member*, I want to track the approval status (`PENDING`, `APPROVED`, `REJECTED`) of my submitted expenses.

---

## 4. Functional Requirements (FR)

### Authentication & Authorization
- **FR-001:** The system shall authenticate users via secure token or session-based credentials.
- **FR-002:** The system shall enforce two distinct roles: `AGENCY_MANAGER` and `TEAM_MEMBER`.
- **FR-003:** Unauthenticated users shall be prohibited from accessing any API endpoints or resources, except public authentication routes.
- **FR-004:** Team members shall strictly access only projects to which they are assigned.
- **FR-005:** Team members shall never receive financial data regarding project budgets, contract revenues, agency profit margins, or internal hourly cost rates of other users.

### Client & Project Management
- **FR-006:** The system shall allow Agency Managers to create, view, update, and archive Client records.
- **FR-007:** The system shall allow Agency Managers to create Projects associated with a Client, defining:
  - Project name and project code (e.g., `PRJ-001`).
  - Contract revenue ($R \ge 0$).
  - Planned cost budget ($B > 0$).
  - Default project currency (ISO 4217 code, e.g., `USD`).
  - Estimated remaining hours ($H_{rem} \ge 0$).
  - Expected remaining expenses ($E_{rem} \ge 0$).
  - Planned internal hourly cost rate ($C_{hourly\_plan} > 0$).
- **FR-008:** The system shall prevent modification of project financial baselines (`contract_revenue`, `planned_cost_budget`) by any user other than an Agency Manager.
- **FR-009:** The system shall support assigning and unassigning Team Members to Projects.

### Time Entry Logging & Rate Snapshots
- **FR-010:** The system shall allow Team Members to log time entries against assigned projects, specifying date, duration in hours (greater than `0.00` and less than or equal to `24.00`), and a textual description.
- **FR-011:** Upon creation of a time entry, the backend shall automatically capture and persist the logging user's current internal hourly cost rate as `cost_rate_snapshot`.
- **FR-012:** Historical `cost_rate_snapshot` values on existing time entries shall remain immutable even if the user's default cost rate is altered in their profile at a later date.
- **FR-013:** Team members shall be permitted to edit or delete only their own time entries. Agency Managers may view all time entries for projects within their organization.

### Expense Tracking & Approval State Machine
- **FR-014:** The system shall allow users to submit project expenses, specifying project, date, category (e.g., `SOFTWARE_LICENSE`, `SUBCONTRACTOR`, `TRAVEL`, `HARDWARE`, `OTHER`), monetary amount ($> 0$), description, and optional receipt reference.
- **FR-015:** Submitted expenses shall automatically initialize in the `PENDING` status.
- **FR-016:** Only Agency Managers shall be authorized to approve or reject expenses.
- **FR-017:** When rejecting an expense, the Agency Manager must provide a non-empty `rejection_reason`.
- **FR-018:** Once an expense is marked `APPROVED` or `REJECTED`, its financial amount and category shall become immutable. Re-evaluation requires administrative workflow or a fresh submission.
- **FR-019:** The system shall exclude `PENDING` and `REJECTED` expenses from actual project cost calculations. Only `APPROVED` expenses shall contribute to actual total cost.

### Financial Engine & Risk Determination
- **FR-020:** The system shall calculate financial metrics deterministically on the backend using decimal-safe arithmetic as specified in [`docs/financial-rules.md`](financial-rules.md):
  - Actual Labor Cost
  - Approved Expenses Total
  - Actual Total Cost
  - Budget Consumption Percentage
  - Estimated Remaining Labor Cost
  - Projected Final Cost
  - Projected Profit
  - Projected Profit Margin Percentage
- **FR-021:** The system shall classify each project into one of four mutually exclusive, deterministic risk statuses:
  - `HEALTHY`
  - `AT_RISK`
  - `OVER_BUDGET`
  - `INSUFFICIENT_DATA`
- **FR-022:** The system shall assign risk statuses based on the strict precedence hierarchy defined in [`docs/financial-rules.md`](financial-rules.md).
- **FR-023:** The system shall return a structured financial summary payload on `GET /api/v1/projects/{id}/financial-summary/`.

### AI Risk Advisor (Advisory Only)
- **FR-024:** The system shall provide an endpoint `POST /api/v1/projects/{id}/ai-risk-analysis/` restricted to Agency Managers.
- **FR-025:** The backend shall extract the calculated financial metrics and deterministic risk status, assemble a sanitized context payload, and query the Google Gemini API server-side.
- **FR-026:** The AI Risk Advisor response shall adhere to a strict structured schema containing:
  - Executive summary of the risk state.
  - Identification of primary risk drivers.
  - Two to four prioritized, practical recommendations.
  - Explicit identification of missing assumptions or data gaps.
- **FR-027:** The AI Risk Advisor shall be strictly read-only and advisory. The AI is structurally prohibited from mutating budgets, changing rates, or approving expenses.
- **FR-028:** If the AI provider fails (due to timeout, quota, or invalid API key), the system shall return an informative error or fallback response without disrupting or masking the deterministic financial calculations.

---

## 5. Non-Functional Requirements (NFR)

| ID | Category | Requirement Specification |
| :--- | :--- | :--- |
| **NFR-001** | **Financial Precision** | All monetary amounts, hourly rates, and intermediate cost calculations must use exact fixed-point decimal arithmetic (`Decimal` in Python, `NUMERIC(12, 2)` or `(12, 4)` in database). Floating-point arithmetic (`float`) is strictly prohibited for financial logic. |
| **NFR-002** | **Zero-Tolerance Division by Zero** | All calculation paths involving ratios or percentages (e.g., margin, budget consumption) must defensively validate denominators. Zero denominators must yield explicit `null` representations and trigger `INSUFFICIENT_DATA` rather than throwing unhandled exceptions. |
| **NFR-003** | **Security & Isolation** | The Gemini API key and database credentials must remain strictly encapsulated in backend environment variables. The API key must never be exposed via client bundles or public endpoints. |
| **NFR-004** | **Object-Level Access Control** | Every API request modifying or retrieving project data must enforce object-level authorization checks on the server to prevent Insecure Direct Object References (IDOR). |
| **NFR-005** | **Response Latency** | Financial calculation endpoints (`GET /projects/{id}/financial-summary/`) must respond within 150ms under normal local development loads. AI analysis endpoints must implement a 10-second timeout. |
| **NFR-006** | **Auditability** | Every time entry and expense record must maintain immutable creation timestamps (`created_at`), update timestamps (`updated_at`), author identifiers (`user_id`), and approval metadata (`approved_by`, `approved_at`). |
| **NFR-007** | **Graceful Degradation** | An AI provider outage, HTTP 429 (rate limit), or malformed AI output must never prevent the user from viewing their deterministic financial metrics and risk status. |
| **NFR-008** | **Single Currency Consistency** | For the MVP, each project operates in a single specified currency. Calculations must never blend or silently convert cross-currency transactions. |
| **NFR-009** | **Defensive Input Validation** | The API must reject negative values for hours worked, labor costs, expenses, contract revenues, and cost budgets with descriptive HTTP 400 validation envelopes. |
| **NFR-010** | **Testability** | Financial calculation routines must be decoupled into pure, deterministic service functions that can be tested independently of HTTP requests and database state. |

---

## 6. Acceptance Criteria for Critical Features

### AC-01: Time Entry Logging & Snapshot Immutability
- **Given** an authenticated Team Member assigned to Project Alpha with a personal cost rate of `$75.00/hr`,
- **When** the member logs a time entry for `4.0` hours,
- **Then** the time entry is saved with `cost_rate_snapshot = 75.0000`,
- **And When** an Agency Manager subsequently changes the member's profile cost rate to `$90.00/hr`,
- **Then** the previously recorded time entry retains its `cost_rate_snapshot = 75.0000`, and all recalculations continue using `$75.00/hr` for that historical entry.

### AC-02: Expense Approval Workflow
- **Given** a submitted expense in `PENDING` status for `$500.00`,
- **When** the project's financial summary is calculated,
- **Then** the `$500.00` is **excluded** from `actual_total_cost`,
- **And When** an Agency Manager approves the expense,
- **Then** the expense status transitions to `APPROVED`, `approved_by` is set to the manager's ID, `approved_at` is set to the current timestamp, and the `$500.00` is immediately included in `actual_total_cost`.
- **And When** a Team Member attempts to approve an expense,
- **Then** the API returns HTTP 403 Forbidden.

### AC-03: Deterministic Risk Status Assignment
- **Given** Project Beta with Planned Cost Budget = `$10,000.00`,
- **Scenario A (Over Budget):** When Actual Total Cost reaches `$10,500.00`, the project risk status must evaluate to `OVER_BUDGET` regardless of remaining estimates.
- **Scenario B (At Risk via Forecast):** When Actual Total Cost is `$6,000.00` (60% consumed) but Estimated Remaining Labor Cost is `$4,500.00` (Projected Final Cost = `$10,500.00`), the status must evaluate to `AT_RISK`.
- **Scenario C (At Risk via Consumption Heuristic):** When Actual Total Cost is `$8,200.00` (82% consumed) and Estimated Remaining Labor Cost is `$1,000.00` (Projected Final Cost = `$9,200.00` $\le \$10,000.00$), the status must evaluate to `AT_RISK` due to the $\ge 80\%$ budget consumption warning threshold.
- **Scenario D (Insufficient Data):** When Estimated Remaining Hours is `null` or Planned Cost Budget is `0.00`, the status must evaluate to `INSUFFICIENT_DATA`.

### AC-04: AI Risk Advisor Guardrails
- **Given** an active project with deterministic status `AT_RISK` and Projected Final Cost of `$12,000.00` against a budget of `$10,000.00`,
- **When** the Agency Manager requests an AI risk analysis,
- **Then** the AI response summary and risk drivers reference the `$2,000.00` projected overrun,
- **And** the AI response provides between 2 and 4 actionable recommendations,
- **And** the response strictly does not modify any database records,
- **And** the deterministic status displayed in the UI remains authoritative.

---

## 7. MVP vs. Future Enhancements

| Capability | MVP (v1.0) | Future Enhancements (v1.1+) |
| :--- | :--- | :--- |
| **Authentication** | Token/Session-based auth, email + password | OAuth2 / SSO (Google, GitHub) |
| **User Roles** | `AGENCY_MANAGER`, `TEAM_MEMBER` | `CLIENT_VIEWER`, `ACCOUNTANT`, `ADMIN` |
| **Currencies** | Single fixed currency per project | Multi-currency with historical exchange rates |
| **Expense Attachments** | Textual URL / Receipt reference string | Cloud storage (S3 / GCS) direct upload & preview |
| **Time Tracking** | Manual date + hours logging | Real-time stopwatch timer widget, calendar view |
| **Invoicing** | Out of scope | PDF invoice generation, Stripe billing integration |
| **AI Capabilities** | Advisory analysis of calculated metrics | Historical velocity estimation, anomaly detection |
| **Database** | SQLite (development) with clean migration path | PostgreSQL with connection pooling & read replicas |
