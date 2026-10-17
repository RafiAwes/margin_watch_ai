# MarginWatch — Security Architecture & Permissions Specification

**Document Status:** Security Blueprint (Phase 0)  
**Last Updated:** October 2026  
**Audience:** Security Engineers, Backend Architects, Full-Stack Developers  

---

## 1. Security Philosophy & Golden Rule

> [!CAUTION]
> **Core Architectural Security Law:**  
> The client-side application (Next.js frontend) must **NEVER** be treated as the authority for user identity, role assignment, project ownership, business validation, or financial calculations.  
> Every security boundary, authorization check, and mathematical computation must be verified server-side on every single request.

---

## 2. Role & Permission Matrix

MarginWatch enforces a strict Role-Based Access Control (RBAC) model combined with Object-Level Access Control (OLAC).

| Capability / Action | Unauthenticated | Team Member | Agency Manager | Enforced At |
| :--- | :---: | :---: | :---: | :--- |
| **Login / Obtain Auth Token** | Allowed | Allowed | Allowed | `POST /api/v1/auth/login/` |
| **View Own Profile** | Denied | Allowed | Allowed | `GET /api/v1/auth/me/` |
| **View Assigned Projects** | Denied | Allowed (Assigned Only) | Allowed (All) | `GET /api/v1/projects/` |
| **Create / Archive Clients** | Denied | Denied | Allowed | `/api/v1/clients/` |
| **Create Projects & Set Budgets** | Denied | Denied | Allowed | `POST /api/v1/projects/` |
| **Update Project Baseline / Budget**| Denied | Denied | Allowed | `PUT /api/v1/projects/{id}/` |
| **View Project Financial Summary** | Denied | Denied | Allowed | `GET /api/v1/projects/{id}/financial-summary/` |
| **View Agency Dashboard** | Denied | Denied | Allowed | `GET /api/v1/dashboard/summary/` |
| **Log Time Entry** | Denied | Allowed (Assigned Only)| Allowed | `POST /api/v1/time-entries/` |
| **Edit / Delete Own Time Entry** | Denied | Allowed (Own Only) | Allowed | `PUT, DELETE /api/v1/time-entries/{id}/` |
| **Edit / Delete Other's Time Entry**| Denied | Denied | Allowed | `PUT, DELETE /api/v1/time-entries/{id}/` |
| **View Historical Cost Snapshots** | Denied | Denied | Allowed | Serializer Field Filter |
| **Submit Project Expense** | Denied | Allowed (Assigned Only)| Allowed | `POST /api/v1/expenses/` |
| **Approve / Reject Expense** | Denied | Denied | Allowed | `POST /api/v1/expenses/{id}/approve/` |
| **Trigger AI Risk Analysis** | Denied | Denied | Allowed | `POST /api/v1/projects/{id}/ai-risk-analysis/` |

---

## 3. Object-Level Access Control (OLAC)

Role check alone is insufficient. An agency team member must not be capable of reading or modifying time entries for projects they do not belong to (Insecure Direct Object Reference - IDOR protection).

### 3.1 Project Boundary Enforcement
```python
# Conceptual implementation pattern (DRF BasePermission)
class IsProjectMemberOrManager(permissions.BasePermission):
    """
    Enforces that Managers can access any project,
    while Team Members can only access projects where membership is active.
    """
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'AGENCY_MANAGER':
            return True
        return obj.memberships.filter(user=request.user).exists()
```

### 3.2 Time Entry Ownership
- A `TEAM_MEMBER` can update or delete a time entry if and only if `entry.user_id == request.user.id`.
- If a team member attempts to edit an entry logged by another team member, the API returns `403 Forbidden` (or `404 Not Found` to prevent entity enumeration).

---

## 4. Financial Information Masking & Data Minimization

Small software agencies maintain sensitivity around internal compensation and profit margins:
1. **Wage Rate Concealment:** Team members must never see other members' `default_hourly_cost_rate` or the `cost_rate_snapshot` recorded on time entries. Serializers for team members explicitly omit cost snapshot fields.
2. **Profit & Revenue Masking:** Project listings (`GET /api/v1/projects/`) serialize `contract_revenue`, `planned_cost_budget`, and `projected_profit` only when `request.user.role == 'AGENCY_MANAGER'`.
3. **AI Context Minimization:** When assembling the payload for the external Google Gemini API, the backend:
   - Strips client contact names, emails, and phone numbers.
   - Strips employee individual names and personal IDs.
   - Sends only project code, anonymized metrics (revenue, budget, burn %, remaining hours), and category-level expense aggregations.

---

## 5. Secrets Management & Environment Hygiene

```
┌─────────────────────────────────────────────────────────────┐
│                     SOURCE CODE REPO                        │
│  - No .env files                                           │
│  - Only .env.example with safe placeholders                 │
└─────────────────────────────────────────────────────────────┘
                               ▲
                               │
               Never committed │ Local / Deployment Injection
                               │
┌──────────────────────────────┴──────────────────────────────┐
│                    ENVIRONMENT VARIABLES                    │
│                                                             │
│  SERVER-SIDE ONLY (Private):                                │
│    - DJANGO_SECRET_KEY                                      │
│    - DB_PASSWORD                                            │
│    - GEMINI_API_KEY  <-- NEVER EXPOSED TO CLIENT            │
│                                                             │
│  CLIENT-SIDE (Publicly Inlined by Next.js):                 │
│    - NEXT_PUBLIC_API_BASE_URL (URL only)                   │
└─────────────────────────────────────────────────────────────┘
```

1. **Strict Key Encapsulation:** The Google Gemini API key is accessed exclusively by Django's backend AI service. It is never prefixed with `NEXT_PUBLIC_` and never transmitted to the client.
2. **Secret Rotation Protocol:** If a `.env` secret is accidentally exposed, it must be invalidated immediately via the provider dashboard (Google Cloud Console, database console), rotated, and committed history scrubbed with `git-filter-repo`.

---

## 6. Web Security & Threat Defenses

### 6.1 Authentication & Password Security
- Passwords must be hashed using Django's default PBKDF2 with SHA-256 (or Argon2) with high work factors.
- Password policies enforce minimum length of 10 characters and complexity validation (rejecting common passwords and numeric sequences).
- Authentication tokens must be time-limited and refreshable via secure refresh endpoints.

### 6.2 Cross-Origin Resource Sharing (CORS) & CSRF
- `django-cors-headers` is configured with an explicit whitelist (`CORS_ALLOWED_ORIGINS`). Wildcards (`*`) are prohibited in production.
- For session-based authentication, CSRF tokens are enforced on all unsafe HTTP methods (`POST`, `PUT`, `DELETE`, `PATCH`).

### 6.3 Rate Limiting & Denial of Service
- API endpoints are throttled using DRF's throttling framework:
  - `auth` endpoints (Login): 5 requests/minute per IP to prevent brute-force credential stuffing.
  - `ai-risk-analysis` endpoints: 10 requests/hour per user to control external API costs and quota exhaustion.
  - Standard CRUD endpoints: 120 requests/minute per user.

### 6.4 Safe Error Reporting
- Production environments enforce `DJANGO_DEBUG=False`.
- Unhandled exceptions trigger a generic `500 Internal Server Error` envelope without exposing stack traces, database schema details, or Python module paths to client consumers.
