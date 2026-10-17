/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react';
import {
  AuthSession,
  Client,
  EnrichedProject,
  Expense,
  ExpenseCategory,
  Project,
  ProjectRiskStatus,
  ProjectStatus,
  StoredUserAccount,
  TimeEntry,
} from './types/domain';
import {
  calculatePortfolioSummary,
  enrichProjects,
  formatCurrency,
  formatHours,
  formatPercentage,
} from './lib/financial-engine';
import {
  loadActiveSession,
  loadStoredUsers,
  loadWorkspaceData,
  persistClients,
  persistExpenses,
  persistProjects,
  persistTimeEntries,
  resetWorkspaceToDefaults,
  saveActiveSession,
  saveStoredUsers,
  buildProjectAiRiskAnalysis,
} from './services/auth-and-store';
import { AuthScreen } from './components/auth/AuthScreen';
import {
  BudgetForecastChart,
  ExpenseStatusBadge,
  LifecycleText,
  RiskStatusBadge,
} from './components/shared/StatusBadges';
import {
  ClientFormModal,
  LogTimeModal,
  ProjectFormModal,
  RejectExpenseModal,
  SubmitExpenseModal,
  UpdateEstimateModal,
} from './components/modals/WorkflowModals';
import {
  ProjectDetailTab,
  ProjectDetailView,
} from './components/views/ProjectDetailView';
import {
  ProfileTab,
  UserProfileView,
} from './components/views/UserProfileView';

type WorkspaceRoute =
  | 'DASHBOARD'
  | 'PROJECTS'
  | 'PROJECT_DETAIL'
  | 'TIME_ENTRIES'
  | 'CLIENTS'
  | 'CLIENT_DETAIL'
  | 'EXPENSES'
  | 'SETTINGS';

