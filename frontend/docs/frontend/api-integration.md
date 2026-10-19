# MarginWatch API Integration Contract Specification

> **Implementation note (October 2026):** this document is the original pre-implementation blueprint. The frontend that was actually built is a **Vite + React 19 + TypeScript + Tailwind CSS single-page app** (decision `DEC-002`) — it does not use Next.js, the App Router, Server Components, TanStack Query, React Hook Form or Zod. Server data is loaded through `src/services/api-client.ts`, lists are paged with `src/hooks/usePagedList.ts`, and all financial figures come from the backend engine. See [`frontend/README.md`](../../README.md) and the root [`README.md`](../../../README.md). Design-system, accessibility, financial and role rules in this document still apply.

## 1. Baseline Contract Governance & Error Envelope

As documented in [`README.md`](./README.md), because the repository did not initially contain `docs/api-specification.md`, this document establishes the **Canonical MarginWatch REST API Contract** between the Next.js frontend and the Django REST Framework (DRF) backend.

### 1.1 Standard Conventions
- **Base Path**: `/api/v1`
- **Content-Type**: `application/json`
- **Authentication**: HTTP-only session/JWT cookie (`credentials: 'include'`) or Bearer token forwarded via Next.js Route Handler proxy.
- **Monetary & Decimal Representation**: Returned as numeric decimals rounded to 2 decimal places (or stringified decimals parsed via strict Zod coercion `z.coerce.number()` into numbers for formatting; never subjected to client-side floating-point arithmetic).
- **Pagination Envelope (for list endpoints)**:
  ```json
  {
    "count": 42,
    "next": "/api/v1/projects/?page=2",
    "previous": null,
    "results": []
  }
  ```

### 1.2 Standard Error Response Envelope
All `4xx` and `5xx` responses from Django normalize into the following frontend `ApiError` structure:
```json
{
  "code": "VALIDATION_ERROR",
  "detail": "One or more fields failed validation.",
  "field_errors": {
    "estimated_remaining_hours": ["Ensure this value is greater than or equal to 0, or null if unknown."],
    "work_date": ["Work date cannot be in the future."]
  }
}
```
- **`400 Bad Request`**: Mapped to React Hook Form field errors via `field_errors` and a top-level form alert via `detail`.
- **`401 Unauthorized`**: Clears client auth cache and redirects to `/login?reason=session_expired&returnTo=<current_path>`.
- **`403 Forbidden`**: Renders `<PermissionDeniedState />` or a toast error (`"You do not have permission to perform this action."`) without crashing the page.
- **`404 Not Found`**: Triggers Next.js `notFound()` boundary on detail routes (`/projects/[id]`, `/clients/[id]`).
- **`500 / 502 / 503 / 504`**: Renders `<ErrorStatePanel />` with a manual `Retry` button.

---

## 2. Centralized TanStack Query Key Factory (`src/lib/query-keys.ts`)

Every query and cache invalidation rule references this deterministic key hierarchy:

```typescript
export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  dashboard: {
    summary: (currency?: string) => ['dashboard', 'summary', { currency }] as const,
  },
  clients: {
    all: ['clients'] as const,
    list: (filters: ClientFilterParams) => ['clients', 'list', filters] as const,
    detail: (id: string) => ['clients', 'detail', id] as const,
  },
  projects: {
    all: ['projects'] as const,
    list: (filters: ProjectFilterParams) => ['projects', 'list', filters] as const,
    detail: (id: string) => ['projects', 'detail', id] as const,
    financials: (id: string) => ['projects', 'detail', id, 'financials'] as const,
    aiAdvisor: (id: string) => ['projects', 'detail', id, 'ai-advisor'] as const,
  },
  timeEntries: {
    all: ['time-entries'] as const,
    byProject: (projectId: string, page?: number) =>
      ['projects', 'detail', projectId, 'time-entries', { page }] as const,
  },
  expenses: {
    all: ['expenses'] as const,
    globalList: (filters: ExpenseFilterParams) => ['expenses', 'list', filters] as const,
    byProject: (projectId: string, filters?: ExpenseFilterParams) =>
      ['projects', 'detail', projectId, 'expenses', filters] as const,
  },
};
```

---

## 3. Endpoint-to-Feature Contract Mapping

### 3.1 Authentication & Session Management

