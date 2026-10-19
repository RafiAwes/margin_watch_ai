# MarginWatch — Comprehensive Testing Strategy & Test Scenarios

**Document Status:** Test Strategy Blueprint & Verification Log  
**Last Updated:** October 2026  
**Audience:** QA Engineers, Backend Engineers, Frontend Developers  
**Architecture Authority:** [ADR-001: Initial Architecture](decisions/ADR-001-initial-architecture.md) | [ADR-002: Single-Agency Architecture](decisions/ADR-002-single-agency-architecture.md)  
**Financial Rules Authority:** [docs/financial-rules.md](financial-rules.md) | [ADR-003: Financial Rules](decisions/ADR-003-financial-rules-and-risk-classification.md)

---

## 1. Testing Philosophy & Test Pyramid

MarginWatch enforces zero tolerance for financial calculation inaccuracies and data leakage. The testing strategy follows a **bottom-heavy test pyramid**, focusing heavily on deterministic unit tests using Python 3.15 and strict server-side authorization boundaries.

```
       /\
      /  \      Frontend Workflow Tests (Playwright / Integration - Planned Phase 6)
     /----\     - Key user journeys, login, forms, state transitions
    /      \
   /--------\   API & Integration Tests (DRF APITestCase - Executed & Planned)
  /          \  - Auth, RBAC, OLAC, expense state machine, AI fallback
 /------------\
/ Pure Unit    \ Unit Tests (Pure Python 3.15 / Decimal Services - Planned Phase 5)
/ Tests         \ - Financial formulas, boundary values, zero divisions, rounding
-----------------
```

### Core Testing Pillars
1. **Single-Agency Security Isolation:** Tests verify that the single agency's records are protected through role-based access (`MANAGER` vs `TEAM_MEMBER`), object-level access control (`ProjectAssignment`), and serializer field masking.
2. **Deterministic Verification:** Every financial test asserts exact penny matches using `Decimal('XX.XX')`. Binary floating-point assertions (`assertAlmostEqual`) are prohibited.
3. **Execution Status Clarity:** This document explicitly distinguishes between **executed test suites** (verified against live database) and **planned test suites** (formal specifications for future development phases).

---

## 2. Execution Status Log: Executed vs. Planned

| Test Suite Category | Implementation Phase | Execution Status | Pass Rate | Test Runner Command |
| :--- | :---: | :---: | :---: | :--- |
| **Authentication & Profile Masking** | Phase 2 / Phase 3 | **EXECUTED** | **100% (8/8 Passed)** | `python manage.py test users --keepdb` |
| **Model Validation & Integrity Constraints** | Phase 2 | **PLANNED** | Not yet run | `python manage.py test core.tests.test_models` |
| **Project Assignment & Revocation** | Phase 3 | **PLANNED** | Not yet run | `python manage.py test core.tests.test_assignments` |
| **Time Entry & Snapshot Immutability** | Phase 4 | **PLANNED** | Not yet run | `python manage.py test core.tests.test_time_entries` |
| **Expense State Machine & Approval** | Phase 4 | **PLANNED** | Not yet run | `python manage.py test core.tests.test_expenses` |
| **Financial Engine & Benchmark Scenarios** | Phase 6 | **VERIFIED** | 31 pure tests (no DB) + 6 selector + 13 API tests pass (Oct 19, 2026) | `python manage.py test profitability` (pure only: `profitability.tests.test_services`) |
| **AI Risk Advisor Resilience & Fallback** | Phase 8 | **VERIFIED** | TC-AI-01…05 + sanitization, grounding, caching, throttling: 38 tests pass with a mocked Gemini (Oct 19, 2026) | `python manage.py test ai_advisor` · live evaluation: `python manage.py evaluate_ai_advisor` |

---

## 3. Executed Test Suite: Authentication & User Governance

The following 8 test cases have been **fully executed and verified** in `backend/users/tests.py`:

| Test ID | Category | Scenario / Input Condition | Verified Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC-AUTH-01** | Authentication | Valid Manager credentials (`POST /api/v1/auth/login/`) | HTTP 200 OK; access & refresh tokens issued; user metadata returned. | **PASSED** |
| **TC-AUTH-02** | Authentication | Invalid password supplied | HTTP 401 Unauthorized returned. | **PASSED** |
| **TC-AUTH-03** | Inactive User | Inactive account (`is_active = False`) attempts login | HTTP 401 Unauthorized; token issuance strictly blocked. | **PASSED** |
| **TC-AUTH-04** | Token Rotation | Renew token via `POST /api/v1/auth/refresh/` using `refresh` or `refresh_token` | HTTP 200 OK; fresh access token issued. | **PASSED** |
| **TC-AUTH-05** | Auth Guard | Unauthenticated request to `GET /api/v1/auth/me/` | HTTP 401 Unauthorized; protected endpoint guarded. | **PASSED** |
| **TC-AUTH-06** | Data Visibility | Manager queries own profile (`GET /api/v1/auth/me/`) | HTTP 200 OK; `default_hourly_cost_rate` is visible ($125.0000). | **PASSED** |
| **TC-AUTH-07** | Data Masking | Team Member queries own profile (`GET /api/v1/auth/me/`) | HTTP 200 OK; `default_hourly_cost_rate` is **strictly omitted**. | **PASSED** |
| **TC-AUTH-08** | Usability | Case-insensitive email login (`MANAGER@AGENCY.COM`) | HTTP 200 OK; email normalized lowercase. | **PASSED** |

