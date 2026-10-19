import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Edit3,
  HelpCircle,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  EnrichedProject,
  Expense,
  TimeEntry,
  User,
} from '../../types/domain';
import {
  formatCurrency,
  formatHours,
  formatPercentage,
} from '../../lib/financial-engine';
import { apiClient } from '../../services/api-client';
import { AiRiskAnalysis } from '../../types/domain';
import {
  BudgetForecastChart,
  ExpenseStatusBadge,
  LifecycleText,
  RiskStatusBadge,
} from '../shared/StatusBadges';

export type ProjectDetailTab = 'OVERVIEW' | 'TIME_ENTRIES' | 'EXPENSES';

export const ProjectDetailView: React.FC<{
  project: EnrichedProject;
  currentUser: User;
  /** Loaded page(s) of this project's entries/expenses (server-paginated, DEC-008). */
  timeEntries: TimeEntry[];
  expenses: Expense[];
  timeEntriesTotal?: number;
  expensesTotal?: number;
  /** Hours on this project for the current scope (all for managers, own for team members). */
  loggedHours?: number;
  timeEntriesFooter?: React.ReactNode;
  expensesFooter?: React.ReactNode;
  initialTab?: ProjectDetailTab;
  onBack: () => void;
  onEditProject: (project: EnrichedProject) => void;
  onOpenUpdateEstimate: (project: EnrichedProject) => void;
  onOpenLogTime: (projectId: string) => void;
  onDeleteTimeEntry: (timeEntryId: string) => void;
  onOpenSubmitExpense: (projectId: string) => void;
  onDeletePendingExpense?: (expenseId: string) => void;
  onApproveExpense: (expenseId: string) => void;
  onRequestRejectExpense: (expense: Expense) => void;
}> = ({
  project,
  currentUser,
  timeEntries,
  expenses,
  timeEntriesTotal,
  expensesTotal,
  loggedHours,
  timeEntriesFooter,
  expensesFooter,
  initialTab = 'OVERVIEW',
  onBack,
  onEditProject,
  onOpenUpdateEstimate,
  onOpenLogTime,
  onDeleteTimeEntry,
  onOpenSubmitExpense,
  onDeletePendingExpense,
  onApproveExpense,
  onRequestRejectExpense,
}) => {
  const isManager = currentUser.role === 'MANAGER';
  const [activeTab, setActiveTab] = useState<ProjectDetailTab>(
    isManager ? initialTab : initialTab === 'OVERVIEW' ? 'TIME_ENTRIES' : initialTab
  );
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AiRiskAnalysis | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const { financials } = project;

  const projectTimeEntries = timeEntries
    .filter((t) => t.project_id === project.id)
    .filter((t) => (isManager ? true : t.user_id === currentUser.id))
    .sort((a, b) => b.work_date.localeCompare(a.work_date));

  const projectExpenses = expenses
    .filter((e) => e.project_id === project.id)
    .filter((e) => (isManager ? true : e.submitted_by_id === currentUser.id))
    .sort((a, b) => b.expense_date.localeCompare(a.expense_date));

  // Calls Gemini only on explicit request; failures stay inside this panel
  const handleRefreshAi = async () => {
    setIsAnalyzingAi(true);
    setAiError(null);
    try {
      setAiAnalysis(await apiClient.ai.analyzeProject(project.id));
    } catch (err: any) {
      setAiError(err?.message || 'AI advisor is temporarily unavailable.');
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Persistent Project Identity Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-blue-700"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{isManager ? 'All Projects' : 'My Assigned Projects'}</span>
              </button>
              <span>·</span>
              <span>{project.client_name}</span>
              <span>·</span>
              <LifecycleText status={project.status} />
              {project.deadline && (
                <>
                  <span>·</span>
                  <span className="font-mono-tabular">Due {project.deadline}</span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
              {isManager && <RiskStatusBadge status={financials.risk_status} />}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onOpenLogTime(project.id)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Work Hours</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenSubmitExpense(project.id)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Submit Expense</span>
            </button>
            {isManager && (
              <button
                type="button"
                onClick={() => onEditProject(project)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Project & Budget</span>
              </button>
            )}
          </div>
        </div>

        {/* Deterministic Risk Explanation Banner (Manager Only) */}
        {isManager && (
          <div
            className={`mt-5 p-4 rounded-lg border ${
              financials.risk_status === 'CRITICAL'
                ? 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
                : financials.risk_status === 'WARNING'
                ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]'
                : financials.risk_status === 'INCOMPLETE_DATA'
                ? 'bg-slate-100 border-slate-300 text-slate-800'
                : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-2.5">
                {financials.risk_status === 'CRITICAL' ? (
                  <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5 text-[#B91C1C]" />
                ) : financials.risk_status === 'WARNING' ? (
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#B45309]" />
                ) : financials.risk_status === 'INCOMPLETE_DATA' ? (
                  <HelpCircle className="w-4 h-4 shrink-0 mt-0.5 text-slate-700" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#15803D]" />
                )}
                <div className="space-y-1 text-xs">
                  <div className="font-semibold">
                    Deterministic Risk Classification:{' '}
                    {financials.risk_status === 'INCOMPLETE_DATA'
                      ? 'Forecast Unavailable — Missing Remaining Effort Estimate'
                      : financials.risk_status}
                  </div>
                  <ul className="space-y-0.5 list-disc list-inside">
                    {financials.risk_reasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenUpdateEstimate(project)}
                className="px-3 py-1.5 text-xs font-medium bg-white text-slate-900 border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap self-start shrink-0"
              >
                {project.estimated_remaining_hours === null
                  ? 'Enter Remaining Hours Estimate'
                  : 'Update Remaining Hours'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Primary Financial Ledger Strip (6 Metrics in Tabular Numerals — Manager Only) */}
      {isManager ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs font-medium text-slate-600">Contract Revenue</div>
            <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-1">
              {formatCurrency(project.contract_revenue, project.currency)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Fixed commercial agreement
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs font-medium text-slate-600">
              Planned Cost Budget
            </div>
            <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-1">
              {formatCurrency(project.planned_cost_budget, project.currency)}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-mono-tabular">
              Planned Margin: {formatPercentage(financials.planned_margin_pct)}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs font-medium text-slate-600">
              Actual Cost to Date
            </div>
            <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-1">
              {formatCurrency(financials.actual_total_cost, project.currency)}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-mono-tabular">
              {formatCurrency(financials.actual_labor_cost, project.currency)} labor ·{' '}
              {formatCurrency(financials.actual_expense_cost, project.currency)} exp
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs font-medium text-slate-600">Budget Consumed</div>
            <div
              className={`text-xl font-bold font-mono-tabular mt-1 ${
                (financials.budget_consumed_pct ?? 0) > 100
                  ? 'text-[#B91C1C]'
                  : (financials.budget_consumed_pct ?? 0) >= 80
                  ? 'text-[#B45309]'
                  : 'text-slate-900'
              }`}
            >
              {formatPercentage(financials.budget_consumed_pct)}
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
              <div
                style={{ width: `${Math.min(100, financials.budget_consumed_pct ?? 0)}%` }}
                className={`h-full ${
                  (financials.budget_consumed_pct ?? 0) > 100
                    ? 'bg-red-700'
                    : (financials.budget_consumed_pct ?? 0) >= 80
                    ? 'bg-amber-600'
                    : 'bg-blue-700'
                }`}
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs font-medium text-slate-600">
              Projected Final Cost (Est.)
            </div>
            {financials.projected_final_cost !== null ? (
              <>
                <div
                  className={`text-xl font-bold font-mono-tabular mt-1 ${
                    (financials.projected_cost_variance ?? 0) > 0
                      ? 'text-[#B91C1C]'
                      : 'text-slate-900'
                  }`}
                >
                  {formatCurrency(financials.projected_final_cost, project.currency)}
                </div>
                <div className="text-xs font-mono-tabular text-slate-600 mt-1">
                  {financials.projected_cost_variance !== null &&
                  financials.projected_cost_variance > 0
                    ? `+${formatCurrency(
                        financials.projected_cost_variance,
                        project.currency
                      )} overrun`
                    : `${formatCurrency(
                        financials.projected_cost_variance,
                        project.currency
                      )} vs budget`}
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-semibold text-slate-700 mt-1.5">
                  Forecast Unavailable
                </div>
                <button
                  type="button"
                  onClick={() => onOpenUpdateEstimate(project)}
                  className="text-xs font-medium text-blue-700 hover:underline mt-1 inline-block"
                >
                  + Enter Remaining Hours →
                </button>
              </>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs font-medium text-slate-600">
              Projected Profit & Margin
            </div>
            {financials.projected_profit !== null &&
            financials.projected_margin_pct !== null ? (
              <>
                <div
                  className={`text-xl font-bold font-mono-tabular mt-1 ${
                    financials.projected_margin_pct < 10
                      ? 'text-[#B91C1C]'
                      : 'text-[#15803D]'
                  }`}
                >
                  {formatPercentage(financials.projected_margin_pct)}
                </div>
                <div className="text-xs font-mono-tabular text-slate-600 mt-1">
                  Profit: {formatCurrency(financials.projected_profit, project.currency)}
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-semibold text-slate-700 mt-1.5">
                  Forecast Unavailable
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Requires remaining hours estimate
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Info className="w-4 h-4 text-blue-700 shrink-0" />
            <span>
              <strong>Delivery Team Workspace:</strong> Record your billable/delivery
              hours and submit project expenses below. Commercial contract margins and
              company-wide cost rates are restricted to Agency Managers.
            </span>
          </div>
          <div className="flex items-center gap-4 font-mono-tabular shrink-0">
            <span>
              Your Logged Hours:{' '}
              <strong className="text-slate-900">
                {formatHours(
                  loggedHours ?? projectTimeEntries.reduce((sum, t) => sum + t.hours, 0)
                )}
              </strong>
            </span>
            <span>·</span>
            <span>
              Your Expenses:{' '}
              <strong className="text-slate-900">
                {expensesTotal ?? projectExpenses.length}
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-6">
        {isManager && (
          <button
            type="button"
            onClick={() => setActiveTab('OVERVIEW')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'OVERVIEW'
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Overview, Financials & AI Risk Advisor
          </button>
        )}
        <button
          type="button"
          onClick={() => setActiveTab('TIME_ENTRIES')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'TIME_ENTRIES'
              ? 'border-blue-700 text-blue-700'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          {isManager
            ? `All Project Time Entries (${timeEntriesTotal ?? projectTimeEntries.length})`
            : `My Time Entries (${timeEntriesTotal ?? projectTimeEntries.length})`}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('EXPENSES')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'EXPENSES'
              ? 'border-blue-700 text-blue-700'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          {isManager
            ? `Project Expenses & Approvals (${expensesTotal ?? projectExpenses.length})`
            : `My Project Expenses (${expensesTotal ?? projectExpenses.length})`}
        </button>
      </div>

      {/* Tab 1: Overview, Financial Breakdown & AI Risk Advisor (Manager) */}
      {isManager && activeTab === 'OVERVIEW' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 7 Cols: Visualization & Cost Composition Ledger */}
          <div className="lg:col-span-7 space-y-6">
            <BudgetForecastChart
              projects={[project]}
              currency={project.currency}
              onRequestEstimate={onOpenUpdateEstimate}
            />

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="text-base font-semibold text-slate-900">
                  Authoritative Delivery Cost & Forecast Breakdown
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Calculated deterministically from historical labor snapshots and
                  approved expenses.
                </p>
              </div>
              <div className="divide-y divide-slate-200 text-xs">
                <div className="px-5 py-3 flex justify-between items-center">
                  <span className="text-slate-600">
                    1. Actual Labor Cost ({formatHours(financials.actual_hours_logged)}{' '}
                    logged × historical hourly snapshots)
                  </span>
                  <span className="font-mono-tabular font-semibold text-slate-900">
                    {formatCurrency(financials.actual_labor_cost, project.currency)}
                  </span>
                </div>
                <div className="px-5 py-3 flex justify-between items-center">
                  <span className="text-slate-600">
                    2. Approved Expense Cost (Included in Actual Cost)
                  </span>
                  <span className="font-mono-tabular font-semibold text-slate-900">
                    {formatCurrency(financials.actual_expense_cost, project.currency)}
                  </span>
                </div>
                <div className="px-5 py-3 flex justify-between items-center bg-slate-50/70">
                  <span className="text-slate-500">
                    • Pending Expenses (Excluded from Actual Cost until Manager approval)
                  </span>
                  <span className="font-mono-tabular text-amber-800">
                    {formatCurrency(financials.pending_expense_amount, project.currency)}{' '}
                    ($0.00 impact)
                  </span>
                </div>
                <div className="px-5 py-3 flex justify-between items-center bg-slate-50/70">
                  <span className="text-slate-500">
                    • Rejected Expenses (Excluded from Actual Cost)
                  </span>
                  <span className="font-mono-tabular text-slate-500">
                    {formatCurrency(financials.rejected_expense_amount, project.currency)}{' '}
                    ($0.00 impact)
                  </span>
                </div>
                <div className="px-5 py-3 flex justify-between items-center font-semibold bg-slate-50">
                  <span className="text-slate-900">
                    Total Actual Delivery Cost to Date (1 + 2)
                  </span>
                  <span className="font-mono-tabular text-sm text-slate-900">
                    {formatCurrency(financials.actual_total_cost, project.currency)}
                  </span>
                </div>
                <div className="px-5 py-3 flex justify-between items-center">
                  <span className="text-slate-600">
                    3. Projected Remaining Cost (
                    {project.estimated_remaining_hours !== null
                      ? `${formatHours(project.estimated_remaining_hours)} est. remaining × ${formatCurrency(
                          project.planned_hourly_cost,
                          project.currency
                        )}/hr`
                      : 'Estimated remaining hours is null'}
                    )
                  </span>
                  <span className="font-mono-tabular font-semibold text-slate-900">
                    {formatCurrency(
                      financials.projected_remaining_cost,
                      project.currency,
                      'Forecast Unavailable'
                    )}
                  </span>
                </div>
                <div className="px-5 py-3.5 flex justify-between items-center bg-blue-50/40 font-semibold">
                  <span className="text-slate-900">
                    Projected Final Delivery Cost (Actual + Projected Remaining)
                  </span>
                  <span className="font-mono-tabular text-sm text-blue-950">
                    {formatCurrency(
                      financials.projected_final_cost,
                      project.currency,
                      'Forecast Unavailable'
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right 5 Cols: AI Risk Advisor Panel (Advisory Only) */}
          <div className="lg:col-span-5">
            <div className="bg-[#EEF2FF]/60 border border-[#C7D2FE] rounded-lg overflow-hidden">
              <div className="px-5 py-4 bg-[#EEF2FF] border-b border-[#C7D2FE] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#3730A3]" aria-hidden="true" />
                  <div>
                    <h2 className="text-sm font-bold text-[#1E1B4B]">
                      AI Risk Advisor
                    </h2>
                    <span className="text-[11px] text-[#3730A3] block">
                      {aiAnalysis
                        ? `Generated ${new Date(aiAnalysis.generated_at).toLocaleString()}${
                            aiAnalysis.cached ? ' · cached' : ''
                          } · ${aiAnalysis.model}`
                        : 'Advisory only · runs on request'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRefreshAi}
                  disabled={isAnalyzingAi}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-white border border-[#C7D2FE] rounded text-[#3730A3] hover:bg-indigo-50 disabled:opacity-60"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isAnalyzingAi ? 'animate-spin' : ''}`}
                  />
                  <span>
                    {isAnalyzingAi ? 'Analyzing...' : aiAnalysis ? 'Refresh Analysis' : 'Analyze Risk'}
                  </span>
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="p-3 rounded bg-white border border-[#C7D2FE] flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">
                    Authoritative Backend Risk Status:
                  </span>
                  <RiskStatusBadge status={financials.risk_status} size="sm" />
                </div>

                {isAnalyzingAi ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className="py-8 text-center space-y-3"
                  >
                    <Loader2 className="w-6 h-6 text-[#3730A3] animate-spin mx-auto" />
                    <div className="text-xs font-medium text-[#1E1B4B]">
                      Asking the AI advisor to explain the current figures...
                    </div>
                  </div>
                ) : aiError ? (
                  <div
                    role="alert"
                    className="p-3 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900"
                  >
                    {aiError}
                  </div>
                ) : !aiAnalysis ? (
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Get a plain-language explanation of this project's risk status and
                    suggested next steps. The advisor sees only anonymized, aggregated
                    figures and never changes them.
                  </p>
                ) : (
                  <>
                    <div>
                      <h3 className="text-xs font-semibold text-[#1E1B4B] mb-1">
                        Executive Summary
                      </h3>
                      <p className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded border border-slate-200">
                        {aiAnalysis.ai_advisor.executive_summary}
                      </p>
                    </div>

                    <div>
                      <h3 className="text-xs font-semibold text-[#1E1B4B] mb-2">
                        Primary Risk Drivers
                      </h3>
                      <ul className="space-y-1.5">
                        {aiAnalysis.ai_advisor.primary_risk_drivers.map((driver, idx) => (
                          <li
                            key={idx}
                            className="p-2.5 rounded bg-white border border-slate-200 text-xs text-slate-700"
                          >
                            {driver}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-xs font-semibold text-[#1E1B4B] mb-2">
                        Recommended Interventions (
                        {aiAnalysis.ai_advisor.actionable_recommendations.length})
                      </h3>
                      <ol className="space-y-2">
                        {aiAnalysis.ai_advisor.actionable_recommendations.map((rec, idx) => (
                          <li
                            key={idx}
                            className="p-3 rounded bg-white border border-slate-200 text-xs text-slate-700"
                          >
                            <span className="font-semibold text-slate-900">0{idx + 1}.</span> {rec}
                          </li>
                        ))}
                      </ol>
                    </div>

                    {aiAnalysis.ai_advisor.data_gaps_and_assumptions.length > 0 && (
                      <div className="p-3 rounded bg-white/80 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                        <strong className="text-slate-800 block">
                          Data Gaps &amp; Assumptions:
                        </strong>
                        <ul className="list-disc list-inside space-y-0.5">
                          {aiAnalysis.ai_advisor.data_gaps_and_assumptions.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}

                <div className="pt-3 border-t border-[#C7D2FE] text-[11px] text-slate-600">
                  <strong>Advisory Boundary:</strong> AI explanations never modify
                  financial calculations, override backend risk status, approve expenses,
                  or alter project budgets.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Time Entries */}
      {activeTab === 'TIME_ENTRIES' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {isManager ? 'Project Time-Entry Ledger' : 'My Recorded Work Hours'}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                {isManager
                  ? 'Displays all logged work hours and historical hourly cost snapshots captured at submission time.'
                  : 'Displays your recorded delivery hours on this project.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenLogTime(project.id)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Work Hours</span>
            </button>
          </div>

          {projectTimeEntries.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <div className="text-sm font-semibold text-slate-900">
                No time entries recorded yet
              </div>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Log delivery hours to track actual labor effort against this project.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                    <th className="py-2.5 px-4">Work Date</th>
                    <th className="py-2.5 px-4">Team Member</th>
                    <th className="py-2.5 px-4">Work Description</th>
                    <th className="py-2.5 px-4 text-right">Hours</th>
                    {isManager && (
                      <>
                        <th className="py-2.5 px-4 text-right">Rate Snapshot</th>
                        <th className="py-2.5 px-4 text-right">Computed Cost</th>
                      </>
                    )}
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {projectTimeEntries.map((entry) => {
                    const canDelete =
                      isManager || entry.user_id === currentUser.id;
                    return (
                      <tr key={entry.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono-tabular whitespace-nowrap text-slate-800">
                          {entry.work_date}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                          {entry.user_name}
                        </td>
                        <td className="py-3 px-4 text-slate-700 max-w-md">
                          {entry.description}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-slate-900 whitespace-nowrap">
                          {entry.hours.toFixed(2)} hrs
                        </td>
                        {isManager && (
                          <>
                            <td className="py-3 px-4 text-right font-mono-tabular text-slate-600 whitespace-nowrap">
                              {formatCurrency(
                                entry.hourly_cost_snapshot,
                                project.currency
                              )}
                              /hr
                            </td>
                            <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-slate-900 whitespace-nowrap">
                              {formatCurrency(
                                entry.hours * entry.hourly_cost_snapshot,
                                project.currency
                              )}
                            </td>
                          </>
                        )}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => onDeleteTimeEntry(entry.id)}
                              title="Delete time entry"
                              className="inline-flex items-center gap-1 text-slate-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {timeEntriesFooter}
        </div>
      )}

      {/* Tab 3: Expenses */}
      {activeTab === 'EXPENSES' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {isManager
                  ? 'Project Expense History & Approvals'
                  : 'My Submitted Project Expenses'}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                <strong>Accounting Rule:</strong> Only <strong>Approved</strong> expenses
                contribute to Actual Cost. Pending and Rejected expenses have $0.00
                budget impact.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenSubmitExpense(project.id)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Submit Expense</span>
            </button>
          </div>

          {projectExpenses.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <div className="text-sm font-semibold text-slate-900">
                No expenses submitted for this project
              </div>
              <p className="text-xs text-slate-600">
                Submit project-related infrastructure, software, contractor, or travel
                expenses for manager approval.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Submitted By</th>
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4">Description & Review Feedback</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {projectExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono-tabular whitespace-nowrap text-slate-700">
                        {exp.expense_date}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                        {exp.submitted_by_name}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {exp.category}
                      </td>
                      <td className="py-3 px-4 text-slate-700 max-w-md">
                        <div>{exp.description}</div>
                        {exp.status === 'REJECTED' && exp.rejection_reason && (
                          <div className="mt-1 p-2 rounded bg-red-50 border border-red-200 text-[11px] text-red-800">
                            <strong>Rejection Reason:</strong> {exp.rejection_reason}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <ExpenseStatusBadge status={exp.status} />
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-slate-900 whitespace-nowrap">
                        {formatCurrency(exp.amount, project.currency)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {isManager ? (
                          exp.status === 'PENDING' ? (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onApproveExpense(exp.id)}
                                className="px-2.5 py-1 text-xs font-medium text-white bg-emerald-700 rounded hover:bg-emerald-800"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => onRequestRejectExpense(exp)}
                                className="px-2.5 py-1 text-xs font-medium text-red-700 bg-white border border-red-300 rounded hover:bg-red-50"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400">
                              Reviewed by {exp.reviewed_by_name ?? 'Manager'}
                            </span>
                          )
                        ) : exp.status === 'PENDING' &&
                          exp.submitted_by_id === currentUser.id &&
                          onDeletePendingExpense ? (
                          <button
                            type="button"
                            onClick={() => onDeletePendingExpense(exp.id)}
                            className="inline-flex items-center gap-1 text-slate-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Withdraw</span>
                          </button>
                        ) : (
                          <span className="text-slate-400">Locked</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {expensesFooter}
        </div>
      )}
    </div>
  );
};
