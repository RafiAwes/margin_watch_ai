"""
Pure financial-engine tests (no database). Covers docs/financial-rules.md §8 benchmark
Scenarios 1–5, §9 edge cases, and docs/testing-strategy.md TC-NUM-01…08.
"""

from decimal import Decimal as D

from django.test import SimpleTestCase

from profitability.services import (
    ProjectFinancialInputs,
    RiskStatus,
    actual_labor_cost,
    budget_consumption_percentage,
    classify_risk,
    estimated_remaining_labor_cost,
    format_money,
    projected_profit_margin_percentage,
    summarize_portfolio,
    summarize_project,
    sum_expenses,
)

THRESHOLD = D("80.00")


def scenario(actual_cost, remaining_hours, *, revenue="10000.00", budget="6000.00", rate="50.0000",
             expected="0.00", approved=(), pending=(), rejected=()):
    """Global baseline for Scenarios 1–5: R = $10,000, B = $6,000, C_hourly_plan = $50/hr, E_rem = $0."""
    return ProjectFinancialInputs(
        currency="USD",
        contract_revenue=D(revenue),
        planned_cost_budget=D(budget),
        planned_hourly_cost=D(rate),
        estimated_remaining_hours=D(remaining_hours) if remaining_hours is not None else None,
        expected_remaining_expenses=D(expected) if expected is not None else None,
        # Actual labor expressed as hours at $50/hr
        time_entries=((D(actual_cost) / D("50"), D("50.0000")),) if D(actual_cost) > 0 else (),
        approved_expenses=tuple(D(a) for a in approved),
        pending_expenses=tuple(D(a) for a in pending),
        rejected_expenses=tuple(D(a) for a in rejected),
    )


class BenchmarkScenarioTests(SimpleTestCase):
    """financial-rules §8 — every figure to the cent."""

    def assertFigures(self, s, **expected):
        for name, value in expected.items():
            actual = getattr(s, name)
            self.assertEqual(actual, None if value is None else D(value), name)

    def test_tc_num_01_healthy(self):
        s = summarize_project(scenario("2000.00", "40"), warning_threshold_pct=THRESHOLD)
        self.assertFigures(
            s,
            actual_total_cost="2000.00",
            budget_consumption_percentage="33.33",
            estimated_remaining_labor_cost="2000.00",
            projected_final_cost="4000.00",
            projected_profit="6000.00",
            projected_profit_margin_percentage="60.00",
        )
        self.assertEqual(s.risk.status, RiskStatus.HEALTHY)
        self.assertEqual(s.risk.rule, 4)

    def test_tc_num_02_forecast_over_budget(self):
        s = summarize_project(scenario("4000.00", "50"), warning_threshold_pct=THRESHOLD)
        self.assertFigures(
            s,
            budget_consumption_percentage="66.67",
            estimated_remaining_labor_cost="2500.00",
            projected_final_cost="6500.00",
            projected_profit="3500.00",
            projected_profit_margin_percentage="35.00",
            projected_cost_variance="500.00",
        )
        self.assertEqual(s.risk.status, RiskStatus.AT_RISK)
        self.assertEqual(s.risk.rule, 3)
        self.assertIn("$6,500.00", s.risk.reasons[0])

    def test_tc_num_03_already_over_budget_beats_missing_estimate(self):
        s = summarize_project(scenario("6200.00", None), warning_threshold_pct=THRESHOLD)
        self.assertFigures(
            s,
            budget_consumption_percentage="103.33",
            estimated_remaining_labor_cost=None,
            projected_final_cost=None,
            projected_profit=None,
            projected_profit_margin_percentage=None,
        )
        self.assertEqual(s.risk.status, RiskStatus.OVER_BUDGET)
        self.assertEqual(s.risk.rule, 1)
        self.assertFalse(s.forecast_available)

    def test_tc_num_04_missing_estimate(self):
        s = summarize_project(scenario("2000.00", None), warning_threshold_pct=THRESHOLD)
        self.assertFigures(s, budget_consumption_percentage="33.33", projected_final_cost=None, projected_profit=None)
        self.assertEqual(s.risk.status, RiskStatus.INSUFFICIENT_DATA)
        self.assertEqual(s.risk.rule, 2)
        self.assertIn("null", s.reason_unavailable)

    def test_tc_num_05_high_consumption_warning_on(self):
        s = summarize_project(scenario("4900.00", "10"), warning_threshold_pct=THRESHOLD)
        self.assertFigures(
            s,
            budget_consumption_percentage="81.67",
            estimated_remaining_labor_cost="500.00",
            projected_final_cost="5400.00",
            projected_profit="4600.00",
            projected_profit_margin_percentage="46.00",
        )
        self.assertEqual(s.risk.status, RiskStatus.AT_RISK)
        self.assertIn("81.67%", s.risk.reasons[0])

    def test_scenario_5_high_consumption_warning_off(self):
        s = summarize_project(scenario("4900.00", "10"), warning_threshold_pct=None)
        self.assertEqual(s.risk.status, RiskStatus.HEALTHY)
        self.assertIsNone(s.warning_threshold_percentage)