| Operation | Method & Endpoint | Request Payload | Expected Response (`200 OK`) | Error / Retry / Cache Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Login** | `POST /api/v1/auth/login/` | `{ "email": string, "password": string }` | `{ "user": { "id": string, "email": string, "full_name": string, "role": "MANAGER" \| "TEAM_MEMBER" } }` (+ sets `HttpOnly` cookie) | **Retry**: `0` (never auto-retry POST auth). **401**: Show invalid credentials banner. **Cache**: Seed `queryKeys.auth.me` and redirect to `/dashboard`. |
| **Current Session** | `GET /api/v1/auth/me/` | None (Cookie) | `{ "id": string, "email": string, "full_name": string, "role": "MANAGER" \| "TEAM_MEMBER", "default_currency": "USD" }` | **Retry**: `1` on network error; `0` on `401`. **401**: Redirect to `/login`. |
| **Logout** | `POST /api/v1/auth/logout/` | `{}` | `204 No Content` (Clears cookie) | **Cache**: Call `queryClient.clear()` to purge all cached financial data and redirect to `/login`. |

---

### 3.2 Client Operations (`MANAGER` Only)

| Operation | Method & Endpoint | Request Payload / Params | Expected Response | Error, Permission & Cache Invalidation |
| :--- | :--- | :--- | :--- | :--- |
| **List Clients** | `GET /api/v1/clients/` | `?q=&status=ACTIVE\|ARCHIVED&page=1` | Paginated `ClientSummary[]`: `{ id, name, contact_name, contact_email, default_currency, status, active_project_count, total_project_count }` | **403**: Render Permission Denied. **Empty**: Show `<EmptyStatePanel />` with `+ New Client` CTA. **Retry**: `2` (exponential backoff). |
| **Create Client** | `POST /api/v1/clients/` | `{ name, default_currency, contact_name?, contact_email?, notes? }` | `201 Created`: Full `ClientDetail` object. | **400**: Map `field_errors` (e.g., duplicate `name`). **Invalidation**: `queryKeys.clients.all`. |
| **Get Client Detail** | `GET /api/v1/clients/{id}/` | Path `id` | `{ id, name, contact_name, contact_email, default_currency, status, notes, created_at, projects: ProjectSummary[] }` | **404**: Trigger Next.js `notFound()`. |
| **Update Client** | `PATCH /api/v1/clients/{id}/` | Partial client fields | `200 OK`: Updated `ClientDetail`. | **Invalidation**: `queryKeys.clients.detail(id)`, `queryKeys.clients.all`, `queryKeys.projects.all`. |
| **Archive Client** | `POST /api/v1/clients/{id}/archive/` | `{}` | `200 OK`: `{ id, status: "ARCHIVED" }` | **400**: If client has `ACTIVE` projects, surface backend message in dialog (`"Complete or cancel active projects before archiving"`). **Invalidation**: `queryKeys.clients.all`, `queryKeys.clients.detail(id)`. |

---

### 3.3 Project & Financial Summary Operations

