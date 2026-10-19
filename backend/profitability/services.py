"""
Authoritative MarginWatch financial engine.

Pure functions over `decimal.Decimal` only: no Django imports, no database access, no side effects.
Implements docs/financial-rules.md §3 (formulas), §4 (edge cases), §5 (missing estimates) and
§7 (risk precedence), with the rounding policy from docs/plans/phase-06-financial-engine-plan.md:

- Every money value is quantized to 0.01 (ROUND_HALF_UP) when it is produced, so displayed
  figures always add up (D2). Labor cost is the sum of per-entry rounded costs, which matches
  `TimeEntry.computed_cost` in the ledger (D1).
- Percentages are rounded only for output; threshold comparisons use exact ratios.
- `None` remaining hours means "unknown" and is never treated as zero.
"""

from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal
from typing import Iterable, Optional

MONEY = Decimal("0.01")
HOURS = Decimal("0.01")
PERCENT = Decimal("0.01")
RATE = Decimal("0.0001")
HUNDRED = Decimal("100")
ZERO = Decimal("0.00")

CURRENCY_SYMBOLS = {"USD": "$", "EUR": "€", "GBP": "£"}


class RiskStatus:
    HEALTHY = "healthy"
    AT_RISK = "at_risk"
    OVER_BUDGET = "over_budget"
    INSUFFICIENT_DATA = "insufficient_data"

    ALL = (HEALTHY, AT_RISK, OVER_BUDGET, INSUFFICIENT_DATA)


# -----------------------------------------------------------------------------
# Input guards & rounding helpers
# -----------------------------------------------------------------------------

def _decimal(name: str, value, *, allow_none: bool = False) -> Optional[Decimal]:
    """Rejects anything that is not a Decimal (floats in particular), per financial-rules §4.1."""
    if value is None:
        if allow_none:
            return None
        raise TypeError(f"{name} is required and must be a Decimal, got None.")
    if not isinstance(value, Decimal):
        raise TypeError(f"{name} must be a Decimal, got {type(value).__name__}.")
    if not value.is_finite():
        raise ValueError(f"{name} must be a finite Decimal, got {value}.")
    return value


def money(value: Decimal) -> Decimal:
    return value.quantize(MONEY, rounding=ROUND_HALF_UP)


def percent(value: Decimal) -> Decimal:
    return value.quantize(PERCENT, rounding=ROUND_HALF_UP)


def format_money(amount: Decimal, currency: str) -> str:
    """Formats a money amount for risk reasons, e.g. Decimal('-1500') -> '-$1,500.00'."""
    symbol = CURRENCY_SYMBOLS.get(currency, f"{currency} ")
    quantized = money(amount)
    sign = "-" if quantized < 0 else ""
    return f"{sign}{symbol}{abs(quantized):,.2f}"


# -----------------------------------------------------------------------------
# Formulas (financial-rules §3)
# -----------------------------------------------------------------------------

def total_hours_logged(entries: Iterable[tuple]) -> Decimal:
    total = ZERO
    for hours, _rate in entries:
        total += _decimal("recorded_hours", hours)
    return total.quantize(HOURS, rounding=ROUND_HALF_UP)


def actual_labor_cost(entries: Iterable[tuple]) -> Decimal:
    """§3.1 C_labor = Σ(H_entry × C_entry), each entry rounded to the cent (D1)."""
    total = ZERO
    for hours, rate in entries:
        hours = _decimal("recorded_hours", hours)
        rate = _decimal("hourly_cost_snapshot", rate)
        if hours <= 0:
            raise ValueError(f"recorded_hours must be greater than 0, got {hours}.")
        if rate < 0:
            raise ValueError(f"hourly_cost_snapshot cannot be negative, got {rate}.")
        total += money(hours * rate)
    return money(total)


def sum_expenses(amounts: Iterable[Decimal]) -> Decimal:
    """Sums expense amounts (§3.2 when given APPROVED amounts only)."""
    total = ZERO
    for amount in amounts:
        amount = _decimal("expense amount", amount)
        if amount <= 0:
            raise ValueError(f"expense amount must be greater than 0, got {amount}.")
        total += amount
    return money(total)


def actual_total_cost(labor_cost: Decimal, expense_cost: Decimal) -> Decimal:
    """§3.3 C_actual = C_labor + C_expense."""
    return money(_decimal("labor_cost", labor_cost) + _decimal("expense_cost", expense_cost))


def budget_consumption_percentage(actual_total: Decimal, budget: Optional[Decimal]) -> Optional[Decimal]:
    """§3.4 P_consumed = C_actual / B × 100, or None when B is missing or ≤ 0."""
    actual_total = _decimal("actual_total", actual_total)
    budget = _decimal("planned_cost_budget", budget, allow_none=True)
    if budget is None or budget <= 0:
        return None
    return percent(actual_total / budget * HUNDRED)


