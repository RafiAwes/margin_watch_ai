import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react';
import {
  Client,
  CurrencyCode,
  EnrichedProject,
  Expense,
  ExpenseCategory,
  Project,
  ProjectStatus,
  User,
} from '../../types/domain';
import { formatCurrency, formatPercentage } from '../../lib/financial-engine';

export const ProjectFormModal: React.FC<{
  initialProject?: Project | null;
  clients: Client[];
  teamUsers?: User[];
  onClose: () => void;
  onSave: (projectData: Omit<Project, 'id' | 'updated_at'>) => void;
}> = ({ initialProject, clients, teamUsers = [], onClose, onSave }) => {
  const activeClients = clients.filter((c) => c.status === 'ACTIVE');

  const [name, setName] = useState(initialProject?.name ?? '');
  const [clientId, setClientId] = useState(
    initialProject?.client_id ?? activeClients[0]?.id ?? ''
  );
  const [currency, setCurrency] = useState<CurrencyCode>(
    initialProject?.currency ?? 'USD'
  );
  const [contractRevenue, setContractRevenue] = useState(
    initialProject ? String(initialProject.contract_revenue) : ''
  );
  const [plannedCostBudget, setPlannedCostBudget] = useState(
    initialProject ? String(initialProject.planned_cost_budget) : ''
  );
  const [plannedHourlyCost, setPlannedHourlyCost] = useState(
    initialProject ? String(initialProject.planned_hourly_cost) : '120'
  );
  const [estimateUnknown, setEstimateUnknown] = useState<boolean>(
    initialProject ? initialProject.estimated_remaining_hours === null : false
  );
  const [estimatedRemainingHoursInput, setEstimatedRemainingHoursInput] =
    useState(
      initialProject && initialProject.estimated_remaining_hours !== null
        ? String(initialProject.estimated_remaining_hours)
        : ''
    );
  const [deadline, setDeadline] = useState(initialProject?.deadline ?? '2026-12-15');
  const [status, setStatus] = useState<ProjectStatus>(
    initialProject?.status ?? 'ACTIVE'
  );
  const [assignedMemberIds, setAssignedMemberIds] = useState<string[]>(
    initialProject?.assigned_member_ids ??
      (teamUsers.length > 0
        ? teamUsers.map((u) => u.id)
        : ['usr_mgr_01', 'usr_dev_02', 'usr_dev_03'])
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggleMemberAssignment = (userId: string) => {
    setAssignedMemberIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const parsedRevenue = Number(contractRevenue);
  const parsedBudget = Number(plannedCostBudget);
  const hasCommercialPreview =
    !Number.isNaN(parsedRevenue) &&
    parsedRevenue > 0 &&
    !Number.isNaN(parsedBudget) &&
    parsedBudget > 0;
  const previewPlannedProfit = hasCommercialPreview
    ? parsedRevenue - parsedBudget
    : null;
  const previewPlannedMargin =
    hasCommercialPreview && previewPlannedProfit !== null
      ? (previewPlannedProfit / parsedRevenue) * 100
      : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};

    if (name.trim().length < 3) {
      nextErrors.name = 'Project name must be at least 3 characters.';
    }
    if (!clientId) {
      nextErrors.client_id = 'Please select an active client organization.';
    }
    if (!contractRevenue || Number.isNaN(parsedRevenue) || parsedRevenue <= 0) {
      nextErrors.contract_revenue = 'Contract revenue must be greater than 0.';
    }
    if (!plannedCostBudget || Number.isNaN(parsedBudget) || parsedBudget <= 0) {
      nextErrors.planned_cost_budget =
        'Planned delivery cost budget must be greater than 0.';
    }

    const parsedRate = Number(plannedHourlyCost);
    if (!plannedHourlyCost || Number.isNaN(parsedRate) || parsedRate <= 0) {
      nextErrors.planned_hourly_cost =
        'Planned internal hourly cost must be greater than 0.';
    }

    if (!estimateUnknown) {
      const trimmedHours = estimatedRemainingHoursInput.trim();
      if (trimmedHours === '') {
        nextErrors.estimated_remaining_hours =
          "Enter estimated remaining hours (use 0 if all work is complete) or check 'Remaining hours estimate is not yet known'.";
      } else {
        const parsedHours = Number(trimmedHours);
        if (Number.isNaN(parsedHours) || parsedHours < 0) {
          nextErrors.estimated_remaining_hours =
            'Estimated remaining hours must be 0 or a positive number.';
        }
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onSave({
      name: name.trim(),
      client_id: clientId,
      currency,
      contract_revenue: Number(parsedRevenue.toFixed(2)),
      planned_cost_budget: Number(parsedBudget.toFixed(2)),
      planned_hourly_cost: Number(parsedRate.toFixed(2)),
      estimated_remaining_hours: estimateUnknown
        ? null
        : Number(Number(estimatedRemainingHoursInput).toFixed(2)),
      deadline: deadline.trim() || null,
      status,
      assigned_member_ids: assignedMemberIds,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 overflow-y-auto"
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 id="project-modal-title" className="text-lg font-bold text-slate-900">
              {initialProject ? 'Edit Project & Budget Configuration' : 'Create New Project'}
            </h2>
            <p className="text-xs text-slate-600">
              Separates commercial contract terms from internal delivery planning estimates.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-500 hover:text-slate-800 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Section 1: Commercial Information */}
          <div className="space-y-4">
            <div className="pb-2 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">
                1. Commercial Information
              </h3>
              <p className="text-xs text-slate-500">
                Client contract revenue and target internal delivery budget ceiling.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label
                  htmlFor="proj-name"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Project Name <span className="text-red-600">*</span>
                </label>
                <input
                  id="proj-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Core Treasury API Modernization"
                  aria-invalid={Boolean(errors.name)}
                  className={`w-full h-10 px-3 text-sm rounded-md border ${
                    errors.name ? 'border-red-600' : 'border-slate-300'
                  } focus:outline-none focus:ring-2 focus:ring-blue-600`}
                />
                {errors.name && (
                  <p role="alert" className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errors.name}</span>
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="proj-client"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Client Organization <span className="text-red-600">*</span>
                </label>
                {activeClients.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
                    No active clients available. Please create a client organization first.
                  </div>
                ) : (
                  <select
                    id="proj-client"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full h-10 px-3 text-sm rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="" disabled>Select a client...</option>
                    {activeClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.default_currency})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label
                  htmlFor="proj-currency"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Currency <span className="text-red-600">*</span>
                </label>
                <select
                  id="proj-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                  className="w-full h-10 px-3 text-sm rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="proj-revenue"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Contract Revenue ({currency}) <span className="text-red-600">*</span>
                </label>
                <input
                  id="proj-revenue"
                  type="number"
                  step="0.01"
                  value={contractRevenue}
                  onChange={(e) => setContractRevenue(e.target.value)}
                  placeholder="95000.00"
                  aria-invalid={Boolean(errors.contract_revenue)}
                  className={`w-full h-10 px-3 text-sm font-mono-tabular rounded-md border ${
                    errors.contract_revenue ? 'border-red-600' : 'border-slate-300'
                  } focus:outline-none focus:ring-2 focus:ring-blue-600`}
                />
                {errors.contract_revenue && (
                  <p role="alert" className="mt-1 text-xs text-red-600">
                    {errors.contract_revenue}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="proj-budget"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Planned Delivery Cost Budget ({currency}){' '}
                  <span className="text-red-600">*</span>
                </label>
                <input
                  id="proj-budget"
                  type="number"
                  step="0.01"
                  value={plannedCostBudget}
                  onChange={(e) => setPlannedCostBudget(e.target.value)}
                  placeholder="64000.00"
                  aria-invalid={Boolean(errors.planned_cost_budget)}
                  className={`w-full h-10 px-3 text-sm font-mono-tabular rounded-md border ${
                    errors.planned_cost_budget ? 'border-red-600' : 'border-slate-300'
                  } focus:outline-none focus:ring-2 focus:ring-blue-600`}
                />
                {errors.planned_cost_budget && (
                  <p role="alert" className="mt-1 text-xs text-red-600">
                    {errors.planned_cost_budget}
                  </p>
                )}
              </div>
            </div>

            {/* Live Target Margin Preview */}
            {hasCommercialPreview && (
              <div className="p-3 rounded-md bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-slate-600 font-medium">
                  Planned Commercial Target Preview:
                </span>
                <div className="font-mono-tabular flex items-center gap-4">
                  <span>
                    Target Profit:{' '}
                    <strong
                      className={
                        (previewPlannedProfit ?? 0) < 0
                          ? 'text-red-700'
                          : 'text-slate-900'
                      }
                    >
                      {formatCurrency(previewPlannedProfit, currency)}
                    </strong>
                  </span>
                  <span>·</span>
                  <span>
                    Target Margin:{' '}
                    <strong
                      className={
                        (previewPlannedMargin ?? 0) < 15
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }
                    >
                      {formatPercentage(previewPlannedMargin)}
                    </strong>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Delivery Planning */}
          <div className="space-y-4">
            <div className="pb-2 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">
                2. Delivery Planning & Forecasting Inputs
              </h3>
              <p className="text-xs text-slate-500">
                Missing estimates are explicitly stored as null — never silently coerced to 0.
              </p>
            </div>

            <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={estimateUnknown}
                  onChange={(e) => {
                    setEstimateUnknown(e.target.checked);
                    if (e.target.checked) {
                      setEstimatedRemainingHoursInput('');
                    }
                  }}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-900 block">
                    Remaining hours estimate is not yet known (Explicit Null Estimate)
                  </span>
                  <span className="text-xs text-slate-600 block mt-0.5">
                    When checked, <code className="font-mono">estimated_remaining_hours</code> is
                    saved as <code className="font-mono">null</code> and the UI displays{' '}
                    <strong>Forecast Unavailable</strong> rather than assuming $0.00 remaining
                    cost.
                  </span>
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="proj-remaining-hours"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Estimated Remaining Hours {!estimateUnknown && <span className="text-red-600">*</span>}
                </label>
                <input
                  id="proj-remaining-hours"
                  type="number"
                  step="0.25"
                  min="0"
                  disabled={estimateUnknown}
                  value={estimatedRemainingHoursInput}
                  onChange={(e) => setEstimatedRemainingHoursInput(e.target.value)}
                  placeholder={estimateUnknown ? 'Unknown (Null)' : 'e.g., 110.00'}
                  aria-invalid={Boolean(errors.estimated_remaining_hours)}
                  className={`w-full h-10 px-3 text-sm font-mono-tabular rounded-md border ${
                    estimateUnknown
                      ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                      : errors.estimated_remaining_hours
                      ? 'border-red-600'
                      : 'border-slate-300'
                  } focus:outline-none focus:ring-2 focus:ring-blue-600`}
                />
                {errors.estimated_remaining_hours && (
                  <p role="alert" className="mt-1 text-xs text-red-600">
                    {errors.estimated_remaining_hours}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="proj-hourly-cost"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Planned Internal Hourly Cost ({currency}/hr){' '}
                  <span className="text-red-600">*</span>
                </label>
                <input
                  id="proj-hourly-cost"
                  type="number"
                  step="0.01"
                  value={plannedHourlyCost}
                  onChange={(e) => setPlannedHourlyCost(e.target.value)}
                  className="w-full h-10 px-3 text-sm font-mono-tabular rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                {errors.planned_hourly_cost && (
                  <p role="alert" className="mt-1 text-xs text-red-600">
                    {errors.planned_hourly_cost}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="proj-deadline"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Target Delivery Deadline
                </label>
                <input
                  id="proj-deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full h-10 px-3 text-sm font-mono-tabular rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label
                  htmlFor="proj-status"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Lifecycle Status <span className="text-red-600">*</span>
                </label>
                <select
                  id="proj-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                  className="w-full h-10 px-3 text-sm rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>

            {teamUsers.length > 0 && (
              <div className="pt-2">
                <span className="block text-xs font-medium text-slate-700 mb-2">
                  Authorized Delivery Team Members ({assignedMemberIds.length}{' '}
                  assigned)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2.5 rounded-md border border-slate-200 bg-slate-50">
                  {teamUsers.map((member) => (
                    <label
                      key={member.id}
                      className="flex items-center justify-between gap-2 p-2 rounded bg-white border border-slate-200 text-xs cursor-pointer hover:border-slate-300"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={assignedMemberIds.includes(member.id)}
                          onChange={() => toggleMemberAssignment(member.id)}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-blue-700"
                        />
                        <span className="font-medium text-slate-900 truncate">
                          {member.full_name}
                        </span>
                      </div>
                      <span className="font-mono-tabular text-[11px] text-slate-500 shrink-0">
                        {formatCurrency(member.default_hourly_cost, 'USD')}/hr
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800"
            >
              {initialProject ? 'Save Project Changes' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const LogTimeModal: React.FC<{
  projects: EnrichedProject[];
  defaultProjectId?: string;
  currentUser: User;
  onClose: () => void;
  onSubmit: (data: {
    project_id: string;
    work_date: string;
    hours: number;
    description: string;
  }) => void;
}> = ({ projects, defaultProjectId, currentUser, onClose, onSubmit }) => {
  const activeProjects = projects.filter((p) => p.status === 'ACTIVE');
  const [projectId, setProjectId] = useState(
    defaultProjectId ?? activeProjects[0]?.id ?? ''
  );
  const [workDate, setWorkDate] = useState('2026-10-17');
  const [hoursInput, setHoursInput] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedHours = Number(hoursInput);
    if (!projectId) {
      setError('Please select an active project.');
      return;
    }
    if (!workDate || workDate > '2026-10-17') {
      setError('Work date cannot be in the future (must be on or before 2026-10-17).');
      return;
    }
    if (
      !hoursInput ||
      Number.isNaN(parsedHours) ||
      parsedHours < 0.25 ||
      parsedHours > 24.0
    ) {
      setError('Hours must be a positive decimal between 0.25 and 24.00.');
      return;
    }
    if (description.trim().length < 5) {
      setError('Please provide a meaningful work description (at least 5 characters).');
      return;
    }

    onSubmit({
      project_id: projectId,
      work_date: workDate,
      hours: Number(parsedHours.toFixed(2)),
      description: description.trim(),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-time-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 id="log-time-title" className="text-base font-bold text-slate-900">
              Record Delivery Work Hours
            </h2>
            <p className="text-xs text-slate-600">
              Logging as <strong>{currentUser.full_name}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div
              role="alert"
              className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="te-project"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Active Project <span className="text-red-600">*</span>
            </label>
            {activeProjects.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
                No active projects available to log work against.
              </div>
            ) : (
              <select
                id="te-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="" disabled>Select a project...</option>
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.client_name})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="te-date"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Work Date <span className="text-red-600">*</span>
              </label>
              <input
                id="te-date"
                type="date"
                max="2026-10-17"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                className="w-full h-10 px-3 text-sm font-mono-tabular rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="te-hours"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Hours Worked (0.25 – 24.00) <span className="text-red-600">*</span>
              </label>
              <input
                id="te-hours"
                type="number"
                step="0.25"
                min="0.25"
                max="24"
                value={hoursInput}
                onChange={(e) => setHoursInput(e.target.value)}
                placeholder="e.g., 6.50"
                className="w-full h-10 px-3 text-sm font-mono-tabular rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="te-desc"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Work Description <span className="text-red-600">*</span>
            </label>
            <textarea
              id="te-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the engineering or delivery task completed..."
              className="w-full p-3 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="p-3 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
            <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <span>
              <strong>Hourly Cost Snapshot Rule:</strong> The internal hourly cost rate is
              captured automatically by the server upon submission and is not editable in
              the client form.
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800"
            >
              Record Work Hours
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const SubmitExpenseModal: React.FC<{
  projects: EnrichedProject[];
  defaultProjectId?: string;
  currentUser: User;
  onClose: () => void;
  onSubmit: (data: {
    project_id: string;
    expense_date: string;
    category: ExpenseCategory;
    amount: number;
    description: string;
  }) => void;
}> = ({ projects, defaultProjectId, currentUser, onClose, onSubmit }) => {
  const activeProjects = projects.filter((p) => p.status === 'ACTIVE');
  const [projectId, setProjectId] = useState(
    defaultProjectId ?? activeProjects[0]?.id ?? ''
  );
  const [expenseDate, setExpenseDate] = useState('2026-10-17');
  const [category, setCategory] = useState<ExpenseCategory>('INFRASTRUCTURE');
  const [amountInput, setAmountInput] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Number(amountInput);
    if (!projectId) {
      setError('Please select a project.');
      return;
    }
    if (!amountInput || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Expense amount must be greater than $0.00.');
      return;
    }
    if (description.trim().length < 5) {
      setError('Please enter a clear expense description (minimum 5 characters).');
      return;
    }

    onSubmit({
      project_id: projectId,
      expense_date: expenseDate,
      category,
      amount: Number(parsedAmount.toFixed(2)),
      description: description.trim(),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-expense-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 id="submit-expense-title" className="text-base font-bold text-slate-900">
              Submit Project Expense
            </h2>
            <p className="text-xs text-slate-600">
              Submitted by <strong>{currentUser.full_name}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Mandatory Accounting Rule Banner */}
          <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <span>
              <strong>Approval Gate Rule:</strong> Submitted expenses enter{' '}
              <strong>Pending Approval</strong> status. Pending and Rejected expenses do{' '}
              <strong>not</strong> contribute to Actual Project Cost until approved by an
              Agency Manager.
            </span>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="exp-project"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Project <span className="text-red-600">*</span>
            </label>
            {activeProjects.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
                No active projects available to submit expenses for.
              </div>
            ) : (
              <select
                id="exp-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="" disabled>Select a project...</option>
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.currency})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="exp-date"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Date <span className="text-red-600">*</span>
              </label>
              <input
                id="exp-date"
                type="date"
                max="2026-10-17"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full h-10 px-3 text-sm font-mono-tabular rounded-md border border-slate-300"
              />
            </div>

            <div>
              <label
                htmlFor="exp-cat"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Category <span className="text-red-600">*</span>
              </label>
              <select
                id="exp-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full h-10 px-3 text-sm rounded-md border border-slate-300 bg-white"
              >
                <option value="INFRASTRUCTURE">Infrastructure</option>
                <option value="SOFTWARE">Software License</option>
                <option value="CONTRACTOR">Subcontractor</option>
                <option value="TRAVEL">Client Travel</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="exp-amount"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Amount (USD) <span className="text-red-600">*</span>
              </label>
              <input
                id="exp-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="450.00"
                className="w-full h-10 px-3 text-sm font-mono-tabular rounded-md border border-slate-300"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="exp-desc"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Vendor & Business Justification <span className="text-red-600">*</span>
            </label>
            <textarea
              id="exp-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Include vendor name, invoice reference, and delivery purpose..."
              className="w-full p-3 text-sm rounded-md border border-slate-300"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800"
            >
              Submit for Approval
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const RejectExpenseModal: React.FC<{
  expense: Expense;
  projectName: string;
  onClose: () => void;
  onConfirmReject: (expenseId: string, reason: string) => void;
}> = ({ expense, projectName, onClose, onConfirmReject }) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 5) {
      setError(
        'Please provide a specific rejection reason (at least 5 characters) so the team member knows how to remediate.'
      );
      return;
    }
    onConfirmReject(expense.id, reason.trim());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-expense-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-red-50/60 flex items-center justify-between">
          <h2 id="reject-expense-title" className="text-base font-bold text-slate-900">
            Reject Submitted Expense
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-slate-500 hover:text-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 rounded-md bg-slate-50 border border-slate-200 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Project:</span>
              <span className="font-medium text-slate-900">{projectName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Submitted By:</span>
              <span className="font-medium text-slate-900">
                {expense.submitted_by_name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Amount:</span>
              <span className="font-mono-tabular font-semibold text-slate-900">
                {formatCurrency(expense.amount, 'USD')}
              </span>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-600 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </p>
          )}

          <div>
            <label
              htmlFor="reject-reason"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Rejection Feedback for Submitter <span className="text-red-600">*</span>
            </label>
            <textarea
              id="reject-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this expense cannot be approved (e.g., missing itemized receipt or exceeds travel policy cap)..."
              className="w-full p-3 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-red-700 rounded-md hover:bg-red-800"
            >
              Confirm Rejection
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const UpdateEstimateModal: React.FC<{
  project: EnrichedProject;
  onClose: () => void;
  onSaveEstimate: (projectId: string, remainingHours: number | null) => void;
}> = ({ project, onClose, onSaveEstimate }) => {
  const [isUnknown, setIsUnknown] = useState(
    project.estimated_remaining_hours === null
  );
  const [hoursValue, setHoursValue] = useState(
    project.estimated_remaining_hours !== null
      ? String(project.estimated_remaining_hours)
      : '140'
  );
  const [error, setError] = useState<string | null>(null);

  const parsedHours = Number(hoursValue);
  const previewRemainingCost =
    !isUnknown && !Number.isNaN(parsedHours) && parsedHours >= 0
      ? parsedHours * project.planned_hourly_cost
      : null;
  const previewFinalCost =
    previewRemainingCost !== null
      ? project.financials.actual_total_cost + previewRemainingCost
      : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isUnknown) {
      if (hoursValue.trim() === '' || Number.isNaN(parsedHours) || parsedHours < 0) {
        setError('Enter 0 or a positive number of remaining hours.');
        return;
      }
    }
    onSaveEstimate(
      project.id,
      isUnknown ? null : Number(parsedHours.toFixed(2))
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-estimate-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h2 id="update-estimate-title" className="text-base font-bold text-slate-900">
              Update Remaining Effort Estimate
            </h2>
            <p className="text-xs text-slate-600">{project.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-slate-500 hover:text-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          )}

          <label className="flex items-start gap-2.5 p-3 rounded-md bg-slate-50 border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={isUnknown}
              onChange={(e) => setIsUnknown(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-700"
            />
            <span className="text-xs text-slate-700">
              <strong>Estimate not yet known (Set to null):</strong> Withholds forecast
              calculations instead of assuming 0 hours remain.
            </span>
          </label>

          <div>
            <label
              htmlFor="quick-est-hours"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Estimated Remaining Hours (at{' '}
              {formatCurrency(project.planned_hourly_cost, project.currency)}/hr)
            </label>
            <input
              id="quick-est-hours"
              type="number"
              step="0.5"
              min="0"
              disabled={isUnknown}
              value={hoursValue}
              onChange={(e) => setHoursValue(e.target.value)}
              className={`w-full h-10 px-3 text-sm font-mono-tabular rounded-md border ${
                isUnknown
                  ? 'bg-slate-100 text-slate-400 border-slate-200'
                  : 'border-slate-300'
              }`}
            />
          </div>

          {previewFinalCost !== null && (
            <div className="p-3 rounded-md bg-blue-50/60 border border-blue-200 text-xs space-y-1 font-mono-tabular">
              <div className="flex justify-between">
                <span className="font-sans text-slate-600">Actual Cost to Date:</span>
                <span>
                  {formatCurrency(
                    project.financials.actual_total_cost,
                    project.currency
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-slate-600">
                  + Est. Remaining Cost:
                </span>
                <span>
                  {formatCurrency(previewRemainingCost, project.currency)}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-blue-200 font-semibold text-slate-900">
                <span className="font-sans">New Projected Final Cost:</span>
                <span>{formatCurrency(previewFinalCost, project.currency)}</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800"
            >
              Save Estimate
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const ClientFormModal: React.FC<{
  initialClient?: Client | null;
  onClose: () => void;
  onSave: (data: {
    name: string;
    contact_name: string;
    contact_email: string;
    default_currency: CurrencyCode;
    notes: string;
  }) => void;
}> = ({ initialClient, onClose, onSave }) => {
  const [name, setName] = useState(initialClient?.name ?? '');
  const [contactName, setContactName] = useState(
    initialClient?.contact_name ?? ''
  );
  const [contactEmail, setContactEmail] = useState(
    initialClient?.contact_email ?? ''
  );
  const [currency, setCurrency] = useState<CurrencyCode>(
    initialClient?.default_currency ?? 'USD'
  );
  const [notes, setNotes] = useState(initialClient?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError('Client organization name must be at least 2 characters.');
      return;
    }
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      setError('Please enter a valid contact email address.');
      return;
    }
    onSave({
      name: name.trim(),
      contact_name: contactName.trim(),
      contact_email: contactEmail.trim(),
      default_currency: currency,
      notes: notes.trim(),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 id="client-modal-title" className="text-base font-bold text-slate-900">
            {initialClient ? 'Edit Client Details' : 'Create New Client'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-slate-500 hover:text-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <p role="alert" className="text-xs text-red-600 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </p>
          )}

          <div>
            <label
              htmlFor="cli-name"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Client Organization Name <span className="text-red-600">*</span>
            </label>
            <input
              id="cli-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Meridian Financial Systems"
              className="w-full h-10 px-3 text-sm rounded-md border border-slate-300"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="cli-contact"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Primary Contact Name
              </label>
              <input
                id="cli-contact"
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Jordan Blake"
                className="w-full h-10 px-3 text-sm rounded-md border border-slate-300"
              />
            </div>

            <div>
              <label
                htmlFor="cli-currency"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Default Currency <span className="text-red-600">*</span>
              </label>
              <select
                id="cli-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="w-full h-10 px-3 text-sm rounded-md border border-slate-300 bg-white"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="cli-email"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Contact Email
            </label>
            <input
              id="cli-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="j.blake@meridian.io"
              className="w-full h-10 px-3 text-sm rounded-md border border-slate-300"
            />
          </div>

          <div>
            <label
              htmlFor="cli-notes"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Commercial / Delivery Notes
            </label>
            <textarea
              id="cli-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 text-sm rounded-md border border-slate-300"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800"
            >
              {initialClient ? 'Save Changes' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
