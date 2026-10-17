# MarginWatch — REST API Specification (Contract Blueprint)

**Document Status:** Planned API Specification — Not Yet Implemented (Phase 0)  
**Last Updated:** October 2026  
**Audience:** Frontend Developers, Backend Developers, API Integration Testers  
**Financial Rules Authority:** [docs/financial-rules.md](financial-rules.md) | [ADR-002](decisions/ADR-002-financial-rules-and-risk-classification.md)

> [!IMPORTANT]
> This document specifies the planned REST API contract for MarginWatch. These endpoints represent target behaviors and response schemas for Phase 4 implementation and do not exist in the codebase at this stage.

---

## 1. Global API Conventions

### 1.1 Base URL & Content Negotiation
- **Base URL:** `/api/v1`
- **Transport:** HTTPS in production, HTTP for local development (`http://localhost:8000/api/v1`).
- **Content Type:** `application/json; charset=utf-8` for all request bodies and responses.

### 1.2 Authentication Headers
Protected endpoints require an `Authorization` header containing a valid token:
```http
Authorization: Bearer <access_token>
```

### 1.3 Standard Success Envelope
Collection endpoints return a standard paginated response envelope:
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
All error responses return an HTTP 4xx or 5xx status code with a consistent error structure:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request body failed schema validation.",
    "details": [
      {
        "field": "hours_worked",
        "issue": "Hours worked must be greater than 0.00."
      }
    ]
  }
}
```

---

## 2. Authentication Endpoints

### 2.1 User Login
- **Endpoint:** `POST /api/v1/auth/login/`
- **Purpose:** Authenticate user credentials and issue an access token.
- **Access Control:** Public (Unauthenticated).
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
    "access_token": "jwt-token-string",
    "refresh_token": "jwt-refresh-string",
    "user": {
      "id": "u-101",
      "email": "manager@agency.com",
      "first_name": "Sarah",
      "last_name": "Connor",
      "role": "AGENCY_MANAGER"
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Missing email or password.
  - `401 Unauthorized`: Invalid credentials or account deactivated.

### 2.2 Current User Profile (`Me`)
- **Endpoint:** `GET /api/v1/auth/me/`
- **Purpose:** Retrieve the profile of the currently authenticated user.
- **Access Control:** Authenticated (`AGENCY_MANAGER` or `TEAM_MEMBER`).
- **Success Response:** `200 OK`
  ```json
  {
    "id": "u-101",
    "email": "dev@agency.com",
    "first_name": "Alex",
    "last_name": "Mercer",
    "role": "TEAM_MEMBER"
  }
  ```
  *(Note: `default_hourly_cost_rate` is only exposed if `role == 'AGENCY_MANAGER'`).*

---

## 3. Client Management Endpoints

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/clients/` | `AGENCY_MANAGER` | List all clients (supports `?search=` and `?status=`). |
| `POST` | `/api/v1/clients/` | `AGENCY_MANAGER` | Create a new client. |
| `GET` | `/api/v1/clients/{id}/` | `AGENCY_MANAGER` | Retrieve client details and associated projects. |
| `PUT` | `/api/v1/clients/{id}/` | `AGENCY_MANAGER` | Update client information. |
| `DELETE`| `/api/v1/clients/{id}/` | `AGENCY_MANAGER` | Archive client (restricted if active projects exist). |

### Create Client Request Body (`POST /api/v1/clients/`)
```json
{
  "name": "Acme Corp",
  "contact_email": "billing@acme.com",
  "contact_name": "Jane Doe",
  "status": "ACTIVE"
}
```

---

## 4. Project Management Endpoints

### 4.1 List Projects
- **Endpoint:** `GET /api/v1/projects/`
- **Allowed Roles:**
  - `AGENCY_MANAGER`: Sees all agency projects.
  - `TEAM_MEMBER`: Filtered automatically to only projects where the member has an active `ProjectMembership`.
- **Query Parameters:** `?status=ACTIVE&client_id={id}&page=1`
- **Success Response:** `200 OK` (Manager View includes financial baselines; Team Member View excludes budgets and revenues).

### 4.2 Create Project
- **Endpoint:** `POST /api/v1/projects/`
- **Allowed Roles:** `AGENCY_MANAGER` strictly.
- **Request Body:**
  ```json
  {
    "client_id": "c-501",
    "name": "Customer Portal Redesign",
    "code": "PRJ-CP",
    "contract_revenue": "45000.00",
    "planned_cost_budget": "28000.00",
    "currency": "USD",
    "planned_hourly_cost_rate": "75.0000",
    "estimated_remaining_hours": "140.00",
    "expected_remaining_expenses": "0.00",
    "assigned_user_ids": ["u-101", "u-102"]
  }
  ```
  *(Note: `estimated_remaining_hours` is nullable; omit or pass `null` if unknown).*
