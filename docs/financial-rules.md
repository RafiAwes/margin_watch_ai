# MarginWatch — Financial Rules and Calculation Specifications

**Document Status:** Authoritative Source of Truth (Phase 0)  
**Last Updated:** October 2026  
**Audience:** Backend Engineers, Financial Domain Experts, Quality Assurance  
**Architecture Decision Record:** [ADR-002: Single-Agency Architecture](decisions/ADR-002-single-agency-architecture.md) | [ADR-003: Financial Rules and Risk Classification](decisions/ADR-003-financial-rules-and-risk-classification.md)

---

## 1. Overview & Core Philosophy

MarginWatch provides a single software agency with transparent, deterministic project profitability and budget risk monitoring. In agency delivery operations, profitability is eroded when recorded labor hours and direct expenses outpace initial budgets without detection.

To prevent catastrophic budget overruns, MarginWatch establishes an authoritative backend calculation engine governed by three foundational pillars:
1. **Absolute Determinism:** Given identical recorded time entries, approved expenses, and project baselines, the engine must produce the exact same figures down to the penny across all execution environments.
2. **Strict Separation of Actuals vs. Forecasts:** Actual money spent to date represents established historical fact. Forecasted completion costs represent probabilistic estimates. These two data streams must never be conflated.
3. **Defensive Mathematical Rigor:** Mathematical hazards (such as division by zero, floating-point rounding errors, or negative durations) are proactively validated. Missing estimates are explicitly preserved as `null` and never silently converted to zero.

---

## 2. Financial Terminology & Classification

Financial metrics in MarginWatch are categorized strictly into **Actual Financial Data** (incurred and verified) and **Forecast Data** (forward-looking projections).

### 2.1 Terminology Definitions

| Term | Symbol | Classification | Conceptual Definition | Persistence & Mutability |
| :--- | :---: | :---: | :--- | :--- |
| **Contract Revenue** | $R$ | Baseline | The total monetary value the client has agreed to pay the agency for the contracted scope of work (fixed-price cap or agreed budget limit). | Stored on `Project`. Configurable only by Managers (`MANAGER`). |
| **Planned Cost Budget** | $B$ | Baseline | The internal delivery-cost ceiling established by agency management (direct labor cost + direct expenses) to deliver the project. | Stored on `Project`. Configurable only by Managers (`MANAGER`). |
| **Recorded Work Hours** | $H_{entry}$ | Actual | The duration of labor logged in a single time entry by an authorized team member. | Stored on `TimeEntry`. Valid range: $0.00 < H_{entry} \le 24.00$. |
| **Historical Internal Hourly Cost** | $C_{entry}$ | Actual | The personal hourly cost rate of the team member at the moment the time entry was created. Saved as `hourly_cost_snapshot`. | Stored on `TimeEntry`. **Permanently immutable.** |
| **Planned Internal Hourly Cost** | $C_{hourly\_plan}$ | Forecast / Baseline | The blended hourly cost rate used to value future remaining estimated labor. | Stored on `Project`. Configurable by Managers (`MANAGER`). |
| **Estimated Remaining Hours** | $H_{rem}$ | Forecast | The estimated labor hours required to complete all outstanding project deliverables. | Stored on `Project` (nullable). `null` = unknown; `0.0` = complete. |
| **Approved Expenses** | $E_{appr}$ | Actual | Direct project expenditures (e.g., subcontractors, software licenses) approved by a Manager. | Derived from `Expense` where `status = APPROVED`. |
| **Pending Expenses** | $E_{pend}$ | Operational | Submitted project expenditures awaiting manager review. **Excluded from actual costs.** | Derived from `Expense` where `status = PENDING`. |
| **Rejected Expenses** | $E_{rej}$ | Operational | Submitted project expenditures rejected by management. **Permanently excluded from actual costs.** | Derived from `Expense` where `status = REJECTED`. |
| **Expected Remaining Expenses** | $E_{rem}$ | Forecast | Anticipated direct future expenses not yet incurred. Defaults to `$0.00` in the MVP. | Stored on `Project`. Configurable by Managers (`MANAGER`). |
| **Actual Labor Cost** | $C_{labor}$ | Actual | The cumulative monetary cost of all internal labor logged against the project to date. | Derived dynamically via deterministic sum of products. |
| **Actual Expense Cost** | $C_{expense}$ | Actual | The cumulative sum of all approved project expenses. | Derived dynamically via sum of approved expenses. |
| **Actual Total Cost** | $C_{actual}$ | Actual | Total financial expenditure burned to date ($C_{labor} + C_{expense}$). | Derived dynamically. |
| **Budget Consumption %** | $P_{consumed}$ | Actual Metric | The proportion of the internal delivery-cost budget that has already been spent. | Derived dynamically: $(C_{actual} / B) \times 100$. |
| **Estimated Remaining Labor Cost**| $C_{rem\_labor}$| Forecast | The projected monetary cost of remaining labor required to complete project scope. | Derived dynamically: $H_{rem} \times C_{hourly\_plan}$. |
| **Projected Final Cost** | $C_{projected}$ | Forecast | Total expected cost at project completion ($C_{actual} + C_{rem\_labor} + E_{rem}$). | Derived dynamically (or `null` if $H_{rem}$ is unknown). |
| **Projected Profit** | $P_{profit}$ | Forecast | Forecasted net monetary return upon project completion ($R - C_{projected}$). | Derived dynamically (or `null` if $C_{projected}$ is `null`). |
| **Projected Profit Margin %** | $M_{profit}$ | Forecast Metric | Forecasted net profitability expressed as a percentage of contract revenue. | Derived dynamically: $(P_{profit} / R) \times 100$. |
| **Project Risk Status** | $S_{risk}$ | Watchdog | Discrete operational health classification (`healthy`, `at_risk`, `over_budget`, `insufficient_data`). | Evaluated deterministically via rule precedence. |

