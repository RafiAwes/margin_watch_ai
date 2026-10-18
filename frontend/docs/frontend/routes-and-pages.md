# MarginWatch Routes, Pages & Workflow UX Specification

## 1. Route Inventory & Architectural Evaluation

Every candidate route was evaluated against the principle: *Add routes only when they represent a meaningful user workflow; avoid redundant pages where a shared layout tab or contextual dialog provides superior orientation.*

| Route Path | Architectural Decision | Authorized Roles | Rationale |
| :--- | :--- | :--- | :--- |
| **`/login`** | **Dedicated Route (Public / Unauthenticated)** | Public (Redirects authenticated users to `/dashboard`) | Clean, distraction-free credential entry outside the authenticated workspace shell. |
| **`/dashboard`** | **Dedicated Route (Primary Landing)** | `MANAGER`, `TEAM_MEMBER` (Role-tailored workspace) | Answers the core triage question immediately upon login. |
| **`/clients`** | **Dedicated Route** | `MANAGER` only (`TEAM_MEMBER` receives `403` / redirected) | Directory of agency clients with search, status filter, and project count summary. |
| **`/clients/new`** | **Dedicated Route** | `MANAGER` only | Full-page validated form for onboarding a new client organization. |
| **`/clients/[id]`** | **Dedicated Route (with Inline Edit Drawer/Mode)** | `MANAGER` only | Displays client profile, commercial summary, related projects list, edit mode, and archive control. |
| **`/projects`** | **Dedicated Route** | `MANAGER` (all projects), `TEAM_MEMBER` (assigned projects) | Searchable, filterable, sortable project portfolio table with budget & risk indicators. |
| **`/projects/new`** | **Dedicated Route** | `MANAGER` only | Two-part commercial & delivery planning creation form; requires focused screen space. |
| **`/projects/[id]`** | **Dedicated Shared Layout + Overview Tab** | `MANAGER` (full financials + AI Advisor), `TEAM_MEMBER` (delivery overview) | Primary project workspace with persistent project identity header and sub-navigation tabs. |
| **`/projects/[id]/edit`** | **Dedicated Route** | `MANAGER` only | Full-page editing of commercial terms, budget, remaining hours estimate, and project status. |
| **`/projects/[id]/financials`** | **Shared Project Layout Sub-Route (or Redirect to `/projects/[id]`)** | `MANAGER` only | Renders inside the `/projects/[id]` layout tab bar to provide deep-linkable access to the detailed cost breakdown, budget vs. forecast visualization, and AI Risk Advisor without losing project context. |
| **`/projects/[id]/time-entries`** | **Shared Project Layout Sub-Route** | `MANAGER` (all project entries + cost snapshots), `TEAM_MEMBER` (own entries + Log Time form) | Deep-linkable tab within `/projects/[id]` dedicated to recording hours and reviewing paginated time history. |
| **`/projects/[id]/expenses`** | **Shared Project Layout Sub-Route** | `MANAGER` (all project expenses + approve/reject controls), `TEAM_MEMBER` (own expenses + Submit Expense form) | Deep-linkable tab within `/projects/[id]` for project-scoped expense tracking and approval. |
| **`/expenses`** | **Dedicated Cross-Project Route** | `MANAGER` (Global Approval Queue + All Expenses), `TEAM_MEMBER` (My Submitted Expenses tracker) | Essential cross-project workflow so Managers can batch-review `PENDING` expenses across all projects in one place and Team Members can track all their reimbursements. |
| **`/settings`** | **Dedicated Route** | `MANAGER`, `TEAM_MEMBER` | Displays authenticated account profile, role permissions summary, default currency/agency settings (Manager), and password/session controls. |

> **Security Mandate**: Hiding a sidebar link for `TEAM_MEMBER` never substitutes for authorization. Every restricted route (`layout.tsx` / `page.tsx`) verifies the user's role via the server session and renders an explicit `403 Access Restricted` state if accessed directly via URL, while the Django API enforces permissions independently on every request.

---

## 2. Detailed Route-by-Route Specifications