- **Success Response:** `201 Created`
- **Error Responses:**
  - `400 Bad Request`: Negative numbers, duplicate `code`, or non-existent `client_id`.
  - `403 Forbidden`: Attempted by `TEAM_MEMBER`.

### 4.3 Update Project Baselines & Estimates
- **Endpoint:** `PUT /api/v1/projects/{id}/`
- **Allowed Roles:** `AGENCY_MANAGER` strictly.
- **Purpose:** Update scope estimates (`estimated_remaining_hours`, `expected_remaining_expenses`) and budgets as delivery progresses. Passing `"estimated_remaining_hours": null` explicitly marks the estimate as unknown.

---

## 5. Time Entry Endpoints

### 5.1 List Time Entries
- **Endpoint:** `GET /api/v1/time-entries/`
- **Allowed Roles:**
  - `AGENCY_MANAGER`: Can view and filter entries across any project and any user (`?project_id=&user_id=&date_from=&date_to=`).
  - `TEAM_MEMBER`: Strictly scoped to their own time entries.
- **Success Response:** `200 OK`
  ```json
  {
    "count": 1,
    "results": [
      {
        "id": "te-201",
        "project_id": "p-10",
        "project_name": "Customer Portal Redesign",
        "user_id": "u-102",
        "user_name": "Alex Mercer",
        "date": "2026-10-15",
        "hours_worked": "6.50",
        "description": "Implemented dashboard metrics widgets",
        "created_at": "2026-10-15T17:30:00Z"
      }
    ]
  }
  ```
  *(Note: `cost_rate_snapshot` is omitted from team member responses).*

### 5.2 Log Time Entry
- **Endpoint:** `POST /api/v1/time-entries/`
- **Allowed Roles:** Authenticated (`AGENCY_MANAGER` or assigned `TEAM_MEMBER`).
- **Request Body:**
  ```json
  {
    "project_id": "p-10",
    "date": "2026-10-17",
    "hours_worked": "4.25",
    "description": "API contract review and financial formulas documentation"
  }
  ```
- **Backend Behavior:** The server injects `request.user.id` and looks up their current `default_hourly_cost_rate` to persist `cost_rate_snapshot`.
- **Success Response:** `201 Created`
- **Error Responses:**
  - `400 Bad Request`: `hours_worked <= 0.0` or `hours_worked > 24.0`, or future date beyond limit.
  - `403 Forbidden`: User is not assigned to the specified project.

### 5.3 Edit / Delete Time Entry
- **Endpoint:** `PUT /api/v1/time-entries/{id}/` / `DELETE /api/v1/time-entries/{id}/`
- **Allowed Roles:**
  - `AGENCY_MANAGER`: Permitted across all entries.
  - `TEAM_MEMBER`: Permitted only for their own unbilled entries.

---

## 6. Expense Management Endpoints

### 6.1 Submit Expense
- **Endpoint:** `POST /api/v1/expenses/`
- **Allowed Roles:** Authenticated user assigned to the project.
- **Request Body:**
  ```json
  {
    "project_id": "p-10",
    "category": "SOFTWARE_LICENSE",
    "amount": "149.00",
    "description": "Monthly cloud staging server allocation",
    "receipt_reference": "https://receipts.example.com/rec-8812.pdf"
  }
  ```
- **Backend Behavior:** Initializes status to `PENDING`.
- **Success Response:** `201 Created`

### 6.2 Approve Expense
- **Endpoint:** `POST /api/v1/expenses/{id}/approve/`
- **Allowed Roles:** `AGENCY_MANAGER` strictly.
- **Request Body:** None (or optional approval note).
- **Success Response:** `200 OK`
  ```json
  {
    "id": "exp-301",
    "status": "APPROVED",
    "approved_by": "Sarah Connor",
    "approved_at": "2026-10-17T14:10:00Z"
  }
  ```
- **Error Responses:**
  - `403 Forbidden`: Called by a `TEAM_MEMBER`.
  - `422 Unprocessable Entity`: Expense is already `APPROVED` or was previously `REJECTED`.

### 6.3 Reject Expense
- **Endpoint:** `POST /api/v1/expenses/{id}/reject/`
- **Allowed Roles:** `AGENCY_MANAGER` strictly.
- **Request Body:**
  ```json
  {
    "rejection_reason": "Out-of-scope personal peripheral purchase."
  }
  ```
- **Validation Rule:** `rejection_reason` is mandatory and cannot be empty.
- **Success Response:** `200 OK`

---

## 7. Financial Summary & Dashboard Endpoints

