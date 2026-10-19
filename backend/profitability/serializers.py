"""
Financial-engine dataclasses → response JSON (docs/api-specification.md §7).
Decimals are emitted as fixed-point strings; unavailable figures as null.
"""


def _str(value):
    return None if value is None else str(value)


def project_summary_data(project, summary):
    return {
        "project_id": str(project.id),
        "project_name": project.name,
        "currency": summary.currency,
        "baselines": {
            "contract_revenue": _str(summary.contract_revenue),
            "planned_cost_budget": _str(summary.planned_cost_budget),
            "planned_hourly_cost_rate": _str(summary.planned_hourly_cost),
            "estimated_remaining_hours": _str(summary.estimated_remaining_hours),
            "expected_remaining_expenses": _str(summary.expected_remaining_expenses),
            "planned_profit": _str(summary.planned_profit),
            "planned_margin_percentage": _str(summary.planned_margin_percentage),
        },
        "actuals": {
            "total_hours_logged": _str(summary.total_hours_logged),
            "actual_labor_cost": _str(summary.actual_labor_cost),
            "approved_expense_cost": _str(summary.approved_expense_cost),
            "actual_total_cost": _str(summary.actual_total_cost),
            "pending_expense_cost": _str(summary.pending_expense_cost),
            "pending_expense_count": summary.pending_expense_count,
            "rejected_expense_cost": _str(summary.rejected_expense_cost),
            "budget_consumption_percentage": _str(summary.budget_consumption_percentage),
        },
        "forecast": {
            "forecast_available": summary.forecast_available,
            "estimated_remaining_labor_cost": _str(summary.estimated_remaining_labor_cost),
            "projected_final_cost": _str(summary.projected_final_cost),
            "projected_cost_variance": _str(summary.projected_cost_variance),
            "projected_profit": _str(summary.projected_profit),
            "projected_profit_margin_percentage": _str(summary.projected_profit_margin_percentage),
            "reason_unavailable": summary.reason_unavailable,
        },
        "risk": {
            "status": summary.risk.status,
            "rule": summary.risk.rule,
            "reasons": list(summary.risk.reasons),
        },
        "metadata": {
            "warning_threshold_percentage": _str(summary.warning_threshold_percentage),
            "assumptions": list(summary.assumptions),
        },
    }


def portfolio_summary_data(portfolio):
    return {
        "currency": portfolio.currency,
        "active_projects_count": portfolio.active_projects_count,
        "total_contract_revenue": _str(portfolio.total_contract_revenue),
        "total_planned_cost_budget": _str(portfolio.total_planned_cost_budget),
        "total_actual_cost_to_date": _str(portfolio.total_actual_cost_to_date),
        "portfolio_budget_consumption_percentage": _str(portfolio.portfolio_budget_consumption_percentage),
        "projects_at_risk_count": portfolio.projects_at_risk_count,
        "projects_over_budget_count": portfolio.projects_over_budget_count,
        "risk_counts": dict(portfolio.risk_counts),
        "forecastable_projects_count": portfolio.forecastable_projects_count,
        "total_projected_final_cost": _str(portfolio.total_projected_final_cost),
        "aggregate_projected_margin_percentage": _str(portfolio.aggregate_projected_margin_percentage),
        "pending_expenses_count": portfolio.pending_expenses_count,
        "pending_expenses_amount": _str(portfolio.pending_expenses_amount),
    }