### 2.1 `/login` — Authentication Screen
- **Purpose**: Authenticate agency managers and team members against the Django session/JWT endpoint.
- **Authorized Roles**: Unauthenticated users (authenticated sessions automatically redirect to `searchParams.returnTo` or `/dashboard`).
- **Main User Actions**: Enter email and password, toggle password visibility, submit credentials.
- **Data Required**: Optional `returnTo` query parameter and `reason=session_expired` banner trigger.
- **API Dependencies**: `POST /api/v1/auth/login/`, `GET /api/v1/auth/me/`.
- **Primary Layout**: Centered single-column panel (`max-w-md`, `p-8`) on `--background` canvas with MarginWatch wordmark, concise subtitle (`Project Profitability & Budget Watchdog`), email/password fields, and full-width primary submit button.
- **Loading State**: Submit button locks (`disabled`) and displays inline spinner + `"Signing in..."`; inputs remain disabled during in-flight request.
- **Empty State**: Clean blank form fields with `autocomplete="email"` and `autocomplete="current-password"`.
- **Error State**:
  - `401 Invalid Credentials`: Non-clearing alert banner above form (`"Invalid email or password. Please verify your credentials and try again."`). Password field clears; email field is preserved.
  - `429 Too Many Requests` / `500 Server Error`: Alert banner with retry guidance.
- **Validation Behavior**: Client-side Zod check for valid email format and non-empty password before network dispatch.
- **Responsive Behavior**: Full-width card with `16px` horizontal viewport margin on mobile; `400px` fixed card on tablet/desktop.
- **Acceptance Criteria**:
  1. Valid credentials redirect to `/dashboard` (or safe internal `returnTo` path) within 1 render cycle.
  2. Invalid credentials preserve the entered email address and move screen-reader focus to the error alert (`role="alert"`).
  3. Submitting via `Enter` key works from either input field and prevents duplicate POST requests on rapid double-click.

---

### 2.2 `/dashboard` — Executive Portfolio & Operational Triage
- **Purpose**: Immediately answer *"Which projects are financially at risk, why are they at risk, and what should I do next?"* for Managers, or *"What projects am I assigned to and what hours/expenses have I logged?"* for Team Members.
- **Authorized Roles**: `MANAGER` (Portfolio Financial Dashboard), `TEAM_MEMBER` (Personal Delivery Dashboard).
- **Main User Actions**:
  - `MANAGER`: Filter portfolio summary by currency (if multi-currency), inspect At-Risk projects, jump to Project Detail, approve/reject pending expenses inline or navigate to `/expenses`, click `+ New Project`.
  - `TEAM_MEMBER`: Click `+ Log Time` or `+ Submit Expense`, select an assigned project to view details, check status of recent expense submissions.
- **Data Required**:
  - `MANAGER`: Portfolio KPI summary, At-Risk projects list (`CRITICAL`, `WARNING`, `INCOMPLETE_DATA`), Budget vs. Actual vs. Forecast comparison dataset, Pending Expenses queue (top 5), Recent Time Activity (last 10 entries).
  - `TEAM_MEMBER`: Assigned active projects, personal hours logged (current week + month), personal recent expenses with status (`PENDING`, `APPROVED`, `REJECTED`).
- **API Dependencies**:
  - `GET /api/v1/dashboard/summary/?currency=USD`
  - `POST /api/v1/expenses/{id}/approve/` & `POST /api/v1/expenses/{id}/reject/` (for quick manager actions).

#### Manager Dashboard Metrics & Aggregation Rules (Mandatory)
Every metric displayed in the top KPI strip must adhere to these exact definitions:

| KPI Card Title | Value Formula & Source | Secondary Context / Sub-label | Null / Incomplete Data Handling |
| :--- | :--- | :--- | :--- |
| **1. Active Projects** | Count of projects where `status = 'ACTIVE'`. | Breakdown: `$X Healthy · $Y Warning · $Z Critical` | Displays `0` when no active projects exist. |
| **2. At-Risk Projects** | Count of `ACTIVE` projects where `risk_status IN ('CRITICAL', 'WARNING')`. | Separate count pill for `INCOMPLETE_DATA` (`"N missing estimates"`). | Highlights in semantic Crimson/Amber if $> 0$; Emerald `"0 At Risk"` if all healthy. |
| **3. Actual Delivery Cost** | $\sum \text{actual\_total\_cost}$ across `ACTIVE` projects in selected currency. | Shows percentage of total planned delivery budget (`budget_consumed_pct`). | Note beneath figure: *"Includes logged labor + approved expenses only"*. |
| **4. Projected Final Cost & Variance** | $\sum \text{projected\_final\_cost}$ across `ACTIVE` projects where `estimated_remaining_hours !== null`. | Variance delta vs. planned budget (`+$14,200 overrun` or `-$3,100 under`) + Aggregate Projected Margin %. | **CRITICAL**: Never average project margins. Aggregate Margin = $\frac{\sum \text{Revenue} - \sum \text{Projected Cost}}{\sum \text{Revenue}} \times 100$ for forecastable projects. If $k$ projects lack estimates, display badge: *"Excludes $k$ unestimated project(s)"*. |
| **5. Pending Approvals** | Count and $\sum \text{amount}$ of expenses where `status = 'PENDING'`. | Direct link: `"Review Queue →"` (`/expenses?status=PENDING`). | Note: *"Pending expenses are excluded from Actual Cost until approved."* |