class EdgeCaseTests(SimpleTestCase):
    """financial-rules §9 and TC-NUM-06…08."""

    def test_tc_num_06_zero_remaining_hours(self):
        s = summarize_project(scenario("4000.00", "0"), warning_threshold_pct=THRESHOLD)
        self.assertEqual(s.estimated_remaining_labor_cost, D("0.00"))
        self.assertEqual(s.projected_final_cost, D("4000.00"))
        self.assertEqual(s.risk.status, RiskStatus.HEALTHY)

    def test_tc_num_07_zero_budget(self):
        s = summarize_project(scenario("2000.00", "40", budget="0.00"), warning_threshold_pct=THRESHOLD)
        self.assertIsNone(s.budget_consumption_percentage)
        self.assertEqual(s.risk.status, RiskStatus.INSUFFICIENT_DATA)
        self.assertIn("budget is missing or zero", s.risk.reasons[0])

    def test_tc_num_08_only_approved_expenses_count(self):
        s = summarize_project(
            scenario("0", "10", approved=["1000.00"], pending=["500.00"], rejected=["200.00"]),
            warning_threshold_pct=THRESHOLD,
        )
        self.assertEqual(s.approved_expense_cost, D("1000.00"))
        self.assertEqual(s.actual_total_cost, D("1000.00"))
        self.assertEqual(s.pending_expense_cost, D("500.00"))
        self.assertEqual(s.pending_expense_count, 1)
        self.assertEqual(s.rejected_expense_cost, D("200.00"))

    def test_ec_02_zero_revenue(self):
        s = summarize_project(scenario("1000.00", "20", revenue="0.00", budget="5000.00"), warning_threshold_pct=THRESHOLD)
        self.assertEqual(s.projected_profit, D("-2000.00"))
        self.assertIsNone(s.projected_profit_margin_percentage)
        self.assertIsNone(s.planned_margin_percentage)
        self.assertEqual(s.risk.status, RiskStatus.HEALTHY)

    def test_ec_03_exactly_100_percent_consumed_with_work_left(self):
        s = summarize_project(scenario("6000.00", "5"), warning_threshold_pct=THRESHOLD)
        self.assertEqual(s.budget_consumption_percentage, D("100.00"))
        self.assertEqual(s.projected_final_cost, D("6250.00"))
        self.assertEqual(s.risk.status, RiskStatus.AT_RISK)

    def test_ec_07_zero_remaining_hours_over_budget(self):
        s = summarize_project(scenario("6500.00", "0"), warning_threshold_pct=THRESHOLD)
        self.assertEqual(s.risk.status, RiskStatus.OVER_BUDGET)

    def test_ec_08_expected_remaining_expenses_default_and_explicit(self):
        omitted = summarize_project(scenario("2000.00", "40", expected=None), warning_threshold_pct=THRESHOLD)
        self.assertEqual(omitted.expected_remaining_expenses, D("0.00"))
        self.assertEqual(omitted.projected_final_cost, D("4000.00"))
        self.assertIn("MVP default", omitted.assumptions[0])

        explicit = summarize_project(scenario("2000.00", "40", expected="1000.00"), warning_threshold_pct=THRESHOLD)
        self.assertEqual(explicit.projected_final_cost, D("5000.00"))
        self.assertIn("double counting", explicit.assumptions[0])

    def test_planned_profit_and_margin(self):
        s = summarize_project(scenario("0", "10"), warning_threshold_pct=THRESHOLD)
        self.assertEqual(s.planned_profit, D("4000.00"))
        self.assertEqual(s.planned_margin_percentage, D("40.00"))