---

## 3. Authoritative Formula Specifications

### 3.1 Actual Labor Cost ($C_{labor}$)
Sum each time entry's recorded hours multiplied by its saved historical hourly cost snapshot:
$$C_{labor} = \sum_{i=1}^{N} \left( H_{entry, i} \times C_{entry, i} \right)$$
- **Inputs:** Set of $N$ time entries belonging to the project, each with `hours_worked` ($H_{entry} > 0.00$) and `cost_rate_snapshot` ($C_{entry} \ge 0.00$).
- **Output:** Decimal monetary total $\ge 0.00$. If $N = 0$, $C_{labor} = 0.00$.
- **Validation:** Reject negative hours or negative rate snapshots.
- **Rule:** Uses the immutable snapshot stored at time entry creation; never uses the user's current profile rate.

### 3.2 Actual Expense Cost ($C_{expense}$)
Sum all approved expenses associated with the project:
$$C_{expense} = \sum_{j=1}^{M} E_{appr, j}$$
- **Inputs:** Set of $M$ approved expenses where `project_id == project.id` and `status == APPROVED`.
- **Output:** Decimal monetary total $\ge 0.00$. If $M = 0$, $C_{expense} = 0.00$.
- **Validation:** Only expenses with `status == APPROVED` are included. `PENDING` and `REJECTED` expenses are strictly excluded.
- **Rule:** Approved expenses are summed exactly once.

### 3.3 Actual Total Cost ($C_{actual}$)
Cumulative actual spending incurred to date:
$$C_{actual} = C_{labor} + C_{expense}$$
- **Inputs:** $C_{labor} \ge 0.00$, $C_{expense} \ge 0.00$.
- **Output:** Decimal monetary total $\ge 0.00$.
- **Assumption:** Reflects real money already committed or paid.

### 3.4 Budget Consumption Percentage ($P_{consumed}$)
Proportion of the planned delivery-cost budget spent to date:
$$P_{consumed} = \begin{cases} 
\left( \frac{C_{actual}}{B} \right) \times 100, & \text{if } B > 0 \\
\text{null}, & \text{if } B \le 0 \text{ or } B \text{ is null}
\end{cases}$$
- **Inputs:** $C_{actual} \ge 0.00$, $B$ (Planned Cost Budget).
- **Output:** Percentage rounded half-up to two decimal places (e.g., `48.33%`), or `null` if $B \le 0$.
- **Validation:** If $B \le 0$, division by zero is prevented; returns `null`.

