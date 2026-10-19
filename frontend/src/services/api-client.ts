import { AiRiskAnalysis, AuthSession, StoredUserAccount, User, UserRole } from '../types/domain';

// Determine default API root.
// When using the Vite dev server, '/api/v1' is automatically proxied to http://127.0.0.1:8000.
// Alternatively, developers can specify VITE_API_BASE_URL (e.g., 'http://localhost:8000/api/v1').
const API_BASE_URL = (
  (import.meta as any).env?.VITE_API_BASE_URL || '/api/v1'
).replace(/\/+$/, '');

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'marginwatch_access_token',
  REFRESH_TOKEN: 'marginwatch_refresh_token',
} as const;

export interface BackendUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  default_hourly_cost_rate?: string | number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface LoginApiResponse {
  access: string;
  refresh: string;
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: UserRole;
  };
}

export class ApiError extends Error {
  public status: number;
  public data: any;
  public isAuthError: boolean;
  public fieldErrors: Record<string, string>;

  constructor(message: string, status: number, data: any = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.isAuthError = status === 401;
    this.fieldErrors = {};

    // Backend error envelope: {"error": {"code", "message", "details": [{"field", "issue"}]}}
    const details: Array<{ field: string | null; issue: string }> = data?.error?.details || [];
    for (const { field, issue } of details) {
      const key = field || 'root';
      if (!this.fieldErrors[key]) {
        this.fieldErrors[key] = issue;
      }
    }
  }
}

/**
 * Builds a user-facing message from the backend error envelope, preferring the first
 * field-level issue over the generic envelope message.
 */
function messageFromErrorEnvelope(errorData: any, status: number): string {
  const error = errorData?.error;
  const first = error?.details?.[0];
  if (first?.issue) {
    return first.field ? `${first.field}: ${first.issue}` : first.issue;
  }
  return error?.message || `API request failed with status ${status}`;
}

/**
 * Normalizes backend User representation into the frontend User domain model.
 * If requesting user is not a MANAGER, default_hourly_cost_rate is masked by backend.
 */
export function transformBackendUserToUser(backendUser: BackendUser): User {
  const firstName = backendUser.first_name || '';
  const lastName = backendUser.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim() || backendUser.email.split('@')[0];

  const parsedCost = backendUser.default_hourly_cost_rate != null
    ? Number(backendUser.default_hourly_cost_rate)
    : 0;

  return {
    id: String(backendUser.id),
    email: backendUser.email,
    full_name: fullName,
    role: backendUser.role,
    title:
      backendUser.role === 'MANAGER'
        ? 'Agency Delivery Manager'
        : 'Senior Software Engineer',
    default_hourly_cost: isNaN(parsedCost) ? 0 : parsedCost,
    created_at: backendUser.created_at,
  };
}

export function transformBackendUserToStoredUser(backendUser: BackendUser): StoredUserAccount {
  const user = transformBackendUserToUser(backendUser);
  return {
    ...user,
  };
}

// Global session expiry listener for app-wide sign out
type SessionExpiredHandler = () => void;
const sessionExpiredListeners: Set<SessionExpiredHandler> = new Set();

export function onApiSessionExpired(handler: SessionExpiredHandler): () => void {
  sessionExpiredListeners.add(handler);
  return () => {
    sessionExpiredListeners.delete(handler);
  };
}

function notifySessionExpired() {
  sessionExpiredListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error('Error in session expired listener:', e);
    }
  });
}

// In-flight refresh token mutex
let refreshPromise: Promise<string | null> | null = null;

