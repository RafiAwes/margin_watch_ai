import json

from django.test import SimpleTestCase

from ai_advisor.validation import InvalidAdvice, parse_and_validate, unverified_numbers

# Context shaped like docs/ai-risk-advisor.md §2 (values as strings, as build_context emits them)
CONTEXT = {
    "project_code": "PRJ-3FA85F64",
    "project_status": "ACTIVE",
    "currency": "USD",
    "contract_revenue": "45000.00",
    "planned_cost_budget": "28000.00",
    "total_hours_logged": "180.00",
    "actual_labor_cost": "13500.00",
    "approved_expenses": "2200.00",
    "actual_total_cost": "15700.00",
    "budget_consumption_percentage": "56.07",
    "estimated_remaining_hours": "140.00",
    "planned_hourly_cost_rate": "75.0000",
    "estimated_remaining_labor_cost": "10500.00",
    "expected_remaining_expenses": "0.00",
    "projected_final_cost": "26200.00",
    "projected_cost_variance": "-1800.00",
    "projected_profit": "18800.00",
    "projected_profit_margin_percentage": "41.78",
    "pending_expenses_count": 2,
    "pending_expenses_total": "450.00",
    "deterministic_status": "healthy",
    "deterministic_rule": 4,
    "deterministic_reasons": [
        "Actual total cost ($15,700.00) is within planned budget ($28,000.00).",
        "Projected final cost ($26,200.00) is within planned budget ($28,000.00).",
    ],
    "warning_threshold_percentage": "80.00",
    "assumptions": ["Expected remaining expenses are assumed to be $0.00 (MVP default)."],
}


def reply(**overrides):
    data = {
        "executive_summary": "The project is healthy: $15,700 spent of a $28,000 budget (56.07%).",
        "primary_risk_drivers": [
            "Remaining labor of 140 hours at $75/hr ($10,500) keeps the projected cost at $26,200.",
        ],
        "actionable_recommendations": [
            "Review the 2 pending expenses totalling $450 before the next milestone.",
            "Protect the $1,800 forecast buffer by gating scope changes behind change orders.",
        ],
        "data_gaps_and_assumptions": ["Assumes the 140-hour estimate is current."],
    }
    data.update(overrides)
    return json.dumps(data)


class ValidationTests(SimpleTestCase):
    def test_valid_reply_passes(self):
        advice = parse_and_validate(reply(), CONTEXT)
        self.assertEqual(len(advice["actionable_recommendations"]), 2)

    def test_display_forms_of_context_figures_are_accepted(self):
        advice = parse_and_validate(
            reply(executive_summary="Healthy: 56.1% consumed, $15,700.00 of $28,000, 41.78% margin, 180 hours logged."),
            CONTEXT,
        )
        self.assertIn("56.1%", advice["executive_summary"])

    def test_safe_derivations_are_accepted(self):
        # $12,300 remaining budget (28,000 − 15,700) and a 20% buffer below the 80% threshold
        parse_and_validate(
            reply(executive_summary="Healthy, with $12,300 of budget left and a 43.93% consumption buffer; the 20% buffer rule is not triggered."),
            CONTEXT,
        )

    def test_invented_figure_is_rejected(self):
        with self.assertRaises(InvalidAdvice) as ctx:
            parse_and_validate(reply(executive_summary="The project will finish at $31,250 (healthy)."), CONTEXT)
        self.assertIn("$31,250", str(ctx.exception))

    def test_rounded_away_figure_is_rejected(self):
        # $26,200 must not become "$26k" style arithmetic like $26,000
        self.assertEqual(
            unverified_numbers(
                {"executive_summary": "About $26,000 projected.", "primary_risk_drivers": [],
                 "actionable_recommendations": [], "data_gaps_and_assumptions": []},
                CONTEXT,
            ),
            ["$26,000"],
        )

    def test_small_integers_and_codes_are_ignored(self):
        parse_and_validate(
            reply(executive_summary="PRJ-3FA85F64 is healthy under rule 4 with 2 pending items within 7 days."),
            CONTEXT,
        )

    def test_invalid_json(self):
        with self.assertRaises(InvalidAdvice):
            parse_and_validate("Here is my analysis: the project is fine.", CONTEXT)
        with self.assertRaises(InvalidAdvice):
            parse_and_validate("[]", CONTEXT)

    def test_schema_violations(self):
        for bad in (
            reply(extra_field="nope"),
            reply(executive_summary=""),
            reply(executive_summary="x" * 601),
            reply(primary_risk_drivers=[]),
            reply(primary_risk_drivers=["a", "b", "c", "d"]),
            reply(actionable_recommendations=["only one"]),
            reply(actionable_recommendations=["a", "b", "c", "d", "e"]),
            reply(data_gaps_and_assumptions=["a"] * 5),
            reply(data_gaps_and_assumptions="not a list"),
            reply(primary_risk_drivers=[42]),
        ):
            with self.assertRaises(InvalidAdvice, msg=bad[:80]):
                parse_and_validate(bad, CONTEXT)

    def test_missing_key(self):
        data = json.loads(reply())
        del data["data_gaps_and_assumptions"]
        with self.assertRaises(InvalidAdvice):
            parse_and_validate(json.dumps(data), CONTEXT)
