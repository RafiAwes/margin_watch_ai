import {
  AiRiskAnalysis,
  AuthSession,
  Client,
  EnrichedProject,
  Expense,
  Project,
  ProjectStatus,
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
import { apiClient, ApiError } from './api-client';

const STORAGE_KEYS = {
  USERS: 'marginwatch_users_v1',
  CREDENTIALS: 'marginwatch_credentials_v1',
  SESSION: 'marginwatch_session_v1',
  CLIENTS: 'marginwatch_clients_v1',
  PROJECTS: 'marginwatch_projects_v1',
  TIME_ENTRIES: 'marginwatch_time_entries_v1',
  EXPENSES: 'marginwatch_expenses_v1',
} as const;

export const INITIAL_REGISTERED_ACCOUNTS: StoredUserAccount[] = [
  {
    id: 'usr_mgr_backend',
    email: 'manager@agency.com',
    full_name: 'Sarah Connor',
    role: 'MANAGER',
    title: 'Agency Operations Director',
    default_hourly_cost: 125,
    password: 'ManagerPass123!',
    created_at: '2026-06-01',
  },
  {
    id: 'usr_dev_backend',
    email: 'dev@agency.com',
    full_name: 'Alex Mercer',
    role: 'TEAM_MEMBER',
    title: 'Senior Software Engineer',
    default_hourly_cost: 65,
    password: 'DevPass123!',
    created_at: '2026-06-01',
  },
];

const DEFAULT_CREDENTIALS: Record<string, string> = {
  'manager@agency.com': 'ManagerPass123!',
  'dev@agency.com': 'DevPass123!',
};

export function loadKnownCredentials(): Record<string, string> {
  const loaded = safeLoad<Record<string, string>>(STORAGE_KEYS.CREDENTIALS, DEFAULT_CREDENTIALS);
  return { ...DEFAULT_CREDENTIALS, ...loaded };
}

export function saveKnownCredential(email: string, password?: string): void {
  if (!email || !password || password === '••••••••') return;
  const creds = loadKnownCredentials();
  creds[email.trim().toLowerCase()] = password;
  safeSave(STORAGE_KEYS.CREDENTIALS, creds);
}

export function getKnownPassword(email: string): string {
  if (!email) return '';
  const creds = loadKnownCredentials();
  return creds[email.trim().toLowerCase()] || '';
}

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

/**
 * Loads stored user accounts, strictly filtering out any legacy un-registered
 * demo placeholders (e.g. @vanguard-agency.io mock accounts) and re-hydrating
 * actual plaintext passwords so accounts can be auto-filled in the login form.
 */
export function loadStoredUsers(): StoredUserAccount[] {
  const loaded = safeLoad<StoredUserAccount[] | null>(STORAGE_KEYS.USERS, null);
  const creds = loadKnownCredentials();

  if (!loaded || loaded.length === 0) {
    const initial = INITIAL_REGISTERED_ACCOUNTS.map((u) => ({
      ...u,
      password: creds[u.email.toLowerCase()] || u.password,
    }));
    safeSave(STORAGE_KEYS.USERS, initial);
    return initial;
  }

  // Filter out any legacy unregistered mock accounts from older demo prototypes
  const registeredOnly = loaded.filter(
    (u) =>
      u.email.toLowerCase() === 'manager@agency.com' ||
      u.email.toLowerCase() === 'dev@agency.com' ||
      (!u.email.endsWith('@vanguard-agency.io') &&
        !u.id.startsWith('usr_mgr_01') &&
        !u.id.startsWith('usr_dev_02') &&
        !u.id.startsWith('usr_dev_03') &&
        !u.id.startsWith('usr_dev_04'))
  );

  const listToUse = registeredOnly.length > 0 ? registeredOnly : INITIAL_REGISTERED_ACCOUNTS;

  // Re-hydrate each account with its actual registered password
  const hydrated = listToUse.map((u) => {
    const knownPwd = creds[u.email.toLowerCase()];
    const currentPwd = u.password && u.password !== '••••••••' ? u.password : undefined;
    return {
      ...u,
      password: knownPwd || currentPwd || (u.role === 'MANAGER' ? 'ManagerPass123!' : 'DevPass123!'),
    };
  });

  safeSave(STORAGE_KEYS.USERS, hydrated);
  return hydrated;
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
  const dummyClientIds = new Set(['cli_01', 'cli_02', 'cli_03', 'cli_04']);
  const dummyProjectIds = new Set([
    'prj_01',
    'prj_02',
    'prj_03',
    'prj_04',
    'prj_05',
  ]);

  const rawClients = safeLoad<Client[]>(STORAGE_KEYS.CLIENTS, INITIAL_CLIENTS);
  const rawProjects = safeLoad<Project[]>(
    STORAGE_KEYS.PROJECTS,
    INITIAL_PROJECTS
  );

  const clients = rawClients.filter((c) => !dummyClientIds.has(c.id));
  const projects = rawProjects.filter((p) => !dummyProjectIds.has(p.id));

  // If legacy mock data was purged, immediately sync clean state back to storage
  if (clients.length !== rawClients.length) {
    persistClients(clients);
  }
  if (projects.length !== rawProjects.length) {
    persistProjects(projects);
  }

  return {
    clients,
    projects,
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
  safeSave(STORAGE_KEYS.USERS, INITIAL_REGISTERED_ACCOUNTS);
  safeSave(STORAGE_KEYS.CLIENTS, INITIAL_CLIENTS);
  safeSave(STORAGE_KEYS.PROJECTS, INITIAL_PROJECTS);
  safeSave(STORAGE_KEYS.TIME_ENTRIES, INITIAL_TIME_ENTRIES);
  safeSave(STORAGE_KEYS.EXPENSES, INITIAL_EXPENSES);
  return {
    users: INITIAL_REGISTERED_ACCOUNTS,
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

/**
 * Authenticates user credentials authoritatively against the Django backend API
 * (/api/v1/auth/login/). Saves JWT access & refresh tokens, loads authenticated user
 * profile with rate masking, and syncs the agency user directory.
 * Falls back gracefully to local credentials store if the backend is not reachable.
 */
export async function authenticateUserWithApi(
  email: string,
  password: string,
  fallbackRole: UserRole = 'MANAGER'
): Promise<
  | {
      ok: true;
      session: AuthSession;
      updatedUsers?: StoredUserAccount[];
      updatedProjects?: Project[];
      fromApi: boolean;
    }
  | {
      ok: false;
      error: string;
    }
> {
  try {
    const loginResult = await apiClient.auth.login(email, password);
    saveKnownCredential(email, password);
    saveActiveSession(loginResult.session);

    // Attempt to load agency directory from backend
    let updatedUsers: StoredUserAccount[] | undefined;
    try {
      const apiUsers = await apiClient.users.list();
      if (apiUsers && apiUsers.length > 0) {
        const creds = loadKnownCredentials();
        const existingUsers = loadStoredUsers();
        const existingMap = new Map(existingUsers.map((u) => [u.email.toLowerCase(), u]));

        const merged: StoredUserAccount[] = apiUsers
          .filter(
            (u) =>
              !u.email.endsWith('@vanguard-agency.io') &&
              !u.id.startsWith('usr_mgr_01') &&
              !u.id.startsWith('usr_dev_02') &&
              !u.id.startsWith('usr_dev_03') &&
              !u.id.startsWith('usr_dev_04')
          )
          .map((apiUser) => {
            const existing = existingMap.get(apiUser.email.toLowerCase());
            const userPassword =
              (apiUser.email.toLowerCase() === email.trim().toLowerCase() ? password : undefined) ||
              creds[apiUser.email.toLowerCase()] ||
              (existing?.password && existing.password !== '••••••••' ? existing.password : undefined) ||
              (apiUser.role === 'MANAGER' ? 'ManagerPass123!' : 'DevPass123!');

            return {
              ...apiUser,
              title: existing?.title || apiUser.title,
              password: userPassword,
            };
          });

        saveStoredUsers(merged);
        updatedUsers = merged;
      }
    } catch {
      // Non-critical if users list endpoint isn't accessible
    }

    return {
      ok: true,
      session: loginResult.session,
      updatedUsers,
      fromApi: true,
    };
  } catch (err: any) {
    // If it's an explicit HTTP status error from the backend (401 invalid credentials, 400 bad request)
    if (err instanceof ApiError && err.status > 0) {
      return {
        ok: false,
        error: err.message || 'Invalid email or password.',
      };
    }

    // Network error or backend offline: fallback to client-side credential store with a console notice
    console.warn('Backend unavailable, falling back to local credentials store:', err?.message);
    const fallbackResult = authenticateUser(email, password, fallbackRole);
    if (fallbackResult.ok) {
      saveKnownCredential(email, password);
    }
    return {
      ...fallbackResult,
      fromApi: false,
    };
  }
}

/**
 * Logs out user by revoking the refresh token on the Django backend (/api/v1/auth/logout/)
 * and clearing local session and tokens.
 */
export async function signOutWithApi(): Promise<void> {
  try {
    await apiClient.auth.logout();
  } catch (e) {
    console.warn('Backend logout revocation notice:', e);
  } finally {
    saveActiveSession(null);
  }
}

/**
 * Synchronizes user directory with the backend /api/v1/users/ endpoint.
 */
export async function syncUsersFromApi(): Promise<StoredUserAccount[]> {
  try {
    const apiUsers = await apiClient.users.list();
    if (apiUsers && apiUsers.length > 0) {
      const creds = loadKnownCredentials();
      const existingUsers = loadStoredUsers();
      const existingMap = new Map(existingUsers.map((u) => [u.email.toLowerCase(), u]));

      const merged: StoredUserAccount[] = apiUsers
        .filter(
          (u) =>
            !u.email.endsWith('@vanguard-agency.io') &&
            !u.id.startsWith('usr_mgr_01') &&
            !u.id.startsWith('usr_dev_02') &&
            !u.id.startsWith('usr_dev_03') &&
            !u.id.startsWith('usr_dev_04')
        )
        .map((apiUser) => {
          const existing = existingMap.get(apiUser.email.toLowerCase());
          const password =
            creds[apiUser.email.toLowerCase()] ||
            (existing?.password && existing.password !== '••••••••' ? existing.password : undefined) ||
            (apiUser.role === 'MANAGER' ? 'ManagerPass123!' : 'DevPass123!');

          return {
            ...apiUser,
            title: existing?.title || apiUser.title,
            password,
          };
        });

      saveStoredUsers(merged);
      return merged;
    }
  } catch (e) {
    console.warn('Could not sync users from backend API:', e);
  }
  return loadStoredUsers();
}

/**
 * Registers a new agency user authoritatively with the Django backend API
 * (/api/v1/auth/register/). Stores signed SimpleJWT tokens, activates session,
 * and updates local workspace state.
 * Falls back gracefully to local credentials store if the backend is unavailable.
 */
export async function registerNewUserWithApi(input: {
  full_name: string;
  email: string;
  password: string;
  role: UserRole;
  title: string;
  default_hourly_cost: number;
  assign_to_active_projects?: boolean;
}): Promise<
  | {
      ok: true;
      session: AuthSession;
      updatedUsers: StoredUserAccount[];
      updatedProjects: Project[];
    }
  | {
      ok: false;
      field?: string;
      errors?: Record<string, string>;
      error: string;
    }
> {
  const parts = input.full_name.trim().split(/\s+/);
  const first_name = parts[0] || 'Agency';
  const last_name = parts.slice(1).join(' ') || 'User';

  try {
    const regResult = await apiClient.auth.register({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      first_name,
      last_name,
      role: input.role,
      default_hourly_cost_rate: input.default_hourly_cost,
    });

    // Ensure custom title is set on the user profile
    if (input.title?.trim()) {
      regResult.user.title = input.title.trim();
      regResult.session.user.title = input.title.trim();
    }

    saveKnownCredential(input.email, input.password);
    saveActiveSession(regResult.session);

    // Sync directory from backend
    let updatedUsers = loadStoredUsers();
    try {
      const apiUsers = await apiClient.users.list();
      if (apiUsers && apiUsers.length > 0) {
        const creds = loadKnownCredentials();
        updatedUsers = apiUsers
          .filter(
            (u) =>
              !u.email.endsWith('@vanguard-agency.io') &&
              !u.id.startsWith('usr_mgr_01') &&
              !u.id.startsWith('usr_dev_02') &&
              !u.id.startsWith('usr_dev_03') &&
              !u.id.startsWith('usr_dev_04')
          )
          .map((u) => {
            const isNewlyRegistered = u.email.toLowerCase() === input.email.trim().toLowerCase();
            return {
              ...u,
              title: isNewlyRegistered ? (input.title?.trim() || u.title) : u.title,
              password: isNewlyRegistered ? input.password : (creds[u.email.toLowerCase()] || u.password),
            };
          });
        saveStoredUsers(updatedUsers);
      }
    } catch {
      const newStored: StoredUserAccount = {
        ...regResult.user,
        title: input.title,
        password: input.password,
      };
      updatedUsers = [
        ...updatedUsers.filter((u) => u.email.toLowerCase() !== input.email.trim().toLowerCase()),
        newStored,
      ];
      saveStoredUsers(updatedUsers);
    }

    const currentProjects = safeLoad<Project[]>(
      STORAGE_KEYS.PROJECTS,
      INITIAL_PROJECTS
    );
    const updatedProjects = currentProjects.map((p) =>
      p.status === 'ACTIVE' && !p.assigned_member_ids.includes(regResult.user.id)
        ? {
            ...p,
            assigned_member_ids: [...p.assigned_member_ids, regResult.user.id],
          }
        : p
    );
    persistProjects(updatedProjects);

    return {
      ok: true,
      session: regResult.session,
      updatedUsers,
      updatedProjects,
    };
  } catch (err: any) {
    if (err instanceof ApiError && err.status > 0) {
      const field = err.data?.email
        ? 'email'
        : err.data?.password
        ? 'password'
        : err.data?.default_hourly_cost_rate
        ? 'default_hourly_cost'
        : 'root';
      const cleanError = err.fieldErrors?.[field] || err.message || 'Registration failed.';
      return {
        ok: false,
        field,
        errors: err.fieldErrors,
        error: cleanError,
      };
    }

    const networkErrorMsg =
      err?.status === 0 || err?.message?.includes('Network error')
        ? 'Cannot connect to MarginWatch backend API at http://127.0.0.1:8000. Please ensure the Django backend is running.'
        : err?.message || 'Registration failed.';

    return {
      ok: false,
      field: 'root',
      error: networkErrorMsg,
    };
  }
}

/**
 * Creates a new agency team member directly on the Django backend (POST /api/v1/users/)
 * using the authenticated Manager's credentials, without overwriting the manager's active session.
 */
export async function createMemberWithApi(input: {
  full_name: string;
  email: string;
  password?: string;
  role: UserRole;
  title?: string;
  default_hourly_cost: number;
  assign_to_active_projects?: boolean;
}): Promise<
  | {
      ok: true;
      createdUser: StoredUserAccount;
      updatedUsers: StoredUserAccount[];
      updatedProjects: Project[];
    }
  | {
      ok: false;
      field?: string;
      errors?: Record<string, string>;
      error: string;
    }
> {
  const parts = input.full_name.trim().split(/\s+/);
  const first_name = parts[0] || 'Agency';
  const last_name = parts.slice(1).join(' ') || 'Member';
  const defaultPassword = input.password?.trim() || 'AgencyPassword123!';

  try {
    const createdAccount = await apiClient.users.create({
      email: input.email.trim().toLowerCase(),
      password: defaultPassword,
      first_name,
      last_name,
      role: input.role,
      default_hourly_cost_rate: input.default_hourly_cost,
    });

    saveKnownCredential(input.email, defaultPassword);
    let updatedUsers = loadStoredUsers();
    try {
      const apiUsers = await apiClient.users.list();
      if (apiUsers && apiUsers.length > 0) {
        const creds = loadKnownCredentials();
        updatedUsers = apiUsers
          .filter(
            (u) =>
              !u.email.endsWith('@vanguard-agency.io') &&
              !u.id.startsWith('usr_mgr_01') &&
              !u.id.startsWith('usr_dev_02') &&
              !u.id.startsWith('usr_dev_03') &&
              !u.id.startsWith('usr_dev_04')
          )
          .map((u) => {
            const isCreated = u.email.toLowerCase() === input.email.trim().toLowerCase();
            return {
              ...u,
              title: isCreated ? (input.title?.trim() || u.title) : u.title,
              password: isCreated ? defaultPassword : (creds[u.email.toLowerCase()] || u.password),
            };
          });
        saveStoredUsers(updatedUsers);
      }
    } catch {
      updatedUsers = [
        ...updatedUsers.filter((u) => u.id !== createdAccount.id),
        {
          ...createdAccount,
          title: input.title?.trim() || (input.role === 'MANAGER' ? 'Agency Manager' : 'Software Engineer'),
          password: defaultPassword,
        },
      ];
      saveStoredUsers(updatedUsers);
    }

    const currentProjects = safeLoad<Project[]>(STORAGE_KEYS.PROJECTS, INITIAL_PROJECTS);
    const shouldAssign = input.assign_to_active_projects ?? true;
    const updatedProjects = shouldAssign
      ? currentProjects.map((p) =>
          p.status === 'ACTIVE' && !p.assigned_member_ids.includes(createdAccount.id)
            ? { ...p, assigned_member_ids: [...p.assigned_member_ids, createdAccount.id] }
            : p
        )
      : currentProjects;
    persistProjects(updatedProjects);

    return {
      ok: true,
      createdUser: createdAccount,
      updatedUsers,
      updatedProjects,
    };
  } catch (err: any) {
    if (err instanceof ApiError && err.status > 0) {
      const field = err.data?.email
        ? 'email'
        : err.data?.password
        ? 'password'
        : err.data?.default_hourly_cost_rate
        ? 'default_hourly_cost'
        : 'root';
      const cleanError = err.fieldErrors?.[field] || err.message || 'Failed to create team member.';
      return {
        ok: false,
        field,
        errors: err.fieldErrors,
        error: cleanError,
      };
    }

    console.warn('Backend unavailable during member creation, adding to local fallback:', err?.message);
    const activeSession = loadActiveSession();
    const localResult = registerNewUser({
      full_name: input.full_name,
      email: input.email,
      password: defaultPassword,
      role: input.role,
      title: input.title?.trim() || (input.role === 'MANAGER' ? 'Agency Manager' : 'Software Engineer'),
      default_hourly_cost: input.default_hourly_cost,
      assign_to_active_projects: input.assign_to_active_projects ?? true,
    });

    if (activeSession) {
      saveActiveSession(activeSession);
    }

    if (localResult.ok === false) {
      return {
        ok: false,
        field: localResult.field,
        error: localResult.error,
      };
    }

    const created = localResult.updatedUsers.find(
      (u) => u.email.trim().toLowerCase() === input.email.trim().toLowerCase()
    )!;

    return {
      ok: true,
      createdUser: created,
      updatedUsers: localResult.updatedUsers,
      updatedProjects: localResult.updatedProjects,
    };
  }
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

/**
 * Updates a user profile. If user is modifying own profile, invokes /api/v1/auth/me/.
 * If user is a MANAGER modifying another agency account, invokes /api/v1/users/{id}/.
 * Updates local store and active session.
 */
export async function updateUserProfileWithApi(
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
): Promise<
  | {
      ok: true;
      updatedUser: User;
      updatedUsers: StoredUserAccount[];
      updatedSession: AuthSession | null;
    }
  | {
      ok: false;
      error: string;
    }
> {
  const session = loadActiveSession();
  const isSelf = session?.user.id === userId;

  try {
    if (isSelf) {
      const parts = updates.full_name.trim().split(/\s+/);
      const first_name = parts[0] || '';
      const last_name = parts.slice(1).join(' ') || '';
      await apiClient.auth.updateMe({ first_name, last_name });
    } else if (session?.user.role === 'MANAGER') {
      const parts = updates.full_name.trim().split(/\s+/);
      await apiClient.users.update(userId, {
        first_name: parts[0] || '',
        last_name: parts.slice(1).join(' ') || '',
        role: updates.role,
        default_hourly_cost_rate: updates.default_hourly_cost,
      });
    }
  } catch (err: any) {
    console.warn('Could not persist profile changes to backend API, updating locally:', err?.message);
    if (err instanceof ApiError && err.status === 400) {
      return { ok: false, error: err.message };
    }
  }

  return updateUserProfile(userId, updates);
}

export function updateUserPassword(
  userId: string,
  newPassword: string
): { ok: true; updatedUsers: StoredUserAccount[] } {
  const users = loadStoredUsers();
  const updatedUsers = users.map((u) => {
    if (u.id === userId) {
      saveKnownCredential(u.email, newPassword);
      return { ...u, password: newPassword };
    }
    return u;
  });
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
        f.projected_margin_pct
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

// -----------------------------------------------------------------------------
// Client & Project API Integration Helpers
// -----------------------------------------------------------------------------

export function transformBackendClientToClient(backendClient: any): Client {
  return {
    id: String(backendClient.id),
    name: backendClient.name,
    contact_name: backendClient.contact_name || '',
    contact_email: backendClient.contact_email || '',
    default_currency: (backendClient.default_currency || 'USD') as 'USD' | 'EUR' | 'GBP',
    status: backendClient.is_archived ? 'ARCHIVED' : 'ACTIVE',
    notes: backendClient.notes || '',
    created_at: backendClient.created_at || new Date().toISOString(),
  };
}

export function transformBackendProjectToProject(backendProject: any): Project {
  const estHours = backendProject.estimated_remaining_hours;
  return {
    id: String(backendProject.id),
    client_id: String(backendProject.client?.id || backendProject.client_id || ''),
    name: backendProject.name,
    currency: (backendProject.currency || 'USD') as 'USD' | 'EUR' | 'GBP',
    status: (backendProject.status || 'PLANNING') as ProjectStatus,
    deadline: backendProject.deadline || null,
    contract_revenue: backendProject.contract_revenue ? parseFloat(backendProject.contract_revenue) : 0,
    planned_cost_budget: backendProject.planned_cost_budget ? parseFloat(backendProject.planned_cost_budget) : 0,
    planned_hourly_cost: backendProject.planned_hourly_cost ? parseFloat(backendProject.planned_hourly_cost) : 0,
    estimated_remaining_hours:
      estHours !== null && estHours !== undefined && estHours !== '' ? parseFloat(estHours) : null,
    assigned_member_ids: Array.isArray(backendProject.assigned_member_ids)
      ? backendProject.assigned_member_ids.map(String)
      : [],
    updated_at: backendProject.updated_at || new Date().toISOString(),
  };
}

export async function syncClientsFromApi(): Promise<Client[]> {
  try {
    const apiClients = await apiClient.clients.list(true);
    if (Array.isArray(apiClients)) {
      const transformed = apiClients.map(transformBackendClientToClient);
      persistClients(transformed);
      return transformed;
    }
  } catch (err) {
    console.warn('Could not sync clients from backend API:', err);
  }
  return loadWorkspaceData().clients;
}

export async function syncProjectsFromApi(): Promise<Project[]> {
  try {
    const apiProjects = await apiClient.projects.list();
    if (Array.isArray(apiProjects)) {
      const transformed = apiProjects.map(transformBackendProjectToProject);
      persistProjects(transformed);
      return transformed;
    }
  } catch (err) {
    console.warn('Could not sync projects from backend API:', err);
  }
  return loadWorkspaceData().projects;
}

export async function saveClientWithApi(
  data: {
    name: string;
    contact_name?: string;
    contact_email?: string;
    notes?: string;
    default_currency?: 'USD' | 'EUR' | 'GBP';
  },
  existingId?: string
): Promise<Client> {
  try {
    let saved: any;
    if (existingId) {
      saved = await apiClient.clients.update(existingId, data);
    } else {
      saved = await apiClient.clients.create(data);
    }
    const client = transformBackendClientToClient(saved);
    const current = loadWorkspaceData().clients;
    const updated = existingId
      ? current.map((c) => (c.id === existingId ? client : c))
      : [client, ...current];
    persistClients(updated);
    return client;
  } catch (err) {
    console.warn('Backend client save error, falling back to local persistence:', err);
    const newClient: Client = {
      id: existingId || `cli_${Date.now()}`,
      name: data.name,
      contact_name: data.contact_name || '',
      contact_email: data.contact_email || '',
      default_currency: data.default_currency || 'USD',
      status: 'ACTIVE',
      notes: data.notes || '',
      created_at: new Date().toISOString(),
    };
    const current = loadWorkspaceData().clients;
    const updated = existingId
      ? current.map((c) => (c.id === existingId ? newClient : c))
      : [newClient, ...current];
    persistClients(updated);
    return newClient;
  }
}

export async function archiveClientWithApi(clientId: string): Promise<void> {
  try {
    await apiClient.clients.archive(clientId);
  } catch (err) {
    console.warn('Backend client archive error, updating local state:', err);
  }
  const current = loadWorkspaceData().clients;
  const updated = current.map((c) =>
    c.id === clientId ? { ...c, status: (c.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED') as any } : c
  );
  persistClients(updated);
}

export async function saveProjectWithApi(
  projectData: Omit<Project, 'id' | 'updated_at'>,
  existingId?: string
): Promise<Project> {
  try {
    let saved: any;
    if (existingId) {
      saved = await apiClient.projects.update(existingId, {
        name: projectData.name,
        currency: projectData.currency,
        status: projectData.status,
        deadline: projectData.deadline,
        contract_revenue: projectData.contract_revenue,
        planned_cost_budget: projectData.planned_cost_budget,
        planned_hourly_cost: projectData.planned_hourly_cost,
        estimated_remaining_hours: projectData.estimated_remaining_hours,
      });
    } else {
      saved = await apiClient.projects.create({
        client_id: projectData.client_id,
        name: projectData.name,
        currency: projectData.currency,
        status: projectData.status,
        deadline: projectData.deadline,
        contract_revenue: projectData.contract_revenue,
        planned_cost_budget: projectData.planned_cost_budget,
        planned_hourly_cost: projectData.planned_hourly_cost,
        estimated_remaining_hours: projectData.estimated_remaining_hours,
        initial_member_ids: projectData.assigned_member_ids,
      });
    }
    const project = transformBackendProjectToProject(saved);
    const current = loadWorkspaceData().projects;
    const updated = existingId
      ? current.map((p) => (p.id === existingId ? project : p))
      : [project, ...current];
    persistProjects(updated);
    return project;
  } catch (err) {
    console.warn('Backend project save error, falling back to local persistence:', err);
    const fallbackProject: Project = {
      ...projectData,
      id: existingId || `prj_${Date.now()}`,
      updated_at: new Date().toISOString(),
    };
    const current = loadWorkspaceData().projects;
    const updated = existingId
      ? current.map((p) => (p.id === existingId ? fallbackProject : p))
      : [fallbackProject, ...current];
    persistProjects(updated);
    return fallbackProject;
  }
}

export async function updateProjectEstimateWithApi(
  projectId: string,
  remainingHours: number | null
): Promise<void> {
  try {
    await apiClient.projects.update(projectId, {
      estimated_remaining_hours: remainingHours,
    });
  } catch (err) {
    console.warn('Backend estimate update error, updating local store:', err);
  }
  const current = loadWorkspaceData().projects;
  const updated = current.map((p) =>
    p.id === projectId
      ? {
          ...p,
          estimated_remaining_hours: remainingHours,
          updated_at: new Date().toISOString(),
        }
      : p
  );
  persistProjects(updated);
}
