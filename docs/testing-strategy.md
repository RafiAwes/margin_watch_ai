# MarginWatch — Comprehensive Testing Strategy & Test Scenarios

**Document Status:** Test Strategy Blueprint — Planned Tests (Phase 0)  
**Last Updated:** October 2026  
**Audience:** QA Engineers, Backend Engineers, Frontend Developers  
**Financial Rules Authority:** [docs/financial-rules.md](financial-rules.md) | [ADR-002](decisions/ADR-002-financial-rules-and-risk-classification.md)

> [!NOTE]
> This document defines the testing strategy, test pyramid, and high-priority scenario matrix for MarginWatch. All test cases documented herein are planned specifications to be implemented during Phases 3 through 8. No tests have been executed at this stage, as application code has not yet been implemented.

---

## 1. Testing Philosophy & Test Pyramid

Financial watchdog systems require zero tolerance for calculation errors and security breaches. MarginWatch implements a **bottom-heavy test pyramid**, focusing heavily on pure mathematical unit tests using Python 3.15 and server-side authorization boundaries.

```
       /\
      /  \      Frontend Workflow Tests (Playwright / Integration)
     /----\     - Key user journeys, login, forms, state transitions
    /      \
   /--------\   API & Integration Tests (DRF APITestCase)
  /          \  - Auth, RBAC, OLAC, expense state machine, AI fallback
 /------------\
/ Pure Unit    \ Unit Tests (Pure Python 3.15 / Decimal Services)
/ Tests         \ - Financial formulas, boundary values, zero divisions, rounding
-----------------
```

### Core Testing Pillars
1. **Financial Rule Isolation:** The financial calculation engine is built as pure, side-effect-free Python functions (`backend/finance/services.py`). It is verified with isolated unit tests independent of database setup or HTTP mocking.
2. **Deterministic Verification:** Every financial test asserts exact penny matches using `Decimal('XX.XX')`. Floating-point assertions (`assertAlmostEqual`) are prohibited.
3. **Security Boundary Coverage:** Every endpoint is tested against both positive and negative authorization cases (unauthenticated, wrong role, cross-tenant/cross-user IDOR attempts).
4. **Resilient AI Simulation:** External AI provider dependencies (Google Gemini) are always mocked in automated test suites to simulate timeouts, rate limits, and malformed outputs without incurring API costs or network flakiness.

---

## 2. Test Types & Scope

### 2.1 Unit Tests (Financial Engine)
- Validate all mathematical equations from [`docs/financial-rules.md`](financial-rules.md).
- Test rounding behaviors (`ROUND_HALF_UP`) and precision preservation.
- Verify precedence hierarchy:
  1. `over_budget` ($C_{actual} > B$)
  2. `insufficient_data` ($B \le 0$ or $H_{rem}$ is `null`)
  3. `at_risk` ($C_{projected} > B$ or $P_{consumed} \ge 80.0\%$ with $H_{rem} > 0$)
  4. `healthy` ($C_{actual} \le B$ and $C_{projected} \le B$)
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
- Verify that `PENDING` and `REJECTED` expenses are mathematically excluded from `actual_expense_cost` and `actual_total_cost`.
- Verify approved expenses cannot have their amount, category, or project mutated.

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

## 3. Authoritative Numerical Benchmark Test Matrix

The following test cases directly verify the 5 authoritative numerical benchmark scenarios defined in [`docs/financial-rules.md`](financial-rules.md).

