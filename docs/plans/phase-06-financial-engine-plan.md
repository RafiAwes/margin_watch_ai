# Phase 6 — Financial Engine & Deterministic Risk: Implementation Plan

**Status:** DRAFT — awaiting owner review (no code written yet)
**Date:** October 19, 2026
**Authorities:** [`docs/financial-rules.md`](../financial-rules.md), [ADR-003](../decisions/ADR-003-financial-rules-and-risk-classification.md), [`docs/api-specification.md` §7](../api-specification.md), [`docs/backend/backend-apps-and-data-models.md` §6](../backend/backend-apps-and-data-models.md)

---

## 1. Goal

Move every financial number and risk status to the backend, computed with `Decimal` only, and make the
frontend display them instead of calculating its own.

**Done means:**
- `profitability` app with pure calculation functions that reproduce benchmark Scenarios 1–5 and TC-NUM-01…08 to the cent.
- `GET /api/v1/projects/{id}/financial-summary/`, a collection variant, and `GET /api/v1/dashboard/summary/` (manager-only).
- Frontend dashboard, project list and project detail read those endpoints (Task 7.6); `financial-engine.ts` keeps only formatters.
- Full backend suite + `tsc` pass; browser figures match the API.

---

## 2. Decisions needed before implementation

Each has a recommendation (**bold**). Please confirm or change.

| # | Question | Options | Recommendation |
|:-:|:--|:--|:--|
| **D1** | **Labor-cost rounding.** `TimeEntry.computed_cost` is already rounded per entry (shown in the ledger). Spec §3.1 is `Σ(H × C)`. With a 4-dp rate snapshot the two can differ by a cent (e.g. 1.33 h × $62.50 = $83.125). | **A.** Round each entry to the cent, then sum (ledger always reconciles with project total). B. Sum exact products, round once (literal spec). | **A** — the roadmap requires "time entries whose costs reconcile exactly with project labor cost totals". Add a one-line clarification to `financial-rules.md` §3.1. |
| **D2** | **Rounding of intermediate values.** | **A.** Every money value is quantized to 0.01 (half-up) when it is produced, so displayed figures always add up; percentages are only rounded for output, and threshold comparisons use exact ratios (`C_actual × 100 ≥ 80 × B`). B. Keep full precision everywhere, round only in the response. | **A** — e.g. avoids `actual_total_cost` ≠ `labor + expenses` by a cent on screen, and 79.996 % never counts as 80 %. |
| **D3** | **80 % consumption warning.** Docs say "configurable, default 80 %"; no model field exists. | **A.** One setting `MARGINWATCH_CONSUMPTION_WARNING_PCT` (default `80.00`, env-overridable, empty = disabled). B. New per-project field (migration + form field). | **A** for the MVP (no schema change); B can follow later. |
| **D4** | **Per-project figures for lists.** The dashboard and project list need risk/figures for every project; calling `/{id}/financial-summary/` 39 times is an N+1 over HTTP. | **A.** Add `GET /api/v1/projects/financial-summaries/` (paginated, same filters as `/projects/`). B. Embed per-project summaries inside `/dashboard/summary/`. | **A** — keeps the dashboard payload small and reuses pagination/filters from Task 5.8. |
| **D5** | **Dashboard scope.** Spec §7.1 has 8 fields; the current UI also shows risk counts, projected final cost, aggregate margin, consumption %. Single-currency rule (§4.2) forbids summing USD + EUR. | **A.** `?currency=USD` (default USD), totals over `ACTIVE`, non-archived projects in that currency, spec fields + the extra fields the UI uses (§4.3 below). B. Spec fields only; UI loses those cards. | **A**, and update `api-specification.md` §7.1. |
| **D6** | **Response extensions** beyond §7.2: `planned_profit`, `planned_margin_percentage`, `projected_cost_variance`, `rejected_expense_cost`, `pending_expense_count`, `risk.rule`, `metadata` (threshold, assumptions). | Accept / trim. | **Accept** — the UI already displays planned profit, variance and rejected amounts, and Phase 8's AI payload needs `pending_expenses_count`. Spec doc updated to match. |
| **D7** | **Risk vocabulary in the frontend.** Backend/spec: `healthy / at_risk / over_budget / insufficient_data`. Frontend: `HEALTHY / WARNING / CRITICAL / INCOMPLETE_DATA` (33 usages). | **A.** Map once in the API transform layer. B. Rename the frontend type everywhere. | **A** — smallest, safest diff; rename can be a later cleanup. |
| **D8** | **Behaviour change you will see.** The current frontend engine is *not* the spec: it marks `CRITICAL` for >10 % projected overrun and for margin < 10 %, warns at **85 %** (spec: 80 %), ignores expected remaining expenses, and shows 0 % instead of `null` for a zero budget. | Accept spec behaviour / keep extra rules. | **Accept the spec.** Some projects currently shown "Critical" will become `at_risk` or `healthy`. If you want the extra rules, they must be added to ADR-003 first. |
| **D9** | **Team members.** Financial endpoints are manager-only (spec §7). Team members currently see masked zeros dressed up as figures. | **A.** Team members get no financials (`null`); views hide financial cards/badges for them. B. Defer to Task 7.11. | **A** for the screens touched in 7.6; full role guards stay in 7.11. |
| **D10** | **Test speed (DEC-003).** Full suite ≈ 5 min on Neon. | **A.** Pure service tests use `SimpleTestCase` (no database, run in ~1 s); only selector/API tests hit Neon. | **A** — most new tests are pure, so the suite grows by seconds, not minutes. |

