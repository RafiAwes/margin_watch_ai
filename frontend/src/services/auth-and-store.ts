import {
  AuthSession,
  Client,
  EnrichedProject,
  Expense,
  ExpenseCategory,
  ExpenseStatus,
  Project,
  ProjectStatus,
  StoredUserAccount,
  TimeEntry,
  User,
  UserRole,
} from '../types/domain';
import { formatCurrency, formatHours, formatPercentage } from '../lib/financial-engine';
import { apiClient, ApiError } from './api-client';

const INITIAL_CLIENTS: Client[] = [];
const INITIAL_PROJECTS: Project[] = [];

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

// Publicly documented demo seed accounts (backend `seed_dev_users`), used only for
// click-to-fill on the login screen. Real passwords are never written to browser storage.
const DEFAULT_CREDENTIALS: Record<string, string> = {
  'manager@agency.com': 'ManagerPass123!',
  'dev@agency.com': 'DevPass123!',
};

export function loadKnownCredentials(): Record<string, string> {
  // Purge the plaintext credential store written by earlier builds
  try {
    window.localStorage.removeItem(STORAGE_KEYS.CREDENTIALS);
  } catch {
    // ignore
  }
  return { ...DEFAULT_CREDENTIALS };
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
 * demo placeholders (non-UUID usr_* ids from older prototypes). Only the demo seed
 * accounts are hydrated with a password (in memory) for login-form auto-fill.
 */
export function loadStoredUsers(): StoredUserAccount[] {
  const loaded = safeLoad<StoredUserAccount[] | null>(STORAGE_KEYS.USERS, null);
  const creds = loadKnownCredentials();

  if (!loaded || loaded.length === 0) {
    const initial = INITIAL_REGISTERED_ACCOUNTS.map((u) => ({
      ...u,
      password: creds[u.email.toLowerCase()],
    }));
    saveStoredUsers(initial);
    return initial;
  }

  // Filter out any legacy unregistered mock accounts from older demo prototypes
  const registeredOnly = loaded.filter(
    (u) =>
      u.email.toLowerCase() === 'manager@agency.com' ||
      u.email.toLowerCase() === 'dev@agency.com' ||
      (!u.id.startsWith('usr_mgr_01') &&
        !u.id.startsWith('usr_dev_02') &&
        !u.id.startsWith('usr_dev_03') &&
        !u.id.startsWith('usr_dev_04'))
  );

  const listToUse = registeredOnly.length > 0 ? registeredOnly : INITIAL_REGISTERED_ACCOUNTS;

  const hydrated = listToUse.map((u) => ({
    ...u,
    password: creds[u.email.toLowerCase()],
  }));

  // Re-saving also scrubs passwords persisted by earlier builds
  saveStoredUsers(hydrated);
  return hydrated;
}

export function saveStoredUsers(users: StoredUserAccount[]): void {
  safeSave(
    STORAGE_KEYS.USERS,
    users.map(({ password: _pwd, ...publicUser }) => publicUser)
  );
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

  return { clients, projects };
}

/**
 * Time entries and expenses are no longer mirrored in localStorage (DEC-008): they are
 * loaded per screen from the paginated API. Removes the copies earlier builds stored
 * (several MB with realistic data volumes).
 */
export function purgeLegacyActivityCache(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEYS.TIME_ENTRIES);
    window.localStorage.removeItem(STORAGE_KEYS.EXPENSES);
  } catch {
    // ignore
  }
}

export function persistClients(clients: Client[]): void {
  safeSave(STORAGE_KEYS.CLIENTS, clients);
}

export function persistProjects(projects: Project[]): void {
  safeSave(STORAGE_KEYS.PROJECTS, projects);
}