| Operation | Method & Endpoint | Request Payload / Params | Expected Response | Error, Permission & Cache Invalidation |
| :--- | :--- | :--- | :--- | :--- |
| **List Projects** | `GET /api/v1/projects/` | `?q=&status=&risk_status=&client_id=&sort=&page=` | Paginated `ProjectListItem[]`. For `MANAGER`, includes financial fields (`planned_cost_budget`, `actual_total_cost`, `budget_consumed_pct`, `projected_final_cost`, `projected_margin_pct`, `risk_status`, `risk_reasons`). For `TEAM_MEMBER`, commercial fields (`contract_revenue`, `projected_profit`, `projected_margin_pct`) are omitted by the backend. | **Empty**: Zero-projects empty state or `"Reset Filters"` no-results state. **Retry**: `2`. |
| **Create Project** | `POST /api/v1/projects/` | `{ name, client_id, currency, contract_revenue, planned_cost_budget, planned_hourly_cost, estimated_remaining_hours: number \| null, deadline: string \| null, status, assigned_member_ids: string[] }` | `201 Created`: Full `ProjectDetail`. | **400**: Map field errors. **403**: Manager only. **Invalidation**: `queryKeys.projects.all`, `queryKeys.dashboard.summary()`, `queryKeys.clients.detail(client_id)`. |
| **Get Project Detail & Financials** | `GET /api/v1/projects/{id}/` (and `/financials/`) | Path `id` | Full `ProjectDetail` including: `{ id, name, client: { id, name }, currency, status, deadline, contract_revenue, planned_cost_budget, planned_hourly_cost, estimated_remaining_hours: number \| null, financials: { actual_labor_cost, actual_hours_logged, actual_expense_cost, pending_expense_amount, actual_total_cost, budget_consumed_pct, projected_remaining_cost: number \| null, projected_final_cost: number \| null, projected_cost_variance: number \| null, projected_profit: number \| null, projected_margin_pct: number \| null, risk_status: "HEALTHY" \| "WARNING" \| "CRITICAL" \| "INCOMPLETE_DATA", risk_reasons: string[] } }` | **Null Contract**: When `estimated_remaining_hours === null`, `projected_*` fields are `null` and `risk_status` is `"INCOMPLETE_DATA"` (unless `actual_total_cost > planned_cost_budget`, which is `"CRITICAL"`). |
| **Update Project** | `PATCH /api/v1/projects/{id}/` | Partial project commercial or delivery planning fields (including setting `estimated_remaining_hours` to a `number` or `null`). | `200 OK`: Updated `ProjectDetail` with recalculated `financials`. | **Invalidation**: `queryKeys.projects.detail(id)`, `queryKeys.projects.financials(id)`, `queryKeys.projects.all`, `queryKeys.dashboard.summary()`, and `queryKeys.projects.aiAdvisor(id)`. |

---

### 3.4 Time-Entry Operations

| Operation | Method & Endpoint | Request Payload / Params | Expected Response | Error, Permission & Cache Invalidation |
| :--- | :--- | :--- | :--- | :--- |
| **List Project Time Entries** | `GET /api/v1/projects/{projectId}/time-entries/` | `?page=1&user_id=` | Paginated `TimeEntry[]`: `{ id, project_id, user: { id, full_name }, work_date, hours, description, hourly_cost_snapshot?, computed_cost?, can_edit: boolean, created_at }` (`hourly_cost_snapshot` and `computed_cost` included for `MANAGER` only). | **Empty**: Render `"No work hours recorded for this project yet"` + `+ Log Time` CTA. |
| **Create Time Entry** | `POST /api/v1/projects/{projectId}/time-entries/` | `{ work_date: "YYYY-MM-DD", hours: number, description: string }` (**Note**: `hourly_cost_snapshot` is **never** sent by client). | `201 Created`: Created `TimeEntry`. | **400**: Future `work_date`, `hours <= 0` or `hours > 24`, or project not `ACTIVE`. **Invalidation (Critical)**: Must invalidate `queryKeys.timeEntries.byProject(projectId)`, `queryKeys.projects.detail(projectId)`, `queryKeys.projects.financials(projectId)`, `queryKeys.projects.all`, and `queryKeys.dashboard.summary()`. |
| **Update Time Entry** | `PATCH /api/v1/time-entries/{id}/` | `{ work_date?, hours?, description? }` | `200 OK`: Updated `TimeEntry`. | **403**: If user is not creator/Manager or project is locked. **Invalidation**: Same cross-query invalidation as Create Time Entry. |
| **Delete Time Entry** | `DELETE /api/v1/time-entries/{id}/` | None | `204 No Content` | **Invalidation**: Same cross-query invalidation as Create Time Entry. |

---

### 3.5 Expense Operations & Manager Approvals

