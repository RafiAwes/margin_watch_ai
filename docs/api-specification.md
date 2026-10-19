# MarginWatch — REST API Specification (Contract Blueprint)

**Document Status:** Planned API Specification — Target Contract (Phase 0)  
**Last Updated:** October 2026  
**Audience:** Frontend Developers, Backend Developers, API Integration Testers  
**Architecture Authority:** [ADR-001: Initial Architecture](decisions/ADR-001-initial-architecture.md) | [ADR-002: Single-Agency Architecture](decisions/ADR-002-single-agency-architecture.md)  
**Financial Rules Authority:** [docs/financial-rules.md](financial-rules.md) | [ADR-003: Financial Rules](decisions/ADR-003-financial-rules-and-risk-classification.md)

> [!IMPORTANT]
> This document specifies the planned REST API contract for MarginWatch under the **Single-Agency Architecture**. The application serves one agency implicitly; no agency IDs or tenant context headers are accepted.

---

## 1. Global API Conventions

### 1.1 Base URL & Content Negotiation
- **Base URL:** `/api/v1`
- **Transport:** HTTPS in production, HTTP for local development (`http://localhost:8000/api/v1`).
- **Content Type:** `application/json; charset=utf-8` for all request bodies and responses.

### 1.2 Authentication Headers
Protected endpoints require a valid JWT access token:
```http
Authorization: Bearer <access_token>
```

### 1.3 Standard Success & Pagination Envelope
Collection endpoints return a standard paginated response:
```json
{
  "count": 42,
  "next": "/api/v1/projects/?page=3",
  "previous": "/api/v1/projects/?page=1",
  "page_size": 20,
  "results": [ ... ]
}
```

