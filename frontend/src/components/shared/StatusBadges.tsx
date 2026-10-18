import React, { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  Table as TableIcon,
  BarChart3,
  XCircle,
} from 'lucide-react';
import {
  ClientStatus,
  CurrencyCode,
  EnrichedProject,
  ExpenseStatus,
  ProjectRiskStatus,
  ProjectStatus,
} from '../../types/domain';
import { formatCurrency, formatPercentage } from '../../lib/financial-engine';

export const RiskStatusBadge: React.FC<{
  status: ProjectRiskStatus;
  size?: 'sm' | 'md';
}> = ({ status, size = 'md' }) => {
  const sizeClasses =
    size === 'sm' ? 'px-2.5 py-0.5 text-xs gap-1' : 'px-3 py-1 text-xs gap-1.5';

  switch (status) {
    case 'CRITICAL':
      return (
        <span
          className={`inline-flex items-center font-medium rounded-lg border bg-[#FFF1F2] border-[#FECDD3] text-[#BE123C] whitespace-nowrap shrink-0 ${sizeClasses}`}
        >
          <AlertOctagon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Critical · Over Budget</span>
        </span>
      );
    case 'WARNING':
      return (
        <span
          className={`inline-flex items-center font-medium rounded-lg border bg-[#FFFBEB] border-[#FDE68A] text-[#B45309] whitespace-nowrap shrink-0 ${sizeClasses}`}
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>At Risk · Warning</span>
        </span>
      );
    case 'INCOMPLETE_DATA':
      return (
        <span
          className={`inline-flex items-center font-medium rounded-lg border bg-[#F0F2F6] border-[#CBD0DC] text-[#4E5666] whitespace-nowrap shrink-0 ${sizeClasses}`}
        >
          <HelpCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Missing Estimate</span>
        </span>
      );
    case 'HEALTHY':
    default:
      return (
        <span
          className={`inline-flex items-center font-medium rounded-lg border bg-[#ECFDF5] border-[#A7F3D0] text-[#047857] whitespace-nowrap shrink-0 ${sizeClasses}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Healthy</span>
        </span>
      );
  }
};

export const ExpenseStatusBadge: React.FC<{ status: ExpenseStatus }> = ({ status }) => {
  switch (status) {
    case 'APPROVED':
      return (
        <span
          title="Included in Actual Project Cost"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border bg-[#ECFDF5] border-[#A7F3D0] text-[#047857] whitespace-nowrap shrink-0"
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Approved</span>
        </span>
      );
    case 'REJECTED':
      return (
        <span
          title="Excluded from Actual Project Cost ($0.00 impact)"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border bg-[#FFF1F2] border-[#FECDD3] text-[#BE123C] whitespace-nowrap shrink-0"
        >
          <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Rejected</span>
        </span>
      );
    case 'PENDING':
    default:
      return (
        <span
          title="Excluded from Actual Project Cost until approved by an Agency Manager"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border bg-[#FFFBEB] border-[#FDE68A] text-[#B45309] whitespace-nowrap shrink-0"
        >
          <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Pending Approval</span>
        </span>
      );
  }
};

export const LifecycleText: React.FC<{ status: ProjectStatus | ClientStatus }> = ({
  status,
}) => {
  const labels: Record<string, string> = {
    DRAFT: 'Draft',
    ACTIVE: 'Active',
    ON_HOLD: 'On Hold',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    ARCHIVED: 'Archived',
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4E5666] whitespace-nowrap">
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === 'ACTIVE'
            ? 'bg-[#10B981]'
            : status === 'ON_HOLD'
            ? 'bg-[#F59E0B]'
            : 'bg-[#94A3B8]'
        }`}
      />
      <span>{labels[status] ?? status}</span>
    </span>
  );
};

/**
 * Accessible Budget vs. Actual vs. Projected Final Cost Visualization
 * Implements solid fill for Actual Cost, diagonal SVG hatch pattern for Projected Remaining Cost,
 * explicit missing-estimate callout when estimated_remaining_hours === null,
 * and an accessible Chart | Data Table toggle.
 */
export const BudgetForecastChart: React.FC<{
  projects: EnrichedProject[];
  currency?: CurrencyCode;
  onSelectProject?: (projectId: string) => void;
  onRequestEstimate?: (project: EnrichedProject) => void;
}> = ({ projects, currency = 'USD', onSelectProject, onRequestEstimate }) => {
  const [viewMode, setViewMode] = useState<'CHART' | 'TABLE'>('CHART');

  const maxDollarValue = Math.max(
    1,
    ...projects.map((p) =>
      Math.max(
        p.planned_cost_budget,
        p.financials.actual_total_cost,
        p.financials.projected_final_cost ?? 0
      )
    )
  );

  return (
    <div className="bg-white border border-[#E3E6ED] rounded-2xl p-5 sm:p-6 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E3E6ED]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-[#202633]">
              Planned Budget vs. Actual Cost vs. Projected Final Cost
            </h2>
            <span className="hidden sm:inline-block font-mono text-[10px] font-semibold uppercase tracking-wider text-[#6558D3] bg-[#F3F1FF] px-2 py-0.5 rounded border border-[#DAD4FC]">
              Decision Analytics
            </span>
          </div>
          <p className="text-xs text-[#4E5666] mt-0.5">
            Solid indigo bars show Actual Cost (labor + approved expenses); hatched
            extensions show Projected Remaining Cost ({currency}).
          </p>
        </div>

        <div
          role="group"
          aria-label="Visualization display mode"
          className="inline-flex items-center p-1 bg-[#F0F2F6] rounded-lg border border-[#E3E6ED] self-start sm:self-auto shrink-0"
        >
          <button
            type="button"
            onClick={() => setViewMode('CHART')}
            aria-pressed={viewMode === 'CHART'}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              viewMode === 'CHART'
                ? 'bg-white text-[#202633] shadow-2xs'
                : 'text-[#4E5666] hover:text-[#202633]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Visual Comparison</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('TABLE')}
            aria-pressed={viewMode === 'TABLE'}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              viewMode === 'TABLE'
                ? 'bg-white text-[#202633] shadow-2xs'
                : 'text-[#4E5666] hover:text-[#202633]'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Accessible Data Table</span>
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-5 py-3 text-xs text-[#4E5666] border-b border-[#E3E6ED]/60">
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-xs bg-[#6558D3] inline-block" aria-hidden="true" />
          <span>Actual Delivery Cost (To Date)</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-3.5 h-3.5 rounded-xs border border-amber-600 inline-block"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, #FEF3C7, #FEF3C7 3px, #F59E0B 3px, #F59E0B 5px)',
            }}
            aria-hidden="true"
          />
          <span>Projected Remaining Cost (Est. Hours × Rate)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-0.5 h-4 bg-[#202633] inline-block" aria-hidden="true" />
          <span>Planned Cost Budget Ceiling</span>
        </div>
      </div>

      {viewMode === 'CHART' ? (
        <div className="divide-y divide-slate-100 mt-2">
          {projects.map((project) => {
            const { financials } = project;
            const actualWidthPct = Math.min(
              100,
              (financials.actual_total_cost / maxDollarValue) * 100
            );
            const budgetMarkerPct = Math.min(
              100,
              (project.planned_cost_budget / maxDollarValue) * 100
            );
            const remainingWidthPct =
              financials.projected_remaining_cost !== null
                ? Math.min(
                    100 - actualWidthPct,
                    (financials.projected_remaining_cost / maxDollarValue) * 100
                  )
                : 0;

            const isOverBudget =
              (financials.projected_final_cost ?? financials.actual_total_cost) >
              project.planned_cost_budget;

            return (
              <div key={project.id} className="py-4 first:pt-2 last:pb-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {onSelectProject ? (
                      <button
                        type="button"
                        onClick={() => onSelectProject(project.id)}
                        className="text-sm font-semibold text-slate-900 hover:text-blue-700 underline-offset-2 hover:underline text-left"
                      >
                        {project.name}
                      </button>
                    ) : (
                      <span className="text-sm font-semibold text-slate-900">
                        {project.name}
                      </span>
                    )}
                    <span className="text-xs text-slate-500">· {project.client_name}</span>
                    <RiskStatusBadge status={financials.risk_status} size="sm" />
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono-tabular text-slate-700">
                    <span>
                      Actual:{' '}
                      <strong className="text-slate-900">
                        {formatCurrency(financials.actual_total_cost, project.currency)}
                      </strong>{' '}
                      ({financials.budget_consumed_pct.toFixed(1)}%)
                    </span>
                    <span>·</span>
                    <span>
                      Budget:{' '}
                      <strong className="text-slate-900">
                        {formatCurrency(project.planned_cost_budget, project.currency)}
                      </strong>
                    </span>
                    <span>·</span>
                    <span>
                      Projected:{' '}
                      {financials.projected_final_cost !== null ? (
                        <strong
                          className={
                            isOverBudget ? 'text-[#B91C1C]' : 'text-[#15803D]'
                          }
                        >
                          {formatCurrency(
                            financials.projected_final_cost,
                            project.currency
                          )}
                        </strong>
                      ) : (
                        <span className="text-slate-600 font-sans italic">
                          Forecast Unavailable
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Bullet / Bar Track */}
                <div className="relative h-7 bg-slate-100 rounded border border-slate-200 overflow-hidden flex items-center">
                  {/* Solid Actual Cost Bar */}
                  <div
                    style={{ width: `${actualWidthPct}%` }}
                    className={`h-full transition-all ${
                      financials.actual_total_cost > project.planned_cost_budget
                        ? 'bg-red-700'
                        : 'bg-blue-700'
                    }`}
                    title={`Actual Cost: ${formatCurrency(
                      financials.actual_total_cost,
                      project.currency
                    )}`}
                  />

                  {/* Hatched Projected Remaining Cost Bar */}
                  {financials.projected_remaining_cost !== null &&
                    remainingWidthPct > 0 && (
                      <div
                        style={{
                          width: `${remainingWidthPct}%`,
                          backgroundImage: isOverBudget
                            ? 'repeating-linear-gradient(45deg, #FEE2E2, #FEE2E2 4px, #DC2626 4px, #DC2626 7px)'
                            : 'repeating-linear-gradient(45deg, #FEF3C7, #FEF3C7 4px, #D97706 4px, #D97706 7px)',
                        }}
                        className="h-full border-l border-white/60"
                        title={`Projected Remaining Cost: ${formatCurrency(
                          financials.projected_remaining_cost,
                          project.currency
                        )}`}
                      />
                    )}

                  {/* Missing Estimate Explicit Inline Indicator */}
                  {financials.projected_final_cost === null && (
                    <div className="ml-2 flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-700 bg-white/90 px-2 py-0.5 rounded border border-slate-300">
                        ? Forecast Unavailable (Missing Remaining Hours)
                      </span>
                      {onRequestEstimate && (
                        <button
                          type="button"
                          onClick={() => onRequestEstimate(project)}
                          className="text-xs font-medium text-blue-700 hover:text-blue-900 underline whitespace-nowrap"
                        >
                          Enter Estimate →
                        </button>
                      )}
                    </div>
                  )}

                  {/* Planned Cost Budget Vertical Marker */}
                  <div
                    style={{ left: `${budgetMarkerPct}%` }}
                    className="absolute top-0 bottom-0 w-0.5 bg-slate-950 z-10"
                    title={`Planned Cost Budget: ${formatCurrency(
                      project.planned_cost_budget,
                      project.currency
                    )}`}
                  >
                    <span className="sr-only">
                      Planned Budget Marker:{' '}
                      {formatCurrency(project.planned_cost_budget, project.currency)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-left border-collapse">
            <caption className="sr-only">
              Project Planned Budget versus Actual Cost and Projected Final Cost
            </caption>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                <th className="py-2.5 px-3">Project</th>
                <th className="py-2.5 px-3">Risk Status</th>
                <th className="py-2.5 px-3 text-right">Planned Budget</th>
                <th className="py-2.5 px-3 text-right">Actual Cost</th>
                <th className="py-2.5 px-3 text-right">% Consumed</th>
                <th className="py-2.5 px-3 text-right">Est. Remaining Cost</th>
                <th className="py-2.5 px-3 text-right">Projected Final Cost</th>
                <th className="py-2.5 px-3 text-right">Projected Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {projects.map((p) => {
                const f = p.financials;
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-medium text-slate-900">
                      {p.name}
                    </td>
                    <td className="py-2.5 px-3">
                      <RiskStatusBadge status={f.risk_status} size="sm" />
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular">
                      {formatCurrency(p.planned_cost_budget, p.currency)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular">
                      {formatCurrency(f.actual_total_cost, p.currency)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular">
                      {formatPercentage(f.budget_consumed_pct)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular">
                      {formatCurrency(
                        f.projected_remaining_cost,
                        p.currency,
                        'Missing Estimate'
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold">
                      {formatCurrency(
                        f.projected_final_cost,
                        p.currency,
                        'Forecast Unavailable'
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular">
                      {f.projected_cost_variance !== null ? (
                        <span
                          className={
                            f.projected_cost_variance > 0
                              ? 'text-[#B91C1C] font-medium'
                              : 'text-[#15803D] font-medium'
                          }
                        >
                          {f.projected_cost_variance > 0 ? '+' : ''}
                          {formatCurrency(f.projected_cost_variance, p.currency)}{' '}
                          {f.projected_cost_variance > 0 ? 'overrun' : 'under'}
                        </span>
                      ) : (
                        <span className="text-slate-500">Forecast Unavailable</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
