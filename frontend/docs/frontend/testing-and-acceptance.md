# MarginWatch Frontend Testing, QA & Acceptance Criteria Specification

> **Implementation note (October 2026):** this document is the original pre-implementation blueprint. The frontend that was actually built is a **Vite + React 19 + TypeScript + Tailwind CSS single-page app** (decision `DEC-002`) — it does not use Next.js, the App Router, Server Components, TanStack Query, React Hook Form or Zod. Server data is loaded through `src/services/api-client.ts`, lists are paged with `src/hooks/usePagedList.ts`, and all financial figures come from the backend engine. See [`frontend/README.md`](../../README.md) and the root [`README.md`](../../../README.md). Design-system, accessibility, financial and role rules in this document still apply.

## 1. Frontend Quality Assurance Checklist

Before marking the MarginWatch frontend complete for assessment submission, verify every item in this 12-category quality gate:

### 1.1 Route Navigation & Deep-Linking
- [ ] All documented routes (`/login`, `/dashboard`, `/clients`, `/clients/new`, `/clients/[id]`, `/projects`, `/projects/new`, `/projects/[id]`, `/projects/[id]/edit`, `/projects/[id]/financials`, `/projects/[id]/time-entries`, `/projects/[id]/expenses`, `/expenses`, `/settings`) resolve without `404` or unhandled runtime errors.
- [ ] Active sidebar navigation links and project sub-navigation tabs accurately reflect the current URL pathname (`aria-current="page"`).
- [ ] Browser `Back` and `Forward` buttons restore URL-driven search, status filter, risk filter, sort order, and page number on `/projects`, `/clients`, and `/expenses`.

### 1.2 Authentication States
- [ ] Unauthenticated requests to any workspace route redirect immediately to `/login?returnTo=<encoded_path>`.
- [ ] Logging in with valid credentials redirects to `returnTo` (if internal and valid) or `/dashboard`.
- [ ] An expired or revoked session (`401` from any API call) clears cached user state and redirects to `/login?reason=session_expired` with a clear informational banner.
- [ ] Signing out (`POST /api/v1/auth/logout/`) purges the entire TanStack Query cache (`queryClient.clear()`) so a subsequent user on the same browser never sees residual financial data.

### 1.3 Role-Based Interface & Permission Behavior
- [ ] **`MANAGER` Role**: Sees Clients navigation, `+ New Project`, commercial revenue/profit/margin metrics, hourly cost snapshots on time entries, `Approve`/`Reject` controls on `PENDING` expenses, and the AI Risk Advisor panel.
- [ ] **`TEAM_MEMBER` Role**: Never sees `/clients` in navigation; receives `<PermissionDeniedState />` (`403`) if navigating directly to `/clients`, `/projects/new`, or `/projects/[id]/edit`; never sees `contract_revenue`, `projected_profit`, `projected_margin_pct`, `hourly_cost_snapshot`, or expense `Approve`/`Reject` controls.

### 1.4 Form Validation & Submission Integrity
- [ ] Client-side Zod validation blocks invalid submissions (empty required fields, negative/zero revenue or budget, time entry hours outside `0.25–24.00`, future work/expense dates) and associates error messages via `aria-invalid` and `aria-describedby`.
- [ ] Server-side `400 Bad Request` field errors map directly to the corresponding inputs via `form.setError()` without clearing user-typed data.
- [ ] Submit buttons lock (`disabled`, `aria-busy="true"`) during in-flight mutations, preventing duplicate records on rapid double-click or repeated `Enter` presses.
- [ ] User-entered financial amounts are never silently rounded, altered, or overwritten before submission.

### 1.5 Financial Value Formatting & Aggregation Accuracy
- [ ] Every currency figure, hour value, percentage, and variance delta renders in `JetBrains Mono` with `font-variant-numeric: tabular-nums`.
- [ ] Actual Delivery Cost equals `actual_labor_cost + actual_expense_cost` (where `actual_expense_cost` includes **only `APPROVED` expenses**).
- [ ] Portfolio projected margin on `/dashboard` is computed from aggregate revenue and aggregate projected cost across forecastable projects—never by averaging individual project margin percentages.