### 3.5 Estimated Remaining Labor Cost ($C_{rem\_labor}$)
Forecasted cost to complete remaining labor:
$$C_{rem\_labor} = \begin{cases}
H_{rem} \times C_{hourly\_plan}, & \text{if } H_{rem} \ge 0 \text{ and } H_{rem} \text{ is not null} \\
\text{null}, & \text{if } H_{rem} \text{ is null}
\end{cases}$$
- **Inputs:** $H_{rem}$ (Estimated Remaining Hours, nullable), $C_{hourly\_plan} > 0.00$.
- **Output:** Decimal monetary amount $\ge 0.00$, or `null` if $H_{rem}$ is unknown.
- **Validation:** $H_{rem} < 0$ is rejected by API validation. $H_{rem} = 0.0$ yields $C_{rem\_labor} = 0.00$.

### 3.6 Projected Final Cost ($C_{projected}$)
Expected total project expenditure at completion:
$$C_{projected} = \begin{cases}
C_{actual} + C_{rem\_labor} + E_{rem}, & \text{if } C_{rem\_labor} \text{ is not null} \\
\text{null}, & \text{if } C_{rem\_labor} \text{ is null}
\end{cases}$$
- **Inputs:** $C_{actual}$, $C_{rem\_labor}$, $E_{rem}$ (Expected Remaining Expenses).
- **MVP Assumption:** In the MVP, $E_{rem}$ defaults to `$0.00` unless explicitly provided. This assumption is documented in the API response metadata.
- **Output:** Decimal monetary amount $\ge 0.00$, or `null` if remaining labor cannot be forecasted.

### 3.7 Projected Profit ($P_{profit}$)
Forecasted net return upon delivery:
$$P_{profit} = \begin{cases}
R - C_{projected}, & \text{if } R \ge 0 \text{ and } C_{projected} \text{ is not null} \\
\text{null}, & \text{if } C_{projected} \text{ is null}
\end{cases}$$
- **Inputs:** $R$ (Contract Revenue $\ge 0.00$), $C_{projected}$.
- **Output:** Decimal monetary amount (can be negative if costs exceed revenue), or `null`.

### 3.8 Projected Profit Margin Percentage ($M_{profit}$)
Forecasted profit margin as a percentage of contract revenue:
$$M_{profit} = \begin{cases}
\left( \frac{P_{profit}}{R} \right) \times 100, & \text{if } R > 0 \text{ and } P_{profit} \text{ is not null} \\
\text{null}, & \text{if } R \le 0 \text{ or } P_{profit} \text{ is null}
\end{cases}$$
- **Inputs:** $P_{profit}$, $R$ (Contract Revenue).
- **Output:** Percentage rounded half-up to two decimal places, or `null`.
- **Validation:** If $R \le 0$, division by zero is prevented; returns `null`.

---

## 4. Fundamental Calculation Rules & Edge-Case Handling

### 4.1 Decimal-Safe Arithmetic
- Binary floating-point math (`float` in Python or JavaScript) is strictly prohibited.
- All calculations are performed in the backend using fixed-point decimals (`decimal.Decimal` in Python, `NUMERIC(12, 4)` in database storage).
- Display and response totals are rounded half-up (`ROUND_HALF_UP`) to two decimal places (`0.01` currency units, `0.01%` percentage units).

### 4.2 Single-Currency Boundary
- For the MVP, each project is bound to a single configured currency (e.g., `USD`, `EUR`, `GBP`).
- All rates, time entry cost snapshots, expenses, budgets, and revenues within that project must share this currency.
- Cross-currency operations or silent conversions are strictly forbidden. Multi-currency support is deferred to post-MVP roadmap milestones.

### 4.3 Division by Zero Prevention
- If Planned Cost Budget ($B \le 0$ or null), $P_{consumed}$ evaluates to `null`.
- If Contract Revenue ($R \le 0$ or null), $M_{profit}$ evaluates to `null`.
- The calculation service must never throw unhandled exceptions or return `NaN` / `Infinity`.

### 4.4 Non-Negative Input Validation
- The API layer defensively rejects:
  - $H_{entry} \le 0$ or $H_{entry} > 24.0$ per time entry.
  - Expense amount $\le 0.00$.
  - Contract revenue $R < 0.00$.
  - Planned cost budget $B \le 0.00$.
  - Estimated remaining hours $H_{rem} < 0.00$.
  - Planned hourly rate $C_{hourly\_plan} \le 0.00$.

### 4.5 Historical Hourly-Cost Snapshot Integrity
- When a user logs a time entry, their current personal hourly cost rate is saved onto `TimeEntry.cost_rate_snapshot`.
- If an employee receives a wage increase in the future, past time entries remain immutable.
- Past project calculations produce authentic historical financial audits, never retroactive distortions.