export function resetWorkspaceToDefaults(): {
  users: StoredUserAccount[];
  clients: Client[];
  projects: Project[];
} {
  safeSave(STORAGE_KEYS.USERS, INITIAL_REGISTERED_ACCOUNTS);
  safeSave(STORAGE_KEYS.CLIENTS, INITIAL_CLIENTS);
  safeSave(STORAGE_KEYS.PROJECTS, INITIAL_PROJECTS);
  purgeLegacyActivityCache();
  return {
    users: INITIAL_REGISTERED_ACCOUNTS,
    clients: INITIAL_CLIENTS,
    projects: INITIAL_PROJECTS,
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

/**
 * Authenticates user credentials authoritatively against the Django backend API
 * (/api/v1/auth/login/). Saves JWT access & refresh tokens, loads authenticated user
 * profile with rate masking, and syncs the agency user directory.
 * There is no offline fallback: if the backend is unreachable, sign-in fails.
 */
export async function authenticateUserWithApi(
  email: string,
  password: string
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
          .map((apiUser) => {
            const existing = existingMap.get(apiUser.email.toLowerCase());
            return {
              ...apiUser,
              title: existing?.title || apiUser.title,
              password: creds[apiUser.email.toLowerCase()],
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

    return {
      ok: false,
      error:
        'Cannot connect to MarginWatch backend API at http://127.0.0.1:8000. Please ensure the Django backend is running.',
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
        .map((apiUser) => {
          const existing = existingMap.get(apiUser.email.toLowerCase());
          return {
            ...apiUser,
            title: existing?.title || apiUser.title,
            password: creds[apiUser.email.toLowerCase()],
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
  const initialPassword = input.password ?? '';

  try {
    const createdAccount = await apiClient.users.create({
      email: input.email.trim().toLowerCase(),
      password: initialPassword,
      first_name,
      last_name,
      role: input.role,
      default_hourly_cost_rate: input.default_hourly_cost,
    });

    let updatedUsers = loadStoredUsers();
    try {
      const apiUsers = await apiClient.users.list();
      if (apiUsers && apiUsers.length > 0) {
        const creds = loadKnownCredentials();
        updatedUsers = apiUsers
          .map((u) => {
            const isCreated = u.email.toLowerCase() === input.email.trim().toLowerCase();
            return {
              ...u,
              title: isCreated ? (input.title?.trim() || u.title) : u.title,
              password: creds[u.email.toLowerCase()],
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
        },
      ];
      saveStoredUsers(updatedUsers);
    }

    const currentProjects = safeLoad<Project[]>(STORAGE_KEYS.PROJECTS, INITIAL_PROJECTS);
    const shouldAssign = input.assign_to_active_projects ?? true;
    const assignedProjectIds = new Set<string>();
    if (shouldAssign) {
      for (const p of currentProjects) {
        if (p.status !== 'ACTIVE') continue;
        try {
          await apiClient.projects.assignMember(p.id, createdAccount.id);
          assignedProjectIds.add(p.id);
        } catch (assignErr) {
          console.warn(`Could not assign new member to project ${p.id}:`, assignErr);
        }
      }
    }
    const updatedProjects = currentProjects.map((p) =>
      assignedProjectIds.has(p.id)
        ? { ...p, assigned_member_ids: [...p.assigned_member_ids, createdAccount.id] }
        : p
    );
    persistProjects(updatedProjects);

    return {
      ok: true,
      createdUser: createdAccount,
      updatedUsers,
      updatedProjects,
    };
  } catch (err: any) {
    if (err instanceof ApiError && err.status > 0) {
      const field = err.fieldErrors.email
        ? 'email'
        : err.fieldErrors.password
        ? 'password'
        : err.fieldErrors.default_hourly_cost_rate
        ? 'default_hourly_cost'
        : 'root';
      const cleanError =
        err.fieldErrors[field === 'default_hourly_cost' ? 'default_hourly_cost_rate' : field] || err.message || 'Failed to create team member.';
      return {
        ok: false,
        field,
        errors: err.fieldErrors,
        error: cleanError,
      };
    }

    return {
      ok: false,
      field: 'root',
      error:
        'Cannot connect to MarginWatch backend API at http://127.0.0.1:8000. Please ensure the Django backend is running.',
    };
  }
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
    return {
      ok: false,
      error: err?.message || 'Could not save profile changes to the backend.',
    };
  }

  return updateUserProfile(userId, updates);
}

/**
 * Changes the signed-in user's password on the backend. The backend revokes all refresh
 * tokens on success, so we sign in again with the new password to keep this session alive.
 */
export async function changePasswordWithApi(
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: true; session: AuthSession } | { ok: false; field?: string; error: string }> {
  try {
    await apiClient.auth.changePassword(currentPassword, newPassword);
  } catch (err: any) {
    if (err instanceof ApiError) {
      const field = err.fieldErrors.current_password
        ? 'current_password'
        : err.fieldErrors.new_password
        ? 'new_password'
        : undefined;
      return { ok: false, field, error: (field && err.fieldErrors[field]) || err.message };
    }
    return { ok: false, error: err?.message || 'Could not change the password.' };
  }
  const login = await apiClient.auth.login(email, newPassword);
  saveActiveSession(login.session);
  return { ok: true, session: login.session };
}

// Client & Project API Integration Helpers

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

/**
 * Brings a project's active backend assignments in line with `memberIds`:
 * assigns newly selected members and revokes deselected ones.
 */
export async function syncProjectAssignmentsWithApi(
  projectId: string,
  memberIds: string[]
): Promise<void> {
  const active = await apiClient.projects.getAssignments(projectId);
  const activeByUser = new Map(active.map((a: any) => [String(a.user), String(a.id)]));
  const desired = new Set(memberIds);

  for (const userId of desired) {
    if (!activeByUser.has(userId)) {
      await apiClient.projects.assignMember(projectId, userId);
    }
  }
  for (const [userId, assignmentId] of activeByUser) {
    if (!desired.has(userId)) {
      await apiClient.projects.revokeAssignment(projectId, assignmentId);
    }
  }
}

/**
 * Creates or updates a project on the backend (including its team assignments).
 * Throws on failure instead of persisting locally, so the UI never shows unsaved changes.
 */
export async function saveProjectWithApi(
  projectData: Omit<Project, 'id' | 'updated_at'>,
  existingId?: string
): Promise<Project> {
  let saved: any;
  if (existingId) {
    await apiClient.projects.update(existingId, {
      name: projectData.name,
      currency: projectData.currency,
      status: projectData.status,
      deadline: projectData.deadline,
      contract_revenue: projectData.contract_revenue,
      planned_cost_budget: projectData.planned_cost_budget,
      planned_hourly_cost: projectData.planned_hourly_cost,
      estimated_remaining_hours: projectData.estimated_remaining_hours,
    });
    await syncProjectAssignmentsWithApi(existingId, projectData.assigned_member_ids);
    // Re-read so assigned_member_ids reflects the backend after assignment changes
    saved = await apiClient.projects.get(existingId);
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

// Time entries and expenses: written to the backend only. A failed request throws
// instead of falling back to local storage, so the UI never shows unsaved costs.

export function transformBackendTimeEntryToTimeEntry(backendEntry: any): TimeEntry {
  // hourly_cost_snapshot and computed_cost are masked by the backend for TEAM_MEMBER requests
  const snapshot = backendEntry.hourly_cost_snapshot;
  const cost = backendEntry.computed_cost;
  return {
    id: String(backendEntry.id),
    project_id: String(backendEntry.project),
    user_id: String(backendEntry.user_id || backendEntry.user),
    user_name: backendEntry.user_full_name || backendEntry.user_email || '',
    work_date: backendEntry.work_date,
    hours: parseFloat(backendEntry.recorded_hours),
    description: backendEntry.description || '',
    hourly_cost_snapshot: snapshot !== undefined && snapshot !== null ? parseFloat(snapshot) : 0,
    computed_cost: cost !== undefined && cost !== null ? parseFloat(cost) : 0,
    created_at: backendEntry.created_at || new Date().toISOString(),
  };
}

export function transformBackendExpenseToExpense(backendExpense: any): Expense {
  const status = backendExpense.status as ExpenseStatus;
  return {
    id: String(backendExpense.id),
    project_id: String(backendExpense.project),
    submitted_by_id: String(backendExpense.user_id || backendExpense.user),
    submitted_by_name: backendExpense.user_full_name || backendExpense.user_email || '',
    expense_date: backendExpense.expense_date,
    category: backendExpense.category as ExpenseCategory,
    amount: parseFloat(backendExpense.amount),
    description: backendExpense.description || '',
    status,
    rejection_reason: status === 'REJECTED' ? backendExpense.review_note || null : null,
    reviewed_by_name: backendExpense.reviewed_by_name || backendExpense.reviewed_by_email || null,
    reviewed_at: backendExpense.reviewed_at || null,
  };
}

export interface Page<T> {
  count: number;
  next: string | null;
  results: T[];
}

/** Query parameters for a page of a list endpoint; empty/undefined values are skipped. */
export function pageParams(page: number, pageSize: number, filters: Record<string, string | undefined> = {}): URLSearchParams {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.append(key, value);
  }
  return params;
}

export async function fetchTimeEntryPage(
  page: number,
  pageSize: number,
  filters: Record<string, string | undefined> = {}
): Promise<Page<TimeEntry>> {
  const res = await apiClient.timeEntries.page(pageParams(page, pageSize, { ordering: '-work_date', ...filters }));
  return { count: res.count, next: res.next, results: res.results.map(transformBackendTimeEntryToTimeEntry) };
}

export async function fetchExpensePage(
  page: number,
  pageSize: number,
  filters: Record<string, string | undefined> = {}
): Promise<Page<Expense>> {
  const res = await apiClient.expenses.page(pageParams(page, pageSize, { ordering: '-expense_date', ...filters }));
  return { count: res.count, next: res.next, results: res.results.map(transformBackendExpenseToExpense) };
}

export interface TimeEntrySummary {
  count: number;
  total_hours: number;
  /** Managers only (wage confidentiality); null for team members. */
  total_labor_cost: number | null;
  hours_by_project: Record<string, number>;
}

export interface ExpenseSummary {
  count: number;
  by_status: Record<'PENDING' | 'APPROVED' | 'REJECTED', { count: number; amount: number }>;
}

export const EMPTY_TIME_ENTRY_SUMMARY: TimeEntrySummary = {
  count: 0, total_hours: 0, total_labor_cost: null, hours_by_project: {},
};

export const EMPTY_EXPENSE_SUMMARY: ExpenseSummary = {
  count: 0,
  by_status: {
    PENDING: { count: 0, amount: 0 },
    APPROVED: { count: 0, amount: 0 },
    REJECTED: { count: 0, amount: 0 },
  },
};

export async function fetchTimeEntrySummary(filters: Record<string, string | undefined> = {}): Promise<TimeEntrySummary> {
  const res = await apiClient.timeEntries.summary(pageParams(1, 1, filters));
  const hours_by_project: Record<string, number> = {};
  for (const row of res.by_project || []) hours_by_project[String(row.project_id)] = Number(row.hours);
  return {
    count: res.count,
    total_hours: Number(res.total_hours),
    total_labor_cost: res.total_labor_cost !== undefined ? Number(res.total_labor_cost) : null,
    hours_by_project,
  };
}

export async function fetchExpenseSummary(filters: Record<string, string | undefined> = {}): Promise<ExpenseSummary> {
  const res = await apiClient.expenses.summary(pageParams(1, 1, filters));
  const by_status = { ...EMPTY_EXPENSE_SUMMARY.by_status };
  for (const status of ['PENDING', 'APPROVED', 'REJECTED'] as const) {
    const row = res.by_status?.[status];
    if (row) by_status[status] = { count: row.count, amount: Number(row.amount) };
  }
  return { count: res.count, by_status };
}

export async function createTimeEntryWithApi(data: {
  project_id: string;
  work_date: string;
  hours: number;
  description: string;
}): Promise<TimeEntry> {
  const saved = await apiClient.timeEntries.create({
    project_id: data.project_id,
    work_date: data.work_date,
    recorded_hours: data.hours,
    description: data.description,
  });
  return transformBackendTimeEntryToTimeEntry(saved);
}

export async function deleteTimeEntryWithApi(timeEntryId: string): Promise<void> {
  await apiClient.timeEntries.delete(timeEntryId);
}

export async function submitExpenseWithApi(data: {
  project_id: string;
  expense_date: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
}): Promise<Expense> {
  const saved = await apiClient.expenses.create(data);
  return transformBackendExpenseToExpense(saved);
}

export async function deleteExpenseWithApi(expenseId: string): Promise<void> {
  await apiClient.expenses.delete(expenseId);
}

export async function reviewExpenseWithApi(
  expenseId: string,
  action: 'APPROVE' | 'REJECT',
  reviewNote = ''
): Promise<Expense> {
  const reviewed = await apiClient.expenses.review(expenseId, action, reviewNote);
  return transformBackendExpenseToExpense(reviewed);
}