| Test ID | Scenario Name | Inputs | Expected Financial Calculations | Expected Risk Status | Priority |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-NUM-01** | Scenario 1: Healthy | $R = \$10,000.00$<br>$B = \$6,000.00$<br>$C_{actual} = \$2,000.00$<br>$H_{rem} = 40.0\text{ hrs}$<br>$C_{hourly} = \$50.00$<br>$E_{rem} = \$0.00$ | $P_{consumed} = 33.33\%$<br>$C_{rem\_labor} = \$2,000.00$<br>$C_{projected} = \$4,000.00$<br>$P_{profit} = \$6,000.00$<br>$M_{profit} = 60.00\%$ | `healthy` | **P0** |
| **TC-NUM-02** | Scenario 2: Forecast Over Budget | $R = \$10,000.00$<br>$B = \$6,000.00$<br>$C_{actual} = \$4,000.00$<br>$H_{rem} = 50.0\text{ hrs}$<br>$C_{hourly} = \$50.00$<br>$E_{rem} = \$0.00$ | $P_{consumed} = 66.67\%$<br>$C_{rem\_labor} = \$2,500.00$<br>$C_{projected} = \$6,500.00$<br>$P_{profit} = \$3,500.00$<br>$M_{profit} = 35.00\%$ | `at_risk`<br>(Reason: $C_{projected} > B$ by $500.00) | **P0** |
| **TC-NUM-03** | Scenario 3: Already Over Budget | $R = \$10,000.00$<br>$B = \$6,000.00$<br>$C_{actual} = \$6,200.00$<br>$H_{rem} = \text{null}$<br>$C_{hourly} = \$50.00$ | $P_{consumed} = 103.33\%$<br>$C_{rem\_labor} = \text{null}$<br>$C_{projected} = \text{null}$<br>$P_{profit} = \text{null}$<br>$M_{profit} = \text{null}$ | `over_budget`<br>(Rule 1 priority: takes precedence over missing $H_{rem}$) | **P0** |
| **TC-NUM-04** | Scenario 4: Missing Estimate | $R = \$10,000.00$<br>$B = \$6,000.00$<br>$C_{actual} = \$2,000.00$<br>$H_{rem} = \text{null}$<br>$C_{hourly} = \$50.00$ | $P_{consumed} = 33.33\%$ (Valid)<br>$C_{rem\_labor} = \text{null}$<br>$C_{projected} = \text{null}$<br>$P_{profit} = \text{null}$<br>$M_{profit} = \text{null}$ | `insufficient_data`<br>(Rule 2: within budget but forecast unknown) | **P0** |
| **TC-NUM-05** | Scenario 5: High Consumption Warning | $R = \$10,000.00$<br>$B = \$6,000.00$<br>$C_{actual} = \$4,900.00$<br>$H_{rem} = 10.0\text{ hrs}$<br>$C_{hourly} = \$50.00$<br>$E_{rem} = \$0.00$ | $P_{consumed} = 81.67\%$<br>$C_{rem\_labor} = \$500.00$<br>$C_{projected} = \$5,400.00$<br>$P_{profit} = \$4,600.00$<br>$M_{profit} = 46.00\%$ | `at_risk` (Warning heuristic on)<br>`healthy` (Warning heuristic off) | **P0** |

---

## 4. Edge-Case & Boundary Value Test Matrix