---

## 4. Planned Test Scenarios

### 4.1 Model Validation & Database Constraints (Planned Phase 2)

| Test ID | Scenario Description | Target Model | Expected Result | Priority |
| :--- | :--- | :--- | :--- | :---: |
| **TC-MOD-01** | Negative monetary amounts | `Project`, `Expense` | Rejection on save with `ValidationError` (`>= 0.00`). | **P0** |
| **TC-MOD-02** | Zero or negative recorded hours | `TimeEntry` | Rejection on save with `ValidationError` (`recorded_hours > 0.00`). | **P0** |
| **TC-MOD-03** | Excessive recorded hours (> 24.0) | `TimeEntry` | Rejection on save with `ValidationError` (`recorded_hours <= 24.00`). | **P1** |
| **TC-MOD-04** | Null estimate representation | `Project` | `estimated_remaining_hours = None` persists as SQL `NULL`, not `0.00`. | **P0** |
| **TC-MOD-05** | Duplicate project assignment | `ProjectAssignment` | DB integrity error on duplicate `(project_id, user_id)`. | **P0** |
| **TC-MOD-06** | Orphan project creation | `Project` | FK constraint error if `client_id` is invalid or deleted. | **P0** |
| **TC-MOD-07** | Cascade deletion protection | `Client` with projects | `models.ProtectedError` raised on attempt to delete client with active projects. | **P0** |
| **TC-MOD-08** | Inactive user assigned to project | `ProjectAssignment` | Serializer validation error rejecting assignment of inactive user. | **P1** |

### 4.2 Security, Permissions & Role Escalation Defense (Planned Phase 3)

| Test ID | Scenario Description | Expected Result | Priority |
| :--- | :--- | :--- | :---: |
| **TC-SEC-01** | Team member attempts to create or update project | HTTP 403 Forbidden (`IsManagerUser` blocks). | **P0** |
| **TC-SEC-02** | Team member attempts to self-elevate role via `PATCH /auth/me/` | HTTP 200 OK, but `role` attribute is ignored and remains `TEAM_MEMBER`. | **P0** |
| **TC-SEC-03** | Team member queries project list `GET /api/v1/projects/` | Only assigned projects returned; financial baselines and margins masked. | **P0** |
| **TC-SEC-04** | Team member attempts to log time to unassigned project | HTTP 403 Forbidden (`User not assigned to target project`). | **P0** |
| **TC-SEC-05** | Team member attempts to update another member's time entry | HTTP 403 Forbidden or 404 Not Found (IDOR defense). | **P0** |
| **TC-SEC-06** | Team member queries time entries `GET /api/v1/time-entries/` | Queryset filtered strictly to own entries; `hourly_cost_snapshot` omitted. | **P0** |
| **TC-SEC-07** | Team member attempts to approve or reject an expense | HTTP 403 Forbidden. | **P0** |
| **TC-SEC-08** | Team member attempts to trigger AI Risk Advisor | HTTP 403 Forbidden. | **P0** |
| **TC-SEC-09** | Manager queries unassigned project | HTTP 200 OK; Managers hold global access across single agency. | **P1** |
| **TC-SEC-10** | Assignment revocation effect | Revoking assignment immediately bars team member from future time/expense logs. | **P0** |

### 4.3 Time Entry & Expense State Machine Tests (Planned Phase 4)

| Test ID | Scenario Description | Expected Result | Priority |
| :--- | :--- | :--- | :---: |
| **TC-EXP-01** | New expense submission | Status initializes to `PENDING`. | **P0** |
| **TC-EXP-02** | Manager approves expense | Status transitions to `APPROVED`; `reviewed_by` and `reviewed_at` populated. | **P0** |
| **TC-EXP-03** | Manager rejects expense without note | Rejection with HTTP 400 Bad Request (`review_note is mandatory`). | **P0** |
| **TC-EXP-04** | Manager rejects expense with valid note | Status transitions to `REJECTED`; `review_note` recorded. | **P0** |
| **TC-EXP-05** | Modifying approved expense | Rejection with HTTP 422 Unprocessable Entity (amount & category immutable). | **P0** |
| **TC-TIME-01**| Rate snapshot immutability | User profile rate modified from $65 to $90; historical time entry retains $65 snapshot. | **P0** |
| **TC-TIME-02**| Planned project rate change | Project planned rate changed from $75 to $100; past time entry costs remain unchanged. | **P0** |

