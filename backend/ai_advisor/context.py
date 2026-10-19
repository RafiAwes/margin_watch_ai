"""
Phase 6 financial summary → sanitized context for the AI advisor.

Built from an explicit allow-list (docs/ai-risk-advisor.md §2, security-and-permissions.md §3.3):
only aggregated, anonymized project metrics are included. Project and client names, descriptions,
user names/emails, per-person rates and individual time entries or expenses are never sent.
"""

CONTEXT_KEYS = (
    "project_code",
    "project_status",
    "currency",
    "contract_revenue",
    "planned_cost_budget",
    "total_hours_logged",
    "actual_labor_cost",
    "approved_expenses",
    "actual_total_cost",
    "budget_consumption_percentage",
    "estimated_remaining_hours",
    "planned_hourly_cost_rate",
    "estimated_remaining_labor_cost",
    "expected_remaining_expenses",
    "projected_final_cost",
    "projected_cost_variance",
    "projected_profit",
    "projected_profit_margin_percentage",
    "pending_expenses_count",
    "pending_expenses_total",
    "deterministic_status",
    "deterministic_rule",
    "deterministic_reasons",
    "warning_threshold_percentage",
    "assumptions",
)


def _str(value):
    return None if value is None else str(value)


def project_code(project_id) -> str:
    """Neutral identifier sent instead of the project name (plan D7)."""
    return f"PRJ-{str(project_id).replace('-', '')[:8].upper()}"


def build_context(project, summary) -> dict:
    context = {
        "project_code": project_code(project.id),
        "project_status": project.status,
        "currency": summary.currency,
        "contract_revenue": _str(summary.contract_revenue),
        "planned_cost_budget": _str(summary.planned_cost_budget),
        "total_hours_logged": _str(summary.total_hours_logged),
        "actual_labor_cost": _str(summary.actual_labor_cost),
        "approved_expenses": _str(summary.approved_expense_cost),
        "actual_total_cost": _str(summary.actual_total_cost),
        "budget_consumption_percentage": _str(summary.budget_consumption_percentage),
        "estimated_remaining_hours": _str(summary.estimated_remaining_hours),
        "planned_hourly_cost_rate": _str(summary.planned_hourly_cost),
        "estimated_remaining_labor_cost": _str(summary.estimated_remaining_labor_cost),
        "expected_remaining_expenses": _str(summary.expected_remaining_expenses),
        "projected_final_cost": _str(summary.projected_final_cost),
        "projected_cost_variance": _str(summary.projected_cost_variance),
        "projected_profit": _str(summary.projected_profit),
        "projected_profit_margin_percentage": _str(summary.projected_profit_margin_percentage),
        "pending_expenses_count": summary.pending_expense_count,
        "pending_expenses_total": _str(summary.pending_expense_cost),
        "deterministic_status": summary.risk.status,
        "deterministic_rule": summary.risk.rule,
        "deterministic_reasons": list(summary.risk.reasons),
        "warning_threshold_percentage": _str(summary.warning_threshold_percentage),
        "assumptions": list(summary.assumptions),
    }
    assert tuple(context) == CONTEXT_KEYS
    return context