### 1.6 Missing-Data (`null` Estimate) Presentation
- [ ] Creating or editing a project with **"Remaining hours estimate is not yet known"** checked sends `"estimated_remaining_hours": null` to the backend.
- [ ] When `estimated_remaining_hours === null`, `projected_final_cost`, `projected_profit`, and `projected_margin_pct` render as **`Forecast Unavailable`** (never `$0.00` or `100.0%` margin) with a direct action to supply the missing estimate.
- [ ] On `/dashboard`, projects with `estimated_remaining_hours === null` are excluded from portfolio projected cost totals with an explicit disclosure count (`"Excludes N project(s) with missing estimates"`).

### 1.7 Expense Status Transitions & Accounting Clarity
- [ ] Newly submitted expenses always display `Pending Approval` (`PENDING`) and never imply automatic approval.
- [ ] The UI explicitly states that `PENDING` and `REJECTED` expenses contribute `$0.00` to Actual Cost.
- [ ] Manager approval of a `PENDING` expense immediately invalidates the project financial summary and updates `actual_expense_cost`, `actual_total_cost`, `budget_consumed_pct`, `projected_final_cost`, and `risk_status`.
- [ ] Manager rejection requires a non-empty `rejection_reason` (`5–300` chars), which is displayed clearly to the submitting team member.

### 1.8 AI Risk Advisor Isolation & Recovery
- [ ] The AI Risk Advisor panel is visually and structurally separated from deterministic backend financial metrics and includes an explicit advisory disclaimer.
- [ ] If the AI endpoint times out (`> 25s`), returns `503`, or returns malformed JSON, the deterministic project financial summary and risk banner remain 100% visible and usable, and the AI panel displays a calm error message with a `Retry Analysis` button.

### 1.9 Responsive Layouts & Mobile Ergonomics
- [ ] Verified at `375px` (Mobile), `768px` (Tablet), and `1440px` (Desktop) with zero unintended horizontal page overflow (`document.documentElement.scrollWidth <= window.innerWidth`).
- [ ] `/projects` switches cleanly to `<ProjectMobileCardList />` below `768px`.
- [ ] Mobile sticky top bar height does not exceed `56px` (`<= 15%` viewport height).

### 1.10 Keyboard Accessibility & Screen-Reader Compliance
- [ ] Full end-to-end workflows (login, create project, log time, submit expense, approve/reject expense, retry AI analysis) can be completed using only `Tab`, `Shift+Tab`, `Arrow` keys, `Space`, `Enter`, and `Escape`.
- [ ] All color pairings meet WCAG 2.2 AA contrast thresholds (`>= 4.5:1` for text, `>= 3.0:1` for UI controls/badges).
- [ ] Status badges always pair color with an icon and explicit text label.

---

## 2. Critical End-to-End User Journeys & Measurable Acceptance Criteria

### Journey 1: Agency Manager Onboarding, Project Setup & Missing-Estimate Triage
1. **Steps**:
   - Sign in as `MANAGER` $\rightarrow$ Navigate to `/clients/new` $\rightarrow$ Create client `"Northstar FinTech"` (`USD`).
   - Navigate to `/projects/new` $\rightarrow$ Enter `"Core Ledger API"`, Revenue `$120,000.00`, Planned Budget `$80,000.00`, Planned Hourly Cost `$125.00`, and check **"Remaining hours estimate is not yet known"** $\rightarrow$ Submit.
   - Inspect `/projects/[id]` $\rightarrow$ Click **"Enter Remaining Hours Estimate"** $\rightarrow$ Set `estimated_remaining_hours = 450` $\rightarrow$ Save.
2. **Measurable Acceptance Criteria**:
   - While `estimated_remaining_hours === null`, Project Detail displays `Missing Estimate` badge and `Forecast Unavailable` in all three forecast cards (0 instances of `$0.00` forecast).
   - After updating `estimated_remaining_hours = 450`, `projected_final_cost` updates immediately via cache invalidation to reflect `actual_total_cost + (450 * $125.00)`.