### 1.4 Standard Error Response Schema
All error responses return an HTTP 4xx or 5xx status code with a uniform error envelope:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The submitted payload contains one or more invalid attributes.",
    "details": [
      {
        "field": "recorded_hours",
        "issue": "Recorded hours must be greater than 0.00 and less than or equal to 24.00."
      }
    ]
  }
}
```

---

## 2. Authentication Endpoints

### 2.1 User Login
- **Endpoint:** `POST /api/v1/auth/login/`
- **Authentication:** Public (Unauthenticated).
- **Permitted Roles:** Any active user.
- **Financial Information Exposed:** None.
- **Request Body:**
  ```json
  {
    "email": "manager@agency.com",
    "password": "SecurePassword123!"
  }
  ```
- **Success Response:** `200 OK`
  ```json
  {
    "access_token": "<jwt_access_token>",
    "refresh_token": "<jwt_refresh_token>",
    "user": {
      "id": "846f1178-716b-4d9e-ba32-c7a64b17bd5e",
      "email": "manager@agency.com",
      "first_name": "Sarah",
      "last_name": "Connor",
      "role": "MANAGER"
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Missing email or password.
  - `401 Unauthorized`: Invalid credentials, inactive account (`is_active = False`), or wrong password.

### 2.2 Token Refresh
- **Endpoint:** `POST /api/v1/auth/refresh/`
- **Authentication:** Public.
- **Request Body:**
  ```json
  {
    "refresh": "<jwt_refresh_token>"
  }
  ```
- **Success Response:** `200 OK`
  ```json
  {
    "access_token": "<new_jwt_access_token>",
    "refresh_token": "<rotated_jwt_refresh_token>"
  }
  ```

### 2.3 Current User Profile (`Me`)
- **Endpoint:** `GET /api/v1/auth/me/`
- **Authentication:** Authenticated.
- **Permitted Roles:** `MANAGER`, `TEAM_MEMBER`.
- **Financial Information Exposed:** `default_hourly_cost_rate` is exposed **strictly to `MANAGER` users** and masked for `TEAM_MEMBER`.
- **Manager Response (`200 OK`):**
  ```json
  {
    "id": "846f1178-716b-4d9e-ba32-c7a64b17bd5e",
    "email": "manager@agency.com",
    "first_name": "Sarah",
    "last_name": "Connor",
    "role": "MANAGER",
    "default_hourly_cost_rate": "125.0000",
    "created_at": "2026-10-17T16:19:19Z",
    "updated_at": "2026-10-17T16:19:21Z"
  }
  ```
- **Team Member Response (`200 OK`):**
  ```json
  {
    "id": "171ec3b3-48b8-44b9-9381-a98b6fdbd92f",
    "email": "dev@agency.com",
    "first_name": "Alex",
    "last_name": "Mercer",
    "role": "TEAM_MEMBER",
    "created_at": "2026-10-17T16:19:21Z",
    "updated_at": "2026-10-17T16:19:26Z"
  }
  ```


### 2.4 Change Password
- **Endpoint:** `POST /api/v1/auth/change-password/`
- **Authentication:** Authenticated (any role).
- **Request Body:** `{"current_password": "...", "new_password": "..."}`
- **Rules:** `current_password` must match; `new_password` must differ from it and pass Django's password validators (length, common passwords, similarity to the user's name/email).
- **Effect:** the password is replaced and **all of the user's refresh tokens are revoked** (other sessions are signed out; the frontend signs in again with the new password).
- **Responses:** `200 OK` `{"detail": "Password updated."}` · `400 VALIDATION_ERROR` with `current_password` / `new_password` field details · `401` when unauthenticated.

### 2.5 Account Provisioning (no public sign-up)
MarginWatch serves one agency, so there is **no public registration endpoint**. Accounts are created by
managers with `POST /api/v1/users/` (email, name, role, hourly cost rate, initial password — validated with
Django's password validators). New staff sign in with the initial password and change it via §2.4.
The first manager account is created on the server (`python manage.py seed_dev_users` or `createsuperuser`).

---

## 3. Client Management Endpoints

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/clients/` | `MANAGER` | List clients (`?search=`, `?is_archived=`). Paginated. |
| `POST` | `/api/v1/clients/` | `MANAGER` | Create a client record. |
| `GET` | `/api/v1/clients/{id}/` | `MANAGER` | Retrieve client details and linked projects. |
| `PUT` | `/api/v1/clients/{id}/` | `MANAGER` | Update client information. |
| `DELETE`| `/api/v1/clients/{id}/` | `MANAGER` | Soft-archive client (`is_archived = True`). Rejects physical deletion if active projects exist. |

### Create Client Request Body (`POST /api/v1/clients/`)
```json
{
  "name": "Acme Corporation",
  "contact_name": "Jane Doe",
  "contact_email": "jane@acme.com",
  "contact_phone": "+1-555-0199",
  "notes": "Key enterprise customer. Monthly invoicing cycle."
}
```

---

## 4. Project Management & Assignment Endpoints

### 4.1 List Projects
- **Endpoint:** `GET /api/v1/projects/`
- **Authentication:** Authenticated.
- **Allowed Roles & Queryset Filtering:**
  - `MANAGER`: Sees all agency projects. Can filter by `?client_id=`, `?status=`, `?is_archived=`.
  - `TEAM_MEMBER`: Automatically filtered by backend queryset to only projects where the user holds an active `ProjectAssignment` (`is_active = True`).
- **Financial Information Exposed:**
  - `MANAGER`: Full financial baselines (`contract_revenue`, `planned_cost_budget`, `planned_hourly_cost_rate`).
  - `TEAM_MEMBER`: Financial attributes are **strictly masked** and omitted.
- **Manager Response Item:**
  ```json
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "client": {
      "id": "e2a3c749-d7b1-4f10-90c7-bfef09d8be8a",
      "name": "Acme Corporation"
    },
    "name": "Customer Portal Redesign",
    "description": "Modern full-stack client portal.",
    "contract_revenue": "45000.00",
    "planned_cost_budget": "28000.00",
    "planned_hourly_cost_rate": "75.0000",
    "currency": "USD",
    "estimated_remaining_hours": "140.00",
    "expected_remaining_expenses": "0.00",
    "status": "ACTIVE",
    "is_archived": false,
    "created_at": "2026-10-18T10:00:00Z"
  }
  ```
- **Team Member Response Item (Masked):**
  ```json
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "client": {
      "id": "e2a3c749-d7b1-4f10-90c7-bfef09d8be8a",
      "name": "Acme Corporation"
    },
    "name": "Customer Portal Redesign",
    "description": "Modern full-stack client portal.",
    "currency": "USD",
    "status": "ACTIVE",
    "is_archived": false,
    "created_at": "2026-10-18T10:00:00Z"
  }
  ```

### 4.2 Create Project
- **Endpoint:** `POST /api/v1/projects/`
- **Allowed Roles:** `MANAGER` strictly.
- **Request Body:**
  ```json
  {
    "client_id": "e2a3c749-d7b1-4f10-90c7-bfef09d8be8a",
    "name": "Customer Portal Redesign",
    "description": "Full-stack client portal.",
    "contract_revenue": "45000.00",
    "planned_cost_budget": "28000.00",
    "planned_hourly_cost_rate": "75.0000",
    "currency": "USD",
    "estimated_remaining_hours": "140.00",
    "expected_remaining_expenses": "0.00",
    "status": "ACTIVE"
  }
  ```
  *(Note: `estimated_remaining_hours` may be omitted or passed as `null` if remaining effort is unknown).*

### 4.3 Update Project Baselines & Scope Estimates
- **Endpoint:** `PUT /api/v1/projects/{id}/`
- **Allowed Roles:** `MANAGER` strictly.
- **Purpose:** Update budgets, contract revenue, or scope estimates (`estimated_remaining_hours`). Passing `"estimated_remaining_hours": null` explicitly marks the estimate as unknown.

### 4.4 Project Assignments Endpoints

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/projects/{project_id}/assignments/` | `MANAGER` | List all assigned users for the project. |
| `POST` | `/api/v1/projects/{project_id}/assignments/` | `MANAGER` | Assign an active user to the project. |
| `DELETE`| `/api/v1/projects/{project_id}/assignments/{id}/` | `MANAGER` | Revoke a user's assignment (`is_active = False`). |

