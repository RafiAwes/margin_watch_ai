# MarginWatch 13-Milestone Frontend Implementation Roadmap

> **Implementation note (October 2026):** this document is the original pre-implementation blueprint. The frontend that was actually built is a **Vite + React 19 + TypeScript + Tailwind CSS single-page app** (decision `DEC-002`) — it does not use Next.js, the App Router, Server Components, TanStack Query, React Hook Form or Zod. Server data is loaded through `src/services/api-client.ts`, lists are paged with `src/hooks/usePagedList.ts`, and all financial figures come from the backend engine. See [`frontend/README.md`](../../README.md) and the root [`README.md`](../../../README.md). Design-system, accessibility, financial and role rules in this document still apply.

This roadmap provides a **dependency-aware, step-by-step engineering sequence** designed for a solo developer to implement, verify, and explain the MarginWatch frontend incrementally. Complete and verify each milestone before starting the next.

---

## Milestone 1: Audit Existing Frontend & Finalize Design System Tokens

- **Objective**: Inspect the repository baseline, verify alignment with the MarginWatch documentation suite, and establish the foundational CSS variables, typography tokens, and financial formatting rules.
- **Prerequisites**: Read [`docs/frontend/README.md`](./README.md) and [`docs/frontend/design-system.md`](./design-system.md).
- **Implementation Tasks**:
  1. Audit existing repository files (`package.json`, `tsconfig.json`, `src/`) and confirm which starter files will be replaced or adapted for Next.js App Router.
  2. Configure the Google Fonts (`Plus Jakarta Sans`, `Public Sans`, `JetBrains Mono`) in the root layout so `--font-display`, `--font-sans`, and `--font-mono` CSS variables are globally available.
  3. Define the 60-30-10 color palette CSS variables and semantic status tokens (`--status-success-*`, `--status-warning-*`, `--status-danger-*`, `--status-neutral-*`, `--status-advisory-*`) in `src/app/globals.css`.
  4. Implement pure, stateless formatting utilities in `src/lib/formatters.ts` (`formatCurrency`, `formatHours`, `formatPercentage`, `formatVariance`, `formatDateISO`) with explicit `null` handling (`"Forecast Unavailable"`).
- **Files / Modules to Create**:
  - `src/app/globals.css`
  - `src/lib/formatters.ts`
  - `src/types/api.ts` (Core domain enums & interfaces: `UserRole`, `ProjectRiskStatus`, `ExpenseStatus`, `CurrencyCode`).
- **Expected Behavior**: Currency, decimal hours, and percentages format consistently with `tabular-nums`, and passing `null` to any forecast formatter returns the explicit fallback string instead of `$0.00` or `NaN`.
- **Acceptance Criteria**:
  - Contrast ratios of all defined CSS variable pairs meet WCAG 2.2 AA ($\ge 4.5:1$ text, $\ge 3.0:1$ UI borders).
  - `formatCurrency(null, 'USD')` returns `"Forecast Unavailable"`.
- **Manual Test Steps**:
  1. Render a temporary token swatch or inspect computed styles in DevTools to verify font families (`Plus Jakarta Sans`, `Public Sans`, `JetBrains Mono`) and `font-variant-numeric: tabular-nums`.
  2. Verify `formatCurrency(0, 'USD')` returns `"$0.00"` while `formatCurrency(null, 'USD')` returns `"Forecast Unavailable"`.
- **Completion Definition**: Design tokens, fonts, domain types, and null-safe financial formatters compile cleanly with `tsc --noEmit`.

---

## Milestone 2: Initialize & Verify the Frontend Toolchain

