"""
Database → financial-engine inputs.

Loads every input for any number of projects in a fixed number of queries (one for time
entries, one for expenses, plus the caller's project query) and sums in Python so `Decimal`
exactness never depends on the database's own arithmetic.
"""

from collections import defaultdict

from django.conf import settings

from expenses.models import Expense, ExpenseStatus
from profitability.services import ProjectFinancialInputs, summarize_project
from time_tracking.models import TimeEntry


def warning_threshold_pct():
    return settings.MARGINWATCH_CONSUMPTION_WARNING_PCT


def load_financial_inputs(projects):
    """Returns {project.id: ProjectFinancialInputs} for an iterable of Project instances."""
    projects = list(projects)
    ids = [p.id for p in projects]

    entries = defaultdict(list)
    for project_id, hours, rate in (
        TimeEntry.objects.filter(project_id__in=ids)
        .order_by()
        .values_list("project_id", "recorded_hours", "hourly_cost_snapshot")
    ):
        entries[project_id].append((hours, rate))

    expenses = defaultdict(lambda: defaultdict(list))
    for project_id, status, amount in (
        Expense.objects.filter(project_id__in=ids)
        .order_by()
        .values_list("project_id", "status", "amount")
    ):
        expenses[project_id][status].append(amount)

    return {
        p.id: ProjectFinancialInputs(
            currency=p.currency,
            contract_revenue=p.contract_revenue,
            planned_cost_budget=p.planned_cost_budget,
            planned_hourly_cost=p.planned_hourly_cost,
            estimated_remaining_hours=p.estimated_remaining_hours,
            expected_remaining_expenses=p.expected_remaining_expenses,
            time_entries=tuple(entries[p.id]),
            approved_expenses=tuple(expenses[p.id][ExpenseStatus.APPROVED]),
            pending_expenses=tuple(expenses[p.id][ExpenseStatus.PENDING]),
            rejected_expenses=tuple(expenses[p.id][ExpenseStatus.REJECTED]),
        )
        for p in projects
    }


def summarize_projects(projects):
    """Returns [(project, ProjectFinancialSummary), ...] in the given project order."""
    projects = list(projects)
    inputs = load_financial_inputs(projects)
    threshold = warning_threshold_pct()
    return [(p, summarize_project(inputs[p.id], warning_threshold_pct=threshold)) for p in projects]