export default function App() {
  // Persistent User Directory & Active Session
  const [registeredUsers, setRegisteredUsers] = useState<StoredUserAccount[]>(
    () => loadStoredUsers()
  );
  const [session, setSession] = useState<AuthSession | null>(() =>
    loadActiveSession()
  );
  const [signedOutNotice, setSignedOutNotice] = useState(false);

  // Persistent Workspace Domain Data
  const [clients, setClients] = useState<Client[]>(
    () => loadWorkspaceData().clients
  );
  const [projects, setProjects] = useState<Project[]>(
    () => loadWorkspaceData().projects
  );
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(
    () => loadWorkspaceData().timeEntries
  );
  const [expenses, setExpenses] = useState<Expense[]>(
    () => loadWorkspaceData().expenses
  );

  // Sync changes to storage
  useEffect(() => {
    persistClients(clients);
  }, [clients]);

  useEffect(() => {
    persistProjects(projects);
  }, [projects]);

  useEffect(() => {
    persistTimeEntries(timeEntries);
  }, [timeEntries]);

  useEffect(() => {
    persistExpenses(expenses);
  }, [expenses]);

  // Navigation & Route State
  const [route, setRoute] = useState<WorkspaceRoute>('DASHBOARD');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('prj_01');
  const [projectDetailTab, setProjectDetailTab] =
    useState<ProjectDetailTab>('OVERVIEW');
  const [selectedClientId, setSelectedClientId] = useState<string>('cli_01');
  const [profileTab, setProfileTab] =
    useState<ProfileTab>('OVERVIEW_AND_EDIT');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Filters & Search
  const [projectSearch, setProjectSearch] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState<
    'ALL' | ProjectStatus
  >('ALL');
  const [projectRiskFilter, setProjectRiskFilter] = useState<
    'ALL' | ProjectRiskStatus
  >('ALL');
  const [clientSearch, setClientSearch] = useState('');
  const [clientStatusFilter, setClientStatusFilter] = useState<
    'ALL' | 'ACTIVE' | 'ARCHIVED'
  >('ALL');
  const [expenseStatusFilter, setExpenseStatusFilter] = useState<
    'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'
  >('ALL');

  // Modal Triggers
  const [projectModalState, setProjectModalState] = useState<{
    open: boolean;
    editingProject: Project | null;
  }>({ open: false, editingProject: null });

  const [logTimeModalProject, setLogTimeModalProject] = useState<
    string | undefined
  >(undefined);
  const [isLogTimeModalOpen, setIsLogTimeModalOpen] = useState(false);

  const [submitExpenseModalProject, setSubmitExpenseModalProject] = useState<
    string | undefined
  >(undefined);
  const [isSubmitExpenseModalOpen, setIsSubmitExpenseModalOpen] =
    useState(false);

  const [rejectingExpense, setRejectingExpense] = useState<Expense | null>(
    null
  );
  const [updatingEstimateProject, setUpdatingEstimateProject] =
    useState<EnrichedProject | null>(null);

  const [clientModalState, setClientModalState] = useState<{
    open: boolean;
    editingClient: Client | null;
  }>({ open: false, editingClient: null });

  // Actionable Toast Notification
  const [toastMessage, setToastMessage] = useState<{
    type: 'SUCCESS' | 'ERROR';
    text: string;
  } | null>(null);

  const triggerToast = (text: string, type: 'SUCCESS' | 'ERROR' = 'SUCCESS') => {
    setToastMessage({ type, text });
    window.setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const currentUser = session?.user ?? null;

  // Derived Enriched Projects & Portfolio Summary
  const enrichedProjects = useMemo(
    () => enrichProjects(projects, clients, timeEntries, expenses),
    [projects, clients, timeEntries, expenses]
  );

  const visibleProjects = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'MANAGER') return enrichedProjects;
    return enrichedProjects.filter((p) =>
      p.assigned_member_ids.includes(currentUser.id)
    );
  }, [enrichedProjects, currentUser]);

  const portfolioSummary = useMemo(
    () => calculatePortfolioSummary(enrichedProjects, expenses, 'USD'),
    [enrichedProjects, expenses]
  );

  const filteredProjects = useMemo(() => {
    return visibleProjects.filter((p) => {
      const matchesSearch =
        projectSearch.trim() === '' ||
        p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
        p.client_name.toLowerCase().includes(projectSearch.toLowerCase());
      const matchesStatus =
        projectStatusFilter === 'ALL' || p.status === projectStatusFilter;
      const matchesRisk =
        projectRiskFilter === 'ALL' ||
        p.financials.risk_status === projectRiskFilter;
      return matchesSearch && matchesStatus && matchesRisk;
    });
  }, [
    visibleProjects,
    projectSearch,
    projectStatusFilter,
    projectRiskFilter,
  ]);

  const atRiskWatchlist = useMemo(() => {
    const severityOrder: Record<ProjectRiskStatus, number> = {
      CRITICAL: 0,
      WARNING: 1,
      INCOMPLETE_DATA: 2,
      HEALTHY: 3,
    };
    return enrichedProjects
      .filter(
        (p) =>
          p.status === 'ACTIVE' && p.financials.risk_status !== 'HEALTHY'
      )
      .sort(
        (a, b) =>
          severityOrder[a.financials.risk_status] -
          severityOrder[b.financials.risk_status]
      );
  }, [enrichedProjects]);

  const selectedProject = useMemo(
    () =>
      visibleProjects.find((p) => p.id === selectedProjectId) ??
      visibleProjects[0] ??
      enrichedProjects[0],
    [visibleProjects, enrichedProjects, selectedProjectId]
  );

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) ?? clients[0],
    [clients, selectedClientId]
  );

  const visibleTimeEntries = useMemo(() => {
    if (!currentUser) return [];
    const list =
      currentUser.role === 'MANAGER'
        ? timeEntries
        : timeEntries.filter((t) => t.user_id === currentUser.id);
    return [...list].sort((a, b) => b.work_date.localeCompare(a.work_date));
  }, [timeEntries, currentUser]);

  const visibleExpenses = useMemo(() => {
    if (!currentUser) return [];
    const list =
      currentUser.role === 'MANAGER'
        ? expenses
        : expenses.filter((e) => e.submitted_by_id === currentUser.id);
    return [...list].sort((a, b) =>
      b.expense_date.localeCompare(a.expense_date)
    );
  }, [expenses, currentUser]);

  // Auth Handlers
  const handleAuthSuccess = (
    newSession: AuthSession,
    updatedUsers?: StoredUserAccount[],
    updatedProjects?: Project[],
    isNewRegistration?: boolean
  ) => {
    if (updatedUsers) setRegisteredUsers(updatedUsers);
    if (updatedProjects) setProjects(updatedProjects);
    setSession(newSession);
    setSignedOutNotice(false);
    setRoute('DASHBOARD');
    triggerToast(
      isNewRegistration
        ? `Account created. Welcome to MarginWatch, ${newSession.user.full_name} (${newSession.user.role}).`
        : `Signed in as ${newSession.user.full_name} (${newSession.user.role}).`
    );
  };

  const handleSignOut = () => {
    saveActiveSession(null);
    setSession(null);
    setSignedOutNotice(true);
    setProfileMenuOpen(false);
    setSignOutConfirmOpen(false);
    setMobileMenuOpen(false);
  };

  const openProfileSection = (tab: ProfileTab = 'OVERVIEW_AND_EDIT') => {
    setProfileTab(tab);
    setRoute('SETTINGS');
    setProfileMenuOpen(false);
    setMobileMenuOpen(false);
  };

  // If no authenticated session exists, enforce the Login / Registration Gate
  if (!currentUser) {
    return (
      <AuthScreen
        registeredUsers={registeredUsers}
        sessionExpiredNotice={signedOutNotice}
        onAuthSuccess={handleAuthSuccess}
      />
    );
  }

  const isManager = currentUser.role === 'MANAGER';

  // Domain Mutation Handlers
  const handleSaveProject = (
    projectData: Omit<Project, 'id' | 'updated_at'>
  ) => {
    if (projectModalState.editingProject) {
      const updatedId = projectModalState.editingProject.id;
      setProjects((prev) =>
        prev.map((p) =>
          p.id === updatedId
            ? { ...projectData, id: updatedId, updated_at: '2026-10-17' }
            : p
        )
      );
      triggerToast(
        `Saved changes to "${projectData.name}" and recalculated financials.`
      );
    } else {
      const newId = `prj_${Date.now()}`;
      setProjects((prev) => [
        { ...projectData, id: newId, updated_at: '2026-10-17' },
        ...prev,
      ]);
      setSelectedProjectId(newId);
      setRoute('PROJECT_DETAIL');
      triggerToast(
        projectData.estimated_remaining_hours === null
          ? `Created "${projectData.name}" with unknown remaining hours (Forecast Unavailable).`
          : `Created project "${projectData.name}".`
      );
    }
    setProjectModalState({ open: false, editingProject: null });
  };

  const handleSaveEstimate = (
    projectId: string,
    remainingHours: number | null
  ) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? {
              ...p,
              estimated_remaining_hours: remainingHours,
              updated_at: '2026-10-17',
            }
          : p
      )
    );
    setUpdatingEstimateProject(null);
    triggerToast(
      remainingHours === null
        ? 'Remaining hours set to unknown (null). Forecast withheld.'
        : `Updated remaining hours estimate to ${remainingHours.toFixed(
            2
          )} hrs. Financial forecast updated.`
    );
  };

  const handleCreateTimeEntry = (data: {
    project_id: string;
    work_date: string;
    hours: number;
    description: string;
  }) => {
    const newEntry: TimeEntry = {
      id: `te_${Date.now()}`,
      project_id: data.project_id,
      user_id: currentUser.id,
      user_name: currentUser.full_name,
      work_date: data.work_date,
      hours: data.hours,
      description: data.description,
      hourly_cost_snapshot: currentUser.default_hourly_cost,
      computed_cost: Number(
        (data.hours * currentUser.default_hourly_cost).toFixed(2)
      ),
      created_at: new Date().toISOString(),
    };
    setTimeEntries((prev) => [newEntry, ...prev]);
    setIsLogTimeModalOpen(false);
    triggerToast(
      `Recorded ${data.hours.toFixed(2)} hrs on ${data.work_date}.`
    );
  };

  const handleDeleteTimeEntry = (timeEntryId: string) => {
    setTimeEntries((prev) => prev.filter((t) => t.id !== timeEntryId));
    triggerToast('Deleted time entry and updated project labor cost.');
  };

  const handleSubmitExpense = (data: {
    project_id: string;
    expense_date: string;
    category: ExpenseCategory;
    amount: number;
    description: string;
  }) => {
    const newExpense: Expense = {
      id: `exp_${Date.now()}`,
      project_id: data.project_id,
      submitted_by_id: currentUser.id,
      submitted_by_name: currentUser.full_name,
      expense_date: data.expense_date,
      category: data.category,
      amount: data.amount,
      description: data.description,
      status: 'PENDING',
      rejection_reason: null,
      reviewed_by_name: null,
      reviewed_at: null,
    };
    setExpenses((prev) => [newExpense, ...prev]);
    setIsSubmitExpenseModalOpen(false);
    triggerToast(
      `Submitted ${formatCurrency(
        data.amount,
        'USD'
      )} expense for Manager approval.`
    );
  };

  const handleDeletePendingExpense = (expenseId: string) => {
    setExpenses((prev) =>
      prev.filter((e) => !(e.id === expenseId && e.status === 'PENDING'))
    );
    triggerToast('Withdrew pending expense submission.');
  };

  const handleApproveExpense = (expenseId: string) => {
    if (!isManager) return;
    const target = expenses.find((e) => e.id === expenseId);
    setExpenses((prev) =>
      prev.map((e) =>
        e.id === expenseId
          ? {
              ...e,
              status: 'APPROVED',
              reviewed_by_name: currentUser.full_name,
              reviewed_at: '2026-10-17',
            }
          : e
      )
    );
    if (target) {
      triggerToast(
        `Approved ${formatCurrency(
          target.amount,
          'USD'
        )} expense. Added to Actual Project Cost.`
      );
    }
  };

  const handleConfirmRejectExpense = (expenseId: string, reason: string) => {
    if (!isManager) return;
    setExpenses((prev) =>
      prev.map((e) =>
        e.id === expenseId
          ? {
              ...e,
              status: 'REJECTED',
              rejection_reason: reason,
              reviewed_by_name: currentUser.full_name,
              reviewed_at: '2026-10-17',
            }
          : e
      )
    );
    setRejectingExpense(null);
    triggerToast('Rejected expense with remediation feedback.');
  };

  const handleSaveClient = (data: {
    name: string;
    contact_name: string;
    contact_email: string;
    default_currency: 'USD' | 'EUR' | 'GBP';
    notes: string;
  }) => {
    if (!isManager) return;
    if (clientModalState.editingClient) {
      const cid = clientModalState.editingClient.id;
      setClients((prev) =>
        prev.map((c) => (c.id === cid ? { ...c, ...data } : c))
      );
      triggerToast(`Updated client "${data.name}".`);
    } else {
      const newClient: Client = {
        id: `cli_${Date.now()}`,
        ...data,
        status: 'ACTIVE',
        created_at: '2026-10-17',
      };
      setClients((prev) => [newClient, ...prev]);
      setSelectedClientId(newClient.id);
      setRoute('CLIENT_DETAIL');
      triggerToast(`Created client "${data.name}".`);
    }
    setClientModalState({ open: false, editingClient: null });
  };

  const handleArchiveClient = (client: Client) => {
    if (!isManager) return;
    const activeClientProjects = projects.filter(
      (p) => p.client_id === client.id && p.status === 'ACTIVE'
    );
    if (activeClientProjects.length > 0) {
      triggerToast(
        `Cannot archive "${client.name}" while ${activeClientProjects.length} active project(s) exist. Complete or cancel active projects first.`,
        'ERROR'
      );
      return;
    }
    setClients((prev) =>
      prev.map((c) =>
        c.id === client.id
          ? { ...c, status: c.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED' }
          : c
      )
    );
    triggerToast(
      client.status === 'ARCHIVED'
        ? `Restored client "${client.name}" to Active status.`
        : `Archived client "${client.name}".`
    );
  };

  const openProjectDetail = (
    projectId: string,
    tab: ProjectDetailTab = 'OVERVIEW'
  ) => {
    setSelectedProjectId(projectId);
    setProjectDetailTab(isManager ? tab : tab === 'OVERVIEW' ? 'TIME_ENTRIES' : tab);
    setRoute('PROJECT_DETAIL');
  };

  return (
    <div className="h-dvh overflow-hidden bg-[#F6F7F9] text-[#202633] flex flex-col">
      {/* Skip Link for WCAG 2.2 AA Keyboard Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#6558D3] focus:text-white focus:text-xs focus:font-semibold focus:rounded-lg"
      >
        Skip to main workspace
      </a>

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="h-14 shrink-0 bg-white border-b border-[#E3E6ED] px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sm:gap-8 sticky top-0 z-30">
        {/* Zone 1: Single-line Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            className="md:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-md"
          >
            <Menu className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setRoute('DASHBOARD')}
            className="text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0"
          >
            MarginWatch
          </button>
        </div>

        {/* Zone 2: Role-Determined Single-Line Text Navigation Links */}
        <nav
          aria-label="Top navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          <button
            type="button"
            onClick={() => setRoute('DASHBOARD')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 ${
              route === 'DASHBOARD'
                ? 'text-blue-700 border-b-2 border-blue-700 font-semibold'
                : ''
            }`}
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => setRoute('PROJECTS')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 ${
              route === 'PROJECTS' || route === 'PROJECT_DETAIL'
                ? 'text-blue-700 border-b-2 border-blue-700 font-semibold'
                : ''
            }`}
          >
            {isManager ? 'Projects' : 'Assigned Projects'}
          </button>
          {isManager && (
            <button
              type="button"
              onClick={() => setRoute('CLIENTS')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 ${
                route === 'CLIENTS' || route === 'CLIENT_DETAIL'
                  ? 'text-blue-700 border-b-2 border-blue-700 font-semibold'
                  : ''
              }`}
            >
              Clients
            </button>
          )}
          <button
            type="button"
            onClick={() => setRoute('TIME_ENTRIES')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 ${
              route === 'TIME_ENTRIES'
                ? 'text-blue-700 border-b-2 border-blue-700 font-semibold'
                : ''
            }`}
          >
            Time Entries
          </button>
          <button
            type="button"
            onClick={() => setRoute('EXPENSES')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 ${
              route === 'EXPENSES'
                ? 'text-blue-700 border-b-2 border-blue-700 font-semibold'
                : ''
            }`}
          >
            Expenses
          </button>
        </nav>

        {/* Zone 3: Primary Operational CTA + User Profile & Logout Menu */}
        <div className="flex items-center gap-3 shrink-0">
          {isManager ? (
            <button
              type="button"
              onClick={() =>
                setProjectModalState({ open: true, editingProject: null })
              }
              className="hidden sm:inline-flex px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
            >
              + New Project
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setLogTimeModalProject(undefined);
                setIsLogTimeModalOpen(true);
              }}
              className="hidden sm:inline-flex px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
            >
              + Log Work Hours
            </button>
          )}

          {/* Authenticated User Profile & Logout Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
              aria-label="Open user profile and account menu"
              className="flex items-center gap-2.5 pl-2 pr-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
            >
              <span className="w-7 h-7 rounded bg-slate-900 text-white font-display font-bold text-xs flex items-center justify-center shrink-0">
                {currentUser.full_name
                  .split(/\s+/)
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <span className="hidden xl:block text-left leading-tight">
                <span className="block text-xs font-semibold text-slate-900 truncate max-w-[130px]">
                  {currentUser.full_name}
                </span>
                <span className="block text-[10px] font-mono text-slate-500">
                  {currentUser.role}
                </span>
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {profileMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setProfileMenuOpen(false)}
                />
                <div
                  role="menu"
                  aria-label="User Account Actions"
                  className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-lg z-50 divide-y divide-slate-200 overflow-hidden"
                >
                  <div className="p-3.5 bg-slate-50/70 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {currentUser.full_name}
                      </span>
                      <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-blue-50 text-blue-800 border border-blue-200 shrink-0">
                        {currentUser.role}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-600 truncate">
                      {currentUser.email}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                      <span>{currentUser.title}</span>
                      <span className="font-mono-tabular font-semibold text-slate-800">
                        {formatCurrency(currentUser.default_hourly_cost, 'USD')}
                        /hr
                      </span>
                    </div>
                  </div>

                  <div className="p-1.5 space-y-0.5">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => openProfileSection('OVERVIEW_AND_EDIT')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-md text-left"
                    >
                      <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                      <span>My Profile & Delivery Rate</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => openProfileSection('SECURITY_AND_SESSION')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-md text-left"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                      <span>Security, Password & Sessions</span>
                    </button>
                    {isManager && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => openProfileSection('TEAM_DIRECTORY')}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-md text-left"
                      >
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        <span>Agency Team Directory</span>
                      </button>
                    )}
                  </div>

                  <div className="p-1.5 bg-slate-50/40">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleSignOut}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 rounded-md"
                    >
                      <span className="flex items-center gap-2">
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Log Out of Workspace</span>
                      </span>
                      <span className="text-[10px] font-mono text-red-600">
                        End Session
                      </span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Application Body: Sticky Viewport-Fitted Sidebar Rail + Scrollable Workspace Canvas */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Sticky Side Navbar (Fitted 100% to Screen Height Below Top Bar) */}
        <aside
          aria-label="Primary Sidebar Navigation"
          className="hidden md:flex md:w-60 lg:w-64 shrink-0 h-full max-h-[calc(100dvh-3.5rem)] sticky top-14 flex-col justify-between bg-white border-r border-[#E3E6ED] overflow-hidden select-none"
        >
          <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col justify-between gap-3">
            {/* Sidebar Navigation Links (Strictly Governed by Authenticated User Role) */}
            <nav aria-label="Workspace Sections" className="space-y-1">
              <div className="px-2.5 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-[#697386]">
                Workspace Navigation
              </div>
              <button
                type="button"
                onClick={() => setRoute('DASHBOARD')}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium rounded-lg transition-colors ${
                  route === 'DASHBOARD'
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-[#4E5666] hover:bg-[#F6F7F9] hover:text-[#202633]'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {isManager ? 'Portfolio Watchdog' : 'My Delivery Overview'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRoute('PROJECTS')}
                className={`w-full flex items-center justify-between px-2.5 py-2 text-xs font-medium rounded-lg transition-colors ${
                  route === 'PROJECTS' || route === 'PROJECT_DETAIL'
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-[#4E5666] hover:bg-[#F6F7F9] hover:text-[#202633]'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <FolderKanban className="w-4 h-4 shrink-0" />
                  <span className="truncate">
                    {isManager ? 'All Projects' : 'Assigned Projects'}
                  </span>
                </span>
                <span className="font-mono-tabular text-[11px] text-[#697386] shrink-0">
                  {visibleProjects.length}
                </span>
              </button>

              {isManager && (
                <button
                  type="button"
                  onClick={() => setRoute('CLIENTS')}
                  className={`w-full flex items-center justify-between px-2.5 py-2 text-xs font-medium rounded-lg transition-colors ${
                    route === 'CLIENTS' || route === 'CLIENT_DETAIL'
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-[#4E5666] hover:bg-[#F6F7F9] hover:text-[#202633]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Building2 className="w-4 h-4 shrink-0" />
                    <span className="truncate">Clients</span>
                  </span>
                  <span className="font-mono-tabular text-[11px] text-[#697386] shrink-0">
                    {clients.length}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setRoute('TIME_ENTRIES')}
                className={`w-full flex items-center justify-between px-2.5 py-2 text-xs font-medium rounded-lg transition-colors ${
                  route === 'TIME_ENTRIES'
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-[#4E5666] hover:bg-[#F6F7F9] hover:text-[#202633]'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span className="truncate">
                    {isManager ? 'Time Ledger' : 'My Time Entries'}
                  </span>
                </span>
                <span className="font-mono-tabular text-[11px] text-[#697386] shrink-0">
                  {visibleTimeEntries.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRoute('EXPENSES')}
                className={`w-full flex items-center justify-between px-2.5 py-2 text-xs font-medium rounded-lg transition-colors ${
                  route === 'EXPENSES'
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-[#4E5666] hover:bg-[#F6F7F9] hover:text-[#202633]'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Receipt className="w-4 h-4 shrink-0" />
                  <span className="truncate">
                    {isManager ? 'Expense Approvals' : 'My Expenses'}
                  </span>
                </span>
                {isManager && portfolioSummary.pending_expenses_count > 0 ? (
                  <span className="font-mono-tabular text-[10px] font-semibold text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] px-1.5 py-0.5 rounded shrink-0">
                    {portfolioSummary.pending_expenses_count}
                  </span>
                ) : (
                  <span className="font-mono-tabular text-[11px] text-[#697386] shrink-0">
                    {visibleExpenses.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => openProfileSection('OVERVIEW_AND_EDIT')}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium rounded-lg transition-colors ${
                  route === 'SETTINGS'
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-[#4E5666] hover:bg-[#F6F7F9] hover:text-[#202633]'
                }`}
              >
                <UserIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {isManager ? 'Profile & Team Governance' : 'My Profile & Security'}
                </span>
              </button>
            </nav>

            {/* Quick Operational Actions */}
            <div className="pt-2.5 border-t border-[#E3E6ED] space-y-1.5 shrink-0">
              <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#697386] px-1">
                Quick Actions
              </div>
              <button
                type="button"
                onClick={() => {
                  setLogTimeModalProject(undefined);
                  setIsLogTimeModalOpen(true);
                }}
                className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#202633] bg-white border border-[#CBD0DC] rounded-lg hover:bg-[#F6F7F9] transition-colors"
              >
                <Clock className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                <span>Record Work Hours</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubmitExpenseModalProject(undefined);
                  setIsSubmitExpenseModalOpen(true);
                }}
                className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#202633] bg-white border border-[#CBD0DC] rounded-lg hover:bg-[#F6F7F9] transition-colors"
              >
                <Receipt className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                <span>Submit Expense</span>
              </button>
            </div>
          </div>

          {/* Authenticated User Profile & Sign Out Footer (Pinned to bottom of sticky rail) */}
          <div className="shrink-0 p-3 border-t border-[#E3E6ED] bg-[#F6F7F9]/80 space-y-2">
            <button
              type="button"
              onClick={() => openProfileSection('OVERVIEW_AND_EDIT')}
              className="w-full flex items-center gap-2.5 text-left p-1.5 -m-1.5 rounded-lg hover:bg-white transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-[#202633] text-white font-display font-bold text-xs flex items-center justify-center shrink-0">
                {currentUser.full_name
                  .split(/\s+/)
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs font-semibold text-[#202633] group-hover:text-blue-700 truncate">
                    {currentUser.full_name}
                  </span>
                  <span className="text-[9px] font-mono font-semibold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 shrink-0">
                    {currentUser.role === 'MANAGER' ? 'MGR' : 'TEAM'}
                  </span>
                </div>
                <div className="text-[11px] text-[#4E5666] truncate">
                  {currentUser.title}
                </div>
              </div>
            </button>

            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => openProfileSection('OVERVIEW_AND_EDIT')}
                className="flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-medium text-[#202633] bg-white border border-[#CBD0DC] rounded-lg hover:bg-[#F0F2F6] transition-colors"
              >
                <UserIcon className="w-3.5 h-3.5 shrink-0" />
                <span>Profile</span>
              </button>
              <button
                type="button"
                onClick={() => setSignOutConfirmOpen(true)}
                className="flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-medium text-[#BE123C] bg-white border border-[#FECDD3] rounded-lg hover:bg-[#FFF1F2] transition-colors"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 md:hidden flex"
          >
            <div
              className="fixed inset-0 bg-slate-950/40"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative w-72 max-w-[85vw] bg-white h-full shadow-xl flex flex-col justify-between p-4 z-10">
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <span className="text-base font-bold text-slate-900 font-display">
                    MarginWatch
                  </span>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 text-slate-500"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                  <div className="font-semibold text-slate-900">
                    {currentUser.full_name}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    {currentUser.email}
                  </div>
                  <div className="mt-1.5 inline-block font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                    Role: {currentUser.role}
                  </div>
                </div>

                <nav className="space-y-1">
                  {(
                    [
                      {
                        id: 'DASHBOARD',
                        label: isManager
                          ? 'Portfolio Watchdog'
                          : 'My Delivery Overview',
                      },
                      {
                        id: 'PROJECTS',
                        label: isManager ? 'All Projects' : 'Assigned Projects',
                      },
                      ...(isManager
                        ? [{ id: 'CLIENTS', label: 'Clients' }]
                        : []),
                      {
                        id: 'TIME_ENTRIES',
                        label: isManager ? 'Time Ledger' : 'My Time Entries',
                      },
                      {
                        id: 'EXPENSES',
                        label: isManager ? 'Expense Approvals' : 'My Expenses',
                      },
                      { id: 'SETTINGS', label: 'Account Settings' },
                    ] as { id: WorkspaceRoute; label: string }[]
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setRoute(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2.5 text-xs font-medium rounded-md ${
                        route === item.id
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </nav>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                className="w-full py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-md flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Workspace Container (Independently Scrollable, Responsive 320px -> 1920px bounded at 1440px) */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 h-full overflow-y-auto overflow-x-hidden min-w-0 focus:outline-none"
        >
          <div className="max-w-[1440px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6">
          {/* Actionable Toast Notification */}
          {toastMessage && (
            <div
              role="status"
              aria-live="polite"
              className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 shadow-xs ${
                toastMessage.type === 'ERROR'
                  ? 'bg-[#FFF1F2] border-[#FECDD3] text-[#BE123C]'
                  : 'bg-[#ECFDF5] border-[#A7F3D0] text-[#047857]'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-medium">
                {toastMessage.type === 'ERROR' ? (
                  <AlertOctagon className="w-4 h-4 text-[#BE123C] shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-[#047857] shrink-0" />
                )}
                <span>{toastMessage.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="text-xs text-[#4E5666] hover:text-[#202633] font-medium"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* ==================== 1. DASHBOARD ROUTE (/dashboard) ==================== */}
          {route === 'DASHBOARD' && (
            <div className="space-y-6">
              <div className="bg-white border border-[#E3E6ED] rounded-2xl p-4 sm:p-5 bg-dev-grid flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#6558D3] bg-[#F3F1FF] px-2 py-0.5 rounded border border-[#DAD4FC]">
                      {isManager ? 'Executive Watchdog' : 'Delivery Operations'}
                    </span>
                    <span className="text-[11px] font-mono text-[#697386]">
                      Reporting Currency: USD
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[#202633]">
                    {isManager
                      ? 'Portfolio Profitability & Risk Watchdog'
                      : `Delivery Workspace · ${currentUser.full_name}`}
                  </h1>
                  <p className="text-xs text-[#4E5666] mt-0.5">
                    {isManager
                      ? 'Real-time visibility into active project health, delivery budget consumption, projected commercial margins, and pending approvals.'
                      : 'View your assigned active projects, record decimal delivery work hours, and track submitted expense statuses.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLogTimeModalProject(undefined);
                      setIsLogTimeModalOpen(true);
                    }}
                    className="px-3.5 py-2 text-xs font-medium text-[#202633] bg-white border border-[#CBD0DC] rounded-lg hover:bg-[#F6F7F9] transition-colors whitespace-nowrap"
                  >
                    + Log Work Hours
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitExpenseModalProject(undefined);
                      setIsSubmitExpenseModalOpen(true);
                    }}
                    className="px-3.5 py-2 text-xs font-medium text-[#202633] bg-white border border-[#CBD0DC] rounded-lg hover:bg-[#F6F7F9] transition-colors whitespace-nowrap"
                  >
                    + Submit Expense
                  </button>
                </div>
              </div>

              {isManager ? (
                <>
                  {/* Manager 5-Column KPI Summary Strip (12-16px card radii + explicit metric definitions) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    <div className="mw-card p-4 flex flex-col justify-between min-w-0">
                      <div>
                        <span className="text-xs font-semibold text-[#202633] block">
                          Active Projects
                        </span>
                        <span className="text-[11px] text-[#697386] block">
                          Currently in delivery execution
                        </span>
                      </div>
                      <div className="text-2xl font-bold font-mono-tabular text-[#202633] my-2">
                        {portfolioSummary.active_projects_count}
                      </div>
                      <div className="text-[11px] text-[#4E5666] flex items-center gap-1.5 flex-wrap">
                        <span className="text-[#047857] font-medium">
                          {portfolioSummary.healthy_count} Healthy
                        </span>
                        <span>·</span>
                        <span className="text-[#B45309] font-medium">
                          {portfolioSummary.warning_count} Warning
                        </span>
                        <span>·</span>
                        <span className="text-[#BE123C] font-medium">
                          {portfolioSummary.critical_count} Critical
                        </span>
                      </div>
                    </div>

                    <div className="mw-card p-4 flex flex-col justify-between min-w-0">
                      <div>
                        <span className="text-xs font-semibold text-[#202633] block">
                          Needs Attention
                        </span>
                        <span className="text-[11px] text-[#697386] block">
                          ≥85% budget used or missing estimate
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 my-2 flex-wrap">
                        <span
                          className={`text-2xl font-bold font-mono-tabular ${
                            portfolioSummary.at_risk_count > 0
                              ? 'text-[#BE123C]'
                              : 'text-[#047857]'
                          }`}
                        >
                          {portfolioSummary.at_risk_count} At Risk
                        </span>
                        {portfolioSummary.incomplete_data_count > 0 && (
                          <span className="text-xs font-mono-tabular text-[#4E5666] bg-[#F0F2F6] px-1.5 py-0.5 rounded">
                            +{portfolioSummary.incomplete_data_count} null est.
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#4E5666]">
                        Flagged for scope or budget review
                      </div>
                    </div>

                    <div className="mw-card p-4 flex flex-col justify-between min-w-0">
                      <div>
                        <span className="text-xs font-semibold text-[#202633] block">
                          Actual Delivery Cost
                        </span>
                        <span className="text-[11px] text-[#697386] block">
                          Logged labor + Approved expenses
                        </span>
                      </div>
                      <div className="text-2xl font-bold font-mono-tabular text-[#202633] my-2 truncate">
                        {formatCurrency(
                          portfolioSummary.total_actual_cost,
                          portfolioSummary.currency
                        )}
                      </div>
                      <div className="text-[11px] text-[#4E5666] font-mono-tabular">
                        {formatPercentage(portfolioSummary.budget_consumed_pct)} of{' '}
                        {formatCurrency(
                          portfolioSummary.total_planned_budget,
                          portfolioSummary.currency
                        )}{' '}
                        budget
                      </div>
                    </div>

                    <div className="mw-card p-4 flex flex-col justify-between min-w-0">
                      <div>
                        <span className="text-xs font-semibold text-[#202633] block">
                          Projected Final Cost
                        </span>
                        <span className="text-[11px] text-[#697386] block">
                          Actual cost + (Rem. hours × Planned rate)
                        </span>
                      </div>
                      <div className="text-2xl font-bold font-mono-tabular text-[#202633] my-2 truncate">
                        {formatCurrency(
                          portfolioSummary.total_projected_final_cost,
                          portfolioSummary.currency
                        )}
                      </div>
                      <div className="text-[11px] text-[#4E5666] font-mono-tabular">
                        Est. Margin:{' '}
                        <strong className="text-[#202633]">
                          {formatPercentage(
                            portfolioSummary.aggregate_projected_margin_pct
                          )}
                        </strong>
                        {portfolioSummary.excluded_incomplete_projects_count > 0 && (
                          <span className="block font-sans text-[11px] text-[#B45309] mt-0.5">
                            Excludes{' '}
                            {portfolioSummary.excluded_incomplete_projects_count}{' '}
                            unestimated project
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mw-card p-4 flex flex-col justify-between min-w-0 sm:col-span-2 lg:col-span-1">
                      <div>
                        <span className="text-xs font-semibold text-[#202633] block">
                          Pending Approvals
                        </span>
                        <span className="text-[11px] text-[#697386] block">
                          Excluded from Actual Cost until approved
                        </span>
                      </div>
                      <div className="text-2xl font-bold font-mono-tabular text-[#B45309] my-2 truncate">
                        {portfolioSummary.pending_expenses_count} (
                        {formatCurrency(
                          portfolioSummary.pending_expenses_amount,
                          portfolioSummary.currency
                        )}
                        )
                      </div>
                      <div className="text-[11px] text-[#4E5666]">
                        Requires Manager review action
                      </div>
                    </div>
                  </div>

                  {/* Primary Decision Split: Project Health & Needs-Attention Panel (8 cols) + Pending Approvals Queue (4 cols) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <div className="lg:col-span-8 bg-white border border-[#E3E6ED] rounded-2xl overflow-hidden shadow-2xs">
                      <div className="p-4 sm:p-5 border-b border-[#E3E6ED] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-base font-semibold text-[#202633]">
                              Project Health & Needs-Attention Watchlist
                            </h2>
                            <span className="font-mono text-[10px] font-semibold text-[#BE123C] bg-[#FFF1F2] px-2 py-0.5 rounded border border-[#FECDD3]">
                              {atRiskWatchlist.length} Flagged
                            </span>
                          </div>
                          <p className="text-xs text-[#4E5666] mt-0.5">
                            Ranked by severity (Critical → Warning → Missing
                            Estimate). Select any project to inspect financial
                            drivers or update remaining hours.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRoute('PROJECTS')}
                          className="text-xs font-semibold text-[#6558D3] hover:underline whitespace-nowrap self-start sm:self-auto"
                        >
                          All Projects ({enrichedProjects.length}) →
                        </button>
                      </div>

                      {/* Desktop Table (>= 768px) */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-[#E3E6ED] bg-[#F0F2F6]/70 text-xs font-medium text-[#4E5666]">
                              <th className="py-3 px-4">Project & Client</th>
                              <th className="py-3 px-4">Health Status</th>
                              <th className="py-3 px-4 text-right">
                                Actual / Budget Consumed
                              </th>
                              <th className="py-3 px-4 text-right">
                                Projected Final & Margin
                              </th>
                              <th className="py-3 px-4">Primary Risk Driver</th>
                              <th className="py-3 px-4 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E3E6ED] text-xs">
                            {atRiskWatchlist.map((proj) => {
                              const f = proj.financials;
                              const barColor =
                                f.risk_status === 'CRITICAL'
                                  ? 'bg-[#F43F5E]'
                                  : f.risk_status === 'WARNING'
                                  ? 'bg-[#F59E0B]'
                                  : 'bg-[#94A3B8]';
                              return (
                                <tr
                                  key={proj.id}
                                  className="hover:bg-[#F6F7F9]/80 transition-colors"
                                >
                                  <td className="py-3.5 px-4">
                                    <button
                                      type="button"
                                      onClick={() => openProjectDetail(proj.id)}
                                      className="font-semibold text-[#202633] hover:text-[#6558D3] text-left block"
                                    >
                                      {proj.name}
                                    </button>
                                    <span className="text-[#697386]">
                                      {proj.client_name} · Due{' '}
                                      <span className="font-mono-tabular">
                                        {proj.deadline ?? 'TBD'}
                                      </span>
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 whitespace-nowrap">
                                    <RiskStatusBadge
                                      status={f.risk_status}
                                      size="sm"
                                    />
                                  </td>
                                  <td className="py-3.5 px-4 text-right font-mono-tabular whitespace-nowrap">
                                    <div className="font-semibold text-[#202633]">
                                      {formatCurrency(
                                        f.actual_total_cost,
                                        proj.currency
                                      )}
                                    </div>
                                    <div className="text-[#697386] text-[11px]">
                                      {f.budget_consumed_pct.toFixed(1)}% of{' '}
                                      {formatCurrency(
                                        proj.planned_cost_budget,
                                        proj.currency
                                      )}
                                    </div>
                                    <div className="w-24 ml-auto mt-1 h-1.5 bg-[#F0F2F6] rounded-full overflow-hidden">
                                      <div
                                        className={`h-full ${barColor}`}
                                        style={{
                                          width: `${Math.min(
                                            100,
                                            f.budget_consumed_pct
                                          )}%`,
                                        }}
                                      />
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-4 text-right font-mono-tabular whitespace-nowrap">
                                    {f.projected_final_cost !== null ? (
                                      <>
                                        <div className="font-semibold text-[#BE123C]">
                                          {formatCurrency(
                                            f.projected_final_cost,
                                            proj.currency
                                          )}
                                        </div>
                                        <div className="text-[#4E5666] text-[11px]">
                                          Margin:{' '}
                                          {formatPercentage(f.projected_margin_pct)}
                                        </div>
                                      </>
                                    ) : (
                                      <span className="font-sans italic text-[#697386]">
                                        Forecast Unavailable
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3.5 px-4 text-[#4E5666] max-w-xs">
                                    {f.risk_reasons[0]}
                                  </td>
                                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                    {proj.estimated_remaining_hours === null ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setUpdatingEstimateProject(proj)
                                        }
                                        className="px-3 py-1.5 text-xs font-semibold text-[#6558D3] bg-[#F3F1FF] border border-[#DAD4FC] rounded-lg hover:bg-[#E7E3FF] transition-colors"
                                      >
                                        Add Estimate
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => openProjectDetail(proj.id)}
                                        className="px-3 py-1.5 text-xs font-medium text-[#202633] bg-white border border-[#CBD0DC] rounded-lg hover:bg-[#F6F7F9] transition-colors"
                                      >
                                        Inspect →
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Financial Ledger Cards (< 768px for 320px/375px/430px viewports) */}
                      <div className="md:hidden divide-y divide-[#E3E6ED]">
                        {atRiskWatchlist.map((proj) => {
                          const f = proj.financials;
                          return (
                            <div key={proj.id} className="p-4 space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => openProjectDetail(proj.id)}
                                    className="text-sm font-bold text-[#202633] hover:text-[#6558D3] text-left block truncate"
                                  >
                                    {proj.name}
                                  </button>
                                  <span className="text-xs text-[#697386]">
                                    {proj.client_name} · Due{' '}
                                    {proj.deadline ?? 'TBD'}
                                  </span>
                                </div>
                                <RiskStatusBadge
                                  status={f.risk_status}
                                  size="sm"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-[#F6F7F9] border border-[#E3E6ED] text-xs font-mono-tabular">
                                <div>
                                  <span className="font-sans text-[11px] text-[#697386] block">
                                    Actual ({f.budget_consumed_pct.toFixed(1)}%)
                                  </span>
                                  <strong className="text-[#202633]">
                                    {formatCurrency(
                                      f.actual_total_cost,
                                      proj.currency
                                    )}
                                  </strong>
                                </div>
                                <div>
                                  <span className="font-sans text-[11px] text-[#697386] block">
                                    Projected Final
                                  </span>
                                  <strong className="text-[#BE123C]">
                                    {formatCurrency(
                                      f.projected_final_cost,
                                      proj.currency,
                                      'Unavailable'
                                    )}
                                  </strong>
                                </div>
                              </div>

                              <p className="text-xs text-[#4E5666]">
                                {f.risk_reasons[0]}
                              </p>

                              <div className="flex items-center gap-2">
                                {proj.estimated_remaining_hours === null && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setUpdatingEstimateProject(proj)
                                    }
                                    className="flex-1 py-2 text-xs font-semibold text-[#6558D3] bg-[#F3F1FF] border border-[#DAD4FC] rounded-lg"
                                  >
                                    Add Estimate
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openProjectDetail(proj.id)}
                                  className="flex-1 py-2 text-xs font-medium text-[#202633] bg-white border border-[#CBD0DC] rounded-lg"
                                >
                                  Inspect Project →
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right 4 Cols: Expenses Awaiting Approval Queue */}
                    <div className="lg:col-span-4 bg-white border border-[#E3E6ED] rounded-2xl overflow-hidden shadow-2xs">
                      <div className="p-4 sm:p-5 border-b border-[#E3E6ED] flex items-center justify-between">
                        <div>
                          <h2 className="text-base font-semibold text-[#202633]">
                            Expenses Awaiting Approval
                          </h2>
                          <p className="text-xs text-[#4E5666] mt-0.5">
                            Approving immediately adds to Actual Cost.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRoute('EXPENSES')}
                          className="text-xs font-semibold text-[#6558D3] hover:underline"
                        >
                          All →
                        </button>
                      </div>

                      <div className="divide-y divide-[#E3E6ED]">
                        {expenses.filter((e) => e.status === 'PENDING').length ===
                        0 ? (
                          <div className="p-6 text-center text-xs text-[#4E5666]">
                            All submitted expenses have been reviewed.
                          </div>
                        ) : (
                          expenses
                            .filter((e) => e.status === 'PENDING')
                            .map((exp) => {
                              const proj = enrichedProjects.find(
                                (p) => p.id === exp.project_id
                              );
                              return (
                                <div key={exp.id} className="p-4 space-y-2.5">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold text-[#202633] truncate">
                                        {proj?.name ?? 'Project'}
                                      </div>
                                      <div className="text-[11px] text-[#697386]">
                                        {exp.submitted_by_name} ·{' '}
                                        <span className="font-mono">
                                          {exp.category}
                                        </span>{' '}
                                        ·{' '}
                                        <span className="font-mono-tabular">
                                          {exp.expense_date}
                                        </span>
                                      </div>
                                    </div>
                                    <span className="font-mono-tabular text-xs font-bold text-[#202633] shrink-0">
                                      {formatCurrency(exp.amount, 'USD')}
                                    </span>
                                  </div>
                                  <p className="text-xs text-[#4E5666]">
                                    {exp.description}
                                  </p>
                                  <div className="flex items-center gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => handleApproveExpense(exp.id)}
                                      className="flex-1 py-1.5 text-xs font-semibold text-white bg-[#059669] rounded-lg hover:bg-[#047857] transition-colors"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setRejectingExpense(exp)}
                                      className="flex-1 py-1.5 text-xs font-semibold text-[#BE123C] bg-white border border-[#FECDD3] rounded-lg hover:bg-[#FFF1F2] transition-colors"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Secondary Decision Split: Budget vs. Forecast Chart (7 cols) + AI Risk Advisor Assistant Panel (5 cols) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <div className="lg:col-span-7 min-w-0">
                      <BudgetForecastChart
                        projects={enrichedProjects.filter(
                          (p) => p.status === 'ACTIVE'
                        )}
                        currency="USD"
                        onSelectProject={(id) => openProjectDetail(id)}
                        onRequestEstimate={(proj) =>
                          setUpdatingEstimateProject(proj)
                        }
                      />
                    </div>

                    {/* Distinct, Supportive AI Risk Advisor Assistant Panel */}
                    {(() => {
                      const spotlightProject =
                        atRiskWatchlist[0] ?? enrichedProjects[0];
                      if (!spotlightProject) return null;
                      const aiAnalysis =
                        buildProjectAiRiskAnalysis(spotlightProject);
                      return (
                        <aside
                          aria-label="AI Risk Advisor Spotlight"
                          className="lg:col-span-5 bg-white border border-[#DAD4FC] rounded-2xl overflow-hidden shadow-2xs"
                        >
                          <div className="p-4 sm:p-5 bg-[#F3F1FF]/70 border-b border-[#DAD4FC] bg-dev-grid flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-[#6558D3]">
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>AI RISK ADVISOR · SPOTLIGHT</span>
                              </div>
                              <h2 className="text-base font-semibold text-[#202633]">
                                {spotlightProject.name}
                              </h2>
                            </div>
                            <RiskStatusBadge
                              status={spotlightProject.financials.risk_status}
                              size="sm"
                            />
                          </div>

                          <div className="p-4 sm:p-5 space-y-4 text-xs">
                            <p className="text-[#202633] leading-relaxed">
                              {aiAnalysis.ai_summary}
                            </p>

                            <div className="space-y-2">
                              <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#4E5666]">
                                Suggested Interventions
                              </div>
                              {aiAnalysis.suggested_actions
                                .slice(0, 2)
                                .map((act) => (
                                  <div
                                    key={act.id}
                                    className="p-3 rounded-xl bg-[#F6F7F9] border border-[#E3E6ED] space-y-1"
                                  >
                                    <div className="font-semibold text-[#202633]">
                                      {act.title}
                                    </div>
                                    <p className="text-[#4E5666] leading-relaxed">
                                      {act.rationale}
                                    </p>
                                    <div className="text-[11px] font-mono text-[#047857] font-medium pt-0.5">
                                      Impact: {act.estimated_impact}
                                    </div>
                                  </div>
                                ))}
                            </div>

                            <div className="pt-2 border-t border-[#E3E6ED] flex items-center justify-between gap-2">
                              <span className="text-[11px] text-[#697386]">
                                Grounded in authoritative backend figures
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  openProjectDetail(
                                    spotlightProject.id,
                                    'OVERVIEW'
                                  )
                                }
                                className="px-3 py-1.5 text-xs font-semibold text-white bg-[#6558D3] rounded-lg hover:bg-[#5346BF] transition-colors whitespace-nowrap"
                              >
                                Full Advisor Analysis →
                              </button>
                            </div>
                          </div>
                        </aside>
                      );
                    })()}
                  </div>
                </>
              ) : (
                /* Team Member Personal Delivery Dashboard */
                <div className="space-y-6">
                  {/* Personal Operational KPI Strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white border border-slate-200 rounded-lg p-4">
                      <span className="text-xs font-medium text-slate-600">
                        Assigned Active Projects
                      </span>
                      <div className="text-2xl font-bold font-mono-tabular text-slate-900 mt-1">
                        {
                          visibleProjects.filter((p) => p.status === 'ACTIVE')
                            .length
                        }
                      </div>
                      <span className="text-xs text-slate-500">
                        Authorized for time & expense logging
                      </span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-lg p-4">
                      <span className="text-xs font-medium text-slate-600">
                        Your Total Logged Hours
                      </span>
                      <div className="text-2xl font-bold font-mono-tabular text-slate-900 mt-1">
                        {formatHours(
                          visibleTimeEntries.reduce((sum, t) => sum + t.hours, 0)
                        )}
                      </div>
                      <span className="text-xs text-slate-500">
                        Across {visibleTimeEntries.length} recorded entries
                      </span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-lg p-4">
                      <span className="text-xs font-medium text-slate-600">
                        Your Pending Expense Submissions
                      </span>
                      <div className="text-2xl font-bold font-mono-tabular text-amber-800 mt-1">
                        {
                          visibleExpenses.filter((e) => e.status === 'PENDING')
                            .length
                        }{' '}
                        (
                        {formatCurrency(
                          visibleExpenses
                            .filter((e) => e.status === 'PENDING')
                            .reduce((s, e) => s + e.amount, 0),
                          'USD'
                        )}
                        )
                      </div>
                      <span className="text-xs text-slate-500">
                        Awaiting Agency Manager review
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
                      <div className="p-5 border-b border-slate-200">
                        <h2 className="text-base font-semibold text-slate-900">
                          Your Assigned Projects
                        </h2>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Select a project to record delivery hours or submit
                          expenses.
                        </p>
                      </div>
                      <div className="divide-y divide-slate-200">
                        {visibleProjects.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-600">
                            You have not been assigned to any projects yet.
                          </div>
                        ) : (
                          visibleProjects.map((proj) => {
                            const myHours = visibleTimeEntries
                              .filter((t) => t.project_id === proj.id)
                              .reduce((s, t) => s + t.hours, 0);
                            return (
                              <div
                                key={proj.id}
                                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50"
                              >
                                <div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openProjectDetail(proj.id, 'TIME_ENTRIES')
                                    }
                                    className="text-sm font-semibold text-slate-900 hover:text-blue-700 text-left"
                                  >
                                    {proj.name}
                                  </button>
                                  <div className="text-xs text-slate-500 mt-0.5">
                                    {proj.client_name} · Due{' '}
                                    {proj.deadline ?? 'TBD'} · Your Logged Hours:{' '}
                                    <span className="font-mono-tabular font-medium text-slate-800">
                                      {formatHours(myHours)}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setLogTimeModalProject(proj.id);
                                      setIsLogTimeModalOpen(true);
                                    }}
                                    className="px-3 py-1.5 text-xs font-medium text-white bg-blue-700 rounded hover:bg-blue-800"
                                  >
                                    + Log Hours
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openProjectDetail(proj.id, 'TIME_ENTRIES')
                                    }
                                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
                                  >
                                    View
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg overflow-hidden">
                      <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                        <div>
                          <h2 className="text-base font-semibold text-slate-900">
                            Your Submitted Expenses
                          </h2>
                          <p className="text-xs text-slate-600 mt-0.5">
                            Track Pending, Approved, and Rejected reimbursements.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRoute('EXPENSES')}
                          className="text-xs font-medium text-blue-700 hover:underline"
                        >
                          All →
                        </button>
                      </div>
                      <div className="divide-y divide-slate-200">
                        {visibleExpenses.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-600">
                            You have not submitted any expenses yet.
                          </div>
                        ) : (
                          visibleExpenses.slice(0, 5).map((exp) => {
                            const proj = enrichedProjects.find(
                              (p) => p.id === exp.project_id
                            );
                            return (
                              <div key={exp.id} className="p-4 space-y-1.5 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-slate-900">
                                    {proj?.name ?? 'Project'}
                                  </span>
                                  <ExpenseStatusBadge status={exp.status} />
                                </div>
                                <div className="flex items-center justify-between text-slate-500">
                                  <span>
                                    {exp.category} · {exp.expense_date}
                                  </span>
                                  <span className="font-mono-tabular font-bold text-slate-900">
                                    {formatCurrency(exp.amount, 'USD')}
                                  </span>
                                </div>
                                <p className="text-slate-700">{exp.description}</p>
                                {exp.status === 'REJECTED' &&
                                  exp.rejection_reason && (
                                    <div className="p-2 rounded bg-red-50 border border-red-200 text-[11px] text-red-800">
                                      <strong>Manager Feedback:</strong>{' '}
                                      {exp.rejection_reason}
                                    </div>
                                  )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== 2. PROJECTS LIST ROUTE (/projects) ==================== */}
          {route === 'PROJECTS' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">
                    {isManager
                      ? 'Project Portfolio Directory'
                      : 'My Assigned Projects'}
                  </h1>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {isManager
                      ? 'Filter by lifecycle status or financial risk classification.'
                      : 'Projects you are authorized to access and log delivery hours against.'}
                  </p>
                </div>
                {isManager && (
                  <button
                    type="button"
                    onClick={() =>
                      setProjectModalState({ open: true, editingProject: null })
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Project</span>
                  </button>
                )}
              </div>

              {/* Filter & Search Toolbar */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    placeholder="Search by project or client name..."
                    aria-label="Search projects"
                    className="w-full h-9 pl-9 pr-3 text-xs rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md border border-slate-200">
                    {(['ALL', 'ACTIVE', 'COMPLETED', 'ON_HOLD'] as const).map(
                      (st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setProjectStatusFilter(st)}
                          className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                            projectStatusFilter === st
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {st === 'ALL' ? 'All Statuses' : st}
                        </button>
                      )
                    )}
                  </div>

                  {isManager && (
                    <select
                      aria-label="Filter by risk status"
                      value={projectRiskFilter}
                      onChange={(e) =>
                        setProjectRiskFilter(
                          e.target.value as 'ALL' | ProjectRiskStatus
                        )
                      }
                      className="h-9 px-3 text-xs rounded-md border border-slate-300 bg-white text-slate-800"
                    >
                      <option value="ALL">All Risk Levels</option>
                      <option value="CRITICAL">Critical Only</option>
                      <option value="WARNING">Warning Only</option>
                      <option value="INCOMPLETE_DATA">
                        Missing Estimate (Null)
                      </option>
                      <option value="HEALTHY">Healthy Only</option>
                    </select>
                  )}
                </div>
              </div>

              {filteredProjects.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-lg p-10 text-center space-y-3">
                  <div className="text-sm font-semibold text-slate-900">
                    No projects match your current filters
                  </div>
                  <p className="text-xs text-slate-600">
                    Try clearing your search query or resetting status and risk
                    filters.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setProjectSearch('');
                      setProjectStatusFilter('ALL');
                      setProjectRiskFilter('ALL');
                    }}
                    className="px-3.5 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
                  >
                    Reset All Filters
                  </button>
                </div>
              ) : (
                <>
                  {/* Desktop Table Presentation (>= 768px) */}
                  <div className="hidden md:block bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                            <th className="py-3 px-4">Project & Client</th>
                            <th className="py-3 px-4">Lifecycle & Due</th>
                            {isManager && (
                              <>
                                <th className="py-3 px-4">Risk Status</th>
                                <th className="py-3 px-4 text-right">
                                  Planned Budget
                                </th>
                                <th className="py-3 px-4 text-right">
                                  Actual Cost (% Used)
                                </th>
                                <th className="py-3 px-4 text-right">
                                  Projected Final Cost
                                </th>
                                <th className="py-3 px-4 text-right">
                                  Projected Margin
                                </th>
                              </>
                            )}
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-xs">
                          {filteredProjects.map((proj) => {
                            const f = proj.financials;
                            return (
                              <tr key={proj.id} className="hover:bg-slate-50">
                                <td className="py-3.5 px-4">
                                  <button
                                    type="button"
                                    onClick={() => openProjectDetail(proj.id)}
                                    className="font-semibold text-slate-900 hover:text-blue-700 text-left block"
                                  >
                                    {proj.name}
                                  </button>
                                  <span className="text-slate-500">
                                    {proj.client_name} · {proj.currency}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <LifecycleText status={proj.status} />
                                  <div className="text-slate-500 font-mono-tabular">
                                    {proj.deadline ?? 'No deadline'}
                                  </div>
                                </td>
                                {isManager && (
                                  <>
                                    <td className="py-3.5 px-4 whitespace-nowrap">
                                      <RiskStatusBadge
                                        status={f.risk_status}
                                        size="sm"
                                      />
                                    </td>
                                    <td className="py-3.5 px-4 text-right font-mono-tabular whitespace-nowrap">
                                      {formatCurrency(
                                        proj.planned_cost_budget,
                                        proj.currency
                                      )}
                                    </td>
                                    <td className="py-3.5 px-4 text-right font-mono-tabular whitespace-nowrap">
                                      <div className="font-semibold text-slate-900">
                                        {formatCurrency(
                                          f.actual_total_cost,
                                          proj.currency
                                        )}
                                      </div>
                                      <div className="text-slate-500">
                                        {f.budget_consumed_pct.toFixed(1)}%
                                      </div>
                                    </td>
                                    <td className="py-3.5 px-4 text-right font-mono-tabular whitespace-nowrap">
                                      {f.projected_final_cost !== null ? (
                                        <span
                                          className={
                                            (f.projected_cost_variance ?? 0) > 0
                                              ? 'text-[#B91C1C] font-semibold'
                                              : 'text-slate-900 font-semibold'
                                          }
                                        >
                                          {formatCurrency(
                                            f.projected_final_cost,
                                            proj.currency
                                          )}
                                        </span>
                                      ) : (
                                        <span className="font-sans italic text-slate-500">
                                          Forecast Unavailable
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3.5 px-4 text-right font-mono-tabular whitespace-nowrap">
                                      {f.projected_margin_pct !== null ? (
                                        <span className="font-semibold text-slate-900">
                                          {formatPercentage(f.projected_margin_pct)}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400">—</span>
                                      )}
                                    </td>
                                  </>
                                )}
                                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => openProjectDetail(proj.id)}
                                    className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"
                                  >
                                    Open Workspace
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mobile Presentation: Financial Ledger Cards (< 768px) */}
                  <div className="md:hidden space-y-3">
                    {filteredProjects.map((proj) => {
                      const f = proj.financials;
                      return (
                        <div
                          key={proj.id}
                          className="bg-white border border-slate-200 rounded-lg p-4 space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <button
                                type="button"
                                onClick={() => openProjectDetail(proj.id)}
                                className="text-sm font-bold text-slate-900 text-left"
                              >
                                {proj.name}
                              </button>
                              <div className="text-xs text-slate-500">
                                {proj.client_name} · Due {proj.deadline ?? 'TBD'}
                              </div>
                            </div>
                            {isManager && (
                              <RiskStatusBadge
                                status={f.risk_status}
                                size="sm"
                              />
                            )}
                          </div>

                          {isManager && (
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs font-mono-tabular">
                              <div>
                                <span className="font-sans text-slate-500 block">
                                  Planned Budget
                                </span>
                                <span className="font-semibold text-slate-900">
                                  {formatCurrency(
                                    proj.planned_cost_budget,
                                    proj.currency
                                  )}
                                </span>
                              </div>
                              <div>
                                <span className="font-sans text-slate-500 block">
                                  Actual ({f.budget_consumed_pct.toFixed(1)}%)
                                </span>
                                <span className="font-semibold text-slate-900">
                                  {formatCurrency(
                                    f.actual_total_cost,
                                    proj.currency
                                  )}
                                </span>
                              </div>
                              <div>
                                <span className="font-sans text-slate-500 block">
                                  Projected Final
                                </span>
                                <span className="font-semibold text-slate-900">
                                  {formatCurrency(
                                    f.projected_final_cost,
                                    proj.currency,
                                    'Unavailable'
                                  )}
                                </span>
                              </div>
                              <div>
                                <span className="font-sans text-slate-500 block">
                                  Projected Margin
                                </span>
                                <span className="font-semibold text-slate-900">
                                  {formatPercentage(
                                    f.projected_margin_pct,
                                    'Unavailable'
                                  )}
                                </span>
                              </div>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => openProjectDetail(proj.id)}
                            className="w-full py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md"
                          >
                            View Project Workspace →
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ==================== 3. PROJECT DETAIL ROUTE (/projects/[id]) ==================== */}
          {route === 'PROJECT_DETAIL' && selectedProject && (
            <ProjectDetailView
              project={selectedProject}
              currentUser={currentUser}
              timeEntries={timeEntries}
              expenses={expenses}
              initialTab={projectDetailTab}
              onBack={() => setRoute('PROJECTS')}
              onEditProject={(proj) =>
                setProjectModalState({ open: true, editingProject: proj })
              }
              onOpenUpdateEstimate={(proj) =>
                setUpdatingEstimateProject(proj)
              }
              onOpenLogTime={(projectId) => {
                setLogTimeModalProject(projectId);
                setIsLogTimeModalOpen(true);
              }}
              onDeleteTimeEntry={handleDeleteTimeEntry}
              onOpenSubmitExpense={(projectId) => {
                setSubmitExpenseModalProject(projectId);
                setIsSubmitExpenseModalOpen(true);
              }}
              onDeletePendingExpense={handleDeletePendingExpense}
              onApproveExpense={handleApproveExpense}
              onRequestRejectExpense={(exp) => setRejectingExpense(exp)}
            />
          )}

          {/* ==================== 4. TIME ENTRIES ROUTE (/time-entries) ==================== */}
          {route === 'TIME_ENTRIES' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">
                    {isManager
                      ? 'Agency Time-Entry Ledger'
                      : 'My Recorded Work Hours'}
                  </h1>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {isManager
                      ? 'Complete log of recorded delivery hours and historical cost rate snapshots across all projects.'
                      : 'Your personal log of delivery hours recorded against assigned projects.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLogTimeModalProject(undefined);
                    setIsLogTimeModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Record Work Hours</span>
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                        <th className="py-3 px-4">Work Date</th>
                        <th className="py-3 px-4">Project</th>
                        <th className="py-3 px-4">Team Member</th>
                        <th className="py-3 px-4">Work Description</th>
                        <th className="py-3 px-4 text-right">Hours</th>
                        {isManager && (
                          <>
                            <th className="py-3 px-4 text-right">
                              Rate Snapshot
                            </th>
                            <th className="py-3 px-4 text-right">
                              Computed Labor Cost
                            </th>
                          </>
                        )}
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {visibleTimeEntries.map((entry) => {
                        const proj = enrichedProjects.find(
                          (p) => p.id === entry.project_id
                        );
                        const canDelete =
                          isManager || entry.user_id === currentUser.id;
                        return (
                          <tr key={entry.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-mono-tabular whitespace-nowrap">
                              {entry.work_date}
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-900">
                              <button
                                type="button"
                                onClick={() =>
                                  openProjectDetail(
                                    entry.project_id,
                                    'TIME_ENTRIES'
                                  )
                                }
                                className="hover:text-blue-700 text-left"
                              >
                                {proj?.name ?? entry.project_id}
                              </button>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {entry.user_name}
                            </td>
                            <td className="py-3 px-4 text-slate-700 max-w-md">
                              {entry.description}
                            </td>
                            <td className="py-3 px-4 text-right font-mono-tabular font-semibold whitespace-nowrap">
                              {entry.hours.toFixed(2)} hrs
                            </td>
                            {isManager && (
                              <>
                                <td className="py-3 px-4 text-right font-mono-tabular text-slate-600 whitespace-nowrap">
                                  {formatCurrency(
                                    entry.hourly_cost_snapshot,
                                    'USD'
                                  )}
                                  /hr
                                </td>
                                <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-slate-900 whitespace-nowrap">
                                  {formatCurrency(
                                    entry.hours * entry.hourly_cost_snapshot,
                                    'USD'
                                  )}
                                </td>
                              </>
                            )}
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTimeEntry(entry.id)}
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
              </div>
            </div>
          )}

          {/* ==================== 5. CLIENTS DIRECTORY (/clients) ==================== */}
          {route === 'CLIENTS' && (
            <div className="space-y-6">
              {!isManager ? (
                <div
                  role="alert"
                  className="bg-white border border-amber-200 rounded-lg p-8 text-center space-y-3"
                >
                  <Lock className="w-6 h-6 text-amber-700 mx-auto" />
                  <h2 className="text-base font-bold text-slate-900">
                    403 Access Restricted — Manager Role Required
                  </h2>
                  <p className="text-xs text-slate-600 max-w-md mx-auto">
                    Client commercial agreements and organization settings are
                    restricted to Agency Managers.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h1 className="text-2xl font-bold text-slate-900">
                        Client Organizations
                      </h1>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Manage client accounts, default billing currencies, and
                        archive eligibility.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setClientModalState({
                          open: true,
                          editingClient: null,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 self-start sm:self-auto"
                    >
                      <Plus className="w-4 h-4" />
                      <span>New Client</span>
                    </button>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="search"
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        placeholder="Search clients by name or contact..."
                        className="w-full h-9 pl-9 pr-3 text-xs rounded-md border border-slate-300"
                      />
                    </div>
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md border border-slate-200">
                      {(['ALL', 'ACTIVE', 'ARCHIVED'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setClientStatusFilter(st)}
                          className={`px-3 py-1 text-xs font-medium rounded ${
                            clientStatusFilter === st
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-600'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                          <th className="py-3 px-4">Client Organization</th>
                          <th className="py-3 px-4">Primary Contact</th>
                          <th className="py-3 px-4">Currency</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">
                            Active / Total Projects
                          </th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs">
                        {clients
                          .filter((c) => {
                            const matchesQ =
                              clientSearch.trim() === '' ||
                              c.name
                                .toLowerCase()
                                .includes(clientSearch.toLowerCase()) ||
                              c.contact_name
                                .toLowerCase()
                                .includes(clientSearch.toLowerCase());
                            const matchesSt =
                              clientStatusFilter === 'ALL' ||
                              c.status === clientStatusFilter;
                            return matchesQ && matchesSt;
                          })
                          .map((client) => {
                            const clientProjects = enrichedProjects.filter(
                              (p) => p.client_id === client.id
                            );
                            const activeCount = clientProjects.filter(
                              (p) => p.status === 'ACTIVE'
                            ).length;
                            return (
                              <tr key={client.id} className="hover:bg-slate-50">
                                <td className="py-3.5 px-4">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedClientId(client.id);
                                      setRoute('CLIENT_DETAIL');
                                    }}
                                    className="font-semibold text-slate-900 hover:text-blue-700 text-left block"
                                  >
                                    {client.name}
                                  </button>
                                  <span className="text-slate-500">
                                    {client.notes}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <div className="font-medium text-slate-900">
                                    {client.contact_name || '—'}
                                  </div>
                                  <div className="text-slate-500">
                                    {client.contact_email}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 font-mono-tabular">
                                  {client.default_currency}
                                </td>
                                <td className="py-3.5 px-4">
                                  <LifecycleText status={client.status} />
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono-tabular">
                                  <strong>{activeCount}</strong> active /{' '}
                                  {clientProjects.length} total
                                </td>
                                <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedClientId(client.id);
                                      setRoute('CLIENT_DETAIL');
                                    }}
                                    className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
                                  >
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleArchiveClient(client)}
                                    className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
                                  >
                                    {client.status === 'ARCHIVED'
                                      ? 'Restore'
                                      : 'Archive'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ==================== 6. CLIENT DETAIL (/clients/[id]) ==================== */}
          {route === 'CLIENT_DETAIL' && selectedClient && isManager && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <button
                      type="button"
                      onClick={() => setRoute('CLIENTS')}
                      className="text-xs font-medium text-blue-700 hover:underline mb-1 inline-block"
                    >
                      ← Back to Clients
                    </button>
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl font-bold text-slate-900">
                        {selectedClient.name}
                      </h1>
                      <LifecycleText status={selectedClient.status} />
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Contact: {selectedClient.contact_name} (
                      {selectedClient.contact_email}) · Default Currency:{' '}
                      <span className="font-mono">
                        {selectedClient.default_currency}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setClientModalState({
                          open: true,
                          editingClient: selectedClient,
                        })
                      }
                      className="px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                    >
                      Edit Client
                    </button>
                    <button
                      type="button"
                      onClick={() => handleArchiveClient(selectedClient)}
                      className="px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                    >
                      {selectedClient.status === 'ARCHIVED'
                        ? 'Restore Client'
                        : 'Archive Client'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900">
                    Related Client Projects
                  </h2>
                  <button
                    type="button"
                    onClick={() =>
                      setProjectModalState({
                        open: true,
                        editingProject: null,
                      })
                    }
                    className="px-3 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800"
                  >
                    + New Project for {selectedClient.name}
                  </button>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                      <th className="py-2.5 px-4">Project</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Risk Status</th>
                      <th className="py-2.5 px-4 text-right">Planned Budget</th>
                      <th className="py-2.5 px-4 text-right">Actual Cost</th>
                      <th className="py-2.5 px-4 text-right">
                        Projected Final
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {enrichedProjects
                      .filter((p) => p.client_id === selectedClient.id)
                      .map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => openProjectDetail(p.id)}
                              className="font-semibold text-slate-900 hover:text-blue-700"
                            >
                              {p.name}
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            <LifecycleText status={p.status} />
                          </td>
                          <td className="py-3 px-4">
                            <RiskStatusBadge
                              status={p.financials.risk_status}
                              size="sm"
                            />
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular">
                            {formatCurrency(p.planned_cost_budget, p.currency)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular">
                            {formatCurrency(
                              p.financials.actual_total_cost,
                              p.currency
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular font-semibold">
                            {formatCurrency(
                              p.financials.projected_final_cost,
                              p.currency
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==================== 7. GLOBAL EXPENSES ROUTE (/expenses) ==================== */}
          {route === 'EXPENSES' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">
                    {isManager
                      ? 'Cross-Project Expense Approval Queue'
                      : 'My Submitted Project Expenses'}
                  </h1>
                  <p className="text-xs text-slate-600 mt-0.5">
                    <strong>Accounting Rule:</strong> Only{' '}
                    <strong>Approved</strong> expenses count toward Actual
                    Project Cost. Pending and Rejected expenses have $0.00
                    budget impact.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitExpenseModalProject(undefined);
                    setIsSubmitExpenseModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Submit Expense</span>
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md border border-slate-200">
                  {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setExpenseStatusFilter(st)}
                        className={`px-3 py-1 text-xs font-medium rounded ${
                          expenseStatusFilter === st
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600'
                        }`}
                      >
                        {st === 'ALL' ? 'All Expenses' : st}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Project</th>
                        <th className="py-3 px-4">Submitted By</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">
                          Description & Rejection Feedback
                        </th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Amount</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {visibleExpenses
                        .filter((e) =>
                          expenseStatusFilter === 'ALL'
                            ? true
                            : e.status === expenseStatusFilter
                        )
                        .map((exp) => {
                          const proj = enrichedProjects.find(
                            (p) => p.id === exp.project_id
                          );
                          return (
                            <tr key={exp.id} className="hover:bg-slate-50">
                              <td className="py-3 px-4 font-mono-tabular whitespace-nowrap">
                                {exp.expense_date}
                              </td>
                              <td className="py-3 px-4 font-medium text-slate-900">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openProjectDetail(
                                      exp.project_id,
                                      'EXPENSES'
                                    )
                                  }
                                  className="hover:text-blue-700 text-left"
                                >
                                  {proj?.name ?? exp.project_id}
                                </button>
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                {exp.submitted_by_name}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                                {exp.category}
                              </td>
                              <td className="py-3 px-4 text-slate-700 max-w-md">
                                <div>{exp.description}</div>
                                {exp.status === 'REJECTED' &&
                                  exp.rejection_reason && (
                                    <div className="mt-1 p-2 rounded bg-red-50 border border-red-200 text-[11px] text-red-800">
                                      <strong>Rejection Reason:</strong>{' '}
                                      {exp.rejection_reason}
                                    </div>
                                  )}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <ExpenseStatusBadge status={exp.status} />
                              </td>
                              <td className="py-3 px-4 text-right font-mono-tabular font-semibold whitespace-nowrap">
                                {formatCurrency(exp.amount, 'USD')}
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                {isManager ? (
                                  exp.status === 'PENDING' ? (
                                    <div className="inline-flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleApproveExpense(exp.id)
                                        }
                                        className="px-2.5 py-1 text-xs font-medium text-white bg-emerald-700 rounded hover:bg-emerald-800"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setRejectingExpense(exp)
                                        }
                                        className="px-2.5 py-1 text-xs font-medium text-red-700 bg-white border border-red-300 rounded hover:bg-red-50"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400">
                                      Reviewed
                                    </span>
                                  )
                                ) : exp.status === 'PENDING' &&
                                  exp.submitted_by_id === currentUser.id ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeletePendingExpense(exp.id)
                                    }
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
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==================== 8. USER PROFILE, SECURITY & TEAM GOVERNANCE (/settings) ==================== */}
          {route === 'SETTINGS' && session && (
            <UserProfileView
              key={`${session.user.id}-${profileTab}`}
              session={session}
              registeredUsers={registeredUsers}
              assignedProjects={visibleProjects}
              timeEntries={timeEntries}
              expenses={expenses}
              initialTab={profileTab}
              onProfileUpdated={(updatedSession, updatedUsers, message) => {
                setSession(updatedSession);
                setRegisteredUsers(updatedUsers);
                triggerToast(message);
              }}
              onUsersDirectoryUpdated={(
                updatedUsers,
                updatedProjects,
                message
              ) => {
                setRegisteredUsers(updatedUsers);
                if (updatedProjects) setProjects(updatedProjects);
                if (message) triggerToast(message);
              }}
              onOpenProject={(projectId) => openProjectDetail(projectId)}
              onRequestSignOut={() => setSignOutConfirmOpen(true)}
              onResetDemoData={() => {
                const defaults = resetWorkspaceToDefaults();
                setRegisteredUsers(defaults.users);
                setClients(defaults.clients);
                setProjects(defaults.projects);
                setTimeEntries(defaults.timeEntries);
                setExpenses(defaults.expenses);
                triggerToast('Reset agency dataset to default seed state.');
              }}
            />
          )}
          </div>
        </main>
      </div>

      {/* Sign Out Confirmation Dialog */}
      {signOutConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="signout-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50"
        >
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h2
                id="signout-dialog-title"
                className="text-base font-bold text-slate-900"
              >
                End Authenticated Session?
              </h2>
              <button
                type="button"
                onClick={() => setSignOutConfirmOpen(false)}
                aria-label="Close sign out dialog"
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs text-slate-600">
              <p>
                You are currently signed in as{' '}
                <strong className="text-slate-900">
                  {currentUser.full_name}
                </strong>{' '}
                (<span className="font-mono">{currentUser.role}</span>).
              </p>
              <p>
                Logging out will revoke your active session token. All projects,
                time entries, expenses, and profile updates remain safely
                persisted for your next sign-in.
              </p>
            </div>
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSignOutConfirmOpen(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100"
              >
                Stay Signed In
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-700 rounded-md hover:bg-red-800"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Confirm Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== WORKFLOW MODALS ==================== */}
      {projectModalState.open && isManager && (
        <ProjectFormModal
          initialProject={projectModalState.editingProject}
          clients={clients}
          teamUsers={registeredUsers}
          onClose={() =>
            setProjectModalState({ open: false, editingProject: null })
          }
          onSave={handleSaveProject}
        />
      )}

      {isLogTimeModalOpen && (
        <LogTimeModal
          projects={visibleProjects}
          defaultProjectId={logTimeModalProject}
          currentUser={currentUser}
          onClose={() => setIsLogTimeModalOpen(false)}
          onSubmit={handleCreateTimeEntry}
        />
      )}

      {isSubmitExpenseModalOpen && (
        <SubmitExpenseModal
          projects={visibleProjects}
          defaultProjectId={submitExpenseModalProject}
          currentUser={currentUser}
          onClose={() => setIsSubmitExpenseModalOpen(false)}
          onSubmit={handleSubmitExpense}
        />
      )}

      {rejectingExpense && isManager && (
        <RejectExpenseModal
          expense={rejectingExpense}
          projectName={
            enrichedProjects.find((p) => p.id === rejectingExpense.project_id)
              ?.name ?? 'Project'
          }
          onClose={() => setRejectingExpense(null)}
          onConfirmReject={handleConfirmRejectExpense}
        />
      )}

      {updatingEstimateProject && isManager && (
        <UpdateEstimateModal
          project={updatingEstimateProject}
          onClose={() => setUpdatingEstimateProject(null)}
          onSaveEstimate={handleSaveEstimate}
        />
      )}

      {clientModalState.open && isManager && (
        <ClientFormModal
          initialClient={clientModalState.editingClient}
          onClose={() =>
            setClientModalState({ open: false, editingClient: null })
          }
          onSave={handleSaveClient}
        />
      )}
    </div>
  );
}
