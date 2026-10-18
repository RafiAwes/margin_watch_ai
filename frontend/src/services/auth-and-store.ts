import {
  AiRiskAnalysis,
  AuthSession,
  Client,
  EnrichedProject,
  Expense,
  Project,
  StoredUserAccount,
  TimeEntry,
  User,
  UserRole,
} from '../types/domain';
import {
  AI_ADVISOR_DATA,
  INITIAL_CLIENTS,
  INITIAL_EXPENSES,
  INITIAL_PROJECTS,
  INITIAL_TIME_ENTRIES,
  TEAM_DIRECTORY,
} from '../data/seed-data';
import { formatCurrency, formatHours, formatPercentage } from '../lib/financial-engine';

const STORAGE_KEYS = {
  USERS: 'marginwatch_users_v1',
  SESSION: 'marginwatch_session_v1',
  CLIENTS: 'marginwatch_clients_v1',
  PROJECTS: 'marginwatch_projects_v1',
  TIME_ENTRIES: 'marginwatch_time_entries_v1',
  EXPENSES: 'marginwatch_expenses_v1',
} as const;

const DEFAULT_ACCOUNTS: StoredUserAccount[] = TEAM_DIRECTORY.map((u) => ({
  ...u,
  password: u.role === 'MANAGER' ? 'Manager123!' : 'Member123!',
  created_at: '2026-06-01',
}));

function safeLoad<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSave<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors in restricted environments
  }
}

export function loadStoredUsers(): StoredUserAccount[] {
  const loaded = safeLoad<StoredUserAccount[] | null>(STORAGE_KEYS.USERS, null);
  if (!loaded || loaded.length === 0) {
    safeSave(STORAGE_KEYS.USERS, DEFAULT_ACCOUNTS);
    return DEFAULT_ACCOUNTS;
  }
  return loaded;
}

export function saveStoredUsers(users: StoredUserAccount[]): void {
  safeSave(STORAGE_KEYS.USERS, users);
}

export function loadActiveSession(): AuthSession | null {
  return safeLoad<AuthSession | null>(STORAGE_KEYS.SESSION, null);
}

export function saveActiveSession(session: AuthSession | null): void {
  if (!session) {
    try {
      window.localStorage.removeItem(STORAGE_KEYS.SESSION);
    } catch {
      // ignore
    }
    return;
  }
  safeSave(STORAGE_KEYS.SESSION, session);
}

export function loadWorkspaceData(): {
  clients: Client[];
  projects: Project[];
  timeEntries: TimeEntry[];
  expenses: Expense[];
} {
  return {
    clients: safeLoad<Client[]>(STORAGE_KEYS.CLIENTS, INITIAL_CLIENTS),
    projects: safeLoad<Project[]>(STORAGE_KEYS.PROJECTS, INITIAL_PROJECTS),
    timeEntries: safeLoad<TimeEntry[]>(
      STORAGE_KEYS.TIME_ENTRIES,
      INITIAL_TIME_ENTRIES
    ),
    expenses: safeLoad<Expense[]>(STORAGE_KEYS.EXPENSES, INITIAL_EXPENSES),
  };
}

export function persistClients(clients: Client[]): void {
  safeSave(STORAGE_KEYS.CLIENTS, clients);
}

export function persistProjects(projects: Project[]): void {
  safeSave(STORAGE_KEYS.PROJECTS, projects);
}

export function persistTimeEntries(timeEntries: TimeEntry[]): void {
  safeSave(STORAGE_KEYS.TIME_ENTRIES, timeEntries);
}

export function persistExpenses(expenses: Expense[]): void {
  safeSave(STORAGE_KEYS.EXPENSES, expenses);
}

export function resetWorkspaceToDefaults(): {
  users: StoredUserAccount[];
  clients: Client[];
  projects: Project[];
  timeEntries: TimeEntry[];
  expenses: Expense[];
} {
  safeSave(STORAGE_KEYS.USERS, DEFAULT_ACCOUNTS);
  safeSave(STORAGE_KEYS.CLIENTS, INITIAL_CLIENTS);
  safeSave(STORAGE_KEYS.PROJECTS, INITIAL_PROJECTS);
  safeSave(STORAGE_KEYS.TIME_ENTRIES, INITIAL_TIME_ENTRIES);
  safeSave(STORAGE_KEYS.EXPENSES, INITIAL_EXPENSES);
  return {
    users: DEFAULT_ACCOUNTS,
    clients: INITIAL_CLIENTS,
    projects: INITIAL_PROJECTS,
    timeEntries: INITIAL_TIME_ENTRIES,
    expenses: INITIAL_EXPENSES,
  };
}