- **Objective**: Ensure the Next.js App Router, TypeScript strict mode, Tailwind CSS, ESLint, shadcn/ui primitives, React Hook Form, Zod, TanStack Query, and Sonner toolchain builds and lints cleanly.
- **Prerequisites**: Milestone 1 complete.
- **Implementation Tasks**:
  1. Verify or configure `next.config.ts`, `tsconfig.json` (`"strict": true`, `"noUncheckedIndexedAccess": true`), and ESLint configuration.
  2. Install and verify core dependencies (`@tanstack/react-query`, `react-hook-form`, `zod`, `@hookform/resolvers`, `lucide-react`, `sonner`, and required Radix/shadcn primitives).
  3. Create `src/providers/query-provider.tsx` configuring `QueryClient` (`staleTime: 30_000`, `retry: 1`, `refetchOnWindowFocus: false`) and mount it alongside `<Toaster />` (`sonner`) in `src/app/layout.tsx`.
  4. Initialize essential shared UI primitives in `src/components/ui/` (`button.tsx`, `input.tsx`, `select.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `tabs.tsx`, `tooltip.tsx`).
- **Files / Modules to Create**:
  - `src/providers/query-provider.tsx`
  - `src/app/layout.tsx`
  - `src/components/ui/{button,input,select,dialog,alert-dialog,tabs,tooltip,sonner}.tsx`
  - `.env.example` (Documenting `NEXT_PUBLIC_API_BASE_URL` and `DJANGO_INTERNAL_API_URL`).
- **Expected Behavior**: Application compiles with zero TypeScript or ESLint errors, and base UI primitives render with accessible focus rings.
- **Acceptance Criteria**:
  - `npm run lint` and `npx tsc --noEmit` pass with 0 errors.
  - Production build (`npm run build`) succeeds.
- **Manual Test Steps**:
  1. Start the dev server (`npm run dev`), open the browser, and verify zero console errors or hydration warnings.
  2. Trigger a test `toast.success("Toolchain verified")` and verify keyboard focus ring on `<Button />`.
- **Completion Definition**: Clean build, strict TypeScript enabled, and UI primitive library ready.

---

## Milestone 3: Build the Reusable Application Shell & Navigation

- **Objective**: Build the responsive workspace layout (`AppShell`), role-filtered `SidebarNav`, single-row `TopBar` with breadcrumbs, `MobileNavDrawer`, and shared status/value display components.
- **Prerequisites**: Milestone 2 complete.
- **Implementation Tasks**:
  1. Create `src/lib/permissions.ts` with pure helper predicates (`isManager(user)`, `canManageClients(user)`, `canManageProjects(user)`, `canApproveExpenses(user)`).
  2. Build `<SidebarNav />` (`256px` desktop width) displaying `Dashboard`, `Projects`, `Clients` (`MANAGER` only), `Expenses`, and `Settings`, plus the authenticated user's name, role label, and `Sign Out` button.
  3. Build `<TopBar />` (`56px` height) implementing the 3-zone contract: Mobile Drawer trigger (`lg:hidden`) + `<BreadcrumbTrail />` on the left, and contextual primary CTA slot on the right.
  4. Build `<MobileNavDrawer />` using `<Sheet />` (`Dialog` primitive) with focus trapping and automatic close on route change.
  5. Build shared data-display components in `src/components/shared/`: `<MoneyValue />`, `<HoursValue />`, `<PercentageValue />`, `<RiskStatusBadge />`, and `<ExpenseStatusBadge />`.
- **Files / Modules to Create**:
  - `src/lib/permissions.ts`
  - `src/components/layout/{app-shell,sidebar-nav,top-bar,mobile-nav-drawer,page-header}.tsx`
  - `src/components/shared/{money-value,hours-value,percentage-value,risk-status-badge,expense-status-badge}.tsx`
- **Expected Behavior**: Switching between `MANAGER` and `TEAM_MEMBER` user fixtures cleanly hides/shows the `Clients` navigation item; `<RiskStatusBadge />` and `<ExpenseStatusBadge />` render icon + text + accessible semantic colors.
- **Acceptance Criteria**:
  - Skip-to-content link (`#main-content`) is the first tab stop on every page.
  - Mobile sticky header height is $\le 56\text{px}$ ($\le 15\%$ of mobile viewport height).
- **Manual Test Steps**:
  1. Resize viewport across `375px`, `768px`, and `1440px` to verify sidebar collapse and mobile drawer keyboard focus trap.
  2. Navigate with `Tab` key to verify focus order: Skip Link $\rightarrow$ Sidebar $\rightarrow$ Top Bar $\rightarrow$ Main Content.
- **Completion Definition**: Responsive shell and shared status/financial badges verified at all 3 breakpoints.

---

## Milestone 4: Implement Login & Protected Application Routes

- **Objective**: Connect authentication (`POST /api/v1/auth/login/`, `GET /api/v1/auth/me/`, `POST /api/v1/auth/logout/`), protect workspace routes against unauthenticated access, and enforce role gatekeeping on manager-only routes.
- **Prerequisites**: Milestone 3 complete; review [`docs/frontend/api-integration.md`](./api-integration.md).
- **Implementation Tasks**:
  1. Build `<LoginForm />` in `src/features/auth/components/login-form.tsx` with Zod validation, loading lock, `401` credential error banner, and `reason=session_expired` alert support.
  2. Create `src/app/(auth)/login/page.tsx`.
  3. Implement route protection in `src/middleware.ts` and session verification in `src/app/(workspace)/layout.tsx`.
  4. Build `<PermissionDeniedState />` in `src/components/shared/permission-denied-state.tsx` to render when a `TEAM_MEMBER` navigates directly to `/clients/*`, `/projects/new`, or `/projects/[id]/edit`.
  5. Implement logout handler that posts to `/api/v1/auth/logout/`, runs `queryClient.clear()`, and redirects to `/login`.
- **Files / Modules to Create**:
  - `src/middleware.ts`
  - `src/features/auth/components/login-form.tsx`
  - `src/features/auth/api/use-auth.ts`
  - `src/app/(auth)/login/page.tsx`
  - `src/app/(workspace)/layout.tsx`
  - `src/components/shared/permission-denied-state.tsx`
- **Expected Behavior**: Unauthenticated users are redirected to `/login?returnTo=...`; authenticated users are routed into the workspace with their verified role; unauthorized role access renders a clear `403` state.
- **Acceptance Criteria**:
  - Entering invalid credentials displays an accessible `role="alert"` message without clearing the email field.
  - Logging out clears all cached financial queries and prevents back-button access to protected data.
- **Manual Test Steps**:
  1. Visit `/projects` while logged out and verify redirect to `/login?returnTo=%2Fprojects`.
  2. Log in as a `TEAM_MEMBER` and manually visit `/clients/new`; verify `<PermissionDeniedState />` renders cleanly.
- **Completion Definition**: Full authentication lifecycle and RBAC route guards operational.

---

## Milestone 5: Implement Shared Forms, Feedback Patterns & API Integration Foundations

- **Objective**: Build the typed API client (`AbortController` timeouts, `ApiError` normalization), centralized TanStack Query key factory, server field-error mapper, and reusable loading/empty/error state panels.
- **Prerequisites**: Milestone 4 complete; review [`docs/frontend/forms-and-state.md`](./forms-and-state.md).
- **Implementation Tasks**:
  1. Implement `src/lib/api-client.ts` with `10,000ms` default timeout (`25,000ms` override for AI Risk Advisor), automatic `401` session-expiry redirect, and normalized `ApiError` parsing (`status`, `code`, `detail`, `field_errors`).
  2. Implement `src/lib/query-keys.ts` with the hierarchical query key factory.
  3. Implement `applyServerErrorsToForm()` helper in `src/lib/form-error-mapper.ts` to bind Django `400` `field_errors` to React Hook Form's `setError` and focus the first invalid field.
  4. Build `<FormFieldWrapper />`, `<EmptyStatePanel />`, `<ErrorStatePanel />`, `<TableSkeleton />`, `<FilterToolbar />`, and `<PaginationBar />` in `src/components/shared/`.
  5. Add `src/app/(workspace)/loading.tsx` and `src/app/(workspace)/error.tsx`.
- **Files / Modules to Create**:
  - `src/lib/api-client.ts`
  - `src/lib/query-keys.ts`
  - `src/lib/form-error-mapper.ts`
  - `src/components/shared/{form-field-wrapper,empty-state-panel,error-state-panel,table-skeleton,filter-toolbar,pagination-bar}.tsx`
  - `src/app/(workspace)/{loading,error}.tsx`
- **Expected Behavior**: API errors, timeouts, empty datasets, and field validation errors are handled through a single consistent set of accessible components.
- **Acceptance Criteria**:
  - Simulated `400` response with `field_errors` highlights the exact form input and announces the error via `role="alert"`.
  - Simulated `500` or network disconnect renders `<ErrorStatePanel />` with a working `Retry` button.
- **Manual Test Steps**:
  1. Trigger a simulated `400` validation error and verify focus moves to the invalid field and user-typed values remain intact.
  2. Throttle network in DevTools to verify `10s` timeout triggers a recoverable error state.
- **Completion Definition**: All 15 required application states have tested, reusable building blocks.

---

## Milestone 6: Implement Client Management Workflows

- **Objective**: Build the complete `MANAGER`-only Client Management workflow (`/clients`, `/clients/new`, `/clients/[id]`) including search, creation, editing, related projects list, and archive protection rules.
- **Prerequisites**: Milestone 5 complete.
- **Implementation Tasks**:
  1. Create `src/lib/validators/client-schema.ts` and `src/features/clients/api/client-queries.ts`.
  2. Build `<ClientListTable />` on `/clients` with URL-synced search (`?q=`), status filter (`ACTIVE` | `ARCHIVED`), empty state, and no-results state.
  3. Build `<ClientForm />` for `/clients/new` and inline editing on `/clients/[id]`.
  4. Build `/clients/[id]/page.tsx` displaying client details, a table of associated projects with their risk statuses, and `<ArchiveClientDialog />` (`AlertDialog`).
- **Files / Modules to Create**:
  - `src/lib/validators/client-schema.ts`
  - `src/features/clients/api/client-queries.ts`
  - `src/features/clients/components/{client-list-table,client-form,archive-client-dialog}.tsx`
  - `src/app/(workspace)/clients/page.tsx`
  - `src/app/(workspace)/clients/new/page.tsx`
  - `src/app/(workspace)/clients/[id]/page.tsx`
- **Expected Behavior**: Managers can create, search, view, edit, and archive clients; attempting to archive a client with active projects displays the backend constraint message cleanly.
- **Acceptance Criteria**:
  - Creating a client invalidates `queryKeys.clients.all` and navigates to `/clients/[id]`.
  - Archiving requires explicit confirmation in `<ArchiveClientDialog />`.
- **Manual Test Steps**:
  1. Create a new client, edit its contact email, and verify the update persists on page reload.
  2. Search for a nonexistent client name on `/clients` and verify the `"Clear Search"` recovery button works.
- **Completion Definition**: Complete Client CRUD and archiving verified for `MANAGER` and blocked (`403`) for `TEAM_MEMBER`.

---

## Milestone 7: Implement Project List, Creation, Editing & Detail Views

- **Objective**: Build the project portfolio list (`/projects` with desktop table and mobile financial cards), two-part project creation/editing form (`/projects/new`, `/projects/[id]/edit`), and Project Detail workspace shell (`/projects/[id]`).
- **Prerequisites**: Milestone 6 complete.
- **Implementation Tasks**:
  1. Create `src/lib/validators/project-schema.ts` implementing the two-section Commercial vs. Delivery Planning validation and the explicit `estimate_unknown` checkbox (`null` serialization).
  2. Build `<ProjectListTable />` (desktop `md:block`) and `<ProjectMobileCardList />` (mobile `md:hidden`) with URL-synced search (`?q=`), status filter, risk filter, sorting, and pagination.
  3. Build `<ProjectForm />` for `/projects/new` and `/projects/[id]/edit`, including the live read-only Planned Target Profit/Margin preview and duplicate-submission lock.
  4. Build `src/app/(workspace)/projects/[id]/layout.tsx` (shared project identity header, deterministic risk banner, and URL-addressable tabs for `Overview & Financials`, `Time Entries`, and `Expenses`) and `<ProjectFinancialStrip />`.
- **Files / Modules to Create**:
  - `src/lib/validators/project-schema.ts`
  - `src/features/projects/api/project-queries.ts`
  - `src/features/projects/components/{project-list-table,project-mobile-card,project-form,project-financial-strip,project-risk-banner}.tsx`
  - `src/app/(workspace)/projects/page.tsx`
  - `src/app/(workspace)/projects/new/page.tsx`
  - `src/app/(workspace)/projects/[id]/{layout,page}.tsx`
  - `src/app/(workspace)/projects/[id]/edit/page.tsx`
  - `src/app/(workspace)/projects/[id]/financials/page.tsx`
- **Expected Behavior**: Projects can be filtered and sorted; creating/editing a project with an unknown remaining-hour estimate explicitly saves `null` and renders `"Forecast Unavailable"` with a direct CTA on Project Detail.
- **Acceptance Criteria**:
  - Leaving `estimated_remaining_hours` blank without checking *"Remaining hours estimate is not yet known"* triggers a helpful inline validation prompt instead of sending `0`.
  - Team Members viewing `/projects` and `/projects/[id]` see operational project info without commercial revenue, profit, or margin figures.
- **Manual Test Steps**:
  1. Create a project with *"Remaining hours estimate is not yet known"* checked; verify `/projects/[id]` shows `Missing Estimate` and `Forecast Unavailable`.
  2. Edit the project to set `estimated_remaining_hours = 120` and verify `projected_final_cost`, `projected_profit`, and `projected_margin_pct` immediately populate.
- **Completion Definition**: Project portfolio, creation, editing, and detail financial header verified across desktop and mobile.

---

## Milestone 8: Implement Time-Entry Workflows

- **Objective**: Enable Team Members and Managers to record, view, edit, and delete work hours while enforcing decimal hour validation (`0.25–24.00`) and keeping `hourly_cost_snapshot` strictly server-controlled.
- **Prerequisites**: Milestone 7 complete.
- **Implementation Tasks**:
  1. Create `src/lib/validators/time-entry-schema.ts` (`hours` between `0.25` and `24.00`, `work_date <= today`, `description` 5–500 chars, no cost-rate field).
  2. Build `<TimeEntryFormDialog />` (usable from both `/projects/[id]/time-entries` and `/dashboard` quick action) and `<TimeEntryTable />` with pagination and edit/delete confirmation.
  3. Wire `useCreateTimeEntryMutation`, `useUpdateTimeEntryMutation`, and `useDeleteTimeEntryMutation` to invalidate `timeEntries`, `projects.detail`, `projects.financials`, `projects.all`, and `dashboard.summary`.
- **Files / Modules to Create**:
  - `src/lib/validators/time-entry-schema.ts`
  - `src/features/time-entries/api/time-entry-queries.ts`
  - `src/features/time-entries/components/{time-entry-form-dialog,time-entry-table}.tsx`
  - `src/app/(workspace)/projects/[id]/time-entries/page.tsx`
- **Expected Behavior**: Logging, editing, or deleting hours immediately updates the project's `actual_labor_cost`, `actual_total_cost`, `budget_consumed_pct`, `projected_final_cost`, and `risk_status`.
- **Acceptance Criteria**:
  - Entering `0`, `-2`, or `25` hours, or a future `work_date`, is blocked with an accessible inline error.
  - `hourly_cost_snapshot` and `computed_cost` columns render in `<TimeEntryTable />` for `MANAGER` only and are never editable inputs.
- **Manual Test Steps**:
  1. Log `4.50` hours on an active project and verify the Project Financial Strip's `Actual Cost to Date` and `Budget Consumed %` increment immediately without a manual page reload.
  2. Delete the test time entry and verify the financial totals revert accurately.
- **Completion Definition**: Complete time-entry lifecycle integrated with automatic financial summary cache invalidation.

---

## Milestone 9: Implement Expense Workflows & Manager Approval Controls

- **Objective**: Build the project-scoped (`/projects/[id]/expenses`) and cross-project (`/expenses`) expense workflows, distinct status indicators (`PENDING`, `APPROVED`, `REJECTED`), accounting rule disclosures, and Manager approval/rejection controls.
- **Prerequisites**: Milestone 8 complete.
- **Implementation Tasks**:
  1. Create `src/lib/validators/expense-schema.ts` (expense submission schema + manager mandatory `rejection_reason` schema).
  2. Build `<ExpenseFormDialog />` with explicit microcopy stating that submitted expenses start as `Pending Approval` and do not affect Actual Cost until approved.
  3. Build `<ExpenseTable />`, `<ExpenseApprovalActions />`, and `<RejectExpenseDialog />`.
  4. Build `/projects/[id]/expenses/page.tsx` and the global `/expenses/page.tsx` (allowing Managers to filter by `status=PENDING` across all projects and Team Members to track their submitted expenses).
- **Files / Modules to Create**:
  - `src/lib/validators/expense-schema.ts`
  - `src/features/expenses/api/expense-queries.ts`
  - `src/features/expenses/components/{expense-form-dialog,expense-table,expense-approval-actions,reject-expense-dialog}.tsx`
  - `src/app/(workspace)/projects/[id]/expenses/page.tsx`
  - `src/app/(workspace)/expenses/page.tsx`
- **Expected Behavior**: Submitting an expense creates a `PENDING` record (`$0.00` impact on `actual_expense_cost`); Manager approval immediately adds the amount to `actual_expense_cost`; Manager rejection records and displays the `rejection_reason`.
- **Acceptance Criteria**:
  - `Approve` and `Reject` controls are rendered only when `user.role === 'MANAGER'` and `expense.status === 'PENDING'`.
  - Rejecting an expense without a `rejection_reason` (`>= 5` chars) is blocked by validation.
- **Manual Test Steps**:
  1. Submit an expense as `TEAM_MEMBER`; verify `actual_expense_cost` on the project does not change while `status === 'PENDING'`.
  2. Log in as `MANAGER`, approve the expense, and verify `actual_expense_cost` and `actual_total_cost` immediately increase by the expense amount.
  3. Reject a second expense with a reason and verify the reason is visible in the `REJECTED` row.
- **Completion Definition**: Expense submission, approval, rejection, and financial rollup invalidation verified.

---

## Milestone 10: Implement Financial Dashboards & Project Visualizations

- **Objective**: Build the decision-first `/dashboard` (Manager portfolio watchdog and Team Member delivery workspace) and the accessible `<BudgetForecastChart />` visualization.
- **Prerequisites**: Milestone 9 complete.
- **Implementation Tasks**:
  1. Build `<ManagerDashboard />` implementing the 5 KPI cards (with exact aggregate margin math and incomplete-project disclosure footnotes), `<AtRiskWatchlistTable />`, `<PendingExpensesWidget />`, and recent time activity feed.
  2. Build `<MemberDashboard />` showing assigned active projects, personal logged hours summary, recent submitted expenses with status badges, and quick `+ Log Time` / `+ Submit Expense` triggers.
  3. Build `<BudgetForecastChart />` comparing `planned_cost_budget`, `actual_total_cost`, and `projected_final_cost` using solid vs. hatched SVG fills, explicit missing-estimate callouts, and an accessible `Chart | Data Table` toggle.
  4. Build `/settings/page.tsx` showing user profile, role capability matrix, and agency risk thresholds.
- **Files / Modules to Create**:
  - `src/features/dashboard/api/dashboard-queries.ts`
  - `src/features/dashboard/components/{manager-dashboard,member-dashboard,at-risk-watchlist-table,pending-expenses-widget}.tsx`
  - `src/features/projects/components/budget-forecast-chart.tsx`
  - `src/app/(workspace)/dashboard/page.tsx`
  - `src/app/(workspace)/settings/page.tsx`
- **Expected Behavior**: The first viewport of `/dashboard` immediately answers how many active projects exist, which are at risk, how much budget is consumed, what final cost is projected, and what requires action today.
- **Acceptance Criteria**:
  - Aggregate projected margin is calculated from summed revenue and summed projected cost of forecastable projects—never averaged across project margin percentages.
  - Zero-client and zero-project states on `/dashboard` display guided onboarding steps with primary CTAs.
- **Manual Test Steps**:
  1. Verify `/dashboard` with a mix of `HEALTHY`, `WARNING`, `CRITICAL`, and `INCOMPLETE_DATA` projects.
  2. Toggle `<BudgetForecastChart />` to `Data Table` mode using the keyboard and verify exact numeric parity.
- **Completion Definition**: Role-aware `/dashboard`, `/settings`, and financial visualizations complete.

---

## Milestone 11: Implement the AI Risk Advisor Interface

- **Objective**: Build `<AiRiskAdvisorPanel />` on `/projects/[id]` (`MANAGER` only) to display deterministic risk drivers alongside non-authoritative AI explanations, 2–4 suggested interventions, assumptions, and resilient timeout/error retry states.
- **Prerequisites**: Milestone 10 complete.
- **Implementation Tasks**:
  1. Create `src/lib/validators/ai-advisor-schema.ts` to validate the structured JSON returned by `POST /api/v1/projects/{id}/ai-risk-analysis/`.
  2. Build `<AiRiskAdvisorPanel />` in `src/features/projects/components/ai-risk-advisor-panel.tsx` using `--status-advisory-*` styling and the explicit non-authoritative disclaimer.
  3. Implement all 6 AI panel states: Idle, Loading (`25s` timeout budget), Populated Success, Provider Unavailable (`503`), Timeout (`504`), and Malformed Response (`422`), with a manual `Retry Analysis` button.
- **Files / Modules to Create**:
  - `src/lib/validators/ai-advisor-schema.ts`
  - `src/features/projects/components/ai-risk-advisor-panel.tsx`
- **Expected Behavior**: Managers can generate and refresh AI risk insights; if the AI provider fails or times out, the error is isolated inside the advisory panel and never disrupts the project's deterministic financial summary.
- **Acceptance Criteria**:
  - AI output never modifies budgets, approves expenses, or overrides the deterministic `risk_status` badge.
  - Simulating a `504` timeout displays the retry button while leaving the top 6 financial metric cards intact.
- **Manual Test Steps**:
  1. Trigger AI Risk Analysis on a `CRITICAL` project and verify deterministic drivers, AI summary, 2–4 suggested actions, and assumptions render clearly.
  2. Simulate a failed AI response and verify `Retry Analysis` recovers cleanly.
- **Completion Definition**: AI Risk Advisor panel complete with strict visual and error isolation.

---

## Milestone 12: Complete Accessibility, Responsive, Error-State & Regression Testing

- **Objective**: Execute the comprehensive QA and WCAG 2.2 AA audit across all routes, viewports, roles, and error states, and author automated unit/integration/E2E tests.
- **Prerequisites**: Milestones 1–11 complete; review [`docs/frontend/accessibility-and-responsive-design.md`](./accessibility-and-responsive-design.md) and [`docs/frontend/testing-and-acceptance.md`](./testing-and-acceptance.md).
- **Implementation Tasks**:
  1. Walk through every checklist item in `testing-and-acceptance.md` using keyboard-only navigation (`Tab`, `Shift+Tab`, `Enter`, `Space`, `Escape`).
  2. Verify responsive layouts at `375px`, `768px`, and `1440px`.
  3. Verify all 15 Required Application States across `/dashboard`, `/clients`, `/projects`, `/projects/[id]`, and `/expenses`.
  4. Implement automated unit tests for formatters and Zod schemas (`Vitest`) and component/journey tests (`React Testing Library` / `Playwright`).
- **Files / Modules to Create**:
  - `src/lib/__tests__/formatters.test.ts`
  - `src/lib/validators/__tests__/{project-schema,time-entry-schema,expense-schema}.test.ts`
  - `src/features/projects/__tests__/project-financial-strip.test.tsx`
  - `e2e/marginwatch-critical-journeys.spec.ts`
- **Expected Behavior**: Zero WCAG 2.2 AA violations, zero layout overflows on mobile/tablet/desktop, and all automated tests passing.
- **Acceptance Criteria**:
  - All 12 QA checklist sections in `testing-and-acceptance.md` pass 100%.
- **Manual Test Steps**:
  1. Run keyboard-only walkthrough of Journeys 1, 2, and 3.
  2. Enable `prefers-reduced-motion: reduce` in OS/DevTools and verify animations/pulses are disabled.
- **Completion Definition**: All manual and automated quality gates passed.

---

## Milestone 13: Prepare the Assessment Demo & Final Documentation Review

- **Objective**: Seed realistic agency demonstration data (via backend seed script or manual walkthrough), verify documentation links, and prepare a crisp architectural defense walkthrough.
- **Prerequisites**: Milestone 12 complete.
- **Implementation Tasks**:
  1. Populate a realistic agency portfolio demonstrating every risk state:
     - 1 `CRITICAL` project (actual cost > budget or >10% projected overrun + pending expenses),
     - 1 `WARNING` project (85–99% budget consumed),
     - 1 `INCOMPLETE_DATA` project (`estimated_remaining_hours = null`), and
     - 2 `HEALTHY` projects.
  2. Verify that `README.md` and `docs/frontend/*.md` accurately reflect the final implemented routes and environment variables.
  3. Rehearse a 5-minute live technical explanation covering:
     - Why `null` remaining hours are never coerced to `0`,
     - Why `PENDING`/`REJECTED` expenses are excluded from `actual_expense_cost`,
     - Why portfolio projected margin is calculated from summed revenue and projected cost rather than averaging margins,
     - How TanStack Query invalidation keeps project financials synchronized after time/expense mutations, and
     - Why the AI Risk Advisor is isolated as non-authoritative guidance.
- **Files / Modules to Update**:
  - `README.md` (Final verification of setup and test commands).
- **Expected Behavior**: Application starts cleanly from a fresh clone and demonstrates every MVP workflow without console errors or visual glitches.
- **Acceptance Criteria**:
  - All 13 milestones complete and verified against Section 25 of the Master Prompt.
- **Manual Test Steps**:
  1. Execute a full clean build (`npm run build && npm run start`) and run through Journeys 1–3 in an incognito browser window.
- **Completion Definition**: MarginWatch frontend is production-grade, fully verified, and ready for assessment submission and live technical defense.