---

## 3. Backend design

### 3.1 New app `backend/profitability/` (no models, no migrations)

```
profitability/
  __init__.py, apps.py
  services.py      # pure Decimal functions + dataclasses, no Django imports
  selectors.py     # DB → service inputs (bulk, fixed query count)
  serializers.py   # dataclasses → spec JSON (strings, null)
  views.py, urls.py
  tests/test_services.py   # SimpleTestCase — benchmarks & edge cases
  tests/test_selectors.py  # TestCase — query count, status filtering
  tests/test_api.py        # TestCase — endpoints, permissions, envelope
```

### 3.2 `services.py` — pure functions (proposed signatures)

```python
MONEY = Decimal("0.01")

@dataclass(frozen=True)
class ProjectFinancialInputs:
    contract_revenue: Decimal            # R
    planned_cost_budget: Decimal         # B
    planned_hourly_cost: Decimal         # C_hourly_plan
    estimated_remaining_hours: Decimal | None   # H_rem (None = unknown)
    expected_remaining_expenses: Decimal # E_rem (None → 0.00, EC-08)
    time_entries: tuple[tuple[Decimal, Decimal], ...]   # (hours, rate_snapshot)
    expense_amounts_by_status: dict[str, tuple[Decimal, ...]]  # APPROVED / PENDING / REJECTED

def actual_labor_cost(entries) -> Decimal                         # §3.1 (D1)
def actual_expense_cost(approved_amounts) -> Decimal              # §3.2
def budget_consumption_percentage(actual_total, budget) -> Decimal | None        # §3.4, None if B ≤ 0
def estimated_remaining_labor_cost(remaining_hours, planned_rate) -> Decimal | None  # §3.5
def projected_final_cost(actual_total, remaining_labor, expected_remaining) -> Decimal | None  # §3.6
def projected_profit(revenue, projected_final) -> Decimal | None  # §3.7 (may be negative)
def projected_profit_margin_percentage(profit, revenue) -> Decimal | None  # §3.8, None if R ≤ 0

def classify_risk(*, actual_total, budget, planned_rate, remaining_hours,
                  projected_final, warning_threshold_pct: Decimal | None) -> RiskAssessment
    # RiskAssessment(status, rule: 1-4, reasons: tuple[str, ...])

def summarize_project(inputs, *, warning_threshold_pct) -> ProjectFinancialSummary
def summarize_portfolio(summaries, *, pending_expenses) -> PortfolioSummary
```

