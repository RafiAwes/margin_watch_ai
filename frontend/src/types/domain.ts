export type UserRole = 'MANAGER' | 'TEAM_MEMBER';

export type CurrencyCode = 'USD' | 'EUR' | 'GBP';

export type ClientStatus = 'ACTIVE' | 'ARCHIVED';

export type ProjectStatus = 'DRAFT' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

export type ProjectRiskStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'INCOMPLETE_DATA';

export type ExpenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type ExpenseCategory = 'SUBCONTRACTOR' | 'SOFTWARE_LICENSE' | 'HARDWARE' | 'TRAVEL' | 'OTHER';

export type SimulationStateMode =
  | 'NORMAL'
  | 'LOADING_SKELETON'
  | 'EMPTY_ZERO_DATA'
  | 'NETWORK_ERROR'
  | 'PERMISSION_DENIED_403';

export interface UserNotificationPreferences {
  budget_threshold_alerts: boolean;
  expense_status_updates: boolean;
  missing_estimate_reminders: boolean;
  weekly_margin_digest: boolean;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  title: string;
  default_hourly_cost: number;
  department?: string;
  timezone?: string;
  phone?: string;
  bio?: string;
  created_at?: string;
  last_login_at?: string;
  notification_preferences?: UserNotificationPreferences;
}

export interface StoredUserAccount extends User {
  password?: string;
}

export interface AuthSession {
  token: string;
  refresh_token?: string;
  user: User;
  issued_at: string;
  expires_at?: string;
  session_id?: string;
}

export interface Client {
  id: string;
  name: string;
  contact_name: string;
  contact_email: string;
  default_currency: CurrencyCode;
  status: ClientStatus;
  notes: string;
  created_at: string;
}

export interface Project {
  id: string;
  client_id: string;
  name: string;
  currency: CurrencyCode;
  status: ProjectStatus;
  deadline: string | null;
  contract_revenue: number;
  planned_cost_budget: number;
  planned_hourly_cost: number;
  /**
   * CRITICAL DOMAIN RULE:
   * `null` means remaining hours are unknown/unestimated (NEVER coerce to 0).
   * `0` explicitly means all delivery work is finished and 0 hours remain.
   */
  estimated_remaining_hours: number | null;
  assigned_member_ids: string[];
  updated_at: string;
}

export interface ProjectFinancials {
  actual_hours_logged: number;
  actual_labor_cost: number;
  actual_expense_cost: number;
  pending_expense_amount: number;
  rejected_expense_amount: number;
  actual_total_cost: number;
  budget_consumed_pct: number;
  projected_remaining_cost: number | null;
  projected_final_cost: number | null;
  projected_cost_variance: number | null;
  projected_profit: number | null;
  projected_margin_pct: number | null;
  planned_profit: number;
  planned_margin_pct: number;
  risk_status: ProjectRiskStatus;
  risk_reasons: string[];
}

export interface EnrichedProject extends Project {
  client_name: string;
  financials: ProjectFinancials;
}

export interface TimeEntry {
  id: string;
  project_id: string;
  user_id: string;
  user_name: string;
  work_date: string;
  hours: number;
  description: string;
  /**
   * Captured automatically by the backend when the time entry is recorded.
   * Never editable as a raw field by the user.
   */
  hourly_cost_snapshot: number;
  computed_cost: number;
  created_at: string;
}

export interface Expense {
  id: string;
  project_id: string;
  submitted_by_id: string;
  submitted_by_name: string;
  expense_date: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  status: ExpenseStatus;
  rejection_reason: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
}

export interface AiSuggestedAction {
  id: string;
  title: string;
  rationale: string;
  estimated_impact: string;
  action_type: 'REVIEW_EXPENSES' | 'UPDATE_ESTIMATE' | 'SCOPE_REVIEW' | 'RATE_AUDIT';
}

export interface AiRiskAnalysis {
  project_id: string;
  generated_at: string;
  deterministic_risk_status: ProjectRiskStatus;
  deterministic_drivers: string[];
  ai_summary: string;
  suggested_actions: AiSuggestedAction[];
  assumptions: string[];
  missing_data_warnings: string[];
}