#### Assign User Request Body (`POST /api/v1/projects/{project_id}/assignments/`)
```json
{
  "user_id": "171ec3b3-48b8-44b9-9381-a98b6fdbd92f"
}
```
- **Validation:**
  - `user_id` must reference an active user (`is_active = True`).
  - Duplicate assignments of the same user to the same project are rejected with `400 Bad Request` (`duplicate_assignment`).

---

## 5. Time Entry Endpoints

### 5.1 List Time Entries
- **Endpoint:** `GET /api/v1/time-entries/`
- **Allowed Roles:**
  - `MANAGER`: Can view all entries across any project and filter by `?project_id=`, `?user_id=`, `?date_from=`, `?date_to=`.
  - `TEAM_MEMBER`: Strictly scoped to their own recorded time entries.
- **Financial Masking:** `hourly_cost_snapshot` is visible only to `MANAGER` and completely omitted from `TEAM_MEMBER` responses.

### 5.2 Log Time Entry
- **Endpoint:** `POST /api/v1/time-entries/`
- **Authentication:** Authenticated.
- **Allowed Roles:** `MANAGER`, or `TEAM_MEMBER` holding an active `ProjectAssignment` on the target project.
- **Request Body:**
  ```json
  {
    "project_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "work_date": "2026-10-18",
    "recorded_hours": "4.50",
    "description": "Implemented JWT authentication and serializer data masking"
  }
  ```
- **Backend Behavior:**
  1. Verifies that `request.user` holds an active `ProjectAssignment` for `project_id` (unless `request.user.role == 'MANAGER'`).
  2. Sets `user = request.user`.
  3. Captures `hourly_cost_snapshot = request.user.default_hourly_cost_rate`.
- **Validation Errors:**
  - `400 Bad Request`: `recorded_hours <= 0.00` or `> 24.00`.
  - `403 Forbidden`: User is not assigned to the specified project.

### 5.3 Edit / Delete Time Entry
- **Endpoint:** `PUT /api/v1/time-entries/{id}/` / `DELETE /api/v1/time-entries/{id}/`
- **Allowed Roles:**
  - `MANAGER`: Allowed for any entry.
  - `TEAM_MEMBER`: Permitted strictly for their own entries (`entry.user_id == request.user.id`).
- **Rule:** `hourly_cost_snapshot` is immutable and cannot be updated.

---

## 6. Expense Management Endpoints

### 6.1 Submit Expense
- **Endpoint:** `POST /api/v1/expenses/`
- **Allowed Roles:** Authenticated user with an active `ProjectAssignment` on the target project.
- **Request Body:**
  ```json
  {
    "project_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "category": "SOFTWARE_LICENSE",
    "amount": "149.00",
    "expense_date": "2026-10-18",
    "description": "Staging server cloud database allocation"
  }
  ```
- **Backend Behavior:** Status initializes to `PENDING`. `amount` must be $> 0.00$.