class PrecedenceBoundaryTests(SimpleTestCase):
    """financial-rules §7.2 boundary comparisons."""

    def risk(self, actual, remaining, budget="6000.00", threshold=THRESHOLD):
        s = summarize_project(scenario(actual, remaining, budget=budget), warning_threshold_pct=threshold)
        return s.risk.status

    def test_projected_equal_to_budget_is_healthy(self):
        # 2000 actual + 80 h × $50 = 6000 exactly, consumption 33 %
        self.assertEqual(self.risk("2000.00", "80"), RiskStatus.HEALTHY)

    def test_consumption_exactly_80_percent_with_work_left_is_at_risk(self):
        self.assertEqual(self.risk("4800.00", "1"), RiskStatus.AT_RISK)

    def test_consumption_just_below_80_percent_is_not_triggered(self):
        # 4799.40 / 6000 = 79.99 %; forecast 4849.40 within budget
        self.assertEqual(self.risk("4799.40", "1"), RiskStatus.HEALTHY)

    def test_value_that_rounds_to_80_does_not_trigger(self):
        # 4799.99 / 6000 = 79.99983 % — displays as 80.00 % but is below the threshold
        s = summarize_project(scenario("4799.99", "0.01"), warning_threshold_pct=THRESHOLD)
        self.assertEqual(s.budget_consumption_percentage, D("80.00"))
        self.assertEqual(s.risk.status, RiskStatus.HEALTHY)

    def test_consumption_warning_needs_remaining_work(self):
        self.assertEqual(self.risk("4900.00", "0"), RiskStatus.HEALTHY)

    def test_one_cent_over_budget(self):
        self.assertEqual(self.risk("6000.01", "0"), RiskStatus.OVER_BUDGET)

    def test_custom_threshold(self):
        self.assertEqual(self.risk("4500.00", "1", threshold=D("75")), RiskStatus.AT_RISK)
        self.assertEqual(self.risk("4500.00", "1", threshold=D("90")), RiskStatus.HEALTHY)

    def test_unusable_planned_rate_is_insufficient_data(self):
        risk = classify_risk(
            actual_total=D("100.00"), budget=D("6000.00"), planned_rate=D("0"),
            remaining_hours=D("10"), projected_final=None, warning_threshold_pct=THRESHOLD,
        )
        self.assertEqual(risk.status, RiskStatus.INSUFFICIENT_DATA)