def estimated_remaining_labor_cost(
    remaining_hours: Optional[Decimal], planned_rate: Optional[Decimal]
) -> Optional[Decimal]:
    """§3.5 C_rem_labor = H_rem × C_hourly_plan, or None when H_rem is unknown or the rate is unusable."""
    remaining_hours = _decimal("estimated_remaining_hours", remaining_hours, allow_none=True)
    planned_rate = _decimal("planned_hourly_cost", planned_rate, allow_none=True)
    if remaining_hours is None:
        return None
    if remaining_hours < 0:
        raise ValueError(f"estimated_remaining_hours cannot be negative, got {remaining_hours}.")
    if planned_rate is None or planned_rate <= 0:
        return None
    return money(remaining_hours * planned_rate)


def projected_final_cost(
    actual_total: Decimal,
    remaining_labor_cost: Optional[Decimal],
    expected_remaining_expenses: Optional[Decimal],
) -> Optional[Decimal]:
    """§3.6 C_projected = C_actual + C_rem_labor + E_rem (E_rem defaults to 0.00, EC-08)."""
    actual_total = _decimal("actual_total", actual_total)
    remaining_labor_cost = _decimal("remaining_labor_cost", remaining_labor_cost, allow_none=True)
    expected = _decimal("expected_remaining_expenses", expected_remaining_expenses, allow_none=True)
    if remaining_labor_cost is None:
        return None
    return money(actual_total + remaining_labor_cost + (expected if expected is not None else ZERO))


def projected_profit(revenue: Optional[Decimal], projected_final: Optional[Decimal]) -> Optional[Decimal]:
    """§3.7 P_profit = R − C_projected (may be negative), or None when the forecast is unavailable."""
    revenue = _decimal("contract_revenue", revenue, allow_none=True)
    projected_final = _decimal("projected_final_cost", projected_final, allow_none=True)
    if revenue is None or projected_final is None:
        return None
    return money(revenue - projected_final)


def projected_profit_margin_percentage(
    profit: Optional[Decimal], revenue: Optional[Decimal]
) -> Optional[Decimal]:
    """§3.8 M_profit = P_profit / R × 100, or None when R ≤ 0 or profit is unavailable."""
    profit = _decimal("projected_profit", profit, allow_none=True)
    revenue = _decimal("contract_revenue", revenue, allow_none=True)
    if profit is None or revenue is None or revenue <= 0:
        return None
    return percent(profit / revenue * HUNDRED)


# -----------------------------------------------------------------------------
# Risk precedence (financial-rules §7)
# -----------------------------------------------------------------------------

@dataclass(frozen=True)
class RiskAssessment:
    status: str
    rule: int
    reasons: tuple


def classify_risk(
    *,
    actual_total: Decimal,
    budget: Optional[Decimal],
    planned_rate: Optional[Decimal],
    remaining_hours: Optional[Decimal],
    projected_final: Optional[Decimal],
    warning_threshold_pct: Optional[Decimal],
    currency: str = "USD",
) -> RiskAssessment:
    """
    Strict precedence: 1 over_budget → 2 insufficient_data → 3 at_risk → 4 healthy.
    A missing or zero budget is not a spending ceiling, so it always yields insufficient_data
    (EC-01 / TC-NUM-07) rather than over_budget.
    """
    actual_total = _decimal("actual_total", actual_total)
    budget = _decimal("planned_cost_budget", budget, allow_none=True)
    planned_rate = _decimal("planned_hourly_cost", planned_rate, allow_none=True)
    remaining_hours = _decimal("estimated_remaining_hours", remaining_hours, allow_none=True)
    projected_final = _decimal("projected_final_cost", projected_final, allow_none=True)
    warning_threshold_pct = _decimal("warning_threshold_pct", warning_threshold_pct, allow_none=True)

    def fmt(amount):
        return format_money(amount, currency)

    budget_valid = budget is not None and budget > 0

    # Rule 1 — over_budget: actual spending has already breached the ceiling
    if budget_valid and actual_total > budget:
        return RiskAssessment(
            RiskStatus.OVER_BUDGET,
            1,
            (
                f"Actual total cost ({fmt(actual_total)}) exceeds planned budget ({fmt(budget)}) "
                f"by {fmt(actual_total - budget)}.",
            ),
        )

    # Rule 2 — insufficient_data: a trustworthy forecast is impossible
    gaps = []
    if not budget_valid:
        gaps.append("Planned cost budget is missing or zero; budget health cannot be evaluated.")
    if remaining_hours is None:
        gaps.append(
            "Estimated remaining hours is unknown; reliable completion forecast cannot be established."
        )
    if planned_rate is None or planned_rate <= 0:
        gaps.append("Planned hourly cost rate is missing or zero; remaining labor cannot be valued.")
    if gaps:
        lead = (
            ("Actual spending has not breached budget ceiling.",)
            if budget_valid
            else ()
        )
        return RiskAssessment(RiskStatus.INSUFFICIENT_DATA, 2, lead + tuple(gaps))

    # Rule 3 — at_risk: forecast overrun or high-consumption warning
    triggers = []
    if projected_final is not None and projected_final > budget:
        triggers.append(
            f"Projected final cost ({fmt(projected_final)}) exceeds planned budget ({fmt(budget)}) "
            f"by {fmt(projected_final - budget)}."
        )
    if (
        warning_threshold_pct is not None
        and remaining_hours > 0
        and actual_total * HUNDRED >= warning_threshold_pct * budget
    ):
        consumed = percent(actual_total / budget * HUNDRED)
        triggers.append(
            f"Budget consumption ({consumed}%) has reached the {percent(warning_threshold_pct)}% "
            f"warning threshold with {remaining_hours.quantize(HOURS)} hours of work remaining."
        )
    if triggers:
        return RiskAssessment(RiskStatus.AT_RISK, 3, tuple(triggers))

    # Rule 4 — healthy
    return RiskAssessment(
        RiskStatus.HEALTHY,
        4,
        (
            f"Actual total cost ({fmt(actual_total)}) is within planned budget ({fmt(budget)}).",
            f"Projected final cost ({fmt(projected_final)}) is within planned budget ({fmt(budget)}).",
        ),
    )


