# MarginWatch Forms, Validation & Application States Specification

## 1. State Ownership Architecture

MarginWatch avoids global client state libraries (such as Redux or Zustand) by assigning every piece of state to the most appropriate, single-responsibility owner:

| State Category | Authoritative Owner | Implementation Mechanism | Lifecycle & Persistence |
| :--- | :--- | :--- | :--- |
| **Shared Server Data** (Projects, Financials, Clients, Time Entries, Expenses) | **TanStack Query (`QueryClient`) + Server Components** | Keyed via `src/lib/query-keys.ts` (`useQuery`, `useMutation`, `invalidateQueries`). | Cached in memory (`staleTime: 30s`); immediately invalidated on related mutations; cleared on logout. |
| **Filter, Search, Sort & Pagination State** | **URL Search Parameters (`?q=&status=&risk=&page=`)** | Next.js `useSearchParams()`, `usePathname()`, `useRouter().replace()` (with `300ms` debounce on text search). | Persisted in browser URL history; bookmarkable and shareable across managers. |
| **Form Input & Validation State** | **React Hook Form + Zod (`useForm`)** | Local to the active form component (`<ProjectForm />`, `<TimeEntryFormDialog />`). | Preserved across failed network submissions; reset only after confirmed `200`/`201` success or explicit user `Cancel`. |
| **Dialog & Drawer Open/Close State** | **Local Component State (`useState`)** | Controlled `open` / `onOpenChange` props on shadcn/ui `<Dialog>` and `<AlertDialog>`. | Ephemeral; blocks closing while an inside mutation is `isPending`. |
| **Actionable Feedback & Notifications** | **`sonner` Toast Queue + Inline Live Banners** | `toast.success()`, `toast.error()`, plus persistent inline `<ErrorStatePanel />` for blocking errors. | Toasts auto-dismiss after `5000ms` (with keyboard pause); inline error banners persist until resolved. |

---

## 2. Form Validation & Schema Specifications (Zod + React Hook Form)

### 2.1 Project Creation & Edit Schema (`src/lib/validators/project-schema.ts`)
Enforces the separation of Commercial vs. Delivery Planning fields and prevents silent coercion of unknown estimates to `0`:

```typescript
import { z } from 'zod';

export const projectFormSchema = z
  .object({
    // Section 1: Commercial Information
    name: z
      .string()
      .trim()
      .min(3, 'Project name must be at least 3 characters.')
      .max(150, 'Project name cannot exceed 150 characters.'),
    client_id: z.string().min(1, 'Please select a client organization.'),
    currency: z.enum(['USD', 'EUR', 'GBP'], {
      required_error: 'Please select a project currency.',
    }),
    contract_revenue: z.coerce
      .number({ invalid_type_error: 'Enter a valid contract revenue amount.' })
      .positive('Contract revenue must be greater than 0.')
      .multipleOf(0.01, 'Use at most 2 decimal places.'),
    planned_cost_budget: z.coerce
      .number({ invalid_type_error: 'Enter a valid planned cost budget.' })
      .positive('Planned cost budget must be greater than 0.')
      .multipleOf(0.01, 'Use at most 2 decimal places.'),

    // Section 2: Delivery Planning
    planned_hourly_cost: z.coerce
      .number({ invalid_type_error: 'Enter a valid planned internal hourly cost.' })
      .positive('Planned hourly cost must be greater than 0.')
      .multipleOf(0.01, 'Use at most 2 decimal places.'),
    estimate_unknown: z.boolean().default(false),
    estimated_remaining_hours_input: z.string().optional(),
    deadline: z
      .string()
      .optional()
      .refine((val) => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), 'Enter a valid date (YYYY-MM-DD).'),
    status: z.enum(['DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']),
    assigned_member_ids: z.array(z.string()).default([]),
  })
  .superRefine((data, ctx) => {
    if (!data.estimate_unknown) {
      const raw = data.estimated_remaining_hours_input?.trim() ?? '';
      if (raw === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['estimated_remaining_hours_input'],
          message:
            "Enter estimated remaining hours (use 0 if no hours remain) or check 'Remaining hours estimate is not yet known'.",
        });
        return;
      }
      const parsed = Number(raw);
      if (Number.isNaN(parsed) || parsed < 0 || !Number.isFinite(parsed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['estimated_remaining_hours_input'],
          message: 'Estimated remaining hours must be 0 or a positive number.',
        });
      }
    }
  });
```
- **Payload Transformation Rule**: Before sending to `POST /api/v1/projects/` or `PATCH /api/v1/projects/{id}/`, transform:
  ```typescript
  const estimated_remaining_hours = values.estimate_unknown
    ? null
    : Number(values.estimated_remaining_hours_input);
  ```
  This guarantees that an unknown estimate is transmitted as `null`, **never** `0`.