function formatNameFromEmail(emailInput: string): string {
  const localPart = emailInput.split('@')[0] || 'Agency User';
  const cleaned = localPart
    .replace(/[._-]+/g, ' ')
    .replace(/\d+/g, '')
    .trim();
  if (!cleaned) return 'Agency User';
  return cleaned
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function authenticateUser(
  email: string,
  password: string,
  fallbackRole: UserRole = 'MANAGER'
): {
  ok: true;
  session: AuthSession;
  updatedUsers?: StoredUserAccount[];
  updatedProjects?: Project[];
} {
  const users = loadStoredUsers();
  const rawInput = email.trim() || 'demo@vanguard-agency.io';
  const normalizedEmail = rawInput.includes('@')
    ? rawInput.toLowerCase()
    : `${rawInput.toLowerCase()}@vanguard-agency.io`;

  const existingAccount = users.find(
    (u) => u.email.trim().toLowerCase() === normalizedEmail
  );

  if (existingAccount) {
    const { password: _pwd, ...publicUser } = existingAccount;
    const session: AuthSession = {
      token: `mw_jwt_${existingAccount.id}_${Date.now()}`,
      user: publicUser,
      issued_at: new Date().toISOString(),
    };
    saveActiveSession(session);
    return { ok: true, session };
  }

  // Auto-detect role hint from email if present, otherwise use fallbackRole
  const inferredRole: UserRole =
    normalizedEmail.includes('member') ||
    normalizedEmail.includes('dev') ||
    normalizedEmail.includes('eng')
      ? 'TEAM_MEMBER'
      : fallbackRole;

  const newUserId = `usr_${inferredRole === 'MANAGER' ? 'mgr' : 'mem'}_${Date.now()}`;
  const newAccount: StoredUserAccount = {
    id: newUserId,
    email: normalizedEmail,
    full_name: formatNameFromEmail(normalizedEmail),
    role: inferredRole,
    title:
      inferredRole === 'MANAGER'
        ? 'Agency Delivery Manager'
        : 'Senior Software Engineer',
    default_hourly_cost: inferredRole === 'MANAGER' ? 135 : 115,
    password: password || 'any-password',
    created_at: new Date().toISOString().slice(0, 10),
  };

  const updatedUsers = [...users, newAccount];
  saveStoredUsers(updatedUsers);

  const currentProjects = safeLoad<Project[]>(
    STORAGE_KEYS.PROJECTS,
    INITIAL_PROJECTS
  );
  const updatedProjects = currentProjects.map((p) =>
    p.status === 'ACTIVE' && !p.assigned_member_ids.includes(newUserId)
      ? { ...p, assigned_member_ids: [...p.assigned_member_ids, newUserId] }
      : p
  );
  persistProjects(updatedProjects);

  const { password: _pwd, ...publicUser } = newAccount;
  const session: AuthSession = {
    token: `mw_jwt_${newAccount.id}_${Date.now()}`,
    user: publicUser,
    issued_at: new Date().toISOString(),
  };

  saveActiveSession(session);
  return { ok: true, session, updatedUsers, updatedProjects };
}

export function registerNewUser(input: {
  full_name: string;
  email: string;
  password: string;
  role: UserRole;
  title: string;
  default_hourly_cost: number;
  assign_to_active_projects?: boolean;
}): {
  ok: true;
  session: AuthSession;
  updatedUsers: StoredUserAccount[];
  updatedProjects: Project[];
} | {
  ok: false;
  field?: string;
  error: string;
} {
  const users = loadStoredUsers();
  const normalizedEmail = input.email.trim().toLowerCase();

  if (users.some((u) => u.email.trim().toLowerCase() === normalizedEmail)) {
    return {
      ok: false,
      field: 'email',
      error: 'An account with this work email already exists. Please sign in instead.',
    };
  }

  const newUserId = `usr_${input.role === 'MANAGER' ? 'mgr' : 'mem'}_${Date.now()}`;
  const newAccount: StoredUserAccount = {
    id: newUserId,
    email: normalizedEmail,
    full_name: input.full_name.trim(),
    role: input.role,
    title:
      input.title.trim() ||
      (input.role === 'MANAGER' ? 'Agency Manager' : 'Software Engineer'),
    default_hourly_cost: Number(input.default_hourly_cost.toFixed(2)),
    password: input.password,
    created_at: new Date().toISOString().slice(0, 10),
  };

  const updatedUsers = [...users, newAccount];
  saveStoredUsers(updatedUsers);

  // If registering as a Team Member (or Manager), assign to active projects so they can immediately log work
  const currentProjects = safeLoad<Project[]>(
    STORAGE_KEYS.PROJECTS,
    INITIAL_PROJECTS
  );
  const shouldAssign = input.assign_to_active_projects ?? true;
  const updatedProjects = shouldAssign
    ? currentProjects.map((p) =>
        p.status === 'ACTIVE' && !p.assigned_member_ids.includes(newUserId)
          ? { ...p, assigned_member_ids: [...p.assigned_member_ids, newUserId] }
          : p
      )
    : currentProjects;

  persistProjects(updatedProjects);

  const { password: _pwd, ...publicUser } = newAccount;
  const session: AuthSession = {
    token: `mw_jwt_${newAccount.id}_${Date.now()}`,
    user: publicUser,
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    session_id: `sess_${Date.now().toString(36)}`,
  };
  saveActiveSession(session);

  return {
    ok: true,
    session,
    updatedUsers,
    updatedProjects,
  };
}

export function updateUserProfile(
  userId: string,
  updates: {
    full_name: string;
    email: string;
    title: string;
    role: UserRole;
    default_hourly_cost: number;
    department?: string;
    timezone?: string;
    phone?: string;
    bio?: string;
    notification_preferences?: User['notification_preferences'];
  }
): {
  ok: true;
  updatedUser: User;
  updatedUsers: StoredUserAccount[];
  updatedSession: AuthSession | null;
} | {
  ok: false;
  error: string;
} {
  const users = loadStoredUsers();
  const normalizedEmail = updates.email.trim().toLowerCase();

  const duplicateEmail = users.find(
    (u) => u.id !== userId && u.email.trim().toLowerCase() === normalizedEmail
  );
  if (duplicateEmail) {
    return {
      ok: false,
      error: 'Another agency account already uses that work email address.',
    };
  }

  let updatedAccount: StoredUserAccount | null = null;
  const updatedUsers = users.map((u) => {
    if (u.id !== userId) return u;
    updatedAccount = {
      ...u,
      full_name: updates.full_name.trim() || u.full_name,
      email: normalizedEmail || u.email,
      title: updates.title.trim() || u.title,
      role: updates.role,
      default_hourly_cost: Number(updates.default_hourly_cost.toFixed(2)),
      department: updates.department?.trim() ?? u.department,
      timezone: updates.timezone ?? u.timezone,
      phone: updates.phone?.trim() ?? u.phone,
      bio: updates.bio?.trim() ?? u.bio,
      notification_preferences:
        updates.notification_preferences ?? u.notification_preferences,
    };
    return updatedAccount;
  });

  if (!updatedAccount) {
    return { ok: false, error: 'User account not found in directory.' };
  }

  saveStoredUsers(updatedUsers);

  const { password: _pwd, ...publicUser } = updatedAccount as StoredUserAccount;
  const currentSession = loadActiveSession();
  let updatedSession: AuthSession | null = currentSession;

  if (currentSession && currentSession.user.id === userId) {
    updatedSession = {
      ...currentSession,
      user: publicUser,
    };
    saveActiveSession(updatedSession);
  }

  return {
    ok: true,
    updatedUser: publicUser,
    updatedUsers,
    updatedSession,
  };
}

export function updateUserPassword(
  userId: string,
  newPassword: string
): { ok: true; updatedUsers: StoredUserAccount[] } {
  const users = loadStoredUsers();
  const updatedUsers = users.map((u) =>
    u.id === userId ? { ...u, password: newPassword } : u
  );
  saveStoredUsers(updatedUsers);
  return { ok: true, updatedUsers };
}


/**
 * Generates an up-to-date advisory analysis grounded in the current project financials
 */
export function buildProjectAiRiskAnalysis(
  project: EnrichedProject
): AiRiskAnalysis {
  const seeded = AI_ADVISOR_DATA[project.id];
  const f = project.financials;

  if (seeded && f.risk_status === seeded.deterministic_risk_status) {
    return {
      ...seeded,
      deterministic_drivers: f.risk_reasons,
    };
  }

  const c = project.currency;
  const suggested_actions: AiRiskAnalysis['suggested_actions'] = [];

  if (project.estimated_remaining_hours === null) {
    suggested_actions.push({
      id: `act_est_${project.id}`,
      title: 'Capture Remaining Delivery Effort Estimate with Engineering Lead',
      rationale: `Actual cost is ${formatCurrency(
        f.actual_total_cost,
        c
      )} (${formatPercentage(
        f.budget_consumed_pct
      )} of budget), but remaining hours are currently null. Entering an estimate is required to compute final cost and margin.`,
      estimated_impact:
        'Restores full deterministic final cost and commercial margin forecasting.',
      action_type: 'UPDATE_ESTIMATE',
    });
  }

  if (f.pending_expense_amount > 0) {
    suggested_actions.push({
      id: `act_exp_${project.id}`,
      title: `Review ${formatCurrency(
        f.pending_expense_amount,
        c
      )} in Pending Expenses Before Milestone Close`,
      rationale:
        'Pending expenses are currently excluded from Actual Cost. Approving or rejecting them clarifies remaining labor budget.',
      estimated_impact: `Resolves ${formatCurrency(
        f.pending_expense_amount,
        c
      )} in unapproved cost exposure.`,
      action_type: 'REVIEW_EXPENSES',
    });
  }

  if (f.projected_cost_variance !== null && f.projected_cost_variance > 0) {
    suggested_actions.push({
      id: `act_scope_${project.id}`,
      title: 'Negotiate Change Request or De-Scope Non-Critical Deliverables',
      rationale: `At ${formatCurrency(
        project.planned_hourly_cost,
        c
      )}/hr across ${formatHours(
        project.estimated_remaining_hours
      )} remaining, projected cost exceeds planned budget by +${formatCurrency(
        f.projected_cost_variance,
        c
      )}.`,
      estimated_impact: `Protects up to ${formatCurrency(
        f.projected_cost_variance,
        c
      )} in commercial margin.`,
      action_type: 'SCOPE_REVIEW',
    });
  }

  if (suggested_actions.length < 2) {
    suggested_actions.push({
      id: `act_cadence_${project.id}`,
      title: 'Maintain Weekly Remaining-Hours Re-Estimation Cadence',
      rationale:
        'Auditing logged hours against remaining effort every Friday prevents late-stage budget surprises.',
      estimated_impact: `Preserves projected ${formatPercentage(
        f.projected_margin_pct,
        'target'
      )} margin.`,
      action_type: 'RATE_AUDIT',
    });
  }

  const ai_summary =
    project.estimated_remaining_hours === null
      ? `${project.name} has recorded ${formatHours(
          f.actual_hours_logged
        )} (${formatCurrency(
          f.actual_labor_cost,
          c
        )} labor) and ${formatCurrency(
          f.actual_expense_cost,
          c
        )} in approved expenses (${formatPercentage(
          f.budget_consumed_pct
        )} of the ${formatCurrency(
          project.planned_cost_budget,
          c
        )} budget). Because estimated remaining hours are currently null, final cost and profit projections are withheld until a delivery estimate is entered.`
      : `${project.name} has consumed ${formatPercentage(
          f.budget_consumed_pct
        )} of its ${formatCurrency(
          project.planned_cost_budget,
          c
        )} planned budget (${formatCurrency(
          f.actual_total_cost,
          c
        )} actual cost to date). Combining actual cost with ${formatHours(
          project.estimated_remaining_hours
        )} remaining at ${formatCurrency(
          project.planned_hourly_cost,
          c
        )}/hr yields a projected final cost of ${formatCurrency(
          f.projected_final_cost,
          c
        )} and a projected commercial margin of ${formatPercentage(
          f.projected_margin_pct
        )} (vs. ${formatPercentage(f.planned_margin_pct)} planned).`;

  return {
    project_id: project.id,
    generated_at: new Date().toISOString(),
    deterministic_risk_status: f.risk_status,
    deterministic_drivers: f.risk_reasons,
    ai_summary,
    suggested_actions,
    assumptions: [
      `Includes ${formatCurrency(
        f.actual_expense_cost,
        c
      )} in Approved expenses; excludes ${formatCurrency(
        f.pending_expense_amount,
        c
      )} in Pending expenses.`,
      project.estimated_remaining_hours !== null
        ? `Values ${formatHours(
            project.estimated_remaining_hours
          )} remaining effort at the ${formatCurrency(
            project.planned_hourly_cost,
            c
          )}/hr planned rate.`
        : 'Forecast metrics are intentionally withheld while estimated_remaining_hours is null.',
    ],
    missing_data_warnings:
      project.estimated_remaining_hours === null
        ? ['Missing required forecast input: estimated_remaining_hours is null.']
        : [],
  };
}