### Journey 2: Team Member Time Logging & Expense Submission (RBAC Enforcement)
1. **Steps**:
   - Sign in as `TEAM_MEMBER` $\rightarrow$ Verify `/clients` is absent from sidebar $\rightarrow$ Attempt direct navigation to `/clients` and `/projects/new` (verify `403` Permission Denied view).
   - Open assigned project `/projects/[id]` $\rightarrow$ Verify commercial revenue, profit, margin, and AI Risk Advisor are absent.
   - Open `Time Entries` tab $\rightarrow$ Log `6.50` hours for today with description $\rightarrow$ Verify entry appears in table without exposing `hourly_cost_snapshot`.
   - Open `Expenses` tab $\rightarrow$ Submit `$450.00` `INFRASTRUCTURE` expense $\rightarrow$ Verify status badge reads `Pending Approval` and `Approve`/`Reject` buttons are absent.
2. **Measurable Acceptance Criteria**:
   - `POST /api/v1/projects/{id}/time-entries/` payload contains `{ work_date, hours: 6.5, description }` and **no** hourly cost field.
   - Submitted expense displays `Pending Approval` with accounting note that actual project cost is unchanged until manager approval.

### Journey 3: Manager Expense Approval, Budget Breach & AI Risk Advisor Intervention
1. **Steps**:
   - Sign in as `MANAGER` $\rightarrow$ View `/dashboard` $\rightarrow$ Locate pending `$450.00` expense in the **Expenses Awaiting Approval** widget (or `/expenses?status=PENDING`).
   - Approve the `$450.00` expense and Reject a second `$200.00` expense with reason `"Missing receipt invoice number"`.
   - Navigate to `/projects/[id]` where budget consumption has now crossed `85%` (`WARNING`) or `100%` (`CRITICAL`).
   - Review the deterministic risk reasons in the top banner, then click **"Generate AI Risk Analysis"** in `<AiRiskAdvisorPanel />`.
2. **Measurable Acceptance Criteria**:
   - Approving the `$450.00` expense immediately increases `actual_expense_cost` and `actual_total_cost` by `$450.00`; rejecting the `$200.00` expense adds `$0.00` to `actual_expense_cost`.
   - `<AiRiskAdvisorPanel />` renders deterministic drivers alongside 2–4 advisory interventions and assumptions, and cleanly recovers via `Retry Analysis` when simulated with a network failure or `504` timeout.

---

## 3. Recommended Automated Frontend Testing Strategy (Future Implementation Work)

When implementing automated tests during or after Milestone 12, prioritize high-signal behavior tests over brittle implementation-detail snapshots:

1. **Unit Tests (Vitest — `src/lib/__tests__/`)**:
   - `formatters.test.ts`: Verify currency formatting across `USD`/`EUR`/`GBP`, decimal hour formatting (`6.5` $\rightarrow$ `6.50 hrs`), percentage formatting, and `null` fallback rendering (`"Forecast Unavailable"`).
   - `project-schema.test.ts`, `time-entry-schema.test.ts`, `expense-schema.test.ts`: Verify Zod validation rules, especially `estimate_unknown: true` $\rightarrow$ `estimated_remaining_hours: null`, rejection of blank remaining hours when `estimate_unknown: false`, `0.25–24.00` hour bounds, and future-date rejection.
2. **Component & Integration Tests (Vitest + React Testing Library + MSW — `src/features/**/__tests__/`)**:
   - `ProjectFinancialStrip.test.tsx`: Verify rendering when forecast fields are populated vs. when `projected_final_cost === null`.
   - `ExpenseApprovalActions.test.tsx`: Verify `Approve` and `Reject` buttons render only for `MANAGER` on `PENDING` expenses, require `rejection_reason` on reject, and invalidate project financial queries on success.
   - `AiRiskAdvisorPanel.test.tsx`: Verify rendering of populated advice, `504` timeout state, and non-interference with deterministic financial metrics.
3. **End-to-End Smoke Tests (Playwright — `e2e/`)**:
   - Automate Journeys 1, 2, and 3 above plus automated `@axe-core/playwright` WCAG 2.2 AA accessibility scans on `/login`, `/dashboard`, `/projects`, and `/projects/[id]`.