### 4.4 Financial Calculations & Risk Precedence (Planned Phase 5)

The 5 authoritative numerical benchmark scenarios from [`docs/financial-rules.md`](financial-rules.md):

| Test ID | Scenario Name | Inputs | Expected Calculations | Expected Status | Priority |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-NUM-01** | Healthy Project | $R = \$10k, B = \$6k, C_{actual} = \$2k, H_{rem} = 40h, C_{hourly} = \$50$ | $P_{consumed} = 33.33\%, C_{projected} = \$4,000.00, P_{profit} = \$6,000.00$ | `healthy` | **P0** |
| **TC-NUM-02** | Forecast Over Budget | $R = \$10k, B = \$6k, C_{actual} = \$4k, H_{rem} = 50h, C_{hourly} = \$50$ | $P_{consumed} = 66.67\%, C_{projected} = \$6,500.00, P_{profit} = \$3,500.00$ | `at_risk` | **P0** |
| **TC-NUM-03** | Already Over Budget | $R = \$10k, B = \$6k, C_{actual} = \$6.2k, H_{rem} = \text{null}$ | $P_{consumed} = 103.33\%, C_{projected} = \text{null}, P_{profit} = \text{null}$ | `over_budget` (Rule 1 priority) | **P0** |
| **TC-NUM-04** | Missing Estimate | $R = \$10k, B = \$6k, C_{actual} = \$2k, H_{rem} = \text{null}$ | $P_{consumed} = 33.33\%, C_{projected} = \text{null}, P_{profit} = \text{null}$ | `insufficient_data` (Rule 2) | **P0** |
| **TC-NUM-05** | Consumption Warning | $R = \$10k, B = \$6k, C_{actual} = \$4.9k, H_{rem} = 10h, C_{hourly} = \$50$ | $P_{consumed} = 81.67\%, C_{projected} = \$5,400.00$ | `at_risk` (80% heuristic on) | **P0** |
| **TC-NUM-06** | Zero Remaining Hours | $R = \$10k, B = \$6k, C_{actual} = \$4k, H_{rem} = 0.0$ | $C_{rem\_labor} = \$0.00, C_{projected} = \$4,000.00$ | `healthy` | **P0** |
| **TC-NUM-07** | Zero Budget Edge Case | $B = 0.00$ | Division by zero prevented; returns explicit warning. | `insufficient_data` | **P0** |
| **TC-NUM-08** | Approved vs Unapproved | $1,000 approved, $500 pending, $200 rejected | $C_{expense} = \$1,000.00$. Pending & rejected excluded from $C_{actual}$. | Reconciled | **P0** |

### 4.5 Demo Seed Repeatability & Reconciliation (Planned Phase 2 / Phase 5)

| Test ID | Category | Scenario / Input Condition | Expected Result | Priority |
| :--- | :--- | :--- | :--- | :---: |
| **TC-SEED-01**| Seed Idempotency | Execute `seed_demo_data` command twice consecutively | Second execution reports existing records without creating duplicates. | **P0** |
| **TC-SEED-02**| Financial Reconciliation | Sum time entries and approved expenses in demo seed | Sum equals the reported project actual cost totals to the exact cent. | **P0** |

### 4.6 AI Risk Advisor Resilience (Planned Phase 7)

| Test ID | Category | Scenario / Input Condition | Expected Result | Priority |
| :--- | :--- | :--- | :--- | :---: |
| **TC-AI-01** | AI Advisor | Mock Gemini API responds with valid structured JSON | HTTP 200 OK with parsed summary, drivers, and recommendations. | **P0** |
| **TC-AI-02** | AI Advisor | Mock Gemini API times out after 10 seconds | HTTP 503 Service Unavailable; deterministic financial summary intact. | **P0** |
| **TC-AI-03** | AI Advisor | Mock Gemini API returns HTTP 429 Quota Exceeded | HTTP 503 Service Unavailable with quota notice. | **P1** |
| **TC-AI-04** | AI Advisor | Mock Gemini API returns malformed or non-JSON text | HTTP 502 Bad Gateway; server handles gracefully without crashing. | **P1** |
| **TC-AI-05** | Guardrail | Verify AI response cannot execute database writes | Database records remain completely unaltered after AI invocation. | **P0** |