class ArithmeticTests(SimpleTestCase):
    def test_labor_cost_rounds_each_entry_to_the_cent(self):
        # 1.33 h × $62.50 = $83.125 → $83.13 per entry (matches TimeEntry.computed_cost)
        entries = [(D("1.33"), D("62.5000")), (D("1.33"), D("62.5000"))]
        self.assertEqual(actual_labor_cost(entries), D("166.26"))

    def test_round_half_up(self):
        self.assertEqual(budget_consumption_percentage(D("1.00"), D("8.00")), D("12.50"))
        self.assertEqual(budget_consumption_percentage(D("0.01"), D("0.08")), D("12.50"))
        self.assertEqual(projected_profit_margin_percentage(D("1.00"), D("3.00")), D("33.33"))
        self.assertEqual(projected_profit_margin_percentage(D("2.00"), D("3.00")), D("66.67"))

    def test_floats_are_rejected(self):
        with self.assertRaises(TypeError):
            actual_labor_cost([(1.5, D("50.0000"))])
        with self.assertRaises(TypeError):
            budget_consumption_percentage(D("100.00"), 6000.0)
        with self.assertRaises(TypeError):
            sum_expenses([19.99])

    def test_invalid_values_are_rejected(self):
        with self.assertRaises(ValueError):
            actual_labor_cost([(D("-1.00"), D("50.0000"))])
        with self.assertRaises(ValueError):
            estimated_remaining_labor_cost(D("-5"), D("50.0000"))
        with self.assertRaises(ValueError):
            sum_expenses([D("0.00")])

    def test_none_and_zero_inputs_never_raise(self):
        self.assertIsNone(budget_consumption_percentage(D("10.00"), None))
        self.assertIsNone(budget_consumption_percentage(D("10.00"), D("0")))
        self.assertIsNone(estimated_remaining_labor_cost(None, D("50.0000")))
        self.assertIsNone(projected_profit_margin_percentage(D("10.00"), D("0")))
        self.assertEqual(actual_labor_cost([]), D("0.00"))
        self.assertEqual(sum_expenses([]), D("0.00"))

    def test_format_money(self):
        self.assertEqual(format_money(D("15700"), "USD"), "$15,700.00")
        self.assertEqual(format_money(D("-500.5"), "EUR"), "-€500.50")
        self.assertEqual(format_money(D("12"), "JPY"), "JPY 12.00")


class PortfolioTests(SimpleTestCase):
    def test_portfolio_totals_and_forecastable_subset(self):
        healthy = summarize_project(scenario("2000.00", "40", pending=["150.00"]), warning_threshold_pct=THRESHOLD)
        over = summarize_project(scenario("6200.00", None), warning_threshold_pct=THRESHOLD)
        at_risk = summarize_project(scenario("4000.00", "50"), warning_threshold_pct=THRESHOLD)

        p = summarize_portfolio([healthy, over, at_risk], currency="USD")
        self.assertEqual(p.active_projects_count, 3)
        self.assertEqual(p.total_contract_revenue, D("30000.00"))
        self.assertEqual(p.total_planned_cost_budget, D("18000.00"))
        self.assertEqual(p.total_actual_cost_to_date, D("12200.00"))
        self.assertEqual(p.portfolio_budget_consumption_percentage, D("67.78"))
        self.assertEqual(p.risk_counts, {"healthy": 1, "at_risk": 1, "over_budget": 1, "insufficient_data": 0})
        self.assertEqual(p.projects_at_risk_count, 1)
        self.assertEqual(p.projects_over_budget_count, 1)
        # Forecast figures exclude the over-budget project with no estimate
        self.assertEqual(p.forecastable_projects_count, 2)
        self.assertEqual(p.total_projected_final_cost, D("10500.00"))
        self.assertEqual(p.aggregate_projected_margin_percentage, D("47.50"))
        self.assertEqual(p.pending_expenses_count, 1)
        self.assertEqual(p.pending_expenses_amount, D("150.00"))

    def test_empty_portfolio(self):
        p = summarize_portfolio([], currency="USD")
        self.assertEqual(p.active_projects_count, 0)
        self.assertEqual(p.total_actual_cost_to_date, D("0.00"))
        self.assertIsNone(p.portfolio_budget_consumption_percentage)
        self.assertIsNone(p.aggregate_projected_margin_percentage)

    def test_mixed_currencies_are_refused(self):
        usd = summarize_project(scenario("100.00", "1"), warning_threshold_pct=THRESHOLD)
        eur = summarize_project(
            ProjectFinancialInputs(
                currency="EUR", contract_revenue=D("1000"), planned_cost_budget=D("500"),
                planned_hourly_cost=D("50"), estimated_remaining_hours=D("1"),
                expected_remaining_expenses=D("0"),
            ),
            warning_threshold_pct=THRESHOLD,
        )
        with self.assertRaises(ValueError):
            summarize_portfolio([usd, eur], currency="USD")