### 2.2 Time-Entry Schema (`src/lib/validators/time-entry-schema.ts`)
- **`project_id`**: Non-empty string (`ACTIVE` project).
- **`work_date`**: Valid `YYYY-MM-DD` string where `work_date <= todayLocalISO()`.
- **`hours`**: Coerced number where `0.25 <= hours <= 24.00`, max 2 decimal places (`multipleOf(0.01)`).
- **`description`**: Trimmed string, `5` to `500` characters.
- **Security Invariant**: `hourly_cost_snapshot` is excluded from the client schema so it can never be injected by form manipulation.

### 2.3 Expense Submission & Rejection Schemas (`src/lib/validators/expense-schema.ts`)
- **Expense Submission**:
  - `project_id`: Required string.
  - `expense_date`: Valid `YYYY-MM-DD` string (`<= todayLocalISO()`).
  - `category`: `'INFRASTRUCTURE' | 'SOFTWARE' | 'CONTRACTOR' | 'TRAVEL' | 'OTHER'`.
  - `amount`: Positive number (`> 0`, max `2` decimal places).
  - `description`: Trimmed string (`5` to `500` characters).
- **Manager Expense Rejection**:
  - `rejection_reason`: Required trimmed string (`5` to `300` characters, e.g., `"Duplicate invoice already approved on Oct 12"`).

---

## 3. Server Validation Mapping & Duplicate-Submission Prevention

### 3.1 Mapping Django `400 Bad Request` Errors to Form Fields
Every mutation hook uses a shared helper `applyServerErrorsToForm(error, form.setError)`:
1. If `error.status === 400` and `error.field_errors` exists:
   - Iterate over `Object.entries(error.field_errors)` and invoke `form.setError(fieldName, { type: 'server', message: messages.join(' ') })`.
   - Automatically call `form.setFocus(firstInvalidField)` so keyboard and screen-reader users are brought directly to the offending input.
2. If `error.detail` or `error.field_errors.non_field_errors` exists:
   - Set `form.setError('root.serverError', { type: 'server', message })`, rendered inside a prominent `<div role="alert">` banner at the top of the form.
3. **Predictable Recovery**: Form inputs **never** reset or lose user-typed values when a `400`, `403`, `500`, or network timeout occurs.

### 3.2 Duplicate-Submission Prevention
1. While `mutation.isPending === true`:
   - The submit button receives `disabled={true}` and `aria-busy="true"`.
   - The button label changes to an explicit processing state (`"Saving project..."`, `"Recording hours..."`, `"Approving expense..."`) alongside a spinning `Loader2` icon.
   - Inside modal dialogs, clicking the backdrop or pressing `Escape` is disabled while `isPending` is true to prevent orphaned background mutations.

---

## 4. Specification of the 15 Required Application States

Every data-dependent screen and interactive workflow in MarginWatch implements all applicable states from the following 15-state matrix:

| # | State Name | Visual Presentation | Screen-Reader / Accessibility Behavior | User Recovery Action |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Initial Loading** | Geometry-matched skeleton placeholders (`<TableSkeleton rows={6} />`, `<KpiStripSkeleton />`) with subtle pulse (`animate-pulse` disabled under `prefers-reduced-motion`). | Container has `aria-busy="true"` and `aria-label="Loading financial data"`. | Automatic transition to State 3, 4, or 9/10 on completion. |
| **2** | **Background Refresh** | Existing table/KPI numbers remain visible on screen (no flash to skeleton); a compact `"Updating..."` indicator with `Loader2` appears in the section header. | Polite status update only when values change. | Non-blocking; user can continue reading or scrolling. |
| **3** | **Success (Populated)** | Crisp `tabular-nums` data tables, multi-cue status badges, and exact currency/percentage formatting. | Semantic `<table>`, `<th>`, `<caption>`, and landmark headings. | Standard workflow actions enabled. |
| **4** | **Empty Data (Zero Records)** | `<EmptyStatePanel />` inside a `1px` bordered panel explaining *why* the view is empty and *what* will appear once data is added. | Announced as standard section content with a focusable primary CTA button. | Direct primary CTA button (e.g., `+ Create First Client`, `+ New Project`, `+ Log Time`). |
| **5** | **No Search / Filter Results** | Distinct from State 4: displays active search/filter summary (`"No projects match status 'ACTIVE' and risk 'CRITICAL'"`). | Polite announcement of `0 results found`. | Single-click **`Reset Filters`** button that clears URL query params. |
| **6** | **Validation Failure (Client or Server `400`)** | Red `1px` input border (`border-red-600`), inline `AlertCircle` icon + error text below field, and top-of-form summary banner if server `non_field_errors` occurred. | Input receives `aria-invalid="true"` and `aria-describedby="<id>-error"`; error paragraph has `role="alert"`. | User edits highlighted field and resubmits; all other typed values remain intact. |
| **7** | **Authentication Failure (`401`)** | On protected routes, redirects cleanly to `/login?reason=session_expired&returnTo=<path>` with an informational Amber banner on the login screen. | Login banner announced via `role="status"`: *"Your session has expired. Please sign in to continue."* | User signs in and is returned directly to `<returnTo>`. |
| **8** | **Permission Denied (`403`)** | Renders `<PermissionDeniedState />` card explaining the role boundary (`"Client commercial terms are restricted to Agency Managers"`). | Heading receives focus or `role="alert"` announcement. | **`Return to Dashboard`** or **`Back to Projects`** link. |
| **9** | **Network / Offline Failure** | Inline `<ErrorStatePanel variant="network" />`: *"Unable to reach the MarginWatch server. Check your network connection."* Cached read data remains visible if already loaded. | Announced via `role="alert"`. | **`Retry Connection`** button (`refetch()`). |
| **10** | **Server Failure (`500` / `502` / `503`)** | Inline `<ErrorStatePanel variant="server" />`: *"The server encountered an error while loading project financials."* | Announced via `role="alert"`. | **`Retry Request`** button (`refetch()` or Error Boundary `reset()`). |
| **11** | **Partial or Unavailable Financial Data (`estimated_remaining_hours === null`)** | Forecast fields (`projected_final_cost`, `projected_profit`, `projected_margin_pct`) display **`Forecast Unavailable`** in muted badge style (`--status-neutral-*`) with an explanatory banner—**never `$0.00`**. | Screen reader reads `"Projected Final Cost: Forecast unavailable, missing remaining hours estimate"`. | Inline **`Update Remaining Hours Estimate`** button linking to project edit/dialog. |
| **12** | **AI Provider Failure / Timeout** | Strictly isolated inside `<AiRiskAdvisorPanel />`: displays calm warning banner (`"AI Risk Advisor timed out or is temporarily unavailable"`). Deterministic financial summary above remains 100% functional. | Polite alert inside advisory region. | **`Retry AI Analysis`** button inside the AI panel. |
| **13** | **Mutation in Progress** | Submit/Approve/Reject button locked (`disabled`), displays inline spinner + active verb (`"Approving..."`). Form inputs locked against mid-flight edits. | Button sets `aria-busy="true"`. | Waits for server response (max `10s` timeout before surfacing State 15). |
| **14** | **Successful Mutation** | Dialog closes (or form navigates); dependent queries invalidate and refresh; `sonner` toast confirms exact outcome (`"Logged 4.50 hrs on Acme ERP"`). | Toast announced via polite ARIA live region (`aria-live="polite"`). | Immediate updated metrics visible in UI. |
| **15** | **Recoverable Mutation Failure** | Dialog/form stays open with all user input preserved; inline error banner + toast explain what failed (`"Could not save time entry: Server timed out"`). | Error banner announced via `role="alert"`. | User clicks **`Submit`** again to retry without re-typing data. |