export const apiClient = {
  getAccessToken(): string | null {
    try {
      return window.localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    } catch {
      return null;
    }
  },

  getRefreshToken(): string | null {
    try {
      return window.localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    } catch {
      return null;
    }
  },

  setTokens(access: string, refresh?: string): void {
    try {
      window.localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, access);
      if (refresh) {
        window.localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refresh);
      }
    } catch {
      // ignore quota errors
    }
  },

  clearTokens(): void {
    try {
      window.localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      window.localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    } catch {
      // ignore
    }
  },

  /**
   * Performs an HTTP request with automatic Bearer token injection
   * and auto-refresh on 401 responses.
   */
  async request<T>(
    endpoint: string,
    options: RequestInit & { skipAuth?: boolean } = {}
  ): Promise<T> {
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (!options.skipAuth) {
      const token = this.getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (err: any) {
      throw new ApiError(
        `Network error connecting to backend: ${err?.message || 'Server unreachable'}`,
        0,
        err
      );
    }

    // Handle token expiration & automatic refresh
    if (response.status === 401 && !options.skipAuth) {
      const refreshToken = this.getRefreshToken();
      if (refreshToken) {
        // Attempt to refresh the access token (with mutex for concurrent requests)
        const newAccessToken = await this.performTokenRefresh(refreshToken);

        if (newAccessToken) {
          // Retry the original request with the new access token
          headers['Authorization'] = `Bearer ${newAccessToken}`;
          const retryResponse = await fetch(url, {
            ...options,
            headers,
          });

          if (!retryResponse.ok) {
            const errorData = await retryResponse.json().catch(() => null);
            throw new ApiError(
              messageFromErrorEnvelope(errorData, retryResponse.status),
              retryResponse.status,
              errorData
            );
          }

          if (retryResponse.status === 204) {
            return undefined as unknown as T;
          }
          return await retryResponse.json();
        }
      }

      // If refresh is impossible or failed, clear tokens and notify
      this.clearTokens();
      notifySessionExpired();
      throw new ApiError('Session expired. Please log in again.', 401);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new ApiError(
        messageFromErrorEnvelope(errorData, response.status),
        response.status,
        errorData
      );
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return await response.json();
  },

  /**
   * Refreshes access token with in-flight request deduplication.
   */
  async performTokenRefresh(refreshToken: string): Promise<string | null> {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/auth/refresh/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh: refreshToken }),
          });

          if (!res.ok) {
            return null;
          }

          const data = await res.json();
          const newAccess = data.access_token || data.access;
          const newRefresh = data.refresh_token || data.refresh || refreshToken;

          if (newAccess) {
            this.setTokens(newAccess, newRefresh);
            return newAccess;
          }
          return null;
        } catch {
          return null;
        } finally {
          refreshPromise = null;
        }
      })();
    }
    return refreshPromise;
  },

  /**
   * Fetches every page of a paginated collection endpoint
   * ({count, next, previous, page_size, results}) and returns the combined rows.
   */
  async listAll<T>(endpoint: string, params?: URLSearchParams): Promise<T[]> {
    const query = new URLSearchParams(params);
    query.set('page_size', '100');
    const rows: T[] = [];
    for (let page = 1; ; page++) {
      query.set('page', String(page));
      const res = await apiClient.request<T[] | { next: string | null; results: T[] }>(
        `${endpoint}?${query.toString()}`
      );
      if (Array.isArray(res)) return res;
      rows.push(...(res?.results || []));
      if (!res?.next) return rows;
    }
  },

  // Auth Endpoints
  auth: {
    async login(
      email: string,
      password: string
    ): Promise<{
      user: User;
      session: AuthSession;
      raw: LoginApiResponse;
    }> {
      const payload = {
        email: email.trim().toLowerCase(),
        password,
      };

      const res = await apiClient.request<LoginApiResponse>('/auth/login/', {
        method: 'POST',
        body: JSON.stringify(payload),
        skipAuth: true,
      });

      const accessToken = res.access_token || res.access;
      const refreshToken = res.refresh_token || res.refresh;
      apiClient.setTokens(accessToken, refreshToken);

      // Fetch the full profile via /auth/me/ to get rate visibility / permissions
      let fullProfile: User;
      try {
        fullProfile = await apiClient.auth.getMe();
      } catch {
        fullProfile = {
          id: String(res.user.id),
          email: res.user.email,
          full_name: `${res.user.first_name || ''} ${res.user.last_name || ''}`.trim() || res.user.email,
          role: res.user.role,
          title: res.user.role === 'MANAGER' ? 'Agency Delivery Manager' : 'Senior Software Engineer',
          default_hourly_cost: res.user.role === 'MANAGER' ? 125 : 0,
        };
      }

      const session: AuthSession = {
        token: accessToken,
        refresh_token: refreshToken,
        user: fullProfile,
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        session_id: `sess_${Date.now().toString(36)}`,
      };

      return {
        user: fullProfile,
        session,
        raw: res,
      };
    },

    async getMe(): Promise<User> {
      const res = await apiClient.request<BackendUser>('/auth/me/');
      return transformBackendUserToUser(res);
    },

    async updateMe(data: {
      first_name?: string;
      last_name?: string;
    }): Promise<User> {
      const res = await apiClient.request<BackendUser>('/auth/me/', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      return transformBackendUserToUser(res);
    },

    async changePassword(currentPassword: string, newPassword: string): Promise<void> {
      await apiClient.request('/auth/change-password/', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
    },

    async logout(): Promise<void> {
      const refreshToken = apiClient.getRefreshToken();
      try {
        if (refreshToken) {
          await apiClient.request('/auth/logout/', {
            method: 'POST',
            body: JSON.stringify({ refresh: refreshToken }),
          });
        }
      } catch (err) {
        console.warn('Backend logout revocation notice:', err);
      } finally {
        apiClient.clearTokens();
      }
    },
  },

  // Users Directory Endpoints
  users: {
    async list(includeInactive = false): Promise<StoredUserAccount[]> {
      const params = new URLSearchParams();
      if (includeInactive) params.append('include_inactive', 'true');
      const list = await apiClient.listAll<BackendUser>('/users/', params);
      return list.map(transformBackendUserToStoredUser);
    },

    async get(id: string): Promise<User> {
      const user = await apiClient.request<BackendUser>(`/users/${id}/`);
      return transformBackendUserToUser(user);
    },

    async create(data: {
      email: string;
      password: string;
      first_name: string;
      last_name: string;
      role: UserRole;
      default_hourly_cost_rate?: number;
    }): Promise<StoredUserAccount> {
      const res = await apiClient.request<BackendUser>('/users/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return transformBackendUserToStoredUser(res);
    },

    async update(
      id: string,
      updates: Partial<{
        first_name: string;
        last_name: string;
        role: UserRole;
        default_hourly_cost_rate: number;
        is_active: boolean;
      }>
    ): Promise<StoredUserAccount> {
      const res = await apiClient.request<BackendUser>(`/users/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      return transformBackendUserToStoredUser(res);
    },

    async delete(id: string): Promise<void> {
      await apiClient.request<void>(`/users/${id}/`, {
        method: 'DELETE',
      });
    },
  },

  // Clients Directory Endpoints
  clients: {
    async list(includeArchived = true): Promise<any[]> {
      const params = new URLSearchParams();
      if (!includeArchived) params.append('is_archived', 'false');
      return apiClient.listAll<any>('/clients/', params);
    },

    async get(id: string): Promise<any> {
      return apiClient.request<any>(`/clients/${id}/`);
    },

    async create(data: {
      name: string;
      contact_name?: string;
      contact_email?: string;
      contact_phone?: string;
      notes?: string;
    }): Promise<any> {
      return apiClient.request<any>('/clients/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async update(id: string, updates: Record<string, any>): Promise<any> {
      return apiClient.request<any>(`/clients/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async archive(id: string): Promise<{ detail: string; is_archived: boolean }> {
      return apiClient.request<{ detail: string; is_archived: boolean }>(`/clients/${id}/`, {
        method: 'DELETE',
      });
    },
  },

  // Projects Delivery Endpoints
  projects: {
    async list(filters?: {
      client_id?: string;
      status?: string;
      is_archived?: boolean;
      search?: string;
    }): Promise<any[]> {
      const params = new URLSearchParams();
      if (filters?.client_id) params.append('client_id', filters.client_id);
      if (filters?.status && filters.status !== 'ALL') params.append('status', filters.status);
      if (filters?.is_archived !== undefined) params.append('is_archived', String(filters.is_archived));
      if (filters?.search) params.append('search', filters.search);

      return apiClient.listAll<any>('/projects/', params);
    },

    async get(id: string): Promise<any> {
      return apiClient.request<any>(`/projects/${id}/`);
    },

    async create(data: {
      client_id: string;
      name: string;
      description?: string;
      contract_revenue?: number;
      planned_cost_budget: number;
      planned_hourly_cost: number;
      currency?: string;
      estimated_remaining_hours?: number | null;
      expected_remaining_expenses?: number;
      status?: string;
      start_date?: string | null;
      deadline?: string | null;
      initial_member_ids?: string[];
    }): Promise<any> {
      return apiClient.request<any>('/projects/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async update(id: string, updates: Record<string, any>): Promise<any> {
      return apiClient.request<any>(`/projects/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async archive(id: string): Promise<{ detail: string; is_archived: boolean }> {
      return apiClient.request<{ detail: string; is_archived: boolean }>(`/projects/${id}/`, {
        method: 'DELETE',
      });
    },

    async getAssignments(projectId: string): Promise<any[]> {
      const res = await apiClient.request<any[]>(`/projects/${projectId}/assignments/`);
      return Array.isArray(res) ? res : [];
    },

    async assignMember(projectId: string, userId: string): Promise<any> {
      return apiClient.request<any>(`/projects/${projectId}/assignments/`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      });
    },

    async revokeAssignment(projectId: string, assignmentId: string): Promise<{ detail: string }> {
      return apiClient.request<{ detail: string }>(`/projects/${projectId}/assignments/${assignmentId}/`, {
        method: 'DELETE',
      });
    },
  },

  // Labor Time Entry Endpoints
  timeEntries: {
    /** One page of the paginated list (count/next/results); filters as query params. */
    async page(params: URLSearchParams): Promise<{ count: number; next: string | null; results: any[] }> {
      return apiClient.request(`/time-entries/?${params.toString()}`);
    },

    async summary(params: URLSearchParams = new URLSearchParams()): Promise<any> {
      return apiClient.request(`/time-entries/summary/?${params.toString()}`);
    },

    async list(filters?: { project_id?: string; date_from?: string; date_to?: string }): Promise<any[]> {
      const params = new URLSearchParams();
      if (filters?.project_id) params.append('project_id', filters.project_id);
      if (filters?.date_from) params.append('date_from', filters.date_from);
      if (filters?.date_to) params.append('date_to', filters.date_to);

      return apiClient.listAll<any>('/time-entries/', params);
    },

    async create(data: {
      project_id: string;
      work_date: string;
      recorded_hours: number;
      description: string;
    }): Promise<any> {
      return apiClient.request<any>('/time-entries/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async delete(id: string): Promise<void> {
      await apiClient.request<void>(`/time-entries/${id}/`, {
        method: 'DELETE',
      });
    },
  },

  // Direct Project Expense Endpoints
  expenses: {
    /** One page of the paginated list (count/next/results); filters as query params. */
    async page(params: URLSearchParams): Promise<{ count: number; next: string | null; results: any[] }> {
      return apiClient.request(`/expenses/?${params.toString()}`);
    },

    async summary(params: URLSearchParams = new URLSearchParams()): Promise<any> {
      return apiClient.request(`/expenses/summary/?${params.toString()}`);
    },

    async list(filters?: { project_id?: string; status?: string }): Promise<any[]> {
      const params = new URLSearchParams();
      if (filters?.project_id) params.append('project_id', filters.project_id);
      if (filters?.status) params.append('status', filters.status);

      return apiClient.listAll<any>('/expenses/', params);
    },

    async create(data: {
      project_id: string;
      category: string;
      amount: number;
      expense_date: string;
      description: string;
    }): Promise<any> {
      return apiClient.request<any>('/expenses/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async delete(id: string): Promise<void> {
      await apiClient.request<void>(`/expenses/${id}/`, {
        method: 'DELETE',
      });
    },

    async review(id: string, action: 'APPROVE' | 'REJECT', reviewNote = ''): Promise<any> {
      return apiClient.request<any>(`/expenses/${id}/review/`, {
        method: 'POST',
        body: JSON.stringify({ action, review_note: reviewNote }),
      });
    },
  },

  // Financial engine endpoints (managers only)
  financials: {
    async projectSummary(projectId: string): Promise<any> {
      return apiClient.request<any>(`/projects/${projectId}/financial-summary/`);
    },

    async listSummaries(params?: URLSearchParams): Promise<any[]> {
      return apiClient.listAll<any>('/projects/financial-summaries/', params);
    },

    async dashboard(currency = 'USD'): Promise<any> {
      return apiClient.request<any>(
        `/dashboard/summary/?currency=${encodeURIComponent(currency)}`
      );
    },
  },

  // AI Risk Advisor (Manager only; advisory, never changes figures)
  ai: {
    async analyzeProject(projectId: string): Promise<AiRiskAnalysis> {
      return apiClient.request<AiRiskAnalysis>(`/projects/${projectId}/ai-risk-analysis/`, {
        method: 'POST',
      });
    },
  },

  /**
   * Health check to detect whether the Django backend server is running and reachable.
   */
  async checkBackendHealth(): Promise<{ reachable: boolean; status?: number; error?: string }> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${API_BASE_URL}/auth/me/`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      // Status 401 or 200 means backend is online and running
      return { reachable: res.status === 401 || res.status === 200, status: res.status };
    } catch (err: any) {
      return { reachable: false, error: err?.message || 'Server unreachable' };
    }
  },
};