### 6.2 Review Expense (Approve or Reject)
- **Endpoint:** `POST /api/v1/expenses/{id}/review/`
- **Allowed Roles:** `MANAGER` strictly.
- **Request Body (Approval):**
  ```json
  {
    "action": "APPROVE",
    "review_note": "Approved per project staging budget."
  }
  ```
- **Request Body (Rejection):**
  ```json
  {
    "action": "REJECT",
    "review_note": "Personal peripheral purchase outside contracted scope."
  }
  ```
- **Validation Rules:**
  - `action` must be `APPROVE` or `REJECT`.
  - If `action == "REJECT"`, `review_note` is mandatory and cannot be empty.
  - An expense already in `APPROVED` or `REJECTED` state cannot be re-reviewed (`422 Unprocessable Entity`).

---

## 7. Financial Summary & Dashboard Endpoints

### 7.1 Agency Dashboard Summary
- **Endpoint:** `GET /api/v1/dashboard/summary/?currency=USD`
- **Allowed Roles:** `MANAGER` strictly (`403` for team members).
- **Scope:** `ACTIVE`, non-archived projects in one currency (`?currency=`, default `USD`; never mixed, financial-rules §4.2). Projected totals and the aggregate margin cover forecastable projects only (known remaining hours).
- **Success Response:** `200 OK`
  ```json
  {
    "currency": "USD",
    "active_projects_count": 5,
    "total_contract_revenue": "185000.00",
    "total_planned_cost_budget": "115000.00",
    "total_actual_cost_to_date": "64200.00",
    "portfolio_budget_consumption_percentage": "55.83",
    "projects_at_risk_count": 1,
    "projects_over_budget_count": 1,
    "risk_counts": {"healthy": 2, "at_risk": 1, "over_budget": 1, "insufficient_data": 1},
    "forecastable_projects_count": 4,
    "total_projected_final_cost": "98400.00",
    "aggregate_projected_margin_percentage": "38.50",
    "pending_expenses_count": 3,
    "pending_expenses_amount": "1450.00"
  }
  ```

### 7.2 Project Financial Summary
- **Endpoint:** `GET /api/v1/projects/{id}/financial-summary/`
- **Allowed Roles:** `MANAGER` strictly (`403` for team members, including assigned ones; `404` for unknown ids).
- **Purpose:** Authoritative real-time calculation of project financials and deterministic risk classification.
- **Fields beyond the examples below:** `baselines.planned_profit` ($R - B$), `baselines.planned_margin_percentage`, `actuals.pending_expense_count`, `actuals.rejected_expense_cost` (informational, never in costs), `forecast.projected_cost_variance` ($C_{projected} - B$), `forecast.reason_unavailable` (`null` when the forecast exists), `risk.rule` (1–4, the precedence rule that decided the status) and `metadata` (`warning_threshold_percentage`, `assumptions`). `actuals.pending_expense_cost` is always present.

#### Complete Forecast Data Scenario:
```json
{
  "project_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "project_name": "Customer Portal Redesign",
  "currency": "USD",
  "baselines": {
    "contract_revenue": "45000.00",
    "planned_cost_budget": "28000.00",
    "planned_hourly_cost_rate": "75.0000",
    "estimated_remaining_hours": "140.00",
    "expected_remaining_expenses": "0.00"
  },
  "actuals": {
    "total_hours_logged": "180.00",
    "actual_labor_cost": "13500.00",
    "approved_expense_cost": "2200.00",
    "actual_total_cost": "15700.00",
    "pending_expense_cost": "450.00",
    "budget_consumption_percentage": "56.07"
  },
  "forecast": {
    "forecast_available": true,
    "estimated_remaining_labor_cost": "10500.00",
    "projected_final_cost": "26200.00",
    "projected_profit": "18800.00",
    "projected_profit_margin_percentage": "41.78"
  },
  "risk": {
    "status": "healthy",
    "reasons": [
      "Actual total cost ($15,700.00) is within planned budget ($28,000.00).",
      "Projected final cost ($26,200.00) is within planned budget ($28,000.00)."
    ]
  }
}
```