| Operation | Method & Endpoint | Request Payload / Params | Expected Response | Error, Permission & Cache Invalidation |
| :--- | :--- | :--- | :--- | :--- |
| **List Expenses (Project or Global)** | `GET /api/v1/projects/{projectId}/expenses/` or `GET /api/v1/expenses/` | `?status=PENDING\|APPROVED\|REJECTED&project_id=&page=1` | Paginated `Expense[]`: `{ id, project: { id, name, currency }, submitted_by: { id, full_name }, category, expense_date, amount, description, status: "PENDING" \| "APPROVED" \| "REJECTED", rejection_reason: string \| null, reviewed_by: { id, full_name } \| null, reviewed_at: string \| null, can_edit: boolean, can_approve: boolean }` | **Empty**: Clear explanation of expense workflow + `+ Submit Expense` button. |
| **Submit Expense** | `POST /api/v1/projects/{projectId}/expenses/` | `{ expense_date: "YYYY-MM-DD", category: "INFRASTRUCTURE" \| "SOFTWARE" \| "CONTRACTOR" \| "TRAVEL" \| "OTHER", amount: number, description: string }` | `201 Created`: `Expense` with `status: "PENDING"`. | **UI Feedback**: Toast states: *"Expense submitted for manager approval. It will be added to actual project cost once approved."* **Invalidation**: `queryKeys.expenses.all`, `queryKeys.expenses.byProject(projectId)`, `queryKeys.projects.detail(projectId)`, `queryKeys.dashboard.summary()`. |
| **Approve Expense (`MANAGER`)** | `POST /api/v1/expenses/{id}/approve/` | `{}` | `200 OK`: Updated `Expense` with `status: "APPROVED"`, `reviewed_by`, `reviewed_at`. | **403**: Non-managers blocked. **Invalidation (Critical)**: Immediately invalidates `queryKeys.expenses.all`, `queryKeys.expenses.byProject(projectId)`, `queryKeys.projects.detail(projectId)`, `queryKeys.projects.financials(projectId)`, `queryKeys.projects.all`, and `queryKeys.dashboard.summary()` because `actual_expense_cost`, `actual_total_cost`, `budget_consumed_pct`, `projected_final_cost`, and `risk_status` all change when an expense becomes `APPROVED`. |
| **Reject Expense (`MANAGER`)** | `POST /api/v1/expenses/{id}/reject/` | `{ "rejection_reason": string }` (Required, 5–300 chars) | `200 OK`: Updated `Expense` with `status: "REJECTED"` and `rejection_reason`. | **400**: Missing `rejection_reason`. **Invalidation**: `queryKeys.expenses.all`, `queryKeys.expenses.byProject(projectId)`, `queryKeys.projects.detail(projectId)`, `queryKeys.dashboard.summary()`. |

---

### 3.6 Dashboard Summary & AI Risk Advisor Endpoints

| Operation | Method & Endpoint | Request Payload / Params | Expected Response | Timeout, Retry & Failure Policy |
| :--- | :--- | :--- | :--- | :--- |
| **Get Dashboard Summary** | `GET /api/v1/dashboard/summary/` | `?currency=USD` | For `MANAGER`: `{ currency, kpis: { active_projects_count, healthy_count, warning_count, critical_count, incomplete_data_count, total_planned_budget, total_actual_cost, budget_consumed_pct, forecastable_projects_count, excluded_incomplete_projects_count, total_projected_final_cost: number \| null, total_projected_variance: number \| null, aggregate_projected_margin_pct: number \| null, pending_expenses_count, pending_expenses_amount }, at_risk_projects: ProjectListItem[], pending_expenses: Expense[], recent_time_entries: TimeEntry[] }` | **Timeout**: `10s`. **Retry**: `2`. **Empty**: Guided onboarding state if `active_projects_count === 0`. |
| **Generate / Fetch AI Risk Analysis (`MANAGER`)** | `POST /api/v1/projects/{projectId}/ai-risk-analysis/` (and `GET` for latest cached analysis) | `{ "force_refresh": boolean }` | `200 OK`: `{ project_id, generated_at, deterministic_risk_status: "HEALTHY" \| "WARNING" \| "CRITICAL" \| "INCOMPLETE_DATA", deterministic_drivers: string[], ai_summary: string, suggested_actions: Array<{ title: string, rationale: string, estimated_impact: string, action_type: "REVIEW_EXPENSES" \| "UPDATE_ESTIMATE" \| "SCOPE_REVIEW" \| "RATE_AUDIT" }>, assumptions: string[], missing_data_warnings: string[] }` | **Timeout**: `25s` (`AbortController`). **Retry**: `0` automatic retries (user-triggered `Retry Analysis` button prevents runaway LLM calls). **Failure Isolation**: Any `500/503/504/422` error is strictly contained inside `<AiRiskAdvisorPanel />`; the deterministic project financials remain unaffected. |

---

## 4. Development Fixtures Policy

- **Strict Production Separation**: Never hardcode mock arrays inside UI components or return fake financial numbers when an API request fails.
- **Test/Storybook Fixtures**: Any mock payloads created for unit/integration testing (`src/test/fixtures/*.ts`) must reside strictly inside `src/test/` and must never be imported by `src/app/`, `src/components/`, or `src/features/` runtime modules.
