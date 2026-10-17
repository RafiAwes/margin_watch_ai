# MarginWatch — Comprehensive Testing Strategy & Test Scenarios

**Document Status:** Test Strategy Blueprint — Not Yet Executed (Phase 0)  
**Last Updated:** October 2026  
**Audience:** QA Engineers, Backend Engineers, Frontend Developers  

> [!NOTE]
> This document defines the testing strategy, test pyramid, and high-priority scenario matrix for MarginWatch. No tests have been executed at this stage, as application code has not yet been implemented.

---

## 1. Testing Philosophy & Test Pyramid

Financial and watchdog systems require rigorous verification. MarginWatch emphasizes a **bottom-heavy test pyramid**, focusing the largest volume of tests on pure mathematical calculation logic and server-side authorization boundaries.

```
       /\
      /  \      Frontend Workflow Tests (E2E / Integration)
     /----\     - Key user journeys, login, forms, state transitions
    /      \
   /--------\   API & Integration Tests (DRF APITestCase)
  /          \  - Auth, RBAC, OLAC, expense state machine, AI fallback
 /------------\
/ Pure Unit    \ Unit Tests (Pure Python / Decimal Services)
/ Tests         \ - Financial formulas, boundary values, zero divisions, rounding
-----------------
```

### Core Testing Pillars
1. **Financial Rule Isolation:** The financial calculation engine is built as pure, side-effect-free Python functions. It is thoroughly verified with unit tests independent of database setup or HTTP mocking.
2. **Deterministic Verification:** Every financial test asserts exact penny matches using `Decimal('XX.XX')`. Floating-point assertions (`assertAlmostEqual`) are prohibited.
3. **Security Boundary Coverage:** Every endpoint is tested against both positive and negative authorization cases (unauthenticated, wrong role, cross-tenant/cross-user IDOR attempts).
4. **Resilient AI Simulation:** External AI provider dependencies (Google Gemini) are always mocked in automated test suites to simulate timeouts, rate limits, and malformed outputs without incurring API costs or network flakiness.

---

## 2. Test Types & Scope

### 2.1 Unit Tests (Financial Engine)
- Validate all mathematical equations from [`docs/financial-rules.md`](financial-rules.md).
- Test rounding behaviors (`ROUND_HALF_UP`) and precision preservation.
- Verify precedence hierarchy across `HEALTHY`, `AT_RISK`, `OVER_BUDGET`, and `INSUFFICIENT_DATA`.
- Test boundary conditions: zero revenue, zero budget, zero hours, missing remaining estimates.

### 2.2 API Validation & Constraint Tests
- Verify serializer rejection of invalid inputs: negative hours, hours $> 24.0$, negative expenses, malformed emails.
- Verify required field presence and clear error message formats.

### 2.3 Authentication & Authorization Tests
- Test access token issuance, token expiration, and invalid credential rejections.
- Role-Based Access: Verify team members receive HTTP 403 when calling manager-only endpoints (project creation, budget changes, expense approvals, AI advisor).
- Object-Level Access: Verify team members cannot query or modify time entries belonging to other users or log time to unassigned projects.

### 2.4 Expense State Machine Tests
- Verify new expenses start in `PENDING`.
- Verify only managers can trigger `/approve/` and `/reject/`.
- Verify rejecting an expense requires a non-empty `rejection_reason`.
- Verify that `PENDING` and `REJECTED` expenses are mathematically excluded from `actual_total_cost`.
- Verify approved expenses cannot have their amount or category mutated.

### 2.5 AI Risk Advisor Integration & Fallback Tests
- Test normal flow with mocked successful Gemini JSON response.
- Test external timeout (simulating 10s socket timeout) $\rightarrow$ asserts HTTP 503 response and ensures deterministic financial metrics remain viewable.
- Test external HTTP 429 (rate limit exceeded) $\rightarrow$ asserts graceful error message.
- Test malformed or hallucinatory JSON from AI $\rightarrow$ asserts schema validation failure and safe fallback.

### 2.6 Frontend Workflow Tests (Planned for Phase 6)
- Test end-to-end user flows in Next.js:
  - Manager logs in, views dashboard, inspects at-risk project, reviews and approves an expense, and sees immediate budget recalculation.
  - Team member logs in, logs 4 hours to Project Alpha, verifies their logged hours, and confirms financial budgets are not visible.

---

## 3. High-Priority Test Scenario Matrix