# -----------------------------------------------------------------------------
# Project & portfolio summaries
# -----------------------------------------------------------------------------

@dataclass(frozen=True)
class ProjectFinancialInputs:
    currency: str
    contract_revenue: Decimal
    planned_cost_budget: Decimal
    planned_hourly_cost: Decimal
    estimated_remaining_hours: Optional[Decimal]
    expected_remaining_expenses: Optional[Decimal]
    time_entries: tuple = ()  # ((recorded_hours, hourly_cost_snapshot), ...)
    approved_expenses: tuple = ()
    pending_expenses: tuple = ()
    rejected_expenses: tuple = ()


@dataclass(frozen=True)
class ProjectFinancialSummary:
    currency: str
    # Baselines
    contract_revenue: Decimal
    planned_cost_budget: Decimal
    planned_hourly_cost: Decimal
    estimated_remaining_hours: Optional[Decimal]
    expected_remaining_expenses: Decimal
    planned_profit: Decimal
    planned_margin_percentage: Optional[Decimal]
    # Actuals
    total_hours_logged: Decimal
    actual_labor_cost: Decimal
    approved_expense_cost: Decimal
    actual_total_cost: Decimal
    pending_expense_cost: Decimal
    pending_expense_count: int
    rejected_expense_cost: Decimal
    budget_consumption_percentage: Optional[Decimal]
    # Forecast
    forecast_available: bool
    estimated_remaining_labor_cost: Optional[Decimal]
    projected_final_cost: Optional[Decimal]
    projected_cost_variance: Optional[Decimal]
    projected_profit: Optional[Decimal]
    projected_profit_margin_percentage: Optional[Decimal]
    reason_unavailable: Optional[str]
    # Risk & metadata
    risk: RiskAssessment
    warning_threshold_percentage: Optional[Decimal]
    assumptions: tuple = field(default_factory=tuple)


