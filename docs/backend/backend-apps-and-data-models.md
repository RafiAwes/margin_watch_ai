# MarginWatch — Backend Apps & Data Models Blueprint

**Document Status:** Implementation Blueprint & Long-Term Source of Truth (Phase 0)  
**Last Updated:** October 2026  
**Target Runtime:** Python 3.15 / Django 5.x / Django REST Framework 3.15+  
**Architecture Authorities:**  
- [ADR-001: Initial Architecture & Technology Stack](../decisions/ADR-001-initial-architecture.md)  
- [ADR-002: Single-Agency Architecture](../decisions/ADR-002-single-agency-architecture.md)  
- [ADR-003: Financial Rules & Calculation Specifications](../decisions/ADR-003-financial-rules-and-risk-classification.md)  
- [Conceptual Data Model & ERD](../data-model.md)  
- [Security & Permissions Specification](../security-and-permissions.md)  
- [API Specification Contract](../api-specification.md)

---

## 1. Document Purpose and Project Context

### 1.1 Purpose of this Document
This document is the authoritative, implementation-ready architectural blueprint for the MarginWatch Django backend. It specifies the modular Django application structure, database models, fields, constraints, deletion behaviors, service boundaries, permissions, financial calculation algorithms, and test requirements. 

Any software engineer returning to this codebase days or weeks after initial planning must be able to consult this document before creating or modifying any model, serializer, view, service, or migration without needing to reconstruct past design discussions.

### 1.2 What MarginWatch Does
MarginWatch is a dedicated project profitability and delivery-cost watchdog. It was designed specifically for small- to mid-sized software agencies delivering custom client projects under fixed-price contracts or capped budgets.

In software agency delivery operations, profitability is routinely compromised when recorded labor hours and direct expenses accumulate silently between billing milestones. By the time an overrun is discovered during month-end invoicing, the agency has already absorbed an irrecoverable operating loss.

### 1.3 The Core Business Question MarginWatch Answers
> *"Based on recorded work hours, approved expenses, and estimated remaining work, is this project likely to exceed its planned delivery-cost budget?"*

### 1.4 Single-Agency Architectural Law
MarginWatch is **not a multi-tenant SaaS platform**. It is architected for **one agency only**, represented implicitly by the deployed application instance itself (see [ADR-002](../decisions/ADR-002-single-agency-architecture.md)).
- No `Agency`, `Tenant`, or `AgencyMembership` database models exist.
- No `agency_id` attributes are accepted or required in API request bodies, headers, or query parameters.
- Multi-tenancy abstractions are strictly out of scope for this assessment MVP and must not introduce speculative complexity into the codebase.

### 1.5 Technology Stack
- **Backend:** Python 3.15, Django, and Django REST Framework (DRF).
- **Frontend:** Next.js (App Router), TypeScript, and Tailwind CSS.
- **Database Strategy:** SQLite for rapid, zero-dependency local development and automated testing; PostgreSQL for production deployment (Phase 8+).
- **AI Advisory Layer:** Google Gemini API (`gemini-3.8-flash` by default, configurable via `GEMINI_MODEL`), accessed strictly server-to-server from the Django backend.

### 1.6 Backend Authority Principle
The Django backend is the **sole authoritative source of truth** for:
1. User identity, authentication, and application role enforcement (`MANAGER` vs. `TEAM_MEMBER`).
2. Object-level access control and project assignment validation.
3. Immutable rate snapshot preservation.
4. Deterministic financial calculations and fixed-point decimal arithmetic.
5. Project risk classification hierarchy evaluation.
6. Context sanitization and grounding for AI advice.

The frontend is a decoupled presentation client. Frontend route guards and conditional UI rendering are provided solely for user experience; **they are never treated as security or authorization mechanisms**.

---

## 2. Backend App Structure

Rather than creating a monolithic backend or an over-engineered micro-app for every single model, the backend is organized into **seven cohesive Django applications**, grouped strictly by operational domain and lifecycle responsibility.

```mermaid
graph TD
    subgraph Core Identity & Tenancy
        ACC[users<br/>User, Authentication, Roles]
    end

    subgraph Client & Scope Management
        CLI[clients<br/>Client Records]
        PRJ[projects<br/>Project, ProjectAssignment]
    end

    subgraph Operational Data Tracking
        TIME[time_tracking<br/>TimeEntry, Rate Snapshots]
        EXP[expenses<br/>Expense, Approval Workflow]
    end

    subgraph Analytics & Intelligence
        PROF[profitability<br/>Calculation Engine, Risk Evaluator, Dashboard]
        AI[ai_advisor<br/>Gemini Client, Sanitization, Advice]
    end

    ACC --> CLI
    ACC --> PRJ
    ACC --> TIME
    ACC --> EXP
    CLI --> PRJ
    PRJ --> TIME
    PRJ --> EXP
    PRJ --> PROF
    TIME --> PROF
    EXP --> PROF
    PROF --> AI
```

### App Breakdown & Module Responsibilities