**Guarantees enforced in code (and tested):**
- Any `float` argument raises `TypeError` (acceptance criterion "zero floats").
- No function raises on zero/None budgets or revenue; no `NaN`/`Infinity` (§4.3).
- `None` remaining hours is never turned into `0` (§5).

### 3.3 Risk precedence (exactly financial-rules §7)

1. `over_budget` — `C_actual > B`
2. `insufficient_data` — `B ≤ 0` **or** `H_rem is None` **or** `C_hourly_plan ≤ 0`
3. `at_risk` — `C_projected > B` **or** (warning enabled **and** `C_actual × 100 ≥ threshold × B` **and** `H_rem > 0`)
4. `healthy` — otherwise

Each outcome carries 1–2 plain-language `reasons` with formatted figures, matching the spec examples.

### 3.4 `selectors.py` — fixed query count

For any set of projects: 1 query for projects, 1 for `(project_id, recorded_hours, hourly_cost_snapshot)`,
1 for `(project_id, status, amount)` of expenses → grouped in Python. **3 queries total**, whether it is
1 project or 100 (asserted with `assertNumQueries`). Summing in Python keeps `Decimal` exactness on any
database (SQLite does decimal arithmetic in floats).

### 3.5 Endpoints (manager-only; team member → 403 envelope; unknown id → 404 envelope)

| Endpoint | Returns |
|:--|:--|
| `GET /api/v1/projects/{id}/financial-summary/` | Spec §7.2 shape (+ D6 extensions) |
| `GET /api/v1/projects/financial-summaries/` | Paginated list of the same objects; filters `status`, `client_id`, `is_archived`, `search` |
| `GET /api/v1/dashboard/summary/?currency=USD` | Spec §7.1 fields + §4.3 extensions |

Routes are registered *before* the DRF router so `financial-summaries` is not captured as a project id.

---

## 4. Response shapes (additions in ➕)

