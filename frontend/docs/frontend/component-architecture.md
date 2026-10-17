# MarginWatch Component & Next.js Architecture Specification

## 1. Conceptual Layering & Responsibility Model

To ensure a solo developer can build, test, and explain the codebase without overengineering or duplicating business logic, the frontend architecture is organized into **14 explicit conceptual layers** grouped into 4 architectural tiers:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ TIER 1: APP ROUTER & SHELL TIER (`src/app/`, `src/components/layout/`)       │
│  1. Application Shell (`AppShell`, `SidebarNav`, `TopBar`, `MobileDrawer`)   │
│  2. Navigation & Breadcrumbs (`RoleAwareNav`, `BreadcrumbTrail`)             │
│  3. Page Layouts & Boundaries (`PageHeader`, `ErrorBoundaryCard`, `Loading`) │
├──────────────────────────────────────────────────────────────────────────────┤
│ TIER 2: DOMAIN FEATURE TIER (`src/features/*`)                               │
│  4. Financial Metric Components (`KpiSummaryStrip`, `MetricLedgerCard`)      │
│  5. Project Feature Components (`ProjectRiskBanner`, `AiRiskAdvisorPanel`)   │
│  6. Operational Workflow Modules (`TimeEntryForm`, `ExpenseApprovalDialog`)  │
├──────────────────────────────────────────────────────────────────────────────┤
│ TIER 3: SHARED UI & PATTERN TIER (`src/components/ui/`, `src/components/shared/`)│
│  7. Shared UI Primitives (`Button`, `Dialog`, `AlertDialog`, `Tabs`, `Select`)│
│  8. Form Controls (`FormFieldWrapper`, `CurrencyInput`, `DecimalHoursInput`) │
│  9. Data-Display & Status (`RiskStatusBadge`, `ExpenseStatusBadge`, `Money`) │
│ 10. Tables & Filters (`DataTable`, `FilterToolbar`, `PaginationBar`)         │
│ 11. Dialogs & Confirmations (`ConfirmActionDialog`, `RejectionReasonDialog`) │
│ 12. Loading, Empty & Error Patterns (`TableSkeleton`, `EmptyStatePanel`)     │
├──────────────────────────────────────────────────────────────────────────────┤
│ TIER 4: DATA ACCESS, CONTRACTS & VALIDATION TIER (`src/lib/`, `src/types/`)  │
│ 13. API & Data-Access Modules (`apiClient`, `serverFetch`, Query Key Factory)│
│ 14. Shared Types, Formatters & Zod Schemas (`financialFormatters`, `schemas`)│
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Recommended Folder & Module Structure

This structure balances Next.js App Router conventions with feature-oriented cohesion while avoiding deep, labyrinthine nesting:

```text
src/
├── app/                                  # Next.js App Router routes & boundaries
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx                  # Public login view
│   ├── (workspace)/                      # Authenticated layout group
│   │   ├── layout.tsx                    # Server session check + AppShell wrapper
│   │   ├── loading.tsx                   # Workspace-level fallback skeleton
│   │   ├── error.tsx                     # Workspace-level recoverable error boundary
│   │   ├── dashboard/
│   │   │   └── page.tsx                  # Role-aware Dashboard page
│   │   ├── clients/
│   │   │   ├── page.tsx                  # Client directory (Manager only)
│   │   │   ├── new/
│   │   │   │   └── page.tsx              # Create client form
│   │   │   └── [id]/
│   │   │       └── page.tsx              # Client detail, projects & archive
│   │   ├── projects/
│   │   │   ├── page.tsx                  # Filterable project portfolio list
│   │   │   ├── new/
│   │   │   │   └── page.tsx              # Two-section project creation form
│   │   │   └── [id]/
│   │   │       ├── layout.tsx            # Shared project identity header & tab bar
│   │   │       ├── page.tsx              # Project overview, financials & AI Advisor
│   │   │       ├── edit/
│   │   │       │   └── page.tsx          # Edit project commercial & delivery inputs
│   │   │       ├── financials/
│   │   │       │   └── page.tsx          # Deep-link financial breakdown view
│   │   │       ├── time-entries/
│   │   │       │   └── page.tsx          # Project time entries & Log Time form
│   │   │       └── expenses/
│   │   │           └── page.tsx          # Project expenses & Manager approval actions
│   │   ├── expenses/
│   │   │   └── page.tsx                  # Global cross-project expense queue / tracker
│   │   └── settings/
│   │       └── page.tsx                  # User profile, role permissions & sign-out
│   ├── api/                              # Next.js Route Handlers (BFF cookie/proxy bridge if needed)
│   ├── globals.css                       # Tailwind v4 imports & semantic CSS variables
│   └── layout.tsx                        # Root HTML shell, fonts (Plus Jakarta Sans, Public Sans, JetBrains Mono), QueryProvider
│
├── components/
│   ├── ui/                               # Unopinionated accessible primitives (shadcn/ui)
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── alert-dialog.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── tabs.tsx
│   │   ├── tooltip.tsx
│   │   └── sonner.tsx
│   ├── layout/                           # Layer 1 & 2: Shell & Navigation
│   │   ├── app-shell.tsx
│   │   ├── sidebar-nav.tsx
│   │   ├── top-bar.tsx
│   │   ├── mobile-nav-drawer.tsx
│   │   └── page-header.tsx
│   └── shared/                           # Layers 8–12: Cross-feature reusable domain building blocks
│       ├── money-value.tsx               # Formatted currency / null-safe display component
│       ├── hours-value.tsx               # Formatted decimal hours display (`tabular-nums`)
│       ├── risk-status-badge.tsx         # Multi-cue (Icon + Text + Token) project risk badge
│       ├── expense-status-badge.tsx      # Multi-cue (`PENDING`, `APPROVED`, `REJECTED`) badge
│       ├── form-field-wrapper.tsx        # Accessible label, description, and `role="alert"` error wrapper
│       ├── filter-toolbar.tsx            # Search input + status/risk segmented filters
│       ├── pagination-bar.tsx            # URL-synchronized pagination controls
│       ├── empty-state-panel.tsx         # Standardized empty / no-results state with CTA
│       ├── error-state-panel.tsx         # Standardized error alert with Retry callback
│       └── table-skeleton.tsx            # Geometry-matched loading skeleton
│
├── features/                             # Layers 4–6: Feature-specific modules
│   ├── auth/
│   │   ├── components/login-form.tsx
│   │   └── api/use-auth.ts
│   ├── dashboard/
│   │   ├── components/manager-dashboard.tsx
│   │   ├── components/member-dashboard.tsx
│   │   ├── components/at-risk-watchlist-table.tsx
│   │   └── components/pending-expenses-widget.tsx
│   ├── clients/
│   │   ├── components/client-list-table.tsx
│   │   ├── components/client-form.tsx
│   │   ├── components/archive-client-dialog.tsx
│   │   └── api/client-queries.ts
│   ├── projects/
│   │   ├── components/project-list-table.tsx
│   │   ├── components/project-mobile-card.tsx
│   │   ├── components/project-form.tsx
│   │   ├── components/project-financial-strip.tsx
│   │   ├── components/budget-forecast-chart.tsx
│   │   ├── components/ai-risk-advisor-panel.tsx
│   │   └── api/project-queries.ts
│   ├── time-entries/
│   │   ├── components/time-entry-form-dialog.tsx
│   │   ├── components/time-entry-table.tsx
│   │   └── api/time-entry-queries.ts
│   └── expenses/
│       ├── components/expense-form-dialog.tsx
│       ├── components/expense-table.tsx
│       ├── components/expense-approval-actions.tsx
│       ├── components/reject-expense-dialog.tsx
│       └── api/expense-queries.ts
│
├── lib/                                  # Layer 13 & 14: Core utilities & API infrastructure
│   ├── api-client.ts                     # Typed fetch wrapper with timeout & error normalization
│   ├── query-keys.ts                     # Centralized TanStack Query key factory
│   ├── formatters.ts                     # Currency, percentage, decimal hours, and date formatters
│   ├── permissions.ts                    # Pure role-capability helper predicates (`canManageProjects(user)`)
│   └── validators/                       # Shared Zod schemas for forms and API responses
│       ├── client-schema.ts
│       ├── project-schema.ts
│       ├── time-entry-schema.ts
│       └── expense-schema.ts
│
└── types/
    └── api.ts                            # Strict TypeScript interfaces matching Django REST contracts
```

---

## 3. Shared vs. Feature-Specific Component Inventory

### 3.1 Shared Components (`src/components/shared/`)
Create a component in `shared/` **only** when it is used across 2 or more features or enforces a global financial presentation rule:

| Component Name | Responsibility | Key Props & Data Ownership |
| :--- | :--- | :--- |
| **`<MoneyValue />`** | Renders currency values using `JetBrains Mono tabular-nums`. Never computes formulas; strictly formats a `number \| string \| null`. | `amount: number \| null`, `currency: CurrencyCode`, `fallbackText?: string` (defaults to `"Forecast Unavailable"` when `null`), `showSign?: boolean`. |
| **`<PercentageValue />`** | Formats percentages to `1` decimal place (`84.5%`) or renders `fallbackText` when `null`. | `value: number \| null`, `fallbackText?: string`. |
| **`<RiskStatusBadge />`** | Renders `HEALTHY`, `WARNING`, `CRITICAL`, or `INCOMPLETE_DATA` with mandatory icon + text label + semantic colors. | `status: ProjectRiskStatus`, `size?: 'sm' \| 'md'`. |
| **`<ExpenseStatusBadge />`** | Renders `PENDING`, `APPROVED`, or `REJECTED` with mandatory icon + text label + cost-inclusion tooltip. | `status: ExpenseStatus`. |
| **`<FormFieldWrapper />`** | Connects `<label htmlFor>`, `<input id aria-Invalid aria-describedby>`, helper hint, and `<p role="alert">` error message. | `id: string`, `label: string`, `required?: boolean`, `hint?: string`, `error?: string`, `children: ReactNode`. |
| **`<EmptyStatePanel />`** | Renders a structured zero-data or zero-search-results box with icon, title, explanation, and optional primary CTA button. | `title: string`, `description: string`, `actionLabel?: string`, `onAction?: () => void`, `actionHref?: string`. |
| **`<ErrorStatePanel />`** | Renders a non-destructive error alert with diagnostic message and a `Retry` action button. | `title: string`, `message: string`, `onRetry?: () => void`. |

### 3.2 Feature-Specific Components (`src/features/*`)
Keep workflow-specific components inside their domain folder so changes to one workflow never break another:
- **`<ProjectFinancialStrip />`** (`features/projects`): Displays the 6-card project financial summary and handles the missing-estimate banner.
- **`<BudgetForecastChart />`** (`features/projects`): Renders the semantic SVG bullet/bar comparison between `planned_cost_budget`, `actual_total_cost`, and `projected_final_cost` + accessible table toggle.
- **`<AiRiskAdvisorPanel />`** (`features/projects`): Isolates all AI Risk Advisor states (idle, loading, structured advice, timeout, invalid schema, retry) from the deterministic financial UI.
- **`<ProjectForm />`** (`features/projects`): Implements the two-section Commercial vs. Delivery Planning form and the explicit *"Estimate not yet known"* checkbox behavior.
- **`<ExpenseApprovalActions />` & `<RejectExpenseDialog />`** (`features/expenses`): Encapsulates manager-only `Approve` and `Reject` mutations with mandatory `rejection_reason` capture.

---

## 4. Component Governance, TypeScript Rules & Anti-Bloat Constraints

1. **Zero Financial Formula Reimplementation in Components**:
   - Visual components **must never** compute `actual_cost + remaining_hours * rate` or classify risk status using hardcoded thresholds in JSX. They consume the authoritative fields returned by the Django API (`actual_total_cost`, `projected_final_cost`, `risk_status`, `risk_reasons`).
   - *Sole Exception*: On `/projects/new` and `/projects/[id]/edit`, `<ProjectForm />` may show a clearly labeled `"Preview before saving"` calculation of Target Planned Margin ($\frac{\text{contract\_revenue} - \text{planned\_cost\_budget}}{\text{contract\_revenue}} \times 100$) to help the manager avoid typos while typing.
2. **Component Size Ceiling (`<= 250` lines)**:
   - No single `.tsx` component file should exceed ~250 lines. Extract table rows, filter toolbars, or modal dialogs into focused sub-components within the same feature folder.
3. **Strict TypeScript Rules**:
   - Enable `"strict": true`, `"noImplicitAny": true`, `"strictNullChecks": true`, and `"noUncheckedIndexedAccess": true` in `tsconfig.json`.
   - **`any` is prohibited**. Use explicit domain types from `src/types/api.ts` or `unknown` narrowed via Zod schemas.
   - Nullable financial fields (`projected_final_cost: number | null`) must be explicitly typed as nullable so TypeScript forces every consumer component to handle the `null` (unavailable forecast) case at compile time.
4. **Import Boundary Rules**:
   - `src/components/ui/*` and `src/components/shared/*` **must never** import from `src/features/*`.
   - Features should communicate via URL parameters, shared query keys (`src/lib/query-keys.ts`), or composition inside `src/app/` page files—not by tightly coupling feature internals across folders.
5. **Naming Conventions**:
   - Files & Folders: `kebab-case.tsx` / `kebab-case.ts` (standard Next.js App Router convention).
   - React Components & TypeScript Interfaces: `PascalCase` (`ProjectFinancialStrip`, `ProjectDetailResponse`).
   - Hooks & Query Functions: `camelCase` starting with `use` (`useApproveExpenseMutation`, `useProjectDetailQuery`).

---

## 5. Next.js App Router Architecture Decisions

### 5.1 Server Components vs. Client Components Boundary
Default to **React Server Components (RSC)** for route shells, layouts, initial session verification, and static structure; add `'use client'` **only** at the leaf interactive boundary:

| Component / Module | Execution Context | Why |
| :--- | :--- | :--- |
| `app/(workspace)/layout.tsx`, `app/**/page.tsx` | **Server Component** | Verifies authentication cookie on the server, enforces role-based route guards before streaming HTML, and avoids shipping layout framing JS to the browser. |
| `<AppShell />`, `<SidebarNav />`, `<TopBar />` | **Server Shell + Minimal Client Leaf (`MobileNavDrawer`, active pathname highlight)** | Keeps navigation lightweight; only `usePathname()` active link styling and the mobile `Sheet` drawer require client interactivity. |
| `<ProjectFinancialStrip />`, `<PageHeader />` | **Server or Pure Presentational Component** | Renders formatted numbers and badges with zero client state overhead. |
| `<ProjectListTable />` Filter Bar, `<ProjectForm />`, `<TimeEntryFormDialog />`, `<ExpenseApprovalActions />`, `<AiRiskAdvisorPanel />` | **Client Component (`'use client'`)** | Requires interactive event handlers (`onChange`, `onSubmit`), React Hook Form state, or TanStack Query `useMutation` / `useQuery` hooks. |

### 5.2 Authentication & Protected-Route Behavior
- **Authority**: Django is the sole authority for authentication and session validity.
- **Transport**: Prefer **HTTP-only, `SameSite=Lax`, `Secure` (in production) session or JWT cookies** issued by the Django backend (or proxied through Next.js `/api/auth/*` route handlers so cookies share the frontend origin).
- **Three-Layer Protection Strategy**:
  1. **Next.js Middleware (`src/middleware.ts`)**: Optimistic check for the presence of the session cookie on `/dashboard`, `/clients/*`, `/projects/*`, `/expenses`, and `/settings`. If missing, immediately redirects to `/login?returnTo=<encoded-path>`.
  2. **Workspace Server Layout (`src/app/(workspace)/layout.tsx`)**: Calls `GET /api/v1/auth/me/` on the server. If the token/session is expired or revoked (`401`), redirects to `/login?reason=session_expired`. Passes the verified `User` object into the workspace context.
  3. **Role Gatekeeper on Manager-Only Routes (`/clients/*`, `/projects/new`, `/projects/[id]/edit`)**: Checks `user.role === 'MANAGER'`. If `user.role === 'TEAM_MEMBER'`, renders a clean `<PermissionDeniedState />` (`403`) explaining that only Agency Managers can access commercial client and budget configuration.

### 5.3 Data Fetching, Caching & Mutation Strategy
- **Initial Load + Interactive Refreshes (Hybrid RSC + TanStack Query)**:
  - Server Components can pre-fetch initial route data (or pass initial query parameters) while client tables and mutation panels use **TanStack Query** (`staleTime: 30_000` / 30 seconds for operational lists; `staleTime: 0` on explicit invalidation).
- **Why Not Aggressive Next.js Static Caching?**:
  - MarginWatch is a live financial watchdog where approving an expense or logging 8 hours of work must immediately update project budget consumption and risk status. Therefore, all authenticated Django API calls use `cache: 'no-store'` at the `fetch` layer, relying on TanStack Query's in-memory cache and explicit `queryClient.invalidateQueries()` after every mutation.

### 5.4 Error Boundaries & Loading Boundaries
- **`loading.tsx` Boundaries**: Placed at `app/(workspace)/loading.tsx` and `app/(workspace)/projects/[id]/loading.tsx` to render immediate, layout-stable skeleton frames during route transitions without full-screen layout shifts (`CLS < 0.05`).
- **`error.tsx` Boundaries**: Placed at `app/(workspace)/error.tsx` and `app/(workspace)/projects/[id]/error.tsx` (`'use client'`) to catch unexpected render or server-fetch failures and provide a `"Try Again"` button (`reset()`) alongside a `"Return to Dashboard"` escape link.

### 5.5 Environment Variables & Security Governance
- **Public Variables (`NEXT_PUBLIC_*`)**:
  - `NEXT_PUBLIC_API_BASE_URL`: Base URL for client-side API requests (e.g., `/api/proxy` or `http://localhost:8000/api/v1`).
  - `NEXT_PUBLIC_APP_ENV`: `'development' | 'staging' | 'production'`.
- **Server-Only Variables (Never prefixed with `NEXT_PUBLIC_`)**:
  - `DJANGO_INTERNAL_API_URL`: Internal server-to-server URL used by Next.js Server Components and Route Handlers.
- **Zero Secrets in Frontend Rule**: AI provider keys, database credentials, and signing secrets **must never** exist in frontend `.env` files or client bundles; all AI Risk Advisor generation happens strictly on the Django backend.

### 5.6 API Timeout Governance
Every client and server API request uses an explicit `AbortController` timeout:
- **Standard CRUD & Financial Endpoints**: **`10,000ms` (10 seconds)**.
- **AI Risk Advisor Endpoint (`POST /api/v1/projects/{id}/ai-risk-analysis/`)**: **`25,000ms` (25 seconds)** to accommodate LLM generation latency before cleanly surfacing the recoverable timeout state.