### 7.1 Agency Dashboard Summary
- **Endpoint:** `GET /api/v1/dashboard/summary/`
- **Allowed Roles:** `AGENCY_MANAGER` strictly.
- **Purpose:** Aggregate view across all active agency projects.
- **Success Response:** `200 OK`
  ```json
  {
    "active_projects_count": 8,
    "total_contract_revenue": "320000.00",
    "total_planned_cost_budget": "195000.00",
    "total_actual_cost_to_date": "112450.00",
    "projects_at_risk_count": 2,
    "projects_over_budget_count": 1,
    "pending_expenses_count": 5,
    "pending_expenses_amount": "3450.00"
  }
  ```

### 7.2 Project Financial Summary
- **Endpoint:** `GET /api/v1/projects/{id}/financial-summary/`
- **Allowed Roles:** `AGENCY_MANAGER` strictly.
- **Purpose:** Authoritative real-time calculation of project financials and deterministic risk classification.

#### Case A: Complete Forecast Data Available
When `estimated_remaining_hours` is valid (e.g., `140.00` hrs):
- **Success Response:** `200 OK`
  ```json
  {
    "project_id": "p-10",
    "project_name": "Customer Portal Redesign",
    "project_code": "PRJ-CP",
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
        "Projected final cost ($26,200.00) is within planned budget ($28,000.00).",
        "Budget consumption is at 56.07% (below 80.0% warning threshold)."
      ]
    },
    "assumptions_and_metadata": {
      "expected_remaining_expenses_assumed_zero": true,
      "warning_threshold_percentage": "80.0"
    }
  }
  ```

#### Case B: Missing Remaining Hours Estimate (`null`)
When `estimated_remaining_hours` is `null` and actual spending has not breached budget ($C_{actual} \le B$):
- **Success Response:** `200 OK`
  ```json
  {
    "project_id": "p-10",
    "project_name": "Customer Portal Redesign",
    "project_code": "PRJ-CP",
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
      "pending_expense_cost": "450.00",
      "budget_consumption_percentage": "56.07"
    },
    "forecast": {
      "forecast_available": false,
      "estimated_remaining_labor_cost": null,
      "projected_final_cost": null,
      "projected_profit": null,
      "projected_profit_margin_percentage": null,
      "reason_unavailable": "Estimated remaining hours is null (unknown). Forward-looking projections are unavailable."
    },
    "risk": {
      "status": "insufficient_data",
      "reasons": [
        "Actual spending ($15,700.00) has not exceeded budget ($28,000.00).",
        "Estimated remaining hours is unknown (null); reliable forecasting is impossible."
      ]
    },
    "assumptions_and_metadata": {
      "expected_remaining_expenses_assumed_zero": true,
      "warning_threshold_percentage": "80.0"
    }
  }
  ```

---

## 8. AI Risk Advisor Endpoint

### 8.1 Request AI Risk Analysis
- **Endpoint:** `POST /api/v1/projects/{id}/ai-risk-analysis/`
- **Allowed Roles:** `AGENCY_MANAGER` strictly.
- **Purpose:** Invoke Google Gemini server-side to generate plain-language risk explanations and actionable mitigation steps grounded strictly in calculated metrics.
- **Request Body:** Optional configuration:
  ```json
  {
    "focus_area": "BUDGET_RECOVERY"
  }
  ```
- **Success Response:** `200 OK`
  ```json
  {
    "project_id": "p-10",
    "deterministic_status": "at_risk",
    "ai_advisor": {
      "executive_summary": "Project PRJ-CP is currently at risk of exceeding its planned delivery budget by $1,800.00 despite currently having consumed only 60% of funds.",
      "primary_risk_drivers": [
        "Remaining work (140 hours) at $75/hr will require $10,500.00 in labor, pushing projected costs over the $28,000.00 ceiling.",
        "Unapproved expenses of $450.00 are currently in review; if approved, overrun will increase to $2,250.00."
      ],
      "actionable_recommendations": [
        "Conduct a scope reduction triage for the remaining 140 hours to identify non-critical tasks.",
        "Reassign remaining front-end QA tasks to a lower-cost tier resource where appropriate.",
        "Negotiate an addendum for scope change with client Acme Corp to expand contract revenue."
      ],
      "data_gaps_and_assumptions": [
        "Assuming remaining hours estimate of 140 hrs was updated within the last 7 calendar days.",
        "Assumes no further scope additions without change orders."
      ]
    },
    "generated_at": "2026-10-17T14:15:22Z"
  }
  ```
- **Error Responses:**
  - `403 Forbidden`: Team member attempting to access financial AI.
  - `503 Service Unavailable`: Gemini API timeout or quota exceeded (accompanied by standard fallback message).