| App Name | Primary Purpose | Models Owned | Business Logic Owned | API Responsibilities | Dependencies | Enforced Permissions | Logic That Must Not Be Duplicated Elsewhere |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`users`** | User identity, authentication, roles, and base employee wage rates. | `User` (Custom User Model) | User creation, role validation, password hashing, hourly rate management. | `/api/v1/auth/login/`<br/>`/api/v1/auth/refresh/`<br/>`/api/v1/auth/logout/`<br/>`/api/v1/auth/me/`<br/>`/api/v1/users/` | Django Auth | `IsAuthenticated`<br/>`IsManager` (for role/rate edits) | Verification that a user is active; role assignment governance; self-elevation prevention. |
| **`clients`** | Commercial client account directory. | `Client` | Client lifecycle, archiving, contact metadata maintenance. | `/api/v1/clients/` | `users` | `IsAuthenticated`<br/>`IsManager` | Soft-archiving query filtering; deletion protection when projects are linked. |
| **`projects`** | Delivery project baselines, budgets, revenues, and team assignments. | `Project`<br/>`ProjectAssignment` | Project budgeting, scope estimate validation, team member assignment and revocation. | `/api/v1/projects/`<br/>`/api/v1/projects/{id}/assignments/` | `users`<br/>`clients` | `IsAuthenticated`<br/>`IsManager`<br/>`IsAssignedTeamMember` | Assignment uniqueness validation; project deadline consistency check; baseline revenue/budget updates. |
| **`time_tracking`** | Recording labor effort and capturing historical wage rates. | `TimeEntry` | Work date validation, hour constraints ($0 < H \le 24$), rate snapshot capture from `User`. | `/api/v1/time-entries/`<br/>`/api/v1/projects/{id}/time-entries/` | `users`<br/>`projects` | `IsAuthenticated`<br/>`IsAssignedTeamMember`<br/>`IsOwnerOrManager` | Snapshot population (`hourly_cost_snapshot = user.default_hourly_cost_rate`); immutability of historical snapshots. |
| **`expenses`** | Direct non-labor expenditures and manager review lifecycle. | `Expense` | Two-stage approval state machine (`PENDING` $\rightarrow$ `APPROVED`/`REJECTED`), self-approval blocking. | `/api/v1/expenses/`<br/>`/api/v1/projects/{id}/expenses/`<br/>`/api/v1/expenses/{id}/review/` | `users`<br/>`projects` | `IsAuthenticated`<br/>`IsAssignedTeamMember`<br/>`IsManager` (for review) | Approval state transitions; mandatory rejection note enforcement; immutability of approved/rejected amounts. |
| **`profitability`** | Authoritative financial calculations, risk evaluation, and dashboard aggregations. | *None (Pure Service & Query Layer)* | All 8 financial formulas, division-by-zero protection, 4-tier risk precedence hierarchy. | `/api/v1/projects/{id}/financial-summary/`<br/>`/api/v1/projects/{id}/financials/`<br/>`/api/v1/projects/{id}/risk/`<br/>`/api/v1/dashboard/summary/` | `projects`<br/>`time_tracking`<br/>`expenses` | `IsAuthenticated`<br/>`IsManager` (financial visibility) | The 8 financial formulas; precedence hierarchy; currency formatting; portfolio budget health rollups. |
| **`ai_advisor`** | LLM-powered plain-language project risk explanations and operational mitigations. | *None (Ephemeral in MVP)* | Context sanitization, prompt construction, Gemini API communication, schema validation, fallback handler. | `/api/v1/projects/{id}/ai-risk-analysis/`<br/>`/api/v1/projects/{id}/ai-advice/` | `profitability`<br/>`projects` | `IsAuthenticated`<br/>`IsManager` | PII scrubbing; temperature and token bounds; JSON schema output enforcement; failure mode decoupling. |

> [!NOTE]
> **Dashboard App Justification:** Dashboard aggregations initially reside within the `profitability` app (`/api/v1/dashboard/summary/`). A dedicated `dashboard` app is unnecessary for the assessment MVP and would introduce premature abstraction. If future reporting introduces multi-currency hedging, executive exports, or cross-departmental widgets, an independent `dashboard` app can be justified.

---

## 3. Complete Model Specifications

All database tables are governed by the following global technical standards:
- **Decimal Safety:** All monetary amounts use `DecimalField(max_digits=12, decimal_places=2)`. All hour quantities use `DecimalField(max_digits=8, decimal_places=2)`. Hourly cost rates use `DecimalField(max_digits=10, decimal_places=4)`. Floating-point fields (`FloatField`) are strictly prohibited.
- **Audit Timestamps:** Every business entity includes auto-populated `created_at = models.DateTimeField(auto_now_add=True)` and `updated_at = models.DateTimeField(auto_now=True)`.
- **Deletion Defense:** Every relationship involving financial history uses `on_delete=models.PROTECT`. Cascading deletes (`CASCADE`) are restricted to pure junction tables (`ProjectAssignment`).

---

### 3.1 Model: `User`
- **Owning App:** `users`
- **Purpose:** Represents an authenticated agency staff member, establishes their application authorization role (`MANAGER` or `TEAM_MEMBER`), and stores their internal base hourly labor cost rate.