- **Primary Layout (`MANAGER`)**:
  1. **Row 1 (First Viewport Header)**: Page title (`Portfolio Watchdog`), Currency Filter (`USD` default), and primary actions (`+ New Project`, `Log Time`).
  2. **Row 2 (KPI Strip)**: 5-column single-elevation metric strip (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-5`) using `JetBrains Mono tabular-nums`.
  3. **Row 3 (Primary Decision Split — 8/4 Grid on Desktop)**:
     - **Left 8 Cols — At-Risk & Incomplete Projects Watchlist Table**: Sorted by severity (`CRITICAL` $\rightarrow$ `WARNING` $\rightarrow$ `INCOMPLETE_DATA`), showing Project & Client, Risk Status (Icon + Text), Budget Consumed %, Projected Final Cost, Projected Margin %, Primary Risk Driver (`risk_reasons[0]`), and quick action (`Inspect →` or `Add Estimate →`).
     - **Right 4 Cols — Expenses Awaiting Approval Queue**: Compact list of up to 5 oldest `PENDING` expenses with Submitter, Project, Amount, Date, and quick `Approve` / `Reject` triggers.
  4. **Row 4 (Analytical & Activity Split — 7/5 Grid)**:
     - **Left 7 Cols — Portfolio Budget vs. Actual vs. Forecast Visualization** (with `Chart | Table` accessible toggle).
     - **Right 5 Cols — Recent Time-Entry Activity Feed**.
- **Zero-Data / Onboarding Empty States**:
  - **No Clients Exist (`client_count === 0`)**: Renders a guided 2-step onboarding panel: *"Step 1: Create your first Client"* (`+ Create Client` primary CTA) $\rightarrow$ *"Step 2: Set up a Project & Delivery Budget"*.
  - **Clients Exist, No Projects Exist (`project_count === 0`)**: Renders *"No projects tracked yet"* with `+ Create First Project` button.
  - **Projects Exist, Zero At-Risk Projects**: The At-Risk Watchlist table renders a positive confirmation state (`CheckCircle2` icon + *"All active projects are currently within planned budget thresholds"*) with a button to `"View All Projects"`.
- **Loading State**: 5 KPI skeleton placeholders (`h-28`) + 5-row table skeleton matching exact desktop column widths.
- **Error State**: Inline error panel with request correlation ID (if available) and `"Retry Dashboard Load"` button.
- **Acceptance Criteria**:
  1. Actual values and Forecast values are visually and textually separated (`Actual Cost to Date` vs. `Projected Final Cost (Est.)`).
  2. Projects with `estimated_remaining_hours === null` never contribute `$0` remaining cost to portfolio forecast totals and are explicitly flagged.
  3. Team Members logging in to `/dashboard` never receive or render `contract_revenue`, `projected_profit`, `projected_margin_pct`, or other users' expenses.

---

### 2.3 `/clients`, `/clients/new`, `/clients/[id]` — Client Management Workflows
- **Purpose**: Allow Agency Managers to maintain the directory of client organizations, their default billing currency, and their associated projects.
- **Authorized Roles**: `MANAGER` only.
- **Main User Actions**:
  - `/clients`: Search clients by name/contact (`?q=`), filter by status (`ACTIVE` | `ARCHIVED`), sort by name or active project count, click `+ New Client`.
  - `/clients/new`: Create a client with `name` (required, 2–120 chars), `default_currency` (required, `USD` | `EUR` | `GBP`), `contact_name` (optional), `contact_email` (optional, valid email format), `notes` (optional, max 500 chars).
  - `/clients/[id]`: View client details, inspect table of all projects belonging to this client (with budget/risk status), edit client details via inline form or dialog, Archive or Restore client.
- **Data Retention & Archiving Rule**:
  - Clients with historical or active projects **cannot be hard-deleted** if projects exist; instead, Managers can **Archive** (`status = 'ARCHIVED'`) a client only when all its projects are `COMPLETED` or `CANCELLED`. If a Manager attempts to archive a client with `ACTIVE` projects, the backend returns `400 Bad Request` and the UI explains: *"Cannot archive client while 2 active projects exist. Complete or cancel active projects first."*
- **API Dependencies**:
  - `GET /api/v1/clients/?q=&status=&page=`
  - `POST /api/v1/clients/`
  - `GET /api/v1/clients/{id}/`
  - `PATCH /api/v1/clients/{id}/`
  - `POST /api/v1/clients/{id}/archive/`
- **Empty & No-Results States**:
  - Empty directory: *"No clients created yet. Create a client before configuring project budgets."* + `+ New Client` CTA.
  - No search results: *"No clients match '[query]'"* + `"Clear Search"` button.
- **Validation Behavior**: Inline field errors on blur/submit; duplicate client name error (`400 {"name": ["A client with this name already exists."]}`) mapped directly onto the `name` input.
- **Acceptance Criteria**:
  1. Creating a client shows a confirmation toast and navigates to `/clients/[id]` (or back to `/projects/new` if initiated from project creation).
  2. Destructive/state-changing archive action requires an accessible `AlertDialog` confirmation explaining that archived clients cannot be assigned to new projects.

---

### 2.4 `/projects` — Project Portfolio List
- **Purpose**: Provide a comprehensive, filterable ledger of projects with immediate visibility into budget consumption, forecast variance, and risk status.
- **Authorized Roles**: `MANAGER` (all projects + financial columns + `+ New Project`), `TEAM_MEMBER` (assigned projects + operational columns only).
- **Main User Actions**:
  - Live debounced search (`300ms`) by project name or client name (`?q=`).
  - Filter by `status` (`ALL`, `ACTIVE`, `ON_HOLD`, `COMPLETED`, `DRAFT`, `CANCELLED`).
  - Filter by `risk_status` (`ALL`, `CRITICAL`, `WARNING`, `INCOMPLETE_DATA`, `HEALTHY`) — `MANAGER` only.
  - Sort by Project Name, Deadline, Budget Consumed %, Projected Variance, or Projected Margin %.
  - Pagination (`20` rows per page) with URL-synced `?page=`.
- **Desktop Table Columns (`MANAGER`)**:
  1. **Project & Client**: Project Name (bold link to `/projects/[id]`) + unboxed subtitle `Client Name · Currency`.
  2. **Status & Deadline**: Lifecycle status text + deadline date (`YYYY-MM-DD`, with overdue indicator if past deadline).
  3. **Risk Status**: Semantic badge (`AlertOctagon Critical`, `AlertTriangle Warning`, `HelpCircle Missing Estimate`, `CheckCircle2 Healthy`).
  4. **Planned Budget**: Right-aligned `tabular-nums` currency.
  5. **Actual Cost & % Consumed**: Right-aligned `tabular-nums` currency + compact horizontal progress bar (`budget_consumed_pct`).
  6. **Projected Final Cost**: Right-aligned `tabular-nums` currency (or muted `"Forecast Unavailable"` if `estimated_remaining_hours === null`).
  7. **Projected Margin**: Right-aligned `tabular-nums` amount + percentage (`$18,400 · 23.0%` or `"—"` if unavailable).
  8. **Actions**: Quick link `View` / `Edit`.
- **Deliberate Mobile Presentation (`< 768px`)**:
  - Rather than squeezing an 8-column table into an unreadable horizontal scroll strip on mobile phones, `/projects` renders a structured **Mobile Project Financial Card List** (`md:hidden`) where each project card displays:
    - Top row: Project Name, Client Name, and Risk Status Badge.
    - Middle grid (`2×2` key-value pairs in `tabular-nums`): `Planned Budget`, `Actual Cost (X%)`, `Projected Final`, and `Projected Margin`.
    - Bottom row: Deadline + full-width tap target to open `/projects/[id]`.
- **Empty & No-Results States**:
  - Zero projects in database: Explanations + `+ New Project` CTA (for Manager) or *"You have not been assigned to any projects yet"* (for Team Member).
  - Zero filter matches: Displays active filter summary + `"Reset All Filters"` button.
- **Acceptance Criteria**:
  1. All filter, sort, and pagination parameters persist in the URL query string so filtered views can be bookmarked or shared.
  2. Missing remaining-hour estimates display `"Forecast Unavailable"` in the Projected Final Cost column and sort predictably when sorting by variance.

---

### 2.5 `/projects/new` & `/projects/[id]/edit` — Project Creation & Editing
- **Purpose**: Capture and update commercial contract figures and delivery cost planning parameters with strict separation of concerns and explicit handling of unknown estimates.
- **Authorized Roles**: `MANAGER` only.
- **Form Structure (Two-Section Layout)**:
  1. **Section 1: Commercial Information**
     - `name` (*Required*, string, 3–150 chars): Project title.
     - `client_id` (*Required*, select): Active client organization (auto-populates project `currency` from selected client, or allows explicit currency selection `USD` | `EUR` | `GBP` on creation; locked once time/expenses are logged).
     - `contract_revenue` (*Required*, positive decimal $> 0$, max 2 decimal places): Total fixed client contract value.
     - `planned_cost_budget` (*Required*, positive decimal $> 0$, max 2 decimal places): Target maximum internal delivery cost.
       - *Live Advisory Calculation Preview*: As the manager types `contract_revenue` and `planned_cost_budget`, a quiet read-only summary box displays **Planned Target Profit** ($\text{Revenue} - \text{Budget}$) and **Planned Target Margin %** ($\frac{\text{Revenue} - \text{Budget}}{\text{Revenue}} \times 100$). If `planned_cost_budget > contract_revenue`, displays a non-blocking Amber warning: *"Planned delivery cost budget exceeds contract revenue (negative planned margin)."*
  2. **Section 2: Delivery Planning & Forecasting Inputs**
     - `planned_hourly_cost` (*Required*, positive decimal $> 0$, max 2 decimal places): Blended internal hourly cost rate used to forecast remaining hours.
     - `estimate_unknown` (*Explicit Checkbox Toggle*): **"Remaining hours estimate is not yet known"**
       - When **unchecked**, `estimated_remaining_hours` input is enabled and required ($\ge 0$, up to 2 decimal places).
       - When **checked**, `estimated_remaining_hours` input is disabled, cleared, and serialized to the API explicitly as `null` (with helper note: *"Project will be marked 'Missing Estimate' until remaining hours are entered. Actual costs will still be tracked."*).
     - `deadline` (*Optional / Recommended*, ISO date `YYYY-MM-DD`).
     - `status` (*Required*, enum: `DRAFT`, `ACTIVE`, `ON_HOLD`, `COMPLETED`, `CANCELLED`).
     - `assigned_member_ids` (*Optional*, multi-select checkboxes): Team members authorized to view and log time/expenses on this project.
- **Validation & Submission Behavior**:
  - Prevents silently coercing an empty `estimated_remaining_hours` field to `0`. If the user leaves `estimated_remaining_hours` blank without checking *"Remaining hours estimate is not yet known"*, validation prompts: *"Enter estimated remaining hours (use 0 if all work is complete) or check 'Estimate not yet known'."*
  - Never silently alters or rounds user-entered financial values.
  - Disables submit button during in-flight `POST` / `PATCH` to prevent duplicate creation.
  - On success: Triggers toast (`"Project saved"`) and navigates to `/projects/[id]`.
  - On failure (`400` / `500`): Preserves all user-typed form values, highlights invalid fields with server messages, and focuses the first invalid input.

---

### 2.6 `/projects/[id]` (and `/financials`, `/time-entries`, `/expenses`) — Project Detail Workspace
- **Purpose**: Serve as the single authoritative workspace for inspecting a project's financial health, understanding risk drivers, reviewing AI Risk Advisor recommendations, and managing project time entries and expenses.
- **Authorized Roles**: `MANAGER` (full access), `TEAM_MEMBER` (restricted to assigned projects; sees project header, own time entries, and own expenses only).
- **Information Hierarchy (Manager View)**:
  1. **Persistent Project Identity Header**:
     - Breadcrumb: `Projects / [Client Name] / [Project Name]`
     - Title (`h1`) + Status Badge (`ACTIVE`) + Risk Status Badge (`CRITICAL` / `WARNING` / `HEALTHY` / `INCOMPLETE_DATA`) + Deadline (`Due Oct 30, 2026`).
     - Primary Actions (Top Right): `+ Log Time`, `+ Submit Expense`, and `Edit Project` (`/projects/[id]/edit`).
  2. **Deterministic Risk Banner (Shown when `risk_status !== 'HEALTHY'`)**:
     - Crisp `1px` bordered semantic callout listing the exact deterministic `risk_reasons` returned by the backend (e.g., *"• Actual delivery cost ($52,400.00) has consumed 95.3% of planned budget ($55,000.00). • Projected final cost ($64,400.00) exceeds planned budget by $9,400.00 (+17.1%)."*).
     - If `estimated_remaining_hours === null`, displays: *"Forecast Unavailable: Estimated remaining hours have not been provided for this project."* with a primary inline button: **`Enter Remaining Hours Estimate`** (opens quick-update dialog or navigates to `/projects/[id]/edit#delivery-planning`).
  3. **Primary Financial Ledger Strip (6 Metrics in `tabular-nums`, Visible to `MANAGER` Only)**:
     - **Contract Revenue**: `$80,000.00` (Fixed contract value)
     - **Planned Cost Budget**: `$55,000.00` (Target delivery ceiling · `31.3%` planned margin)
     - **Actual Cost to Date**: `$52,400.00` (`$46,000.00` labor + `$6,400.00` approved expenses · Excludes `$1,200.00` pending expenses)
     - **Budget Consumed**: `95.3%` (with visual threshold bar)
     - **Projected Final Cost**: `$64,400.00` (`+$9,400.00` over budget · based on `100.00` est. remaining hrs @ `$120.00/hr`) — *or `"Forecast Unavailable"` if `null`*.
     - **Projected Profit & Margin**: `$15,600.00` (`19.5%` margin vs. `31.3%` planned) — *or `"Forecast Unavailable"` if `null`*.
  4. **Workspace Sub-Navigation Tabs (URL-Synced)**:
     - **Tab 1: `Overview & Financials` (`/projects/[id]` or `/projects/[id]/financials`)**:
       - Left Column (7 cols): **Budget vs. Actual vs. Forecast Visual Breakdown** + **Cost Composition Ledger** (Labor hours & cost, Approved Expenses, Pending Expenses excluded from actuals, Remaining Estimated Labor).
       - Right Column (5 cols): **AI Risk Advisor Panel** (Section 4 below).
       - Bottom Row: Recent 5 Time Entries & Recent 5 Expenses with `"View All"` links.
     - **Tab 2: `Time Entries` (`/projects/[id]/time-entries`)**: Full project time-entry log + `+ Log Time` form/dialog (Section 2.7).
     - **Tab 3: `Expenses` (`/projects/[id]/expenses`)**: Full project expense log + approval controls + `+ Submit Expense` form/dialog (Section 2.8).

---

### 2.7 Time-Entry Workflows (`/projects/[id]/time-entries` & Quick Log Dialog)
- **Purpose**: Enable Team Members and Managers to record work hours accurately while preserving historical cost integrity via backend hourly-cost snapshots.
- **Authorized Roles**: `MANAGER` and assigned `TEAM_MEMBER`.
- **Recording Work Hours Form Specification**:
  - `project_id`: Pre-selected when opened inside `/projects/[id]/time-entries`; selectable dropdown of authorized `ACTIVE` projects when opened from `/dashboard`. (Logging time against `COMPLETED`, `CANCELLED`, or `ARCHIVED` projects is blocked with a clear explanation).
  - `work_date` (*Required*, ISO date `YYYY-MM-DD`): Defaults to today's local date. Cannot be in the future (`work_date <= today`).
  - `hours` (*Required*, positive decimal): Allowed range **`0.25` to `24.00`** hours per entry, supporting quarter-hour or tenth-hour decimals (up to 2 decimal places, e.g., `1.5`, `3.25`, `7.50`). Zero (`0`) or negative numbers are rejected.
  - `description` (*Required*, string, `5–500` chars): Concrete summary of work performed (e.g., *"Implemented Stripe webhook idempotency and retry tests"*).
  - **Hourly Cost Snapshot Rule (Mandatory)**: The form **never** exposes `hourly_cost_snapshot` as an editable input field. The backend automatically snapshots the user's/project's applicable hourly cost rate at creation time. In the form footer, a quiet informational note states: *"Labor cost is calculated automatically by the server using your configured internal cost rate."*
- **Time Entry History Table**:
  - Columns: `Work Date`, `Team Member`, `Description`, `Hours` (`tabular-nums`), `Hourly Rate Snapshot` (`MANAGER` only), `Computed Cost` (`MANAGER` only), and `Actions` (`Edit` / `Delete` if authorized).
  - Pagination: `25` entries per page, sorted by `work_date DESC, created_at DESC`.
  - Editing / Deleting: Authorized users (the entry creator while project is `ACTIVE`, or `MANAGER`) can edit `work_date`, `hours`, and `description`, or delete an erroneous entry after `AlertDialog` confirmation. Every mutation invalidates both the Time Entries query and the Project Financial Summary query so `actual_labor_cost` and `budget_consumed_pct` update immediately.

---

### 2.8 Expense Workflows (`/projects/[id]/expenses` & `/expenses`)
- **Purpose**: Manage project-related non-labor expenses (cloud hosting, software licenses, subcontractors, travel) with a strict approval gate so unapproved expenses never pollute actual project costs.
- **Authorized Roles**:
  - `TEAM_MEMBER`: Submit expense (`status = 'PENDING'`), view own expenses and their current status/rejection feedback, edit or delete own expense **only while `status === 'PENDING'`**.
  - `MANAGER`: Submit expense, view all expenses across projects, filter by `PENDING` / `APPROVED` / `REJECTED`, and execute **Approve** or **Reject** transitions on `PENDING` expenses.
- **Mandatory Financial Rule Disclosure in UI**:
  - Above every expense list and inside the expense submission dialog, a persistent informational banner/caption states:
    > **"Accounting Rule:** Only **Approved** expenses are included in Actual Project Cost. **Pending** and **Rejected** expenses have `$0.00` impact on budget consumption."
- **Distinct Status Presentation**:
  1. **`PENDING`**: Amber tint (`#FFFBEB`), `Clock` icon, label `"Pending Approval"`, helper text `"Excluded from Actual Cost until approved"`.
  2. **`APPROVED`**: Emerald tint (`#F0FDF4`), `CheckCircle2` icon, label `"Approved"`, helper text `"Included in Actual Cost · Approved by [Manager] on [Date]"`.
  3. **`REJECTED`**: Crimson tint (`#FEF2F2`), `XCircle` icon, label `"Rejected"`, helper text `"Excluded from Actual Cost"`, plus an inline callout displaying the manager's `rejection_reason` (e.g., *"Reason: Missing itemized vendor receipt; please re-submit with invoice PDF reference."*).
- **Manager Approval & Rejection UX**:
  - **Approve Action**: Clicking `Approve` on a `PENDING` expense opens a lightweight confirmation (`AlertDialog` or popover confirmation): *"Approve $1,250.00 expense for AWS Staging Cluster? This will immediately add $1,250.00 to Acme ERP's Actual Cost."*
  - **Reject Action**: Clicking `Reject` opens a modal requiring a `rejection_reason` (mandatory string, `5–300` chars) so the submitting team member knows why it was declined and how to remediate it.
  - Team members **never** see `Approve` or `Reject` buttons in the DOM.

---

### 2.9 `/settings` — Account & Workspace Settings
- **Purpose**: Provide clear visibility into the current user's authenticated profile, role capabilities, and agency-level defaults.
- **Authorized Roles**: `MANAGER`, `TEAM_MEMBER`.
- **Sections**:
  - **Profile & Role Summary**: Full Name, Email, Role Badge (`Agency Manager` or `Team Member`), and an explicit list of permitted actions for transparency during assessment review.
  - **Agency Financial Thresholds (Read-Only Reference or Manager Configurable if supported by API)**: Displays the active risk classification thresholds (Warning at `85%` budget consumed; Critical at `>100%` budget consumed or `>10%` projected overrun).
  - **Session Management**: `Sign Out` button (`POST /api/v1/auth/logout/`).

---

## 3. Financial Visualization Specification

Charts in MarginWatch exist strictly to accelerate financial comparison—never as decorative eye candy.

### 3.1 Approved Visualizations
1. **Visualization 1: Planned Budget vs. Actual Cost vs. Projected Final Cost Comparison Bar/Bullet Chart** (Displayed on `/dashboard` for top active projects and on `/projects/[id]` for the current project):
   - **Definition**: Horizontal comparison bars comparing three backend-provided values per project in the same currency:
     - `planned_cost_budget` (Reference target marker / baseline bar),
     - `actual_total_cost` (Solid primary fill bar),
     - `projected_remaining_cost` (Hatched/patterned extension bar extending from `actual_total_cost` to `projected_final_cost`).
   - **Color-Blind & Non-Color Cues**: Uses distinct fill patterns (solid fill for Actual Cost, diagonal stripe pattern for Projected Remaining Cost, and a vertical `2px` threshold line for Planned Cost Budget) plus direct numeric data labels (`tabular-nums`).
   - **Missing Forecast Handling**: If `estimated_remaining_hours === null`, the chart renders only `planned_cost_budget` and `actual_total_cost`, placing an explicit `[? Forecast Unavailable — Missing Estimate]` badge at the end of the Actual bar instead of drawing a misleading zero-length forecast.
2. **Visualization 2: Portfolio Risk Distribution Summary Bar** (Displayed on `/dashboard`):
   - **Definition**: Segmented horizontal proportion bar showing the exact count and percentage of active projects in `CRITICAL`, `WARNING`, `INCOMPLETE_DATA`, and `HEALTHY` states.
3. **Prohibition on Fabricated Time-Series**:
   - Unless the backend explicitly provides a historical snapshot endpoint, the frontend **must not** fabricate daily/weekly burn-down lines or cumulative cost curves by guessing historical state.

### 3.2 Mandatory Accessibility for Every Chart
- Every chart container includes a `View as Data Table` toggle button (or renders directly adjacent to the numeric ledger table) and provides a screen-reader-accessible `<table>` (`sr-only` or expandable) containing the exact underlying figures and units.

---

## 4. AI Risk Advisor Interface Specification

The **AI Risk Advisor** (`MANAGER` only, located on `/projects/[id]`) helps managers interpret why a project is at risk and explore concrete operational interventions.

### 4.1 Core Architectural Boundary: Advisory vs. Authoritative
The UI must make it unmistakable that **Django's financial engine is authoritative** and **the AI Risk Advisor is strictly advisory**:
1. **Visual Separation**: The AI Risk Advisor is housed in a dedicated panel styled with the `--status-advisory-*` Indigo Slate border and header (`"AI Risk Advisor · Advisory Analysis"`), visually separated from the top-level deterministic Financial Ledger Strip.
2. **Persistent Disclaimer Microcopy**: Footer inside the panel states: *"AI suggestions are advisory and generated from current project metrics. They do not modify budgets, approve expenses, or override calculated risk statuses."*
3. **Zero Autonomous Mutation**: The AI panel contains **no buttons** that automatically change budgets, alter estimates, or approve expenses. Suggested interventions may link to human-controlled forms (e.g., `"Review Pending Expenses →"` or `"Update Remaining Hours Estimate →"`).

### 4.2 Structured Content Hierarchy inside the Panel
When an AI analysis response is loaded, the panel renders 5 structured sub-sections:
1. **Authoritative Baseline Anchor**: Restates the backend's deterministic `risk_status` badge (`CRITICAL` / `WARNING` / `HEALTHY` / `INCOMPLETE_DATA`) and the timestamp of the underlying financial snapshot (`Generated Oct 17, 2026 at 14:32 UTC`).
2. **Deterministic Financial Drivers**: Bullet list of the exact mathematical rules triggered on the backend (`deterministic_drivers`).
3. **AI Executive Explanation (`ai_summary`)**: 1–2 concise paragraphs explaining the operational interplay between burn rate, remaining hours, and deadline.
4. **Suggested Interventions (`suggested_actions`, 2–4 items)**: Numbered cards (`01` to `04`), each displaying:
   - **Action Title** (e.g., *"Re-scope Phase 2 Reporting Module or negotiate change request"*),
   - **Rationale & Estimated Impact**, and
   - **Optional Navigation Link** to the relevant manual workflow.
5. **Assumptions & Missing Data Warnings (`assumptions` & `missing_data_warnings`)**: Explicitly calls out any caveats (e.g., *"Assumes $1,800.00 in Pending expenses will not be approved"* or *"Remaining hours estimate has not been updated in 14 days"*).

### 4.3 Required AI Risk Advisor States
| State | Visual & Interactive Behavior |
| :--- | :--- |
| **1. Idle / Not Yet Generated** | Displays deterministic risk drivers + `"Generate AI Risk Analysis"` button (`Sparkles` icon). |
| **2. Loading / Analyzing** | Skeleton lines inside the advisory box + `"Analyzing project cost drivers and variance..."` status text. The deterministic Financial Summary above remains 100% interactive. |
| **3. Success (Populated)** | Renders the 5 structured sub-sections above + `"Refresh Analysis"` secondary button. |
| **4. Unavailable / Provider Disabled (`503`)** | Renders a calm neutral notice: *"AI Risk Advisor is currently unavailable. Deterministic financial metrics and risk drivers remain active above."* |
| **5. Timeout (`504` / `> 25s` client abort)** | Renders warning notice: *"AI analysis timed out before completing."* + **`Retry Analysis`** button. |
| **6. Invalid / Malformed AI Response (`422` / Schema Mismatch)** | Caught by client Zod response validator; hides broken raw text, logs diagnostic warning, and renders: *"Received an incomplete advisory response."* + **`Retry Analysis`** button. |
