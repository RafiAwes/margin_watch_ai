import { CurrencyCode, ProjectFinancials, ProjectRiskStatus } from '../types/domain';
import { PortfolioSummary } from '../lib/financial-engine';
import { apiClient } from './api-client';

/**
 * Financial figures come only from the backend engine (/projects/financial-summaries/,
 * /dashboard/summary/). The frontend never recalculates them; decimal strings are
 * converted to numbers for display formatting only.
 */

// Backend risk vocabulary (financial-rules §7) → existing UI vocabulary
const RISK_STATUS_MAP: Record<string, ProjectRiskStatus> = {
  healthy: 'HEALTHY',
  at_risk: 'WARNING',
  over_budget: 'CRITICAL',
  insufficient_data: 'INCOMPLETE_DATA',
};

const toNumber = (value: string | null | undefined): number | null =>
  value === null || value === undefined ? null : Number(value);

const toAmount = (value: string | null | undefined): number => toNumber(value) ?? 0;

/** Placeholder for users who may not see financials (team members) or before data loads. */
export const UNAVAILABLE_FINANCIALS: ProjectFinancials = {
  actual_hours_logged: 0,
  actual_labor_cost: 0,
  actual_expense_cost: 0,
  pending_expense_amount: 0,
  rejected_expense_amount: 0,
  actual_total_cost: 0,
  budget_consumed_pct: null,
  projected_remaining_cost: null,
  projected_final_cost: null,
  projected_cost_variance: null,
  projected_profit: null,
  projected_margin_pct: null,
  planned_profit: 0,
  planned_margin_pct: null,
  risk_status: 'INCOMPLETE_DATA',
  risk_reasons: ['Financial figures are not available.'],
};

export const EMPTY_PORTFOLIO: PortfolioSummary = {
  currency: 'USD',
  active_projects_count: 0,
  healthy_count: 0,
  warning_count: 0,
  critical_count: 0,
  at_risk_count: 0,
  incomplete_data_count: 0,
  total_actual_cost: 0,
  total_planned_budget: 0,
  budget_consumed_pct: null,
  total_projected_final_cost: 0,
  aggregate_projected_margin_pct: null,
  excluded_incomplete_projects_count: 0,
  pending_expenses_count: 0,
  pending_expenses_amount: 0,
};

export function transformFinancialSummary(api: any): ProjectFinancials {
  const { baselines, actuals, forecast, risk } = api;
  return {
    actual_hours_logged: toAmount(actuals.total_hours_logged),
    actual_labor_cost: toAmount(actuals.actual_labor_cost),
    actual_expense_cost: toAmount(actuals.approved_expense_cost),
    pending_expense_amount: toAmount(actuals.pending_expense_cost),
    rejected_expense_amount: toAmount(actuals.rejected_expense_cost),
    actual_total_cost: toAmount(actuals.actual_total_cost),
    budget_consumed_pct: toNumber(actuals.budget_consumption_percentage),
    projected_remaining_cost: toNumber(forecast.estimated_remaining_labor_cost),
    projected_final_cost: toNumber(forecast.projected_final_cost),
    projected_cost_variance: toNumber(forecast.projected_cost_variance),
    projected_profit: toNumber(forecast.projected_profit),
    projected_margin_pct: toNumber(forecast.projected_profit_margin_percentage),
    planned_profit: toAmount(baselines.planned_profit),
    planned_margin_pct: toNumber(baselines.planned_margin_percentage),
    risk_status: RISK_STATUS_MAP[risk.status] ?? 'INCOMPLETE_DATA',
    risk_reasons: Array.isArray(risk.reasons) ? risk.reasons : [],
  };
}

export function transformPortfolioSummary(api: any): PortfolioSummary {
  const counts = api.risk_counts || {};
  return {
    currency: (api.currency || 'USD') as CurrencyCode,
    active_projects_count: api.active_projects_count ?? 0,
    healthy_count: counts.healthy ?? 0,
    warning_count: counts.at_risk ?? 0,
    critical_count: counts.over_budget ?? 0,
    // "Needs attention" in the UI = at risk + over budget
    at_risk_count: (counts.at_risk ?? 0) + (counts.over_budget ?? 0),
    incomplete_data_count: counts.insufficient_data ?? 0,
    total_actual_cost: toAmount(api.total_actual_cost_to_date),
    total_planned_budget: toAmount(api.total_planned_cost_budget),
    budget_consumed_pct: toNumber(api.portfolio_budget_consumption_percentage),
    total_projected_final_cost: toAmount(api.total_projected_final_cost),
    aggregate_projected_margin_pct: toNumber(api.aggregate_projected_margin_percentage),
    excluded_incomplete_projects_count:
      (api.active_projects_count ?? 0) - (api.forecastable_projects_count ?? 0),
    pending_expenses_count: api.pending_expenses_count ?? 0,
    pending_expenses_amount: toAmount(api.pending_expenses_amount),
  };
}

/** All projects' summaries keyed by project id. */
export async function fetchProjectFinancials(): Promise<Record<string, ProjectFinancials>> {
  const rows = await apiClient.financials.listSummaries();
  const byProject: Record<string, ProjectFinancials> = {};
  for (const row of rows) {
    byProject[String(row.project_id)] = transformFinancialSummary(row);
  }
  return byProject;
}

export async function fetchPortfolioSummary(currency: CurrencyCode = 'USD'): Promise<PortfolioSummary> {
  return transformPortfolioSummary(await apiClient.financials.dashboard(currency));
}