| Attribute Name | Django Field Type | Null / Blank | Default Value | Validation & Constraints | Relationship & Deletion | Read / Modify Permissions |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| `id` | `UUIDField` or `BigAutoField` | Null: No<br/>Blank: No | Auto-generated | Primary Key. Open architectural choice (see [Section 11](#11-open-decisions-register)). | Primary Key | Read: Authenticated User<br/>Modify: Immutable |
| `email` | `EmailField(max_length=254)` | Null: No<br/>Blank: No | None | Unique constraint; RFC 5322 compliant; normalized to lowercase. Primary login identifier. | None | Read: Authenticated User<br/>Modify: User (self) / Manager |
| `username` | `CharField(max_length=150)` | Null: Yes<br/>Blank: Yes | None | Optional or unique depending on login decision (`DEC-AUTH-01`). | None | Read: Authenticated User<br/>Modify: User (self) / Manager |
| `first_name` | `CharField(max_length=100)` | Null: No<br/>Blank: No | None | Human given name; non-empty. | None | Read: Authenticated User<br/>Modify: User (self) / Manager |
| `last_name` | `CharField(max_length=100)` | Null: No<br/>Blank: No | None | Human surname; non-empty. | None | Read: Authenticated User<br/>Modify: User (self) / Manager |
| `role` | `CharField(max_length=20)` | Null: No<br/>Blank: No | `'TEAM_MEMBER'` | Choices: `Role.MANAGER` (`'MANAGER'`), `Role.TEAM_MEMBER` (`'TEAM_MEMBER'`). | None | Read: Authenticated User<br/>Modify: **Manager Only** |
| `default_hourly_cost_rate` | `DecimalField(max_digits=10, decimal_places=4)` | Null: No<br/>Blank: No | `Decimal('0.0000')` | Min value validator: $\ge 0.0000$. Internal direct labor cost to agency. | None | Read: **Manager Only**<br/>Modify: **Manager Only** |
| `is_active` | `BooleanField` | Null: No<br/>Blank: No | `True` | Inactive users are strictly blocked from obtaining or refreshing JWT tokens. | None | Read: Authenticated User<br/>Modify: **Manager Only** |
| `is_staff` | `BooleanField` | Null: No<br/>Blank: No | `False` | Django administration portal access flag. | None | Read: Admin / Superuser<br/>Modify: Superuser Only |
| `is_superuser` | `BooleanField` | Null: No<br/>Blank: No | `False` | Unrestricted Django admin permissions. | None | Read: Superuser Only<br/>Modify: Superuser Only |
| `date_joined` | `DateTimeField` | Null: No<br/>Blank: No | `timezone.now` | Account registration timestamp. | None | Read: Authenticated User<br/>Modify: Immutable |
| `created_at` | `DateTimeField` | Null: No<br/>Blank: No | `auto_now_add=True` | Record creation timestamp. | None | Read: Authenticated User<br/>Modify: Immutable |
| `updated_at` | `DateTimeField` | Null: No<br/>Blank: No | `auto_now=True` | Record update timestamp. | None | Read: Authenticated User<br/>Modify: Immutable |

#### Implementation & Governance Notes:
1. **Custom User Model Mandate:** MarginWatch must inherit from `AbstractBaseUser` and `PermissionsMixin` prior to executing the initial database migration (`AUTH_USER_MODEL = 'users.User'`). Swapping the user model mid-project corrupts foreign key migrations.
2. **Administrative Flags vs. Application Roles:** `is_staff` and `is_superuser` grant operational access to Django's built-in `/admin/` portal. They are **never** evaluated by application business logic or REST API permission classes. All business permissions inspect `user.role`.
3. **Self-Elevation Prevention:** A team member updating their profile (`PATCH /api/v1/auth/me/`) must use a serializer that excludes `role`, `default_hourly_cost_rate`, `is_active`, `is_staff`, and `is_superuser`. Any attempted elevation returns HTTP 400 Bad Request.
4. **Wage Masking:** `default_hourly_cost_rate` must never appear in serializers consumed by `TEAM_MEMBER` users. Colleague salaries are strictly confidential.

---

### 3.2 Model: `Client`
- **Owning App:** `clients`
- **Purpose:** Represents a commercial customer or organization contracting the software agency for project delivery.

| Attribute Name | Django Field Type | Null / Blank | Default Value | Validation & Constraints | Relationship & Deletion | Read / Modify Permissions |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| `id` | `UUIDField` or `BigAutoField` | Null: No<br/>Blank: No | Auto-generated | Primary Key. | Primary Key | Read: Manager / Assigned Member<br/>Modify: Immutable |
| `name` | `CharField(max_length=200)` | Null: No<br/>Blank: No | None | Unique constraint; non-empty trimmed string. | None | Read: Manager / Assigned Member<br/>Modify: **Manager Only** |
| `contact_name` | `CharField(max_length=150)` | Null: Yes<br/>Blank: Yes | None | Primary business representative name. | None | Read: **Manager Only**<br/>Modify: **Manager Only** |
| `contact_email` | `EmailField(max_length=254)` | Null: Yes<br/>Blank: Yes | None | Primary billing or communications email. | None | Read: **Manager Only**<br/>Modify: **Manager Only** |
| `contact_phone` | `CharField(max_length=50)` | Null: Yes<br/>Blank: Yes | None | Commercial phone contact. | None | Read: **Manager Only**<br/>Modify: **Manager Only** |
| `notes` | `TextField` | Null: Yes<br/>Blank: Yes | None | Internal agency account notes and contract history. | None | Read: **Manager Only**<br/>Modify: **Manager Only** |
| `created_by` | `ForeignKey('users.User')` | Null: Yes<br/>Blank: True | None | Manager who registered the client. | `on_delete=models.SET_NULL` | Read: Manager<br/>Modify: Immutable |
| `is_archived` | `BooleanField` | Null: No<br/>Blank: No | `False` | Soft-archiving flag. Excluded from active dropdowns. | None | Read: Manager<br/>Modify: **Manager Only** |
| `created_at` | `DateTimeField` | Null: No<br/>Blank: No | `auto_now_add=True` | Record creation timestamp. | None | Read: Manager<br/>Modify: Immutable |
| `updated_at` | `DateTimeField` | Null: No<br/>Blank: No | `auto_now=True` | Record update timestamp. | None | Read: Manager<br/>Modify: Immutable |

#### Implementation & Governance Notes:
1. **One-to-Many Relationship:** One client can have many projects (`related_name='projects'`).
2. **Deletion Protection:** Deletion of a client record is strictly prohibited (`PROTECT`) if linked projects exist. Decommissioning is performed exclusively via `is_archived = True`.
3. **Scattered Metadata Protection:** Team members cannot list all agency clients. Client name is exposed to team members only as contextual metadata embedded within their assigned projects.

---

### 3.3 Model: `Project`
- **Owning App:** `projects`
- **Purpose:** The core delivery monitoring entity containing commercial contract baselines, cost ceilings, labor estimation rates, remaining scope estimates, and delivery lifecycle states.

| Attribute Name | Django Field Type | Null / Blank | Default Value | Validation & Constraints | Relationship & Deletion | Read / Modify Permissions |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| `id` | `UUIDField` or `BigAutoField` | Null: No<br/>Blank: No | Auto-generated | Primary Key. | Primary Key | Read: Manager / Assigned Member<br/>Modify: Immutable |
| `client` | `ForeignKey('clients.Client')` | Null: No<br/>Blank: No | None | References the commercial client. Must be an active client. | `on_delete=models.PROTECT`, `related_name='projects'` | Read: Manager / Assigned Member<br/>Modify: **Manager Only** |
| `name` | `CharField(max_length=200)` | Null: No<br/>Blank: No | None | Descriptive project name; non-empty. | None | Read: Manager / Assigned Member<br/>Modify: **Manager Only** |
| `description` | `TextField` | Null: Yes<br/>Blank: True | None | Delivery scope summary and deliverables. | None | Read: Manager / Assigned Member<br/>Modify: **Manager Only** |
| `contract_revenue` | `DecimalField(max_digits=12, decimal_places=2)` | Null: No<br/>Blank: No | `Decimal('0.00')` | Min value validator: $\ge 0.00$. Fixed-price revenue cap. | None | Read: **Manager Only**<br/>Modify: **Manager Only** |
| `planned_cost_budget` | `DecimalField(max_digits=12, decimal_places=2)` | Null: No<br/>Blank: No | None | Min value validator: $> 0.00$. Strictly positive internal cost ceiling ($B$). | None | Read: **Manager Only**<br/>Modify: **Manager Only** |
| `planned_hourly_cost` | `DecimalField(max_digits=10, decimal_places=4)` | Null: No<br/>Blank: No | None | Min value validator: $> 0.00$. Blended labor rate used to value remaining hours ($C_{hourly\_plan}$). | None | Read: **Manager Only**<br/>Modify: **Manager Only** |
| `currency` | `CharField(max_length=3)` | Null: No<br/>Blank: No | `'USD'` | ISO 4217 uppercase 3-letter currency code. | None | Read: Manager / Assigned Member<br/>Modify: **Manager Only** |
| `estimated_remaining_hours` | `DecimalField(max_digits=8, decimal_places=2)` | **Null: Yes**<br/>**Blank: True** | **`None`** | **Critical:** `null` = estimate unknown; `0.00` = scope complete. Min validator: $\ge 0.00$ when not null. | None | Read: Manager / Assigned Member<br/>Modify: **Manager Only** |
| `expected_remaining_expenses` | `DecimalField(max_digits=12, decimal_places=2)` | Null: No<br/>Blank: No | `Decimal('0.00')` | Min value validator: $\ge 0.00$. Un-incurred future direct expenses ($E_{rem}$). | None | Read: **Manager Only**<br/>Modify: **Manager Only** |
| `status` | `CharField(max_length=20)` | Null: No<br/>Blank: No | `'PLANNING'` | Choices: `ProjectStatus.PLANNING`, `ACTIVE`, `ON_HOLD`, `COMPLETED`, `CANCELLED`. | None | Read: Manager / Assigned Member<br/>Modify: **Manager Only** |
| `start_date` | `DateField` | Null: Yes<br/>Blank: True | None | Scheduled kickoff date. | None | Read: Manager / Assigned Member<br/>Modify: **Manager Only** |
| `deadline` | `DateField` | Null: Yes<br/>Blank: True | None | Target delivery date. Validation: `deadline >= start_date` if both are set. | None | Read: Manager / Assigned Member<br/>Modify: **Manager Only** |
| `created_by` | `ForeignKey('users.User')` | Null: Yes<br/>Blank: True | None | Manager who provisioned the project record. | `on_delete=models.SET_NULL` | Read: Manager<br/>Modify: Immutable |
| `is_archived` | `BooleanField` | Null: No<br/>Blank: No | `False` | Soft-archiving flag. Excluded from default active lists. | None | Read: Manager<br/>Modify: **Manager Only** |
| `created_at` | `DateTimeField` | Null: No<br/>Blank: No | `auto_now_add=True` | Record creation timestamp. | None | Read: Manager / Assigned Member<br/>Modify: Immutable |
| `updated_at` | `DateTimeField` | Null: No<br/>Blank: No | `auto_now=True` | Record update timestamp. | None | Read: Manager / Assigned Member<br/>Modify: Immutable |

#### Implementation & Governance Notes:
1. **Revenue vs. Cost Budget:** `contract_revenue` ($R$, money client pays agency) and `planned_cost_budget` ($B$, internal cost ceiling agency expects to spend) are fundamentally distinct concepts. Never conflate them.
2. **Strict Estimate Semantics:** `estimated_remaining_hours` must permit true database `NULL`. A value of `0.00` explicitly asserts that the team has completed 100% of scope deliverables. An unestimated project must store `null` so the financial engine can trigger `INSUFFICIENT_DATA`.
3. **Forecast Input Distinction:** `expected_remaining_expenses` is a *forward-looking forecast input*, not an incurred expenditure. It is excluded from actual costs and included only in projected final costs.
4. **Serializer Field Masking:** When serialized for `TEAM_MEMBER`, the serializer must strip `contract_revenue`, `planned_cost_budget`, `planned_hourly_cost`, `expected_remaining_expenses`, and all profit/margin calculations.

---

### 3.4 Model: `ProjectAssignment`
- **Owning App:** `projects`
- **Purpose:** Connects eligible team members to projects, establishing the authoritative object-level access control boundary.

| Attribute Name | Django Field Type | Null / Blank | Default Value | Validation & Constraints | Relationship & Deletion | Read / Modify Permissions |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| `id` | `UUIDField` or `BigAutoField` | Null: No<br/>Blank: No | Auto-generated | Primary Key. | Primary Key | Read: Manager / Assigned Member<br/>Modify: Immutable |
| `project` | `ForeignKey('projects.Project')` | Null: No<br/>Blank: No | None | References the project. | `on_delete=models.CASCADE`, `related_name='assignments'` | Read: Manager / Assigned Member<br/>Modify: **Manager Only** |
| `user` | `ForeignKey('users.User')` | Null: No<br/>Blank: No | None | References the assigned user. Must have `is_active=True` and `role='TEAM_MEMBER'`. | `on_delete=models.CASCADE`, `related_name='project_assignments'` | Read: Manager / Assigned Member<br/>Modify: **Manager Only** |
| `assigned_by` | `ForeignKey('users.User')` | Null: Yes<br/>Blank: True | None | Manager who executed the assignment. | `on_delete=models.SET_NULL` | Read: Manager<br/>Modify: Immutable |
| `assigned_at` | `DateTimeField` | Null: No<br/>Blank: No | `auto_now_add=True` | Assignment creation timestamp. | None | Read: Manager / Assigned Member<br/>Modify: Immutable |
| `is_active` | `BooleanField` | Null: No<br/>Blank: No | `True` | If `False`, team member access is revoked while preserving historical audit logs. | None | Read: Manager / Assigned Member<br/>Modify: **Manager Only** |

#### Implementation & Governance Notes:
1. **Database Uniqueness Constraint:** The table must enforce a unique composite constraint across `(project, user)`:
   ```python
   class Meta:
       constraints = [
           models.UniqueConstraint(fields=['project', 'user'], name='unique_project_user_assignment')
       ]
   ```
2. **Access Control Enforcement:** Non-manager users are strictly barred from viewing projects, logging time, or submitting expenses unless an active assignment (`is_active=True`) exists.
3. **Manager Role Exemption:** Managers do not require a `ProjectAssignment` row to view projects or review expenses. (Whether managers must assign themselves to log personal hours is tracked under [DEC-PERM-02](#11-open-decisions-register)).

---

### 3.5 Model: `TimeEntry`
- **Owning App:** `time_tracking`
- **Purpose:** Records discrete labor effort logged by an assigned team member against an active project, permanently capturing the historical wage snapshot.

| Attribute Name | Django Field Type | Null / Blank | Default Value | Validation & Constraints | Relationship & Deletion | Read / Modify Permissions |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| `id` | `UUIDField` or `BigAutoField` | Null: No<br/>Blank: No | Auto-generated | Primary Key. | Primary Key | Read: Manager / Author<br/>Modify: Immutable |
| `project` | `ForeignKey('projects.Project')` | Null: No<br/>Blank: No | None | References the project. Project must not be archived. | `on_delete=models.PROTECT`, `related_name='time_entries'` | Read: Manager / Author<br/>Modify: Author (during draft) |
| `user` | `ForeignKey('users.User')` | Null: No<br/>Blank: No | None | Team member who performed the labor. | `on_delete=models.PROTECT`, `related_name='time_entries'` | Read: Manager / Author<br/>Modify: Immutable |
| `work_date` | `DateField` | Null: No<br/>Blank: No | None | Date work occurred. Constraint: cannot exceed current date + 1 day. | None | Read: Manager / Author<br/>Modify: Author (if permitted) |
| `hours` | `DecimalField(max_digits=5, decimal_places=2)` | Null: No<br/>Blank: No | None | Labor duration. Check constraint: `hours > 0.00 AND hours <= 24.00`. | None | Read: Manager / Author<br/>Modify: Author (if permitted) |
| `hourly_cost_snapshot` | `DecimalField(max_digits=10, decimal_places=4)` | Null: No<br/>Blank: No | None | Captured at creation from `user.default_hourly_cost_rate`. **Permanently immutable.** | None | Read: **Manager Only**<br/>Modify: **System Immutable** |
| `description` | `TextField` | Null: No<br/>Blank: No | None | Non-empty summary of delivery tasks completed. | None | Read: Manager / Author<br/>Modify: Author (if permitted) |
| `created_at` | `DateTimeField` | Null: No<br/>Blank: No | `auto_now_add=True` | Record creation timestamp. | None | Read: Manager / Author<br/>Modify: Immutable |
| `updated_at` | `DateTimeField` | Null: No<br/>Blank: No | `auto_now=True` | Record update timestamp. | None | Read: Manager / Author<br/>Modify: Immutable |

#### Implementation & Governance Notes:
1. **Server-Populated Rate Snapshot:** `hourly_cost_snapshot` is populated exclusively by the backend service or serializer `perform_create` method (`instance.hourly_cost_snapshot = request.user.default_hourly_cost_rate`). The API request body cannot inject or override this rate.
2. **Historical Immutability Law:** Once written, `hourly_cost_snapshot` is **read-only forever**. If a team member receives a raise from \$50/hr to \$75/hr next month, past timesheets remain valued at \$50/hr.
3. **Labor Cost Calculation:** The direct labor cost of an individual entry is deterministically derived as:
   $$\text{Entry Cost} = \text{hours} \times \text{hourly\_cost\_snapshot}$$
4. **Edit and Deletion Governance:** Team members may edit or delete their own time entries within a configurable grace period (e.g., current active billing period). Once locked or invoiced, edits are blocked. Managers can inspect all time entries across all projects.

---

### 3.6 Model: `Expense`
- **Owning App:** `expenses`
- **Purpose:** Records direct non-labor expenditures (cloud infrastructure, software licenses, travel, subcontractors) subject to an explicit managerial review state machine.

| Attribute Name | Django Field Type | Null / Blank | Default Value | Validation & Constraints | Relationship & Deletion | Read / Modify Permissions |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| `id` | `UUIDField` or `BigAutoField` | Null: No<br/>Blank: No | Auto-generated | Primary Key. | Primary Key | Read: Manager / Submitter<br/>Modify: Immutable |
| `project` | `ForeignKey('projects.Project')` | Null: No<br/>Blank: No | None | References the project incurring the cost. | `on_delete=models.PROTECT`, `related_name='expenses'` | Read: Manager / Submitter<br/>Modify: Submitter (if PENDING) |
| `submitted_by` | `ForeignKey('users.User')` | Null: No<br/>Blank: No | None | Team member or manager incurring the expense. | `on_delete=models.PROTECT`, `related_name='expenses_submitted'` | Read: Manager / Submitter<br/>Modify: Immutable |
| `description` | `CharField(max_length=255)` | Null: No<br/>Blank: No | None | Specific purpose and vendor summary; non-empty. | None | Read: Manager / Submitter<br/>Modify: Submitter (if PENDING) |
| `category` | `CharField(max_length=30)` | Null: No<br/>Blank: No | None | Choices: `ExpenseCategory.SOFTWARE`, `TRAVEL`, `EQUIPMENT`, `CONTRACTOR`, `OTHER`. | None | Read: Manager / Submitter<br/>Modify: Submitter (if PENDING) |
| `amount` | `DecimalField(max_digits=12, decimal_places=2)` | Null: No<br/>Blank: No | None | Check constraint: `amount > 0.00`. Monetary expenditure value. | None | Read: Manager / Submitter<br/>Modify: Submitter (if PENDING) |
| `expense_date` | `DateField` | Null: No<br/>Blank: No | None | Calendar date expense was incurred. | None | Read: Manager / Submitter<br/>Modify: Submitter (if PENDING) |
| `status` | `CharField(max_length=20)` | Null: No<br/>Blank: No | `'PENDING'` | Controlled choices: `ExpenseStatus.PENDING`, `APPROVED`, `REJECTED`. | None | Read: Manager / Submitter<br/>Modify: **Review Endpoint Only** |
| `reviewed_by` | `ForeignKey('users.User')` | Null: Yes<br/>Blank: True | None | Manager who executed the review. | `on_delete=models.SET_NULL`, `related_name='expenses_reviewed'` | Read: Manager / Submitter<br/>Modify: **System Immutable** |
| `reviewed_at` | `DateTimeField` | Null: Yes<br/>Blank: True | None | Timestamp review was finalized. | None | Read: Manager / Submitter<br/>Modify: **System Immutable** |
| `review_note` | `TextField` | Null: Yes<br/>Blank: True | None | Mandatory when `status='REJECTED'`. Optional when `status='APPROVED'`. | None | Read: Manager / Submitter<br/>Modify: **Review Endpoint Only** |
| `receipt_url` | `CharField(max_length=500)` | Null: Yes<br/>Blank: True | None | Optional URL or storage key linking to digital receipt (see [DEC-EXP-01](#11-open-decisions-register)). | None | Read: Manager / Submitter<br/>Modify: Submitter (if PENDING) |
| `created_at` | `DateTimeField` | Null: No<br/>Blank: No | `auto_now_add=True` | Record creation timestamp. | None | Read: Manager / Submitter<br/>Modify: Immutable |
| `updated_at` | `DateTimeField` | Null: No<br/>Blank: No | `auto_now=True` | Record update timestamp. | None | Read: Manager / Submitter<br/>Modify: Immutable |

#### Implementation & Governance Notes:
1. **Review State Machine:** Standard `PUT`/`PATCH` endpoints cannot alter `status`, `reviewed_by`, or `reviewed_at`. Status transitions must occur exclusively via the dedicated endpoint `POST /api/v1/expenses/{id}/review/`.
2. **Self-Approval Prohibition:** A manager who submits an expense cannot approve their own expense:
   ```python
   if expense.submitted_by == request.user:
       raise PermissionDenied("Managers are barred from approving their own expenses.")
   ```
3. **Accounting Inclusion Law:**
   $$\text{Actual Incurred Direct Expenses} = \sum_{e \in \text{Expenses}} [e.\text{amount} \iff e.\text{status} = \text{'APPROVED'}]$$
   `PENDING` and `REJECTED` direct expenses are **strictly excluded** from project costs.
4. **Permanent Rejection Audit:** Rejecting an expense requires a non-empty `review_note` to provide immediate operational feedback to the submitter.

---

## 4. Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    User ||--o{ Project : "provisions"
    User ||--o{ ProjectAssignment : "assigned to"
    User ||--o{ TimeEntry : "logs"
    User ||--o{ Expense : "submits"
    User ||--o{ Expense : "reviews"
    Client ||--o{ Project : "commissions"
    Project ||--o{ ProjectAssignment : "staffed with"
    Project ||--o{ TimeEntry : "tracks"
    Project ||--o{ Expense : "incurs"

    User {
        UUID id PK
        string email UK
        string first_name
        string last_name
        string role
        decimal default_hourly_cost_rate
        boolean is_active
        boolean is_staff
        datetime created_at
    }

    Client {
        UUID id PK
        string name UK
        string contact_name
        string contact_email
        boolean is_archived
        datetime created_at
    }

    Project {
        UUID id PK
        UUID client_id FK
        string name
        decimal contract_revenue
        decimal planned_cost_budget
        decimal planned_hourly_cost
        decimal estimated_remaining_hours "NULLABLE"
        decimal expected_remaining_expenses
        string status
        date deadline
        boolean is_archived
    }

    ProjectAssignment {
        UUID id PK
        UUID project_id FK
        UUID user_id FK
        boolean is_active
        datetime assigned_at
    }

    TimeEntry {
        UUID id PK
        UUID project_id FK
        UUID user_id FK
        date work_date
        decimal hours
        decimal hourly_cost_snapshot "IMMUTABLE"
        string description
    }

    Expense {
        UUID id PK
        UUID project_id FK
        UUID submitted_by_id FK
        decimal amount
        date expense_date
        string category
        string status
        UUID reviewed_by_id FK "NULLABLE"
        string review_note "NULLABLE"
    }
```

---

## 5. Permissions, Authorization & Object-Level Access Control

Every API endpoint enforces server-side permission checks in strict adherence with [docs/security-and-permissions.md](../security-and-permissions.md):

```mermaid
flowchart TD
    Req[Incoming HTTP Request] --> AuthCheck{Is Authenticated & Active?}
    AuthCheck -- No --> 401[401 Unauthorized]
    AuthCheck -- Yes --> RoleCheck{User Role?}
    
    RoleCheck -- MANAGER --> ManagerPerms[Full Tenant Access<br/>All Projects, Rates, Budgets, Approval Gates]
    RoleCheck -- TEAM_MEMBER --> AssignCheck{Assigned to Project?}
    
    AssignCheck -- No --> 403[403 Forbidden / 404 Hidden]
    AssignCheck -- Yes --> ScopedPerms[Scoped Access<br/>Log Time, View Own Entries, Submit Expenses]
    
    ScopedPerms --> MaskCheck[Field Masking Gate<br/>Strip Revenue, Budgets, Rates, AI Advice]
    ManagerPerms --> FullData[Unmasked Financial Response]
    MaskCheck --> MaskedData[Masked Operational Response]
```

---

## 6. Authoritative Financial Calculations

All financial algorithms live in `profitability/services.py` and are implemented with Python `Decimal`:

```python
from decimal import Decimal

# Formula 1: Actual Labor Cost
# C_labor = sum(entry.hours * entry.hourly_cost_snapshot)

# Formula 2: Actual Expense Cost (APPROVED only)
# C_expense = sum(expense.amount for expense in approved_expenses)

# Formula 3: Actual Total Cost
# C_actual = C_labor + C_expense

# Formula 4: Budget Consumption Percentage
# P_consumed = (C_actual / B) * Decimal('100.00')

# Formula 5: Estimated Remaining Labor Cost
# C_rem_labor = estimated_remaining_hours * planned_hourly_cost (or None if unestimated)

# Formula 6: Projected Final Cost
# C_projected = C_actual + C_rem_labor + expected_remaining_expenses

# Formula 7: Projected Profit
# Profit_projected = contract_revenue - C_projected

# Formula 8: Projected Margin Percentage
# M_projected = (Profit_projected / contract_revenue) * Decimal('100.00')
```

### Risk Precedence Hierarchy

1. **`OVER_BUDGET`**: Incurred cost strictly exceeds budget ($C_{actual} > B$).
2. **`INSUFFICIENT_DATA`**: Actual spend within budget, but $H_{remaining}$ is `null`.
3. **`AT_RISK`**: $C_{projected} > B$ or $P_{consumed} \ge 80.0\%$.
4. **`HEALTHY`**: Incurred and projected costs strictly within budget.

---

## 7. AI Risk Advisor Integration

- **Model:** Google Gemini (`gemini-3.8-flash` by default, configurable via `GEMINI_MODEL`; `gemini-2.5-flash` access is now limited by Google).
- **Communication:** Server-to-server only via Django `ai_advisor` service.
- **Access:** Strictly restricted to agency managers (`IsManager`).
- **Sanitization:** All personal identifiers and client contact details are scrubbed prior to dispatch.
- **Contract:** Strict JSON schema output (`risk_status`, `summary`, `key_findings`, `recommended_actions`, `limitations`, `generated_at`).
- **Resilience:** Times out gracefully at 25 seconds; returns clean fallback response on provider outage without interrupting application operations.

---

## 8. Database Indexing Strategy

1. `users.User`: `email` (unique index), `role` (B-tree index), `is_active` (filter index).
2. `clients.Client`: `name` (unique index), `is_archived` (B-tree index).
3. `projects.Project`: `client_id` (foreign key index), `status` (B-tree index), `is_archived` (B-tree index).
4. `projects.ProjectAssignment`: `(project_id, user_id)` (unique composite index).
5. `time_tracking.TimeEntry`: `(project_id, work_date)` (composite index), `user_id` (foreign key index).
6. `expenses.Expense`: `(project_id, status)` (composite index for rapid approved-expense summing).

---

## 9. Serialization & Error Formats

Standard error format:
```json
{
  "detail": "Descriptive human-readable error message.",
  "code": "ERROR_CODE_IDENTIFIER"
}
```

Validation error format:
```json
{
  "field_name": [
    "This field is required."
  ]
}
```

---

## 10. Staged Implementation Order

Implementation must follow a strict, test-driven sequential roadmap. Developers must **never** build downstream apps before upstream foundations are fully validated with unit tests.

```mermaid
flowchart TD
    M1[1. Foundations & Auth<br/>users app, custom User model, JWT] --> M2[2. Client & Project Baselines<br/>clients, projects, ProjectAssignment]
    M2 --> M3[3. Work & Expense Tracking<br/>time_tracking, rate snapshots, expenses state machine]
    M3 --> M4[4. Profitability Engine<br/>profitability service, math formulas, risk precedence]
    M4 --> M5[5. REST API Gateways<br/>Serializers, permissions, filtering, dashboard aggregation]
    M5 --> M6[6. Frontend Workflows<br/>Next.js pages, role gating, timesheets, review tables]
    M6 --> M7[7. AI Risk Advisor<br/>ai_advisor service, Gemini client, sanitization]
    M7 --> M8[8. Hardening & Demo Data<br/>PostgreSQL migration, seed_demo_data command, regression audit]
```

1. **Stage 1: Identity & Custom User Foundation (`users`)**
   - Finalize custom user model and login identifier decision.
   - Implement `users.User`, role choices (`MANAGER`, `TEAM_MEMBER`), and initial migration.
   - Configure JWT authentication (`/api/v1/auth/login/`, `/refresh/`, `/logout/`, `/me/`, `/users/`).
   - Run tests: `TC-MOD-01`, `TC-MOD-02`, `TC-SEC-03`.
2. **Stage 2: Client & Project Portfolio Core (`clients`, `projects`)**
   - Implement `Client`, `Project`, and `ProjectAssignment` models with constraints.
   - Establish manager-only CRUD endpoints and project assignment join endpoints.
   - Run tests: `TC-MOD-03`, `TC-MOD-04`, `TC-MOD-05`, `TC-MOD-06`.
3. **Stage 3: Labor & Expense Ingestion (`time_tracking`, `expenses`)**
   - Implement `TimeEntry` with automatic server-side rate snapshot population.
   - Implement `Expense` with two-stage manager review lifecycle.
   - Implement object-level assignment permission classes.
   - Run tests: `TC-MOD-07`, `TC-MOD-08`, `TC-MOD-09`, `TC-SEC-01`.
4. **Stage 4: Deterministic Profitability Engine (`profitability`)**
   - Implement pure Python `ProfitabilityService` using exact `Decimal` arithmetic.
   - Codify all 8 financial formulas and 4-tier risk precedence hierarchy.
   - Run comprehensive numerical tests: `TC-NUM-01`, `TC-NUM-02`, `TC-NUM-03`, `TC-NUM-04`.
5. **Stage 5: API Aggregation & Permission Gateways**
   - Expose `/api/v1/projects/{id}/financial-summary/` and `/api/v1/dashboard/summary/`.
   - Implement role-based serializer field masking.
   - Run tests: `TC-SEC-02`.
6. **Stage 6: Frontend Integration (Next.js)**
   - Build client-side routes, role navigation, timesheet entry forms, and expense review portals.
7. **Stage 7: AI Risk Advisor (`ai_advisor`)**
   - Implement Gemini client, context sanitization, prompt templates, and schema validation.
   - Run tests: `TC-AI-01`, `TC-AI-02`.
8. **Stage 8: Production Polish, Seeding & Walkthrough**
   - Implement idempotent `seed_demo_data` Django management command.
   - Validate PostgreSQL migration and execute full regression suite.

---

## 11. Open Decisions Register

The following architectural and contract decisions are currently **open**. They must be formally reviewed and approved before code implementation begins for their respective milestones.

| Decision ID | Topic / Question | Current Recommendation | Architectural Impact & Trade-Offs | Status | Settlement Prerequisite |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **`DEC-AUTH-01`** | Primary Key Strategy: UUID vs. BigAutoField | **UUIDv4 (`UUIDField`)** | UUIDs prevent primary key enumeration attacks and simplify distributed imports, but incur a minor storage and index penalty compared to 64-bit integers. | **Open** | Must be settled prior to executing the initial migration in Stage 1. |
| **`DEC-AUTH-02`** | Login Identifier: Email vs. Username | **Pure Email Login** (`USERNAME_FIELD = 'email'`) | Eliminates redundant username field. Requires custom user model manager normalizing email to lowercase. | **Open** | Must be settled prior to Stage 1. |
| **`DEC-AUTH-03`** | Authentication Protocol: Session vs. JWT | **SimpleJWT (Stateless Access + Refresh)** | Supports decoupled Next.js client seamlessly across separate local dev ports (3000 and 8000). Requires handling token refresh rotation and secure HTTP-only cookies or storage. | **Open** | Must be settled prior to Stage 1. |
| **`DEC-PRJ-01`** | Project Financial Field Requiredness on Draft Projects | **Allow $R=0$, Require $B > 0$** | In early planning, contract revenue may be unfinalized ($0.00$), but a positive delivery cost budget ($B > 0$) is mandatory to allow baseline risk evaluation. | **Open** | Must be approved for Stage 2 serializers. |
| **`DEC-PRJ-02`** | Project Status Choice Nomenclature | **`PLANNING`, `ACTIVE`, `ON_HOLD`, `COMPLETED`, `CANCELLED`** | Aligns with business delivery lifecycle. Replaces legacy `DRAFT` and `ARCHIVED` status strings. | **Open** | Settle during Stage 2 model definition. |
| **`DEC-TIME-01`** | Time Entry Edit & Deletion Policy | **Author edit allowed within active billing window** | Team members can edit their own logged hours within 7 days or until manager locks the month; historical snapshot rate remains immutable. | **Open** | Must be settled before Stage 3 timesheet API. |
| **`DEC-TIME-02`** | Manager Edits to Another Member's Timesheet | **Allowed with Audit Trail** | Managers can adjust recorded hours if an employee is on leave, but the change logs `updated_by` to maintain historical accountability. | **Open** | Must be settled before Stage 3 timesheet API. |
| **`DEC-TIME-03`** | Future Work Date Tolerance | **Allow Current Date + 1 Day** | Accommodates international date-line variations between remote team members and server clock without allowing arbitrary future logging. | **Open** | Settle during Stage 3 validation. |
| **`DEC-EXP-01`** | Expense Receipt Attachment Storage | **URL String (`receipt_url`) for MVP** | Avoids local multipart media handling complexities during MVP. Full S3/Cloud Storage file upload deferred to v1.1+. | **Open** | Settle during Stage 3 expense model. |
| **`DEC-PERM-01`**| Team Member Project-Level Cost Visibility | **Strict Zero Visibility (Complete Masking)** | Team members see zero project cost ceilings, burn rates, or profit metrics. Preserves absolute agency wage and margin privacy. | **Open** | Settle before Stage 5 serializers. |
| **`DEC-AI-01`**  | AI Advice Persistence | **Ephemeral (Not Persisted in DB for MVP)** | AI advice is generated on demand for managers and discarded. Persisting advice tables and user feedback ratings deferred to Phase 8+. | **Open** | Settle before Stage 7 AI service. |
| **`DEC-API-01`** | API Financial Route Naming | **Expose `/financials/` and alias `/financial-summary/`** | Reconciles proposed modular routes with existing `docs/api-specification.md`. | **Open** | Settle during Stage 5 URL routing. |

---

## 12. Verification and Quality Checklist

Before marking any stage complete during implementation, verify against this quality checklist:
- [ ] No `Agency` or `AgencyMembership` models or `agency_id` fields are present in any migration or model file.
- [ ] Exactly six core models are implemented across `users`, `clients`, `projects`, `time_tracking`, and `expenses`.
- [ ] `ProfitabilityService` uses Python `Decimal` arithmetic exclusively; zero `float` instances exist in financial modules.
- [ ] All monetary fields use `DecimalField(max_digits=12, decimal_places=2)`.
- [ ] `TimeEntry.hourly_cost_snapshot` is captured automatically from the user's rate at creation and cannot be updated.
- [ ] `Project.estimated_remaining_hours` permits `null` and is never silently converted to `0.00`.
- [ ] `Expense` state transitions are restricted to the dedicated review endpoint; self-approval is blocked.
- [ ] Foreign keys to financial entities enforce `on_delete=models.PROTECT`.
- [ ] All list API querysets filter out unassigned projects for non-manager users.
- [ ] All financial metrics are stripped from serializers when requested by `TEAM_MEMBER` users.
- [ ] AI advice is strictly read-only and decoupled from deterministic financial calculations.