### 4.1 Project financial summary
```json
{
  "project_id": "…", "project_name": "…", "currency": "USD",
  "baselines": {
    "contract_revenue": "10000.00", "planned_cost_budget": "6000.00",
    "planned_hourly_cost_rate": "50.0000", "estimated_remaining_hours": "40.00",
    "expected_remaining_expenses": "0.00",
    "planned_profit": "4000.00", "planned_margin_percentage": "40.00"   ➕
  },
  "actuals": {
    "total_hours_logged": "40.00", "actual_labor_cost": "2000.00",
    "approved_expense_cost": "0.00", "actual_total_cost": "2000.00",
    "pending_expense_cost": "0.00", "pending_expense_count": 0,          ➕ count
    "rejected_expense_cost": "0.00",                                      ➕
    "budget_consumption_percentage": "33.33"
  },
  "forecast": {
    "forecast_available": true,
    "estimated_remaining_labor_cost": "2000.00", "projected_final_cost": "4000.00",
    "projected_cost_variance": "-2000.00",                                ➕ (C_projected − B)
    "projected_profit": "6000.00", "projected_profit_margin_percentage": "60.00",
    "reason_unavailable": null
  },
  "risk": { "status": "healthy", "rule": 4, "reasons": ["…", "…"] },     ➕ rule
  "metadata": {                                                           ➕
    "warning_threshold_percentage": "80.00",
    "assumptions": ["Expected remaining expenses are $0.00 (MVP default)."]
  }
}
```
`pending_expense_cost` is always present (the spec's missing-estimate example omits it; treated as a doc typo).

### 4.2 Collection — `{count, next, previous, page_size, results: [<4.1>, …]}`

### 4.3 Dashboard summary
```json
{
  "currency": "USD",                                                      ➕
  "active_projects_count": 23,
  "total_contract_revenue": "…", "total_planned_cost_budget": "…",
  "total_actual_cost_to_date": "…",
  "portfolio_budget_consumption_percentage": "…",                         ➕
  "projects_at_risk_count": 6, "projects_over_budget_count": 7,
  "risk_counts": {"healthy": 10, "at_risk": 6, "over_budget": 7, "insufficient_data": 0},  ➕
  "forecastable_projects_count": 23,                                      ➕
  "total_projected_final_cost": "…",                                      ➕ (forecastable only)
  "aggregate_projected_margin_percentage": "…",                           ➕ (forecastable only, null if none)
  "pending_expenses_count": 3, "pending_expenses_amount": "1450.00"
}
```

---

## 5. Implementation steps (one checkpoint each)

| Step | Work | Verification |
|:--:|:--|:--|
| 6.1 | Create `profitability` app, register in `INSTALLED_APPS`, add `MARGINWATCH_CONSUMPTION_WARNING_PCT` setting. | `manage.py check`, `makemigrations --check` (no migrations) |
| 6.2 | `services.py`: dataclasses + 8 formulas + `classify_risk` + `summarize_project` / `summarize_portfolio`. | — |
| 6.3 | `tests/test_services.py` (§6 below). | `manage.py test profitability.tests.test_services` (no DB) |
| 6.4 | `selectors.py` bulk loader. | `test_selectors.py`: 3-query assertion; pending/rejected excluded; archived handling |
| 6.5 | `serializers.py` + views + urls for the 3 endpoints. | `test_api.py`: shapes, 401/403/404 envelopes, pagination, filters, currency param |
| 6.6 | Docs: api-spec §7 (extensions, collection endpoint, currency), financial-rules §3.1 rounding note (D1), testing-strategy status, ADR-003 note on threshold setting (D3). | Review |
| 6.7 | Frontend (Task 7.6): `apiClient.financials` + `dashboard`; transform + status mapping (D7); replace `enrichProjects` / `calculatePortfolioSummary` math with API data; team-member handling (D9); remove float math from `financial-engine.ts` (keep formatters). | `tsc --noEmit`; browser: dashboard + 3 projects compared against API JSON |
| 6.8 | Full suite, PROJECT_CONTEXT sync. | `manage.py test --keepdb` all green |

Backend steps 6.1–6.6 can be reviewed and committed (backend branch) before 6.7 starts (frontend branch).

---

## 6. Test matrix (`test_services.py`, all pure)

| Group | Cases |
|:--|:--|
| Benchmarks | TC-NUM-01…05 = Scenarios 1–5 (all 9 figures + status, to the cent); Scenario 5 with warning off → `healthy` |
| Edge cases | TC-NUM-06 zero remaining hours; TC-NUM-07 / EC-01 zero budget → `null` %, `insufficient_data`; TC-NUM-08 / EC-06 approved vs pending vs rejected; EC-02 zero revenue → negative profit, `null` margin; EC-03 exactly 100 % consumed + work left → `at_risk`; EC-07 `H_rem = 0` over budget → `over_budget`; EC-08 `E_rem` omitted → 0.00 + assumption note |
| Boundaries | `C_projected == B` → `healthy`; consumption exactly 80.00 % with `H_rem > 0` → `at_risk`; 79.99 % → not triggered; 80 % with `H_rem = 0` → not triggered; `C_actual = B + 0.01` → `over_budget` |
| Precedence | over budget **and** null estimate → `over_budget` (Rule 1 beats Rule 2) |
| Arithmetic | D1 per-entry rounding (1.33 h × 62.5000); half-up (`x.xx5`); no `float` accepted; no exceptions on `None`/0 inputs |
| Portfolio | Totals only over forecastable projects for projected figures; empty portfolio → zeros and `null` margin |

---

## 7. Out of scope

AI advisor (Phase 8); automatic `E_rem` decrement on approval (ADR-003 §5.1); per-project warning threshold (unless D3 = B);
multi-currency conversion; caching/materialized financials; the remaining local-only fallbacks (client save/archive, estimate update).

## 8. Risks

- **Visible status changes** in the UI once spec rules replace the frontend's extra rules (D8).
- **Spec drift:** `development-roadmap.md` names the app `finance`; blueprint and PROJECT_CONTEXT say `profitability` → using `profitability`, roadmap wording fixed in 6.6.
- **Team-member screens** still assume financial numbers exist; D9 limits changes to screens touched by 7.6.