#### Missing Estimate Scenario (`estimated_remaining_hours = null`):
```json
{
  "project_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "project_name": "Customer Portal Redesign",
  "currency": "USD",
  "baselines": {
    "contract_revenue": "45000.00",
    "planned_cost_budget": "28000.00",
    "planned_hourly_cost_rate": "75.0000",
    "estimated_remaining_hours": null,
    "expected_remaining_expenses": "0.00"
  },
  "actuals": {
    "total_hours_logged": "180.00",
    "actual_labor_cost": "13500.00",
    "approved_expense_cost": "2200.00",
    "actual_total_cost": "15700.00",
    "budget_consumption_percentage": "56.07"
  },
  "forecast": {
    "forecast_available": false,
    "estimated_remaining_labor_cost": null,
    "projected_final_cost": null,
    "projected_profit": null,
    "projected_profit_margin_percentage": null,
    "reason_unavailable": "Estimated remaining hours is null (unknown). Forward projections are suppressed."
  },
  "risk": {
    "status": "insufficient_data",
    "reasons": [
      "Actual spending has not breached budget ceiling.",
      "Estimated remaining hours is unknown; reliable completion forecast cannot be established."
    ]
  }
}
```

### 7.3 Project Financial Summaries (collection)
- **Endpoint:** `GET /api/v1/projects/financial-summaries/`
- **Allowed Roles:** `MANAGER` strictly.
- **Purpose:** The §7.2 object for many projects at once (dashboards, project lists) in a fixed number of queries.
- **Query parameters:** same as `GET /api/v1/projects/` (`client_id`, `status`, `is_archived`, `search`, `ordering`) plus pagination (`page`, `page_size` ≤ 100).
- **Success Response:** `200 OK` — §1.3 pagination envelope whose `results` are §7.2 objects.

---

## 8. AI Risk Advisor Endpoint

### 8.1 Request AI Risk Analysis
- **Endpoint:** `POST /api/v1/projects/{id}/ai-risk-analysis/`
- **Allowed Roles:** `MANAGER` strictly.
- **Success Response (`200 OK`):**
  ```json
  {
    "project_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "deterministic_status": "at_risk",
    "ai_advisor": {
      "executive_summary": "Project Customer Portal Redesign is at risk of exceeding its planned delivery budget by $1,800.00.",
      "primary_risk_drivers": [
        "Remaining labor (140 hours at $75/hr = $10,500.00) pushes projected costs to $29,800.00 vs $28,000.00 ceiling.",
        "Pending expenses of $450.00 in review could increase overrun to $2,250.00."
      ],
      "actionable_recommendations": [
        "Review remaining 140 hours scope for potential reduction of non-essential features.",
        "Rebalance frontend development hours to a lower-rate team member.",
        "Request client change order to adjust contract revenue."
      ],
      "data_gaps_and_assumptions": [
        "Assumes remaining hours estimate was updated within the last 7 calendar days."
      ]
    },
    "generated_at": "2026-10-18T10:15:00Z"
  }
  ```

---

### 8.2 Behaviour & Errors
- **Allowed roles:** `MANAGER` only (`403` for team members, including assigned ones; `404` for unknown ids). `POST` only.
- **Rate limit:** 10 requests/hour per user (`429`, code `THROTTLED`).
- **Extra response fields:** `model` (the Gemini model used) and `cached` (`true` when identical figures were analysed within the last 24 h; no new model call is made).
- **Read-only:** the endpoint never writes to the database.
- **Error codes** (standard error envelope; every message ends with "Deterministic financials remain valid."):

| HTTP | `error.code` | When |
| :---: | :--- | :--- |
| 503 | `AI_NOT_CONFIGURED` | `GEMINI_API_KEY` is not set on the server. |
| 503 | `AI_TIMEOUT` | No reply within 10 seconds (`GEMINI_TIMEOUT_SECONDS`). |
| 503 | `AI_QUOTA_EXCEEDED` | Provider returned HTTP 429. |
| 503 | `AI_UNAVAILABLE` | Network/provider error, or the key/model was rejected. |
| 502 | `AI_RESPONSE_INVALID` | Reply was not valid JSON, broke the schema, or quoted figures not present in the context (grounding check). |

---

## 9. Unresolved API Contract Decisions

The following contract decisions are explicitly flagged for stakeholder alignment:
1. **Time Entry Monthly Lockout:** Should the API reject time logging for dates in calendar months that a Manager has marked "billed"? (Targeted for post-MVP).
2. **Team Member Expense Categories:** Should team members see all 5 expense categories, or should categories like `SUBCONTRACTOR` be restricted to Managers? (Currently open to all submitters).
