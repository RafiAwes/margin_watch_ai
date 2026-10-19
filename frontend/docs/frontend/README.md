# MarginWatch Frontend Architecture & Engineering Blueprint

> **Implementation note (October 2026):** this document is the original pre-implementation blueprint. The frontend that was actually built is a **Vite + React 19 + TypeScript + Tailwind CSS single-page app** (decision `DEC-002`) — it does not use Next.js, the App Router, Server Components, TanStack Query, React Hook Form or Zod. Server data is loaded through `src/services/api-client.ts`, lists are paged with `src/hooks/usePagedList.ts`, and all financial figures come from the backend engine. See [`frontend/README.md`](../../README.md) and the root [`README.md`](../../../README.md). Design-system, accessibility, financial and role rules in this document still apply.

## 1. Repository Audit & Baseline Resolution

### 1.1 Current Repository State Audit
Before designing the MarginWatch frontend architecture, the workspace was audited to establish the current baseline:

1. **Existing Files Inspected**:
   - `/package.json`, `/tsconfig.json`, `/vite.config.ts`, `/index.html`, `/src/main.tsx`, `/src/App.tsx`, `/src/index.css`, `/.env.example`.
2. **Audit Findings**:
   - **Frontend State**: The workspace currently contains only an unconfigured starter shell (`src/App.tsx` renders an empty `<div></div>`) using `npm` (evident from standard `package.json` scripts and structure).
   - **Missing Backend Documentation (`docs/*.md`)**: The repository does not yet contain `docs/requirements.md`, `docs/financial-rules.md`, `docs/architecture.md`, `docs/data-model.md`, `docs/api-specification.md`, `docs/security-and-permissions.md`, `docs/testing-strategy.md`, `docs/ai-risk-advisor.md`, or `docs/development-roadmap.md`.
3. **Conflict & Gap Resolution (Confirmed Baseline)**:
   - Rather than inventing ad-hoc UI behavior or leaving specifications vague, this blueprint establishes the **Canonical MarginWatch Baseline Rules & Contracts** in Section 2 below and in [`api-integration.md`](./api-integration.md).
   - Every formula, permission check, status transition, and null-handling rule in the frontend specification is strictly bound to these canonical domain rules.
   - **Assessment Constraint Compliance**: Zero executable application code has been generated or modified. All deliverables are architectural, UX, and implementation specifications designed for independent implementation by the developer.

---

## 2. Canonical Domain Rules & Financial Formulas (Source of Truth)

The Django backend is the sole authority for financial calculations, risk classification, and permissions. The frontend **never** independently re-derives profit, margin, or risk status from raw line items—it renders backend-calculated fields and formats them consistently. However, the frontend developer must understand and enforce the exact semantics of every metric in labels, tooltips, empty states, and aggregation views.

### 2.1 Core Project Financial Definitions

| Metric Field | Formula / Backend Source Rule | Frontend Presentation & Null-Safety Rule |
| :--- | :--- | :--- |
| **`contract_revenue`** | Fixed commercial contract value agreed with the client ($> 0$). | Visible to `MANAGER` only. Hidden/omitted from `TEAM_MEMBER` responses. |
| **`planned_cost_budget`** | Target maximum internal delivery cost for the project ($> 0$). | Visible to `MANAGER` (and optionally read-only budget progress to `TEAM_MEMBER` if permitted by endpoint; defaults to `MANAGER` only). |
| **`planned_hourly_cost`** | Estimated blended internal hourly cost rate used to value remaining estimated hours ($> 0$). | Used by backend to compute `projected_remaining_cost`. Never used to retroactively alter historical time entries. |
| **`estimated_remaining_hours`** | Remaining delivery effort in hours ($\ge 0$) **or `null` if unknown**. | **CRITICAL**: `null` means *unknown/unestimated*, **never** `0`. A value of `0` explicitly means zero hours of work remain. |
| **`actual_labor_cost`** | $\sum (\text{TimeEntry.hours} \times \text{TimeEntry.hourly\_cost\_snapshot})$ | Sum of all recorded time entries using each entry's immutable `hourly_cost_snapshot` captured when the work was logged. |
| **`actual_expense_cost`** | $\sum (\text{Expense.amount}) \text{ where } \text{status} = \text{'APPROVED'}$ | **CRITICAL**: Only `APPROVED` expenses contribute to `actual_expense_cost`. `PENDING` and `REJECTED` expenses contribute `$0.00`. |
| **`actual_total_cost`** | $\text{actual\_labor\_cost} + \text{actual\_expense\_cost}$ | Displayed in both Project Detail and Dashboard summaries. |
| **`budget_consumed_pct`** | $\left(\frac{\text{actual\_total\_cost}}{\text{planned\_cost\_budget}}\right) \times 100$ | Formatted to 1 decimal place (`tabular-nums`), e.g., `84.5%`. Can exceed `100.0%`. |
| **`projected_remaining_cost`** | If `estimated_remaining_hours !== null`: $\text{estimated\_remaining\_hours} \times \text{planned\_hourly\_cost}$. Else: `null`. | If `null`, display `"Estimate Required"` — never `$0.00`. |
| **`projected_final_cost`** | If `projected_remaining_cost !== null`: $\text{actual\_total\_cost} + \text{projected\_remaining\_cost}$. Else: `null`. | If `null`, display `"Forecast Unavailable"` with an inline CTA to update `estimated_remaining_hours`. |
| **`projected_cost_variance`** | If `projected_final_cost !== null`: $\text{projected\_final\_cost} - \text{planned\_cost\_budget}$. Else: `null`. | Positive variance ($> 0$) means projected **cost overrun** (danger/warning). Negative variance ($\le 0$) means projected **under/on budget**. Always label explicitly (e.g., `+$4,200 overrun` or `-$1,500 under budget`). |
| **`projected_profit`** | If `projected_final_cost !== null`: $\text{contract\_revenue} - \text{projected\_final\_cost}$. Else: `null`. | Visible to `MANAGER` only. If `null`, render `"Forecast Unavailable"`. |
| **`projected_margin_pct`** | If `projected_profit !== null`: $\left(\frac{\text{projected\_profit}}{\text{contract\_revenue}}\right) \times 100$. Else: `null`. | Visible to `MANAGER` only. Formatted to 1 decimal place (e.g., `24.2%`). |

