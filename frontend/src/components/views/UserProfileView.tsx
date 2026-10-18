import React, { useState } from 'react';
import {
  Bell,
  Briefcase,
  CheckCircle2,
  Clock,
  Edit3,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Plus,
  Receipt,
  RotateCcw,
  Save,
  ShieldCheck,
  User as UserIcon,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  AuthSession,
  EnrichedProject,
  Expense,
  Project,
  StoredUserAccount,
  TimeEntry,
  User,
  UserNotificationPreferences,
  UserRole,
} from '../../types/domain';
import { formatCurrency, formatHours } from '../../lib/financial-engine';
import {
  registerNewUser,
  updateUserPassword,
  updateUserProfile,
  updateUserProfileWithApi,
} from '../../services/auth-and-store';

export type ProfileTab =
  | 'OVERVIEW_AND_EDIT'
  | 'SECURITY_AND_SESSION'
  | 'NOTIFICATIONS'
  | 'TEAM_DIRECTORY';

export const UserProfileView: React.FC<{
  session: AuthSession;
  registeredUsers: StoredUserAccount[];
  assignedProjects: EnrichedProject[];
  timeEntries: TimeEntry[];
  expenses: Expense[];
  initialTab?: ProfileTab;
  onProfileUpdated: (
    updatedSession: AuthSession,
    updatedUsers: StoredUserAccount[],
    message: string
  ) => void;
  onUsersDirectoryUpdated: (
    updatedUsers: StoredUserAccount[],
    updatedProjects?: Project[],
    message?: string
  ) => void;
  onOpenProject: (projectId: string) => void;
  onRequestSignOut: () => void;
  onResetDemoData: () => void;
}> = ({
  session,
  registeredUsers,
  assignedProjects,
  timeEntries,
  expenses,
  initialTab = 'OVERVIEW_AND_EDIT',
  onProfileUpdated,
  onUsersDirectoryUpdated,
  onOpenProject,
  onRequestSignOut,
  onResetDemoData,
}) => {
  const currentUser = session.user;
  const isManager = currentUser.role === 'MANAGER';

  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);

  // Personal Profile Form State
  const [fullName, setFullName] = useState(currentUser.full_name);
  const [email, setEmail] = useState(currentUser.email);
  const [title, setTitle] = useState(currentUser.title);
  const [role, setRole] = useState<UserRole>(currentUser.role);
  const [hourlyCost, setHourlyCost] = useState(
    String(currentUser.default_hourly_cost)
  );
  const [department, setDepartment] = useState(
    currentUser.department ??
      (currentUser.role === 'MANAGER'
        ? 'Delivery & Commercial Operations'
        : 'Product Engineering')
  );
  const [timezone, setTimezone] = useState(
    currentUser.timezone ?? 'America/New_York (UTC-05:00)'
  );
  const [phone, setPhone] = useState(currentUser.phone ?? '+1 (555) 234-8910');
  const [bio, setBio] = useState(
    currentUser.bio ??
      (currentUser.role === 'MANAGER'
        ? 'Responsible for agency portfolio margin targets, project delivery budgets, client commercial governance, and expense approvals.'
        : 'Focused on full-stack product delivery, milestone execution, and accurate work-hour tracking across assigned client engagements.')
  );
  const [profileError, setProfileError] = useState<string | null>(null);

  // Notification Preferences State
  const [notifications, setNotifications] =
    useState<UserNotificationPreferences>(
      currentUser.notification_preferences ?? {
        budget_threshold_alerts: true,
        expense_status_updates: true,
        missing_estimate_reminders: true,
        weekly_margin_digest: isManager,
      }
    );

  // Password Change Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Team Directory Inline Edit & Add Member State (Manager-Only)
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editMemberTitle, setEditMemberTitle] = useState('');
  const [editMemberRole, setEditMemberRole] = useState<UserRole>('TEAM_MEMBER');
  const [editMemberRate, setEditMemberRate] = useState('115');

  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberTitle, setNewMemberTitle] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<UserRole>('TEAM_MEMBER');
  const [newMemberRate, setNewMemberRate] = useState('115');

  // Personal Activity Metrics
  const userTimeEntries = timeEntries.filter(
    (t) => t.user_id === currentUser.id
  );
  const totalHoursLogged = userTimeEntries.reduce((sum, t) => sum + t.hours, 0);
  const totalLaborCostGenerated = userTimeEntries.reduce(
    (sum, t) => sum + t.hours * t.hourly_cost_snapshot,
    0
  );

  const userExpenses = expenses.filter(
    (e) => e.submitted_by_id === currentUser.id
  );
  const approvedExpensesTotal = userExpenses
    .filter((e) => e.status === 'APPROVED')
    .reduce((sum, e) => sum + e.amount, 0);
  const pendingExpensesTotal = userExpenses
    .filter((e) => e.status === 'PENDING')
    .reduce((sum, e) => sum + e.amount, 0);

  const initials = currentUser.full_name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);

    const parsedCost = Number(hourlyCost);
    if (!fullName.trim()) {
      setProfileError('Full name cannot be empty.');
      return;
    }
    if (!email.trim()) {
      setProfileError('Work email cannot be empty.');
      return;
    }
    if (Number.isNaN(parsedCost) || parsedCost <= 0 || parsedCost > 2000) {
      setProfileError(
        'Internal hourly cost rate must be between $1.00 and $2,000.00/hr.'
      );
      return;
    }

    const res = await updateUserProfileWithApi(currentUser.id, {
      full_name: fullName,
      email,
      title,
      role,
      default_hourly_cost: parsedCost,
      department,
      timezone,
      phone,
      bio,
      notification_preferences: notifications,
    });

    if (res.ok === false) {
      setProfileError(res.error);
      return;
    }

    if (res.updatedSession) {
      onProfileUpdated(
        res.updatedSession,
        res.updatedUsers,
        `Profile updated for ${res.updatedUser.full_name} (${res.updatedUser.role}).`
      );
    }
  };

  const handleSaveNotifications = async () => {
    const res = await updateUserProfileWithApi(currentUser.id, {
      full_name: currentUser.full_name,
      email: currentUser.email,
      title: currentUser.title,
      role: currentUser.role,
      default_hourly_cost: currentUser.default_hourly_cost,
      department,
      timezone,
      phone,
      bio,
      notification_preferences: notifications,
    });
    if (res.ok && res.updatedSession) {
      onProfileUpdated(
        res.updatedSession,
        res.updatedUsers,
        'Saved watchdog alert and notification preferences.'
      );
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!newPassword.trim()) {
      setPasswordError('Please enter a new password.');
      return;
    }
    if (confirmNewPassword && newPassword !== confirmNewPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    const res = updateUserPassword(currentUser.id, newPassword);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    onUsersDirectoryUpdated(
      res.updatedUsers,
      undefined,
      'Account password updated and synced to your security credentials.'
    );
  };

  const startEditingMember = (member: StoredUserAccount) => {
    setEditingMemberId(member.id);
    setEditMemberTitle(member.title);
    setEditMemberRole(member.role);
    setEditMemberRate(String(member.default_hourly_cost));
  };

  const saveEditedMember = async (member: StoredUserAccount) => {
    const parsedRate = Number(editMemberRate) || member.default_hourly_cost;
    const res = await updateUserProfileWithApi(member.id, {
      full_name: member.full_name,
      email: member.email,
      title: editMemberTitle,
      role: editMemberRole,
      default_hourly_cost: parsedRate,
      department: member.department,
      timezone: member.timezone,
      phone: member.phone,
      bio: member.bio,
      notification_preferences: member.notification_preferences,
    });
    setEditingMemberId(null);

    if (res.ok) {
      if (res.updatedSession && member.id === currentUser.id) {
        onProfileUpdated(
          res.updatedSession,
          res.updatedUsers,
          `Updated your directory role and hourly rate to ${formatCurrency(
            parsedRate,
            'USD'
          )}/hr.`
        );
      } else {
        onUsersDirectoryUpdated(
          res.updatedUsers,
          undefined,
          `Updated ${member.full_name} (${editMemberRole} · ${formatCurrency(
            parsedRate,
            'USD'
          )}/hr).`
        );
      }
    }
  };

  const handleCreateMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberEmail.trim()) return;
    const parsedRate = Number(newMemberRate) || 115;

    // Preserve active manager session while adding a new user to directory
    const previousSession = session;
    const result = registerNewUser({
      full_name: newMemberName,
      email: newMemberEmail,
      password: 'AgencyPassword123!',
      role: newMemberRole,
      title:
        newMemberTitle.trim() ||
        (newMemberRole === 'MANAGER'
          ? 'Delivery Manager'
          : 'Software Engineer'),
      default_hourly_cost: parsedRate,
      assign_to_active_projects: true,
    });

    if (result.ok) {
      // Restore the manager's own session so adding a team member doesn't switch the active user
      window.localStorage.setItem(
        'marginwatch_session_v1',
        JSON.stringify(previousSession)
      );
      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberTitle('');
      setShowAddMemberForm(false);
      onUsersDirectoryUpdated(
        result.updatedUsers,
        result.updatedProjects,
        `Added ${newMemberName.trim()} (${newMemberRole}) to the agency directory.`
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Persistent Profile Identity Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-14 h-14 rounded-lg bg-slate-900 text-white font-display font-bold text-lg flex items-center justify-center shrink-0 border border-slate-800">
              {initials}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900">
                  {currentUser.full_name}
                </h1>
                <span
                  className={`px-2 py-0.5 text-xs font-mono font-semibold rounded border ${
                    isManager
                      ? 'bg-blue-50 border-blue-200 text-blue-800'
                      : 'bg-slate-100 border-slate-300 text-slate-800'
                  }`}
                >
                  {currentUser.role}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span>Active Session</span>
                </span>
              </div>
              <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>{currentUser.title}</span>
                <span>·</span>
                <span className="font-mono">{currentUser.email}</span>
                <span>·</span>
                <span>
                  Internal Cost Rate:{' '}
                  <strong className="font-mono-tabular text-slate-900">
                    {formatCurrency(currentUser.default_hourly_cost, 'USD')}/hr
                  </strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onResetDemoData}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Demo Dataset</span>
            </button>
            <button
              type="button"
              onClick={onRequestSignOut}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-700 rounded-md hover:bg-red-800 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        {/* Personal Footprint KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-200">
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500 block">
              Assigned Active Projects
            </span>
            <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-1">
              {assignedProjects.filter((p) => p.status === 'ACTIVE').length}
            </div>
            <span className="text-[11px] text-slate-500">
              {assignedProjects.length} total accessible workspaces
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500 block">
              Personal Hours Logged
            </span>
            <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-1">
              {formatHours(totalHoursLogged)}
            </div>
            <span className="text-[11px] text-slate-500 font-mono-tabular">
              {userTimeEntries.length} recorded time entries
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500 block">
              Labor Cost Footprint (Snapshot)
            </span>
            <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-1">
              {formatCurrency(totalLaborCostGenerated, 'USD')}
            </div>
            <span className="text-[11px] text-slate-500 font-mono-tabular">
              Current rate:{' '}
              {formatCurrency(currentUser.default_hourly_cost, 'USD')}/hr
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500 block">
              Submitted Expenses
            </span>
            <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-1">
              {formatCurrency(approvedExpensesTotal, 'USD')} approved
            </div>
            <span className="text-[11px] text-amber-800 font-mono-tabular">
              {formatCurrency(pendingExpensesTotal, 'USD')} awaiting approval
            </span>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Profile and Account Sections"
          className="flex items-center gap-1 mt-6 border-b border-slate-200 overflow-x-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'OVERVIEW_AND_EDIT'}
            onClick={() => setActiveTab('OVERVIEW_AND_EDIT')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${
              activeTab === 'OVERVIEW_AND_EDIT'
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Profile & Delivery Rate</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'SECURITY_AND_SESSION'}
            onClick={() => setActiveTab('SECURITY_AND_SESSION')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${
              activeTab === 'SECURITY_AND_SESSION'
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Security, Password & Sessions</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'NOTIFICATIONS'}
            onClick={() => setActiveTab('NOTIFICATIONS')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${
              activeTab === 'NOTIFICATIONS'
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Watchdog Alerts</span>
          </button>

          {isManager && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'TEAM_DIRECTORY'}
              onClick={() => setActiveTab('TEAM_DIRECTORY')}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${
                activeTab === 'TEAM_DIRECTORY'
                  ? 'border-blue-700 text-blue-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Agency Directory ({registeredUsers.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* ==================== TAB 1: PROFILE & DELIVERY RATE ==================== */}
      {activeTab === 'OVERVIEW_AND_EDIT' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 8 Columns: Personal & Commercial Rate Form */}
          <form
            onSubmit={handleSaveProfile}
            className="lg:col-span-8 bg-white border border-slate-200 rounded-lg p-6 space-y-5"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Personal Identity & Delivery Rate Configuration
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Changes to your profile, role, and hourly cost snapshot rate
                  persist immediately across your active session.
                </p>
              </div>
            </div>

            {profileError && (
              <div
                role="alert"
                className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700"
              >
                {profileError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="prof-name"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Full Name <span className="text-red-600">*</span>
                </label>
                <input
                  id="prof-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-10 px-3 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label
                  htmlFor="prof-email"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Work Email Address <span className="text-red-600">*</span>
                </label>
                <input
                  id="prof-email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 px-3 text-sm font-mono rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label
                  htmlFor="prof-title"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Job Title / Discipline
                </label>
                <input
                  id="prof-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full h-10 px-3 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label
                  htmlFor="prof-dept"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Department / Practice Area
                </label>
                <select
                  id="prof-dept"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full h-10 px-3 text-sm rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="Delivery & Commercial Operations">
                    Delivery & Commercial Operations
                  </option>
                  <option value="Product Engineering">
                    Product Engineering
                  </option>
                  <option value="Cloud & Platform Architecture">
                    Cloud & Platform Architecture
                  </option>
                  <option value="Product Design & Research">
                    Product Design & Research
                  </option>
                  <option value="Quality Assurance & Release">
                    Quality Assurance & Release
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="prof-role"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Organizational RBAC Role <span className="text-red-600">*</span>
                </label>
                <select
                  id="prof-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full h-10 px-3 text-sm font-mono rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="MANAGER">
                    MANAGER (Full Financial & Approval Authority)
                  </option>
                  <option value="TEAM_MEMBER">
                    TEAM_MEMBER (Scoped Delivery Operations)
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="prof-rate"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Default Internal Hourly Cost Rate (USD/hr){' '}
                  <span className="text-red-600">*</span>
                </label>
                <input
                  id="prof-rate"
                  type="number"
                  step="0.01"
                  min="1"
                  value={hourlyCost}
                  onChange={(e) => setHourlyCost(e.target.value)}
                  className="w-full h-10 px-3 text-sm font-mono-tabular rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label
                  htmlFor="prof-tz"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Working Timezone
                </label>
                <select
                  id="prof-tz"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full h-10 px-3 text-sm rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="America/New_York (UTC-05:00)">
                    America/New_York (UTC-05:00)
                  </option>
                  <option value="America/Chicago (UTC-06:00)">
                    America/Chicago (UTC-06:00)
                  </option>
                  <option value="America/Los_Angeles (UTC-08:00)">
                    America/Los_Angeles (UTC-08:00)
                  </option>
                  <option value="Europe/London (UTC+00:00)">
                    Europe/London (UTC+00:00)
                  </option>
                  <option value="Europe/Berlin (UTC+01:00)">
                    Europe/Berlin (UTC+01:00)
                  </option>
                  <option value="Asia/Singapore (UTC+08:00)">
                    Asia/Singapore (UTC+08:00)
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="prof-phone"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Direct Contact Number
                </label>
                <input
                  id="prof-phone"
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-10 px-3 text-sm font-mono rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="prof-bio"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Delivery Responsibilities & Notes
              </label>
              <textarea
                id="prof-bio"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full p-3 text-xs rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
              <strong className="text-slate-900">
                Historical Rate Snapshot Rule:
              </strong>{' '}
              Updating your default internal hourly cost rate ({' '}
              <span className="font-mono-tabular font-semibold text-slate-900">
                {formatCurrency(Number(hourlyCost) || 0, 'USD')}/hr
              </span>{' '}
              ) applies to newly recorded time entries moving forward. Historical
              time entries retain their immutable{' '}
              <code className="font-mono text-[11px]">hourly_cost_snapshot</code>{' '}
              recorded at the time of entry.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Profile Changes</span>
              </button>
            </div>
          </form>

          {/* Right 4 Columns: Assigned Projects & Recent Activity */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  Assigned Project Workspaces
                </h3>
                <span className="text-xs font-mono-tabular text-slate-500">
                  {assignedProjects.length} projects
                </span>
              </div>
              <div className="divide-y divide-slate-200">
                {assignedProjects.map((proj) => (
                  <div
                    key={proj.id}
                    className="py-2.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onOpenProject(proj.id)}
                        className="font-semibold text-slate-900 hover:text-blue-700 truncate block text-left"
                      >
                        {proj.name}
                      </button>
                      <span className="text-slate-500 text-[11px]">
                        {proj.client_name} · {proj.status}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenProject(proj.id)}
                      className="px-2.5 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 shrink-0"
                    >
                      Open
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Recent Personal Time Entries
              </h3>
              {userTimeEntries.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No delivery hours recorded under your profile yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-200">
                  {userTimeEntries.slice(0, 4).map((t) => (
                    <div key={t.id} className="py-2.5 text-xs space-y-0.5">
                      <div className="flex items-center justify-between font-mono-tabular">
                        <span className="text-slate-500">{t.work_date}</span>
                        <span className="font-semibold text-slate-900">
                          {t.hours.toFixed(2)} hrs (
                          {formatCurrency(
                            t.hours * t.hourly_cost_snapshot,
                            'USD'
                          )}
                          )
                        </span>
                      </div>
                      <p className="text-slate-700 truncate">{t.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: SECURITY, PASSWORD & SESSIONS ==================== */}
      {activeTab === 'SECURITY_AND_SESSION' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Password Update Form */}
          <form
            onSubmit={handlePasswordSubmit}
            className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-6 space-y-4"
          >
            <div className="pb-3 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                Change Account Password
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Update the credential stored for {currentUser.email}.
              </p>
            </div>

            {passwordError && (
              <div
                role="alert"
                className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700"
              >
                {passwordError}
              </div>
            )}

            <div>
              <label
                htmlFor="sec-curr-pwd"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Current Password
              </label>
              <input
                id="sec-curr-pwd"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full h-10 px-3 text-sm rounded-md border border-slate-300"
              />
            </div>

            <div>
              <label
                htmlFor="sec-new-pwd"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                New Password <span className="text-red-600">*</span>
              </label>
              <input
                id="sec-new-pwd"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full h-10 px-3 text-sm rounded-md border border-slate-300"
              />
            </div>

            <div>
              <label
                htmlFor="sec-conf-pwd"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Confirm New Password
              </label>
              <input
                id="sec-conf-pwd"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full h-10 px-3 text-sm rounded-md border border-slate-300"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800"
              >
                Update Password
              </button>
            </div>
          </form>

          {/* Active Session Telemetry & RBAC Permission Scope */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Active Session & Token Governance
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Current authenticated browser session and revocation controls.
                  </p>
                </div>
                <span className="px-2 py-0.5 text-[11px] font-mono font-semibold rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                  AUTHENTICATED
                </span>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded bg-slate-50 border border-slate-200">
                  <dt className="text-slate-500">Session Token Fingerprint</dt>
                  <dd className="font-mono text-slate-900 font-semibold mt-0.5 truncate">
                    {session.token}
                  </dd>
                </div>
                <div className="p-3 rounded bg-slate-50 border border-slate-200">
                  <dt className="text-slate-500">Session Issued At</dt>
                  <dd className="font-mono-tabular text-slate-900 font-semibold mt-0.5">
                    {new Date(session.issued_at).toLocaleString()}
                  </dd>
                </div>
                <div className="p-3 rounded bg-slate-50 border border-slate-200">
                  <dt className="text-slate-500">User ID</dt>
                  <dd className="font-mono text-slate-900 mt-0.5">
                    {currentUser.id}
                  </dd>
                </div>
                <div className="p-3 rounded bg-slate-50 border border-slate-200">
                  <dt className="text-slate-500">RBAC Scope</dt>
                  <dd className="font-mono font-semibold text-blue-700 mt-0.5">
                    {currentUser.role}
                  </dd>
                </div>
              </dl>

              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-600">
                  Signing out immediately clears your session token from browser
                  storage.
                </span>
                <button
                  type="button"
                  onClick={onRequestSignOut}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-700 rounded-md hover:bg-red-800"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Revoke Session & Log Out</span>
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-700" />
                <span>
                  Effective Role Permissions ({currentUser.role})
                </span>
              </h3>
              <ul className="space-y-2 text-xs text-slate-700">
                {isManager ? (
                  <>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>
                        View & manage Client Organizations, commercial contract
                        revenue, and planned budgets
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>
                        Approve or reject Pending team expenses (controlling
                        Actual Project Cost impact)
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>
                        Update estimated remaining delivery hours (null vs.
                        numeric) and run AI Risk Advisor
                      </span>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>
                        Access assigned active projects and record decimal
                        delivery work hours
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>
                        Submit project expenses and withdraw Pending submissions
                      </span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-500">
                      <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span>
                        Commercial contract revenue, margins, client directory,
                        and peer hourly rates are restricted
                      </span>
                    </li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: WATCHDOG ALERT PREFERENCES ==================== */}
      {activeTab === 'NOTIFICATIONS' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 max-w-3xl space-y-5">
          <div className="pb-3 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">
              Watchdog Notification & Alert Preferences
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Configure which financial and operational events trigger alerts for
              your account.
            </p>
          </div>

          <div className="divide-y divide-slate-200">
            {(
              [
                {
                  key: 'budget_threshold_alerts',
                  title:
                    'Budget Consumption Threshold Alerts (85% Warning / 100% Critical)',
                  desc: 'Notify immediately when logged hours or approved expenses push an active project over the 85% Warning or 100% Critical budget threshold.',
                },
                {
                  key: 'expense_status_updates',
                  title: 'Expense Submission & Approval Status Updates',
                  desc: 'Receive notifications when project expenses are submitted, approved into Actual Cost, or rejected with remediation feedback.',
                },
                {
                  key: 'missing_estimate_reminders',
                  title:
                    'Missing Remaining-Hours Estimate (Null Forecast) Reminders',
                  desc: 'Alert when an active project has estimated_remaining_hours = null so forecasts are not left unavailable.',
                },
                {
                  key: 'weekly_margin_digest',
                  title: 'Weekly Portfolio Profitability & Variance Digest',
                  desc: 'Receive a Friday summary of portfolio budget consumption, projected final costs, and commercial margin variance.',
                },
              ] as const
            ).map((item) => (
              <div
                key={item.key}
                className="py-4 flex items-start justify-between gap-4"
              >
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    {item.title}
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">{item.desc}</p>
                </div>
                <input
                  type="checkbox"
                  aria-label={item.title}
                  checked={notifications[item.key]}
                  onChange={(e) =>
                    setNotifications((prev) => ({
                      ...prev,
                      [item.key]: e.target.checked,
                    }))
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                />
              </div>
            ))}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleSaveNotifications}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Notification Preferences</span>
            </button>
          </div>
        </div>
      )}

      {/* ==================== TAB 4: MANAGER TEAM DIRECTORY GOVERNANCE ==================== */}
      {activeTab === 'TEAM_DIRECTORY' && isManager && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden space-y-0">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Agency Team Directory & Hourly Cost Rate Governance
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Manage organizational roles and internal hourly cost rates across
                all {registeredUsers.length} registered accounts.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddMemberForm((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                {showAddMemberForm ? 'Cancel' : 'Add Team Member Account'}
              </span>
            </button>
          </div>

          {showAddMemberForm && (
            <form
              onSubmit={handleCreateMember}
              className="p-5 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
            >
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="Samira Patel"
                  className="w-full h-9 px-2.5 text-xs rounded border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  Work Email *
                </label>
                <input
                  type="text"
                  required
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="samira@vanguard-agency.io"
                  className="w-full h-9 px-2.5 text-xs rounded border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  Job Title
                </label>
                <input
                  type="text"
                  value={newMemberTitle}
                  onChange={(e) => setNewMemberTitle(e.target.value)}
                  placeholder="Product Designer"
                  className="w-full h-9 px-2.5 text-xs rounded border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  Role & Rate ($/hr)
                </label>
                <div className="flex gap-1.5">
                  <select
                    value={newMemberRole}
                    onChange={(e) =>
                      setNewMemberRole(e.target.value as UserRole)
                    }
                    className="h-9 px-2 text-xs rounded border border-slate-300 bg-white"
                  >
                    <option value="TEAM_MEMBER">TEAM_MEMBER</option>
                    <option value="MANAGER">MANAGER</option>
                  </select>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={newMemberRate}
                    onChange={(e) => setNewMemberRate(e.target.value)}
                    className="w-20 h-9 px-2 text-xs font-mono-tabular rounded border border-slate-300 bg-white"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="h-9 px-3 text-xs font-semibold text-white bg-blue-700 rounded hover:bg-blue-800"
              >
                Create Account
              </button>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                  <th className="py-3 px-4">Team Member</th>
                  <th className="py-3 px-4">Work Email</th>
                  <th className="py-3 px-4">Title / Discipline</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4 text-right">
                    Internal Hourly Cost Rate
                  </th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {registeredUsers.map((u) => {
                  const isEditing = editingMemberId === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {u.full_name}
                        {u.id === currentUser.id && (
                          <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                            You
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {u.email}
                      </td>
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editMemberTitle}
                            onChange={(e) => setEditMemberTitle(e.target.value)}
                            className="h-8 px-2 text-xs rounded border border-slate-300 w-44"
                          />
                        ) : (
                          <span className="text-slate-700">{u.title}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <select
                            value={editMemberRole}
                            onChange={(e) =>
                              setEditMemberRole(e.target.value as UserRole)
                            }
                            className="h-8 px-2 text-xs font-mono rounded border border-slate-300 bg-white"
                          >
                            <option value="MANAGER">MANAGER</option>
                            <option value="TEAM_MEMBER">TEAM_MEMBER</option>
                          </select>
                        ) : (
                          <span
                            className={`px-2 py-0.5 text-[11px] font-mono font-semibold rounded border ${
                              u.role === 'MANAGER'
                                ? 'bg-blue-50 border-blue-200 text-blue-800'
                                : 'bg-slate-100 border-slate-300 text-slate-700'
                            }`}
                          >
                            {u.role}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-slate-900">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            min="1"
                            value={editMemberRate}
                            onChange={(e) => setEditMemberRate(e.target.value)}
                            className="h-8 px-2 text-xs font-mono-tabular text-right rounded border border-slate-300 w-24"
                          />
                        ) : (
                          `${formatCurrency(u.default_hourly_cost, 'USD')}/hr`
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => saveEditedMember(u)}
                              className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-700 rounded hover:bg-blue-800"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingMemberId(null)}
                              className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditingMember(u)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit Rate / Role</span>
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
      )}
    </div>
  );
};
