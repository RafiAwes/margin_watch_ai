# ADR-003: Financial Business Rules, Missing Estimate Policy, and Risk Precedence

**Status:** Accepted (Formal Financial Specification — Phase 0)  
**Date:** October 2026  
**Deciders:** Lead Architect, Financial Domain Specialist, Full-Stack Developer  
**Related Documents:** [docs/financial-rules.md](../financial-rules.md), [docs/requirements.md](../requirements.md), [ADR-001](ADR-001-initial-architecture.md), [ADR-002](ADR-002-single-agency-architecture.md)

---

## 1. Context & Problem Statement

Software development agencies frequently suffer unexpected delivery losses because:
1. Financial metrics are computed using inconsistent formulas across spreadsheets and ad-hoc reports.
2. Estimating remaining scope in active development is uncertain; when estimates are missing, systems either crash or silently substitute zero, falsely indicating that work is complete.
3. Actual spending breaches are conflated with probabilistic forecasts.
4. Unvetted expenses are prematurely factored into delivery costs, or approved expenses are counted twice (in both actuals and future expected expenses).

MarginWatch requires an unambiguous, mathematically sound, and auditable set of financial business rules that can be codified deterministically in backend Python services.

---

## 2. Decisions Made

### 2.1 Formula & Arithmetic Standards
1. **Decimal-Safe Calculation:** All currency calculations are executed using `decimal.Decimal` in Python (`NUMERIC` in SQL). Binary floating-point representation (`float`) is prohibited.
2. **Formula Decomposition:**
   - Actual Labor Cost: $C_{labor} = \sum (H_{entry} \times C_{entry})$ using historical snapshot rates.
   - Actual Expense Cost: $C_{expense} = \sum E_{appr}$ using strictly approved expenses.
   - Actual Total Cost: $C_{actual} = C_{labor} + C_{expense}$.
   - Budget Consumption: $P_{consumed} = (C_{actual} / B) \times 100$.
   - Estimated Remaining Labor Cost: $C_{rem\_labor} = H_{rem} \times C_{hourly\_plan}$.
   - Projected Final Cost: $C_{projected} = C_{actual} + C_{rem\_labor} + E_{rem}$.
   - Projected Profit: $P_{profit} = R - C_{projected}$.
   - Projected Profit Margin: $M_{profit} = (P_{profit} / R) \times 100$.

### 2.2 Missing Estimates Policy (`null` vs `0.0`)
1. **Distinction:** `null` remaining hours denotes an **unknown estimate**. `0.0` remaining hours denotes that the team has explicitly determined that **zero work remains**.
2. **Treatment:** When $H_{rem}$ is `null`, actual costs ($C_{labor}$, $C_{expense}$, $C_{actual}$) and budget consumption ($P_{consumed}$) are computed normally and displayed. However, forecast figures ($C_{projected}$, $P_{profit}$, $M_{profit}$) are returned as `null` (unavailable). The system never silently converts `null` to `0.0`.

### 2.3 Expense Approval & Double-Counting Safeguards
1. **Status Filtering:** Only expenses with `status == APPROVED` are included in $C_{expense}$ and $C_{actual}$. `PENDING` and `REJECTED` expenses are strictly excluded from actual costs.
2. **Double-Counting Prevention:** In the MVP, Expected Remaining Expenses ($E_{rem}$) defaults to `$0.00`. Expected remaining expenses represent un-incurred future costs only. Approved expenses are accounted for exclusively via $C_{actual}$.

### 2.4 Risk Classification & Strict Precedence Order
Projects are classified into four mutually exclusive statuses using the following strict hierarchy:
1. **Rule 1 — `over_budget`:** If $C_{actual} > B$, the project is `over_budget`. This takes absolute priority over missing forecast data, because money already spent has breached the budget ceiling.
2. **Rule 2 — `insufficient_data`:** If $C_{actual} \le B$, but required forecast data is missing or invalid ($B \le 0$, $B$ is null, or $H_{rem}$ is null), the project is `insufficient_data`.
3. **Rule 3 — `at_risk`:** If forecast inputs are valid, and either $C_{projected} > B$ (forecasted overrun) OR $P_{consumed} \ge 80.0\%$ with $H_{rem} > 0$ (configurable consumption warning heuristic), the project is `at_risk`.
4. **Rule 4 — `healthy`:** If $C_{actual} \le B$, $C_{projected} \le B$, and no warning rule is triggered, the project is `healthy`.

---

## 3. Rationale & Trade-Offs

### 3.1 Why Rule 1 (`over_budget`) Precedes Rule 2 (`insufficient_data`)
- **Alternative:** Marking a project `insufficient_data` if $H_{rem}$ is null, even if actual spending already exceeds the budget.
- **Why rejected:** If an agency budgeted $6,000 and has already paid out $6,200 in actual cash, the project is in financial breach *now*. Masking this critical reality under "insufficient data" because the team hasn't estimated remaining scope would present a dangerous false negative to agency executives.

### 3.2 Why Suppress Forecasts When $H_{rem}$ is `null`
- **Alternative:** Defaulting $H_{rem}$ to `0.0` or estimating it using historical burn velocity.
- **Why rejected:** Defaulting to `0.0` falsely implies that the project is delivered, showing an artificially high projected profit. Estimating velocity via heuristics introduces speculative math into what must remain an authoritative watchdog. Explicitly returning `null` forces management to obtain a real estimate from the team.

### 3.3 Why Treat 80% Budget Consumption as a Heuristic
- **Rationale:** Projects entering the final 20% of their financial runway face elevated delivery risks (QA cycles, client revisions, deployment friction). Tagging a project as `at_risk` at 80% consumption provides an early intervention buffer. However, because some agile agencies deliver continuously without friction, this rule is documented as a configurable heuristic rather than an inviolable law.

---

## 4. Configurable Assumptions in the MVP

1. **Default Project Currency:** One ISO currency per project; no cross-currency blending.
2. **Expected Remaining Expenses:** Defaults to `$0.00` in the MVP unless explicitly configured by a manager.
3. **Warning Consumption Threshold:** Configured default of `80.0%`. In the MVP it is one agency-wide setting, `MARGINWATCH_CONSUMPTION_WARNING_PCT` (environment variable; empty disables the warning). A per-project override is deferred.

---

## 5. Unresolved Questions & Future Decisions

1. **Automated Expense Decrementing:** In v1.1+, should approved expenses automatically deduct from an allocated $E_{rem}$ milestone pool? (Deferred to post-MVP).
2. **Grace Period for Time Logging:** Should time entries be locked against editing after a manager runs a monthly billing review? (Scheduled for Phase 4 CRUD specification review).