### 2.2 Portfolio Aggregation Rules (Dashboard)
- **Prohibition on Averaging Margins**: The frontend must **never** compute portfolio margin by averaging individual project margin percentages ($\frac{1}{N}\sum \text{margin}_i$ is mathematically invalid across different contract sizes).
- **Authoritative Aggregate Margin Formula**:
  When summarizing a set of active projects $P_{\text{forecastable}}$ (those where `estimated_remaining_hours !== null` and matching currency):
  $$\text{Aggregate Projected Margin \%} = \left(\frac{\sum_{p \in P_{\text{forecastable}}} \text{contract\_revenue}_p - \sum_{p \in P_{\text{forecastable}}} \text{projected\_final\_cost}_p}{\sum_{p \in P_{\text{forecastable}}} \text{contract\_revenue}_p}\right) \times 100$$
- **Incomplete Forecast Disclosure**: If $k$ active projects have `estimated_remaining_hours === null`, the Dashboard Forecast KPI card must display an explicit footnote: *"Excludes $k$ project(s) with missing remaining-hour estimates"* with a filter link to view those incomplete projects.
- **Multi-Currency Guardrail**: Financial totals (`actual_total_cost`, `projected_final_cost`, `planned_cost_budget`) are aggregated per currency (defaulting to the agency's primary currency, e.g., `USD`, or filtered via a currency selector if multi-currency clients exist). Never sum raw numbers across `USD`, `EUR`, and `GBP` without an explicit currency filter.

### 2.3 Deterministic Risk Status Rules
The backend assigns each project one of four deterministic `risk_status` values alongside a `risk_reasons: string[]` array:
1. **`CRITICAL` (Over Budget / Severe Forecast Overrun)**:
   - `actual_total_cost > planned_cost_budget` ($> 100\%$ budget consumed), OR
   - `projected_final_cost > planned_cost_budget * 1.10` ($> 10\%$ projected cost overrun), OR
   - `projected_margin_pct < 10.0%` (severe margin compression).
2. **`WARNING` (Approaching Threshold / Moderate Risk)**:
   - `budget_consumed_pct >= 85.0%` while `actual_total_cost <= planned_cost_budget`, OR
   - `projected_final_cost > planned_cost_budget` (up to $10\%$ overrun), OR
   - Project deadline is within 7 calendar days with `estimated_remaining_hours > 40`.
3. **`INCOMPLETE_DATA` (Missing Delivery Forecast Inputs)**:
   - `estimated_remaining_hours === null` on an `ACTIVE` project (and actual cost has not already breached `planned_cost_budget`, which immediately triggers `CRITICAL`).
4. **`HEALTHY` (On Track)**:
   - `estimated_remaining_hours !== null`, `actual_total_cost <= planned_cost_budget * 0.85`, and `projected_final_cost <= planned_cost_budget`.

---

## 3. Role-Based Access Control (RBAC) Matrix

All authorization is enforced by the Django backend. The frontend uses the authenticated user's `role` (`MANAGER` | `TEAM_MEMBER`) to tailor navigation and avoid presenting dead-end controls, while gracefully handling `403 Forbidden` responses on every route and mutation.

| Capability / Workflow | Agency Manager (`MANAGER`) | Team Member (`TEAM_MEMBER`) |
| :--- | :--- | :--- |
| **View Executive Portfolio Dashboard (`/dashboard`)** | Full portfolio financial KPIs, At-Risk watchlist, Pending Expense Approval queue, Budget vs. Forecast chart. | Personal operational workspace: Assigned active projects, Recent logged hours this week, Submitted expense status tracker, Quick actions (`Log Time`, `Submit Expense`). |
| **Client Management (`/clients`, `/clients/new`, `/clients/[id]`)** | Full CRUD + Archive (if no active unarchived constraints violated). | No access (`403` / hidden from sidebar navigation). |
| **Project List & Detail (`/projects`, `/projects/[id]`)** | View all agency projects; full commercial revenue, budget, actuals, forecasts, profit, margin, and AI Risk Advisor. | View assigned/authorized `ACTIVE` projects only; view project status, deadline, own time entries, and own expenses. Commercial revenue, profit, margin,hourly cost rates, and AI Risk Advisor are restricted. |
| **Create / Edit Project (`/projects/new`, `/projects/[id]/edit`)** | Authorized (create project, edit commercial & delivery estimates). | Not authorized (`403`). |
| **Time Entry Workflows (`/projects/[id]/time-entries`)** | View all project time entries (including `hourly_cost_snapshot` and `computed_cost`); log own time; edit/delete entries on active projects. | View own time entries (hours, date, description—no cost rates); create/edit/delete own time entries on `ACTIVE` projects within allowed edit window. |
| **Expense Workflows (`/projects/[id]/expenses`, `/expenses`)** | View all project expenses; submit expenses; **Approve** or **Reject** `PENDING` expenses (with rejection reason). | Submit expenses (`PENDING`); view own expense status (`PENDING`, `APPROVED`, `REJECTED` + `rejection_reason`); edit/delete own `PENDING` expenses only. |
| **AI Risk Advisor (`POST /api/v1/projects/{id}/ai-risk-analysis/`)** | Authorized to view and trigger/retry AI risk analysis. | Not authorized. |

---

## 4. Verified Technology Stack Specification

In accordance with Section 4 of the Master Prompt, the target frontend stack is standardized on stable, production-verified releases:

| Layer | Technology & Version Policy | Architectural Rationale |
| :--- | :--- | :--- |
| **Package Manager** | **`npm`** (standardized via `package-lock.json`) | Already present in the repository environment; avoids lockfile fragmentation. |
| **Framework** | **Vite `^8` + React SPA** *(planned: Next.js App Router)* | Single-page app with a Vite dev server proxying `/api` to Django; no SSR required for an authenticated dashboard (`DEC-002`). |
| **UI Runtime** | **React `^19.0.0` & React DOM `^19.0.0`** | Matches the repository's installed React 19 baseline. |
| **Language** | **TypeScript `^5.8.x` (Strict Mode)** | `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true` to guarantee null-safety for financial values. |
| **Styling** | **Tailwind CSS `^4.x` (`@tailwindcss/postcss`)** | Zero-runtime CSS utility system configured with semantic CSS variables for the 60-30-10 financial palette. |
| **Accessible UI Primitives** | **shadcn/ui (Radix UI Primitives)** | Provides WAI-ARIA compliant `Dialog`, `AlertDialog`, `Select`, `Tabs`, `Tooltip`, `DropdownMenu`, and `Popover` foundations without locking into a generic template aesthetic. |
| **Icons** | **`lucide-react` (`^0.546.0`)** | Consistent 1.75px stroke geometric iconography paired with mandatory text labels for status indicators. |
| **Server State & Caching** | **Typed API client + `usePagedList` hook** *(planned: TanStack Query `^5.x`)* | Handles client-side mutations, loading/error states, retry policies, and cross-resource cache invalidation (e.g., invalidating project financials when an expense is approved). |
| **Forms & Validation** | **React Hook Form `^7.x` + Zod `^3.24.x` + `@hookform/resolvers`** | Co-locates client schema validation (decimal hour rules, positive currency amounts, explicit nullable remaining hours) with Django `400` server field error mapping. |
| **Notifications** | **`sonner` (`^2.x`)** | Lightweight, keyboard-accessible toast notifications for mutation confirmations and recoverable errors. |
| **Analytical Charts** | **Custom Accessible SVG Bar/Bullet Components (or lightweight `recharts` `^2.15.x` isolated to 2 client chart components)** | MarginWatch requires only two high-signal visualizations (Planned vs. Actual vs. Forecast Bullet/Bar comparison and Budget Consumption progress bars). Custom semantic SVG or lazily loaded Recharts avoids bundle bloat while guaranteeing full ARIA table fallbacks. |

---

## 5. Documentation Map

Use the following documents in sequence to review or implement the system:

1. [**Design System Specification (`design-system.md`)**](./design-system.md)
2. [**Routes & Pages Specification (`routes-and-pages.md`)**](./routes-and-pages.md)
3. [**Component Architecture (`component-architecture.md`, original Next.js blueprint)**](./component-architecture.md)
4. [**API Integration Contracts (`api-integration.md`)**](./api-integration.md)
5. [**Forms, Validation & Application States (`forms-and-state.md`)**](./forms-and-state.md)
6. [**Accessibility & Responsive UX (`accessibility-and-responsive-design.md`)**](./accessibility-and-responsive-design.md)
7. [**Testing, QA & Acceptance Criteria (`testing-and-acceptance.md`)**](./testing-and-acceptance.md)
8. [**13-Milestone Implementation Roadmap (`implementation-roadmap.md`)**](./implementation-roadmap.md)