### 4.6 Budget Consumption vs. Project Completion
- **Critical Distinction:** Budget consumption ($P_{consumed}$) measures money spent, **not** work delivered.
- Spending 80% of a budget does not mean the project is 80% complete. If only 40% of deliverables are finished, the project is severely distressed.
- MarginWatch explicitly separates actual cost accumulation ($C_{actual}$) from scope-to-complete forecasting ($C_{projected}$).

---

## 5. Missing Estimates Policy

Estimating remaining scope in software projects is often uncertain. MarginWatch implements an unambiguous policy for missing estimates:

### 5.1 Semantic Meaning of `null` vs. `0.0`
- **`H_{rem} = null` (Unknown / Missing):** The delivery team has not provided an estimate of remaining work. The forecast is **unknown**.
- **`H_{rem} = 0.0` (Explicitly Complete):** The team has reviewed the scope and explicitly asserts that **no further work remains**.
- **`H_{rem} < 0.0` (Invalid):** Rejected as a validation error.

### 5.2 System Behavior When Remaining Hours are Unknown (`null`)
When $H_{rem}$ is `null`:
1. **Actuals Remain Fully Operational:** Actual labor cost ($C_{labor}$), actual expense cost ($C_{expense}$), actual total cost ($C_{actual}$), and budget consumption ($P_{consumed}$) are computed normally and displayed.
2. **Forecast Metrics are Suppressed:** Projected final cost ($C_{projected}$), projected profit ($P_{profit}$), and projected profit margin ($M_{profit}$) are returned as `null` (unavailable). They are never fabricated or guessed.
3. **Never Silently Convert `null` to Zero:** Converting `null` to `0.0` would falsely assume that no work remains, presenting a misleadingly optimistic financial forecast.
4. **Risk Status Interaction:** Returns `insufficient_data` **unless** actual total cost already exceeds the planned cost budget ($C_{actual} > B$), in which case `over_budget` takes precedence.

---

## 6. Expense Approval & Double-Counting Prevention Policy

Direct project expenditures follow a strict managerial review lifecycle:

| Expense Status | Included in Actual Cost ($C_{actual}$)? | Treatment in Forecast ($C_{projected}$)? |
| :--- | :---: | :--- |
| **`PENDING`** | **No** | Excluded from actuals. Can be surfaced in operational alerts, but does not burn budget. Excluded from forecast unless separately tracked under expected remaining expenses. |
| **`APPROVED`** | **Yes** | Fully included in $C_{expense}$ and $C_{actual}$. Included in forecast via $C_{actual}$. |
| **`REJECTED`** | **No** | Permanently excluded from actual costs and forecasts. |

### 6.1 Approval Authority
- Only authenticated users with the `MANAGER` role can approve or reject expenses.
- Rejecting an expense requires a mandatory, non-empty `rejection_reason`.

### 6.2 Preventing Double-Counting Between Actuals and Forecasts
- **The Double-Counting Hazard:** If a manager anticipates a $1,000 subcontractor bill and enters $E_{rem} = \$1,000$, and the subcontractor later submits an expense that gets approved ($C_{expense} = \$1,000$), failing to decrement $E_{rem}$ would count the $1,000 twice ($C_{actual} + E_{rem} = \$1,000 + \$1,000 = \$2,000$).
- **Rule for MVP:** In the MVP, $E_{rem}$ defaults to `$0.00`. Expected remaining expenses represent *un-incurred* future expenses only. When an expense is approved, it enters $C_{expense}$. If a manager explicitly configures $E_{rem}$, the manager must decrement $E_{rem}$ when the corresponding expense is approved. The API documentation explicitly reminds managers of this rule.

---

## 7. Deterministic Risk Classification & Precedence Hierarchy

Every project is evaluated against four mutually exclusive health statuses: `over_budget`, `insufficient_data`, `at_risk`, and `healthy`.

Because multiple conditions can be true simultaneously (e.g., spending is above budget AND remaining hours are missing), the engine evaluates conditions in a **strict, non-negotiable precedence hierarchy**.