| Test ID | Category | Scenario / Input Condition | Expected Calculation / Behavior | Expected Risk Status | Priority |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-EDGE-01** | Boundary | Zero planned budget ($B = 0.00$) | $P_{consumed} = \text{null}$ (division by zero avoided). Warning returned. | `insufficient_data` | **P0** |
| **TC-EDGE-02** | Boundary | Zero contract revenue ($R = 0.00$, $B = \$5,000.00$) | $P_{profit} = -\$C_{projected}$. $M_{profit} = \text{null}$ (division by zero avoided). | `healthy` / `at_risk` relative to $B$ | **P0** |
| **TC-EDGE-03** | Boundary | Exactly 100% budget consumption ($C_{actual} = B = \$6,000.00$, $H_{rem} = 5.0$) | $P_{consumed} = 100.00\%$. $C_{projected} = \$6,250.00 > \$6,000.00$. | `at_risk` (forecast overrun) | **P0** |
| **TC-EDGE-04** | Boundary | Exactly 100% budget consumption, 0 remaining hours ($C_{actual} = B = \$6,000.00$, $H_{rem} = 0.0$) | $P_{consumed} = 100.00\%$. $C_{projected} = \$6,000.00 \le \$6,000.00$. | `at_risk` (if 80% warning heuristic triggers on $\ge 80\%$); or `healthy` if heuristic requires $H_{rem} > 0$. | **P1** |
| **TC-EDGE-05** | Validation | Negative hours worked ($H_{entry} = -3.5$) | API serializer rejects with HTTP 400 Bad Request. | N/A (Validation Error) | **P0** |
| **TC-EDGE-06** | Validation | Excessive hours worked ($H_{entry} = 25.0$) | API serializer rejects with HTTP 400 ("Max 24 hrs/day"). | N/A (Validation Error) | **P1** |
| **TC-EDGE-07** | Validation | Negative remaining hours ($H_{rem} = -10.0$) | API serializer rejects with HTTP 400 ("Remaining hours cannot be negative"). | N/A (Validation Error) | **P0** |
| **TC-EDGE-08** | Snapshot | Member's cost rate changes after time entry logged | $C_{labor}$ continues using `cost_rate_snapshot` from time entry creation time; historical audit preserved. | Preserved | **P0** |
| **TC-EDGE-09** | Segregation | Expenses in mixed states: $1,000 approved, $500 pending, $200 rejected | $C_{expense} = \$1,000.00$. Pending ($500) and rejected ($200) strictly excluded from $C_{actual}$. | Evaluated on $C_{actual} = C_{labor} + \$1,000$ | **P0** |
| **TC-EDGE-10** | Forecast | Explicit zero remaining hours ($H_{rem} = 0.0$) | $C_{rem\_labor} = \$0.00$. $C_{projected} = C_{actual} + E_{rem}$. Project complete. | `healthy` (if $C_{actual} \le B$) | **P0** |
| **TC-EDGE-11** | Forecast | Missing expected remaining expenses ($E_{rem} = \text{null}$) | Defaults to `$0.00` in MVP with explicit assumption metadata. | Evaluated normally | **P1** |

---

## 5. Security & Access Control Test Matrix

| Test ID | Category | Scenario / Input Condition | Expected Result | Priority |
| :--- | :--- | :--- | :--- | :---: |
| **TC-SEC-01** | Authorization | Team member attempts to log time to unassigned project | Request rejected with HTTP 403 Forbidden. | **P0** |
| **TC-SEC-02** | Authorization | Team member attempts to update another member's time entry | Request rejected with HTTP 403 Forbidden or 404 Not Found (IDOR defense). | **P0** |
| **TC-SEC-03** | Data Masking | Team member queries project list `GET /api/v1/projects/` | Response excludes `contract_revenue`, `planned_cost_budget`, and profit margins. | **P0** |
| **TC-SEC-04** | Data Masking | Team member queries time entries `GET /api/v1/time-entries/` | Response excludes `cost_rate_snapshot`. | **P0** |
| **TC-SEC-05** | Authorization | Team member attempts to approve an expense | Request rejected with HTTP 403 Forbidden. | **P0** |
| **TC-SEC-06** | Authorization | Team member attempts to trigger AI risk analysis | Request rejected with HTTP 403 Forbidden. | **P0** |

---

## 6. AI Risk Advisor Resilience Test Matrix

| Test ID | Category | Scenario / Input Condition | Expected Result | Priority |
| :--- | :--- | :--- | :--- | :---: |
| **TC-AI-01** | AI Advisor | Mock Gemini API responds with valid structured JSON | HTTP 200 OK with parsed executive summary, drivers, and recommendations. | **P0** |
| **TC-AI-02** | AI Advisor | Mock Gemini API times out after 10 seconds | HTTP 503 Service Unavailable with friendly fallback; financial summary remains intact. | **P0** |
| **TC-AI-03** | AI Advisor | Mock Gemini API returns HTTP 429 Quota Exceeded | HTTP 503 Service Unavailable with quota notification. | **P1** |
| **TC-AI-04** | AI Advisor | Mock Gemini API returns unparseable or schema-violating text | HTTP 502 Bad Gateway; server handles gracefully without crashing. | **P1** |
| **TC-AI-05** | AI Guardrail | Verify AI response cannot execute database writes | Mocked AI suggests changing budget; verify database records remain unaltered. | **P0** |