def summarize_project(
    inputs: ProjectFinancialInputs, *, warning_threshold_pct: Optional[Decimal]
) -> ProjectFinancialSummary:
    revenue = _decimal("contract_revenue", inputs.contract_revenue)
    budget = _decimal("planned_cost_budget", inputs.planned_cost_budget)
    rate = _decimal("planned_hourly_cost", inputs.planned_hourly_cost)
    remaining_hours = _decimal(
        "estimated_remaining_hours", inputs.estimated_remaining_hours, allow_none=True
    )
    expected = _decimal(
        "expected_remaining_expenses", inputs.expected_remaining_expenses, allow_none=True
    )
    expected = money(expected) if expected is not None else ZERO

    labor = actual_labor_cost(inputs.time_entries)
    approved = sum_expenses(inputs.approved_expenses)
    actual = actual_total_cost(labor, approved)

    remaining_labor = estimated_remaining_labor_cost(remaining_hours, rate)
    projected = projected_final_cost(actual, remaining_labor, expected)
    profit = projected_profit(revenue, projected)

    if remaining_hours is None:
        reason_unavailable = (
            "Estimated remaining hours is null (unknown). Forward projections are suppressed."
        )
    elif remaining_labor is None:
        reason_unavailable = (
            "Planned hourly cost rate is missing or zero. Forward projections are suppressed."
        )
    else:
        reason_unavailable = None

    if expected == ZERO:
        assumptions = (
            f"Expected remaining expenses are assumed to be {format_money(ZERO, inputs.currency)} (MVP default).",
        )
    else:
        assumptions = (
            f"Expected remaining expenses of {format_money(expected, inputs.currency)} are included in the "
            "forecast; reduce them as the corresponding expenses are approved to avoid double counting.",
        )

    risk = classify_risk(
        actual_total=actual,
        budget=budget,
        planned_rate=rate,
        remaining_hours=remaining_hours,
        projected_final=projected,
        warning_threshold_pct=warning_threshold_pct,
        currency=inputs.currency,
    )

    planned_profit = money(revenue - budget)
    return ProjectFinancialSummary(
        currency=inputs.currency,
        contract_revenue=money(revenue),
        planned_cost_budget=money(budget),
        planned_hourly_cost=rate.quantize(RATE, rounding=ROUND_HALF_UP),
        estimated_remaining_hours=(
            remaining_hours.quantize(HOURS, rounding=ROUND_HALF_UP) if remaining_hours is not None else None
        ),
        expected_remaining_expenses=expected,
        planned_profit=planned_profit,
        planned_margin_percentage=projected_profit_margin_percentage(planned_profit, revenue),
        total_hours_logged=total_hours_logged(inputs.time_entries),
        actual_labor_cost=labor,
        approved_expense_cost=approved,
        actual_total_cost=actual,
        pending_expense_cost=sum_expenses(inputs.pending_expenses),
        pending_expense_count=len(inputs.pending_expenses),
        rejected_expense_cost=sum_expenses(inputs.rejected_expenses),
        budget_consumption_percentage=budget_consumption_percentage(actual, budget),
        forecast_available=projected is not None,
        estimated_remaining_labor_cost=remaining_labor,
        projected_final_cost=projected,
        projected_cost_variance=money(projected - budget) if projected is not None else None,
        projected_profit=profit,
        projected_profit_margin_percentage=projected_profit_margin_percentage(profit, revenue),
        reason_unavailable=reason_unavailable,
        risk=risk,
        warning_threshold_percentage=(
            percent(warning_threshold_pct) if warning_threshold_pct is not None else None
        ),
        assumptions=assumptions,
    )


@dataclass(frozen=True)
class PortfolioSummary:
    currency: str
    active_projects_count: int
    total_contract_revenue: Decimal
    total_planned_cost_budget: Decimal
    total_actual_cost_to_date: Decimal
    portfolio_budget_consumption_percentage: Optional[Decimal]
    risk_counts: dict
    forecastable_projects_count: int
    total_projected_final_cost: Decimal
    aggregate_projected_margin_percentage: Optional[Decimal]
    pending_expenses_count: int
    pending_expenses_amount: Decimal

    @property
    def projects_at_risk_count(self) -> int:
        return self.risk_counts[RiskStatus.AT_RISK]

    @property
    def projects_over_budget_count(self) -> int:
        return self.risk_counts[RiskStatus.OVER_BUDGET]


def summarize_portfolio(summaries: Iterable[ProjectFinancialSummary], *, currency: str) -> PortfolioSummary:
    """
    Aggregates single-currency project summaries (financial-rules §4.2: never mix currencies).
    Projected totals and the aggregate margin cover forecastable projects only.
    """
    summaries = list(summaries)
    mixed = {s.currency for s in summaries if s.currency != currency}
    if mixed:
        raise ValueError(f"Cannot aggregate {sorted(mixed)} projects into a {currency} portfolio.")

    risk_counts = {status: 0 for status in RiskStatus.ALL}
    revenue = budget = actual = ZERO
    forecastable_revenue = forecastable_projected = ZERO
    forecastable = pending_count = 0
    pending_amount = ZERO

    for s in summaries:
        risk_counts[s.risk.status] += 1
        revenue += s.contract_revenue
        budget += s.planned_cost_budget
        actual += s.actual_total_cost
        pending_count += s.pending_expense_count
        pending_amount += s.pending_expense_cost
        if s.projected_final_cost is not None:
            forecastable += 1
            forecastable_revenue += s.contract_revenue
            forecastable_projected += s.projected_final_cost

    return PortfolioSummary(
        currency=currency,
        active_projects_count=len(summaries),
        total_contract_revenue=money(revenue),
        total_planned_cost_budget=money(budget),
        total_actual_cost_to_date=money(actual),
        portfolio_budget_consumption_percentage=budget_consumption_percentage(money(actual), money(budget)),
        risk_counts=risk_counts,
        forecastable_projects_count=forecastable,
        total_projected_final_cost=money(forecastable_projected),
        aggregate_projected_margin_percentage=projected_profit_margin_percentage(
            money(forecastable_revenue - forecastable_projected), money(forecastable_revenue)
        ),
        pending_expenses_count=pending_count,
        pending_expenses_amount=money(pending_amount),
    )