```mermaid
flowchart TD
    Start([Evaluate Project Risk]) --> Rule1{Rule 1: Is Actual Total Cost > Planned Budget?<br>C_actual > B}
    Rule1 -- Yes --> OB[Status = over_budget<br>Actual money spent already breached budget]
    Rule1 -- No --> Rule2{Rule 2: Is Required Forecast Data Missing or Invalid?<br>B missing/<=0 OR H_rem is null}
    Rule2 -- Yes --> ID[Status = insufficient_data<br>Cannot reliably forecast completion]
    Rule2 -- No --> Rule3{Rule 3: Does Projected Final Cost > Planned Budget?<br>C_projected > B<br>OR (Optional Warning Active: P_consumed >= 80% & H_rem > 0)}
    Rule3 -- Yes --> AR[Status = at_risk<br>Forecasted overrun or high consumption warning]
    Rule3 -- No --> H[Status = healthy<br>Actuals and forecast within budget]
```

### 7.1 Precedence Rules

#### Rule 1 — `over_budget` (Highest Priority)
- **Condition:** $C_{actual} > B$
- **Semantic Meaning:** Actual funds spent to date have already breached the delivery-cost budget ceiling.
- **Precedence Note:** This rule takes priority over missing forecasting data. If a project with a $6,000 budget has already burned $6,200, the project is definitively `over_budget` even if $H_{rem}$ is `null`. The overrun is an established historical fact.

#### Rule 2 — `insufficient_data` (Second Priority)
- **Condition:** $C_{actual} \le B$ AND ($B \le 0$ OR $B \text{ is null}$ OR $H_{rem} \text{ is null}$ OR $C_{hourly\_plan} \le 0$).
- **Semantic Meaning:** Actual spending has not exceeded the budget, but required information for a trustworthy forecast is missing or invalid.
- **Action:** Warn management that reliable forecasting is impossible until baselines or remaining estimates are populated.

#### Rule 3 — `at_risk` (Third Priority)
- **Condition:** All required forecasting inputs are valid, AND either:
  1. **Forecasted Overrun:** $C_{projected} > B$, OR
  2. **High Consumption Warning (Configurable Heuristic):** $P_{consumed} \ge 80.0\%$ AND $H_{rem} > 0.0$ (when the optional 80% warning heuristic is enabled).
- **Semantic Meaning:** Actual spending is currently within budget, but the project is on trajectory to breach its delivery budget.
- **Heuristic Note:** The 80% threshold is a configurable operational warning, not a universal industry standard. It warns leadership when the financial contingency buffer drops below 20% while work remains.

#### Rule 4 — `healthy` (Fourth Priority)
- **Condition:** All forecasting inputs are valid, $C_{actual} \le B$, $C_{projected} \le B$, and no configured warning rule has been triggered.
- **Semantic Meaning:** Project actual spending and projected completion costs track safely within the planned delivery budget.

### 7.2 Boundary Condition Comparisons

| Metric Comparison | Rule Evaluated | Outcome |
| :--- | :--- | :--- |
| $C_{actual} == B$ (100% consumed) | Rule 1: $C_{actual} > B$ is False. | Evaluates to Rule 3 (`at_risk`) if $H_{rem} > 0$, or via high consumption warning. |
| $C_{projected} == B$ | Rule 3: $C_{projected} > B$ is False. | Evaluates to `healthy` (unless $P_{consumed} \ge 80\%$ triggers the consumption warning). |
| $P_{consumed} == 80.00\%$ | Rule 3: $P_{consumed} \ge 80.0\%$ is True. | Triggers `at_risk` if warning heuristic is enabled and $H_{rem} > 0$. |

---

## 8. Authoritative Numerical Benchmark Scenarios

The following five benchmark scenarios define the exact expected outputs for MarginWatch.

**Global Baseline Parameters for Scenarios 1–5:**
- Currency: `USD`
- Planned Internal Hourly Cost ($C_{hourly\_plan}$): `$50.00/hr`
- Expected Remaining Expenses ($E_{rem}$): `$0.00`
- Approved Expenses ($E_{appr}$): Included directly in Actual Cost ($C_{actual}$).

### Summary Benchmark Table