| Test ID | Category | Scenario / Input Condition | Expected Result | Priority |
| :--- | :--- | :--- | :--- | :---: |
| **TC-FIN-01** | Financial Unit | Zero planned budget ($B = 0.00$) | Budget consumption returns `null`; status evaluates to `INSUFFICIENT_DATA`. No division by zero. | **P0** |
| **TC-FIN-02** | Financial Unit | Zero contract revenue ($R = 0.00$) | Profit margin % returns `null`; net profit calculated accurately ($0 - C_{projected}$). No exception. | **P0** |
| **TC-FIN-03** | Financial Unit | Missing estimated remaining hours ($H_{rem} = \text{null}$) | Forecast metrics return `null`; status evaluates to `INSUFFICIENT_DATA`. | **P0** |
| **TC-FIN-04** | Financial Unit | Actual total cost exceeds planned budget ($C_{actual} > B$) | Status evaluates strictly to `OVER_BUDGET` regardless of remaining estimates. | **P0** |
| **TC-FIN-05** | Financial Unit | $C_{actual} \le B$, but $C_{projected} > B$ | Status evaluates to `AT_RISK` (early warning of forecast overrun). | **P0** |
| **TC-FIN-06** | Financial Unit | $C_{actual} \le B$, $C_{projected} \le B$, but $P_{consumed} \ge 80.0\%$ | Status evaluates to `AT_RISK` (consumption threshold heuristic). | **P0** |
| **TC-FIN-07** | Financial Unit | Multiple entries with differing historic cost snapshots | $C_{labor}$ equals exact sum of products; reflects historical rates, not current user rate. | **P0** |
| **TC-EXP-01** | Expense Logic | Submit expense, calculate financials while `PENDING` | Amount is completely excluded from $C_{actual}$ and $P_{consumed}$. | **P0** |
| **TC-EXP-02** | Expense Logic | Approve expense as `AGENCY_MANAGER` | Status transitions to `APPROVED`; amount immediately reflected in $C_{actual}$. | **P0** |
| **TC-EXP-03** | Expense Logic | Reject expense without providing `rejection_reason` | Request rejected with HTTP 400 validation error; status remains `PENDING`. | **P1** |
| **TC-EXP-04** | Expense Logic | Attempt to approve expense as `TEAM_MEMBER` | Request rejected with HTTP 403 Forbidden; status remains unchanged. | **P0** |
| **TC-SEC-01** | Authorization | Team member attempts to log time to unassigned project | Request rejected with HTTP 403 Forbidden. | **P0** |
| **TC-SEC-02** | Authorization | Team member attempts to update another member's time entry | Request rejected with HTTP 403 Forbidden or 404 Not Found (IDOR defense). | **P0** |
| **TC-SEC-03** | Data Masking | Team member queries project list `GET /api/v1/projects/` | Response excludes `contract_revenue`, `planned_cost_budget`, and profit margins. | **P0** |
| **TC-SEC-04** | Data Masking | Team member queries time entries `GET /api/v1/time-entries/` | Response excludes `cost_rate_snapshot`. | **P0** |
| **TC-VAL-01** | Input Validation| Submit time entry with `hours_worked = -2.5` or `0.0` | HTTP 400 Bad Request with field validation error. | **P0** |
| **TC-VAL-02** | Input Validation| Submit time entry with `hours_worked = 25.0` | HTTP 400 Bad Request ("Maximum 24 hours per entry"). | **P1** |
| **TC-VAL-03** | Input Validation| Submit expense with negative or zero amount | HTTP 400 Bad Request ("Amount must be greater than 0.00"). | **P0** |
| **TC-AI-01** | AI Advisor | Mock Gemini API responds with valid structured JSON | HTTP 200 OK with parsed executive summary, drivers, and recommendations. | **P0** |
| **TC-AI-02** | AI Advisor | Mock Gemini API times out after 10 seconds | HTTP 503 Service Unavailable with friendly fallback; financial summary remains intact. | **P0** |
| **TC-AI-03** | AI Advisor | Mock Gemini API returns HTTP 429 Quota Exceeded | HTTP 503 Service Unavailable with quota notification. | **P1** |
| **TC-AI-04** | AI Advisor | Mock Gemini API returns unparseable or schema-violating text | HTTP 502 Bad Gateway; server handles gracefully without crashing. | **P1** |
| **TC-AI-05** | AI Guardrail | Verify AI response cannot execute database writes | Mocked AI suggests changing budget; verify database remains unaltered. | **P0** |
