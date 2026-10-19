import {
  Client,
  CurrencyCode,
  EnrichedProject,
  Expense,
  Project,
  ProjectFinancials,
  ProjectRiskStatus,
  TimeEntry,
} from '../types/domain';

export interface PortfolioSummary {
  currency: CurrencyCode;
  active_projects_count: number;
  healthy_count: number;
  warning_count: number;
  critical_count: number;
  at_risk_count: number;
  incomplete_data_count: number;
  total_actual_cost: number;
  total_planned_budget: number;
  budget_consumed_pct: number | null;
  total_projected_final_cost: number;
  aggregate_projected_margin_pct: number | null;
  excluded_incomplete_projects_count: number;
  pending_expenses_count: number;
  pending_expenses_amount: number;
}

export function formatCurrency(
  amount: number | null | undefined,
  currency: CurrencyCode = 'USD',
  fallback: string = '-'
): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return fallback;
  }
  const symbols: Record<CurrencyCode, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
  };
  const symbol = symbols[currency] || '$';
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return isNegative ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || isNaN(hours)) {
    return '-';
  }
  return `${hours.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}h`;
}

export function formatPercentage(
  pct: number | null | undefined,
  decimals: number = 1
): string {
  if (pct === null || pct === undefined || isNaN(pct)) {
    return '-';
  }
  return `${pct.toFixed(decimals)}%`;
}