| Scenario | Revenue ($R$) | Budget ($B$) | Actual Cost ($C_{actual}$) | Remaining Hours ($H_{rem}$) | Remaining Labor ($C_{rem\_labor}$) | Projected Cost ($C_{projected}$) | Projected Profit ($P_{profit}$) | Margin ($M_{profit}$) | Consumption ($P_{consumed}$) | Expected Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Healthy** | $10,000 | $6,000 | $2,000 | 40 hrs | $2,000 | $4,000 | $6,000 | 60.00% | 33.33% | `healthy` |
| **2. Forecast Over Budget** | $10,000 | $6,000 | $4,000 | 50 hrs | $2,500 | $6,500 | $3,500 | 35.00% | 66.67% | `at_risk` |
| **3. Already Over Budget** | $10,000 | $6,000 | $6,200 | `null` | Unavailable | Unavailable | Unavailable | Unavailable | 103.33% | `over_budget` |
| **4. Missing Estimate** | $10,000 | $6,000 | $2,000 | `null` | Unavailable | Unavailable | Unavailable | Unavailable | 33.33% | `insufficient_data` |
| **5. High Consumption Warning** | $10,000 | $6,000 | $4,900 | 10 hrs | $500 | $5,400 | $4,600 | 46.00% | 81.67% | `at_risk` (warning on)<br>`healthy` (warning off) |

---

### Scenario Breakdown & Explanations

#### Scenario 1: Healthy
- **Calculations:**
  - $P_{consumed} = (\$2,000 / \$6,000) \times 100 = 33.33\%$
  - $C_{rem\_labor} = 40 \times \$50.00 = \$2,000.00$
  - $C_{projected} = \$2,000.00 + \$2,000.00 + \$0.00 = \$4,000.00$
  - $P_{profit} = \$10,000.00 - \$4,000.00 = \$6,000.00$
  - $M_{profit} = (\$6,000.00 / \$10,000.00) \times 100 = 60.00\%$
- **Why this status applies:**
  - Rule 1 ($C_{actual} > B$): $\$2,000 > \$6,000$ $\rightarrow$ False.
  - Rule 2 (Missing data): All baselines and estimates present $\rightarrow$ False.
  - Rule 3 ($C_{projected} > B$ or $P_{consumed} \ge 80\%$): $\$4,000 > \$6,000$ is False; $33.33\% \ge 80\%$ is False $\rightarrow$ False.
  - Rule 4: Evaluates to **`healthy`**.

#### Scenario 2: Forecast Over Budget
- **Calculations:**
  - $P_{consumed} = (\$4,000 / \$6,000) \times 100 = 66.67\%$
  - $C_{rem\_labor} = 50 \times \$50.00 = \$2,500.00$
  - $C_{projected} = \$4,000.00 + \$2,500.00 + \$0.00 = \$6,500.00$
  - $P_{profit} = \$10,000.00 - \$6,500.00 = \$3,500.00$
  - $M_{profit} = (\$3,500.00 / \$10,000.00) \times 100 = 35.00\%$
- **Why this status applies:**
  - Rule 1: $\$4,000 > \$6,000$ $\rightarrow$ False.
  - Rule 2: All forecast data valid $\rightarrow$ False.
  - Rule 3 ($C_{projected} > B$): $\$6,500.00 > \$6,000.00$ $\rightarrow$ **True!** Projected final cost exceeds planned budget by $500.00.
  - Precedence stops at Rule 3: Evaluates to **`at_risk`**.

#### Scenario 3: Already Over Budget
- **Calculations:**
  - $P_{consumed} = (\$6,200 / \$6,000) \times 100 = 103.33\%$
  - $H_{rem} = \text{null} \rightarrow C_{rem\_labor} = \text{null}$, $C_{projected} = \text{null}$, $P_{profit} = \text{null}$, $M_{profit} = \text{null}$.
- **Why this status applies:**
  - Rule 1 ($C_{actual} > B$): $\$6,200.00 > \$6,000.00$ $\rightarrow$ **True!**
  - Actual expenditure has already breached the budget. Rule 1 takes highest precedence, bypassing Rule 2 (missing forecast data).
  - Evaluates to **`over_budget`**.

#### Scenario 4: Missing Estimate
- **Calculations:**
  - $P_{consumed} = (\$2,000 / \$6,000) \times 100 = 33.33\%$ (Valid and displayed).
  - $H_{rem} = \text{null} \rightarrow C_{rem\_labor} = \text{null}$, $C_{projected} = \text{null}$, $P_{profit} = \text{null}$, $M_{profit} = \text{null}$.
- **Why this status applies:**
  - Rule 1: $\$2,000 > \$6,000$ $\rightarrow$ False. Actual spending is within budget.
  - Rule 2 (Missing data): $H_{rem}$ is `null` $\rightarrow$ **True!** Forecasting data is unavailable.
  - Precedence stops at Rule 2: Evaluates to **`insufficient_data`**.

