import { AuthSession, StoredUserAccount, User, UserRole } from '../types/domain';

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

  constructor(message: string, status: number, data: any = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.isAuthError = status === 401;
  }
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
    password: '••••••••',
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
              errorData?.detail || `API error with status ${retryResponse.status}`,
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
      let errorMsg = `API request failed with status ${response.status}`;
      if (errorData) {
        if (typeof errorData.detail === 'string') {
          errorMsg = errorData.detail;
        } else if (typeof errorData === 'object') {
          // Format validation errors nicely
          const firstKey = Object.keys(errorData)[0];
          const firstVal = errorData[firstKey];
          if (Array.isArray(firstVal) && firstVal.length > 0) {
            errorMsg = `${firstKey}: ${firstVal[0]}`;
          } else if (typeof firstVal === 'string') {
            errorMsg = `${firstKey}: ${firstVal}`;
          }
        }
      }
      throw new ApiError(errorMsg, response.status, errorData);
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

  // Auth Endpoints
  auth: {
    async register(data: {
      email: string;
      password: string;
      first_name?: string;
      last_name?: string;
      role?: UserRole;
      default_hourly_cost_rate?: number;
    }): Promise<{
      user: User;
      session: AuthSession;
      raw: LoginApiResponse;
    }> {
      const payload = {
        email: data.email.trim().toLowerCase(),
        password: data.password,
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        role: data.role || 'TEAM_MEMBER',
        default_hourly_cost_rate: data.default_hourly_cost_rate ?? 0,
      };

      const res = await apiClient.request<LoginApiResponse>('/auth/register/', {
        method: 'POST',
        body: JSON.stringify(payload),
        skipAuth: true,
      });

      const accessToken = res.access_token || res.access;
      const refreshToken = res.refresh_token || res.refresh;
      apiClient.setTokens(accessToken, refreshToken);

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
          default_hourly_cost: res.user.role === 'MANAGER' ? (data.default_hourly_cost_rate || 125) : 0,
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
      const query = includeInactive ? '?include_inactive=true' : '';
      const list = await apiClient.request<BackendUser[]>(`/users/${query}`);
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