#### Scenario 5: High Consumption Warning
- **Calculations:**
  - $P_{consumed} = (\$4,900 / \$6,000) \times 100 = 81.67\%$
  - $C_{rem\_labor} = 10 \times \$50.00 = \$500.00$
  - $C_{projected} = \$4,900.00 + \$500.00 + \$0.00 = \$5,400.00$
  - $P_{profit} = \$10,000.00 - \$5,400.00 = \$4,600.00$
  - $M_{profit} = (\$4,600.00 / \$10,000.00) \times 100 = 46.00\%$
- **Why this status applies:**
  - Rule 1: $\$4,900 > \$6,000$ $\rightarrow$ False.
  - Rule 2: All forecast data valid $\rightarrow$ False.
  - Rule 3 ($C_{projected} > B$ or Warning): $\$5,400 \le \$6,000$ (No forecast overrun). But $P_{consumed} = 81.67\% \ge 80.0\%$ and remaining work $10 \text{ hrs} > 0$.
  - When the optional 80% consumption warning heuristic is enabled, this triggers Rule 3 $\rightarrow$ **`at_risk`**.
  - If the warning heuristic is disabled, Rule 3 is False and the status evaluates to **`healthy`**.

---

## 9. Comprehensive Edge-Case Specifications

| Edge Case | Condition / Input | System Behavior & Calculation | Expected Risk Status |
| :--- | :--- | :--- | :--- |
| **EC-01: Zero Planned Budget** | $B = 0.00$ | $P_{consumed} = \text{null}$ (division by zero avoided). Forecast cannot be evaluated against a zero ceiling. | `insufficient_data` |
| **EC-02: Zero Contract Revenue** | $R = 0.00$, $B = \$5,000$ | $P_{profit} = 0 - C_{projected}$ (negative profit). $M_{profit} = \text{null}$ (division by zero avoided). Budget monitoring remains active. | Evaluated normally based on $C_{actual}$ and $C_{projected}$ relative to $B$. |
| **EC-03: Exactly 100% Budget Consumption** | $C_{actual} = \$6,000$, $B = \$6,000$, $H_{rem} = 5 \text{ hrs}$ | $P_{consumed} = 100.00\%$. $C_{actual} > B$ is False ($6,000 > 6,000$ is False). But $C_{projected} = \$6,250 > \$6,000$. | `at_risk` (due to forecast overrun; will become `over_budget` as soon as next cent is logged). |
| **EC-04: Negative or Invalid Inputs** | $H_{entry} < 0$, $B < 0$, $H_{rem} < 0$ | Rejected by API serializer with HTTP 400 Bad Request before entering calculation engine. | N/A (Validation Error) |
| **EC-05: Missing User Cost Rate** | User has `default_hourly_cost_rate = null` | Rejected at time entry creation or defaults to `$0.0000` with mandatory warning. Rate snapshot cannot be null. | N/A (Validation Error) |
| **EC-06: Pending & Rejected Expenses** | Project has $1,000 approved, $500 pending, $200 rejected | $C_{expense} = \$1,000.00$. Pending ($500) and rejected ($200) are strictly excluded from $C_{actual}$. | Evaluated strictly on $C_{actual} = C_{labor} + \$1,000.00$. |
| **EC-07: Zero Remaining Hours** | $H_{rem} = 0.0$ | $C_{rem\_labor} = \$0.00$. $C_{projected} = C_{actual} + E_{rem}$. Indicates project delivery is complete. | `healthy` (if $C_{actual} \le B$) or `over_budget` (if $C_{actual} > B$). |
| **EC-08: Missing Expected Remaining Expenses** | $E_{rem} = \text{null}$ or omitted | Defaults to `$0.00` in the MVP with explicit documentation that zero future expenses are assumed. | Evaluates normally using $E_{rem} = 0.00$. |

---

## 10. Open Policy Decisions & Review Notes

The following policy items are documented as open decisions subject to stakeholder review:
1. **Configurable Warning Threshold (80% Heuristic):** Currently implemented as a project-level setting defaulting to 80%. Agencies may choose to configure this to 75% or 90%, or disable it entirely.
2. **Explicit Expected Expense Input:** For the MVP, $E_{rem}$ defaults to `$0.00`. An explicit expense forecasting module (allowing managers to schedule future subcontractor milestones) is slated for Phase 4/5 evaluation.
