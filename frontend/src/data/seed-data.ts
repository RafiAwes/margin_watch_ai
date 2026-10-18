import {
  AiRiskAnalysis,
  Client,
  Expense,
  Project,
  TimeEntry,
  User,
} from '../types/domain';

export const DEMO_USERS: Record<'MANAGER' | 'TEAM_MEMBER', User> = {
  MANAGER: {
    id: 'usr_mgr_01',
    email: 'alex.morgan@vanguard-agency.io',
    full_name: 'Alex Morgan',
    role: 'MANAGER',
    title: 'Principal Delivery Director',
    default_hourly_cost: 135,
  },
  TEAM_MEMBER: {
    id: 'usr_dev_02',
    email: 'elena.rostova@vanguard-agency.io',
    full_name: 'Elena Rostova',
    role: 'TEAM_MEMBER',
    title: 'Senior Full-Stack Engineer',
    default_hourly_cost: 115,
  },
};

export const TEAM_DIRECTORY: User[] = [
  DEMO_USERS.MANAGER,
  DEMO_USERS.TEAM_MEMBER,
  {
    id: 'usr_mgr_backend',
    email: 'manager@agency.com',
    full_name: 'Sarah Connor',
    role: 'MANAGER',
    title: 'Agency Operations Director',
    default_hourly_cost: 125,
  },
  {
    id: 'usr_dev_backend',
    email: 'dev@agency.com',
    full_name: 'Alex Mercer',
    role: 'TEAM_MEMBER',
    title: 'Senior Software Engineer',
    default_hourly_cost: 65,
  },
  {
    id: 'usr_dev_03',
    email: 'marcus.chen@vanguard-agency.io',
    full_name: 'Marcus Chen',
    role: 'TEAM_MEMBER',
    title: 'Staff Backend Engineer',
    default_hourly_cost: 125,
  },
  {
    id: 'usr_dev_04',
    email: 'priya.nair@vanguard-agency.io',
    full_name: 'Priya Nair',
    role: 'TEAM_MEMBER',
    title: 'Product Designer & Accessibility Lead',
    default_hourly_cost: 110,
  },
];

export const INITIAL_CLIENTS: Client[] = [];

export const INITIAL_PROJECTS: Project[] = [];

export const INITIAL_TIME_ENTRIES: TimeEntry[] = [
  // prj_01 (Core Settlement Ledger v2 Migration) -> 460 hrs logged = $56,200 labor
  {
    id: 'te_101',
    project_id: 'prj_01',
    user_id: 'usr_dev_02',
    user_name: 'Elena Rostova',
    work_date: '2026-10-16',
    hours: 7.5,
    description: 'Implemented idempotent double-entry journal batching and deadlock retry handlers.',
    hourly_cost_snapshot: 115,
    computed_cost: 862.5,
    created_at: '2026-10-16T18:10:00Z',
  },
  {
    id: 'te_102',
    project_id: 'prj_01',
    user_id: 'usr_dev_03',
    user_name: 'Marcus Chen',
    work_date: '2026-10-15',
    hours: 8.0,
    description: 'Rebuilt PostgreSQL partitioning migration scripts for high-volume settlement tables.',
    hourly_cost_snapshot: 125,
    computed_cost: 1000.0,
    created_at: '2026-10-15T17:45:00Z',
  },
  {
    id: 'te_103',
    project_id: 'prj_01',
    user_id: 'usr_mgr_01',
    user_name: 'Alex Morgan',
    work_date: '2026-10-12',
    hours: 120.0,
    description: 'Sprint 1–4 architecture oversight, security audit remediation, and ledger schema design.',
    hourly_cost_snapshot: 135,
    computed_cost: 16200.0,
    created_at: '2026-10-12T16:00:00Z',
  },
  {
    id: 'te_104',
    project_id: 'prj_01',
    user_id: 'usr_dev_02',
    user_name: 'Elena Rostova',
    work_date: '2026-10-08',
    hours: 320.0,
    description: 'Core settlement engine API endpoints, ISO-20022 parser, and integration test suite.',
    hourly_cost_snapshot: 115,
    computed_cost: 36800.0,
    created_at: '2026-10-08T19:00:00Z',
  },

  // prj_02 (FHIR Patient Telemetry Portal) -> $43,800 labor
  {
    id: 'te_201',
    project_id: 'prj_02',
    user_id: 'usr_dev_02',
    user_name: 'Elena Rostova',
    work_date: '2026-10-16',
    hours: 6.25,
    description: 'Built HL7 FHIR Observation stream consumer and WebSocket chart normalizer.',
    hourly_cost_snapshot: 115,
    computed_cost: 718.75,
    created_at: '2026-10-16T15:30:00Z',
  },
  {
    id: 'te_202',
    project_id: 'prj_02',
    user_id: 'usr_dev_04',
    user_name: 'Priya Nair',
    work_date: '2026-10-14',
    hours: 160.0,
    description: 'Clinical telemetry interface design, WCAG 2.2 AA contrast audit, and clinician user testing.',
    hourly_cost_snapshot: 110,
    computed_cost: 17600.0,
    created_at: '2026-10-14T18:00:00Z',
  },
  {
    id: 'te_203',
    project_id: 'prj_02',
    user_id: 'usr_dev_02',
    user_name: 'Elena Rostova',
    work_date: '2026-10-05',
    hours: 220.0,
    description: 'RBAC clinician auth gateway, audit logging, and encrypted patient chart views.',
    hourly_cost_snapshot: 115,
    computed_cost: 25300.0,
    created_at: '2026-10-05T17:00:00Z',
  },

  // prj_03 (Customs Tariff Rules Engine) -> $21,250 labor (Missing remaining hours estimate)
  {
    id: 'te_301',
    project_id: 'prj_03',
    user_id: 'usr_dev_03',
    user_name: 'Marcus Chen',
    work_date: '2026-10-15',
    hours: 170.0,
    description: 'Harmonized System (HS) tariff lookup tree and multi-jurisdiction duty evaluator.',
    hourly_cost_snapshot: 125,
    computed_cost: 21250.0,
    created_at: '2026-10-15T12:00:00Z',
  },

  // prj_04 (Automated Reconciliation Webhook Suite) -> $14,950 labor (Healthy)
  {
    id: 'te_401',
    project_id: 'prj_04',
    user_id: 'usr_dev_02',
    user_name: 'Elena Rostova',
    work_date: '2026-10-17',
    hours: 5.5,
    description: 'Configured HMAC signature verification and dead-letter queue replay CLI.',
    hourly_cost_snapshot: 115,
    computed_cost: 632.5,
    created_at: '2026-10-17T09:30:00Z',
  },
  {
    id: 'te_402',
    project_id: 'prj_04',
    user_id: 'usr_dev_02',
    user_name: 'Elena Rostova',
    work_date: '2026-10-10',
    hours: 124.5,
    description: 'Webhook ingestion pipeline, schema validators, and partner sandbox harness.',
    hourly_cost_snapshot: 115,
    computed_cost: 14317.5,
    created_at: '2026-10-10T17:00:00Z',
  },

  // prj_05 (Completed project)
  {
    id: 'te_501',
    project_id: 'prj_05',
    user_id: 'usr_dev_03',
    user_name: 'Marcus Chen',
    work_date: '2026-06-20',
    hours: 210.0,
    description: 'Full warehouse inventory sync service and cutover deployment.',
    hourly_cost_snapshot: 120,
    computed_cost: 25200.0,
    created_at: '2026-06-20T17:00:00Z',
  },
];

export const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'exp_01',
    project_id: 'prj_01',
    submitted_by_id: 'usr_dev_03',
    submitted_by_name: 'Marcus Chen',
    expense_date: '2026-10-11',
    category: 'INFRASTRUCTURE',
    amount: 4850.0,
    description: 'Dedicated AWS RDS Multi-AZ load-testing cluster for 50k TPS settlement benchmark.',
    status: 'APPROVED',
    rejection_reason: null,
    reviewed_by_name: 'Alex Morgan',
    reviewed_at: '2026-10-12',
  },
  {
    id: 'exp_02',
    project_id: 'prj_01',
    submitted_by_id: 'usr_dev_02',
    submitted_by_name: 'Elena Rostova',
    expense_date: '2026-10-16',
    category: 'CONTRACTOR',
    amount: 3400.0,
    description: 'External penetration testing audit on ISO-20022 settlement payload parser.',
    status: 'PENDING',
    rejection_reason: null,
    reviewed_by_name: null,
    reviewed_at: null,
  },
  {
    id: 'exp_03',
    project_id: 'prj_02',
    submitted_by_id: 'usr_dev_04',
    submitted_by_name: 'Priya Nair',
    expense_date: '2026-10-13',
    category: 'SOFTWARE',
    amount: 2100.0,
    description: 'HIPAA-compliant synthetic patient telemetry dataset license (Q4 testing).',
    status: 'APPROVED',
    rejection_reason: null,
    reviewed_by_name: 'Alex Morgan',
    reviewed_at: '2026-10-14',
  },
  {
    id: 'exp_04',
    project_id: 'prj_02',
    submitted_by_id: 'usr_dev_02',
    submitted_by_name: 'Elena Rostova',
    expense_date: '2026-10-16',
    category: 'INFRASTRUCTURE',
    amount: 1450.0,
    description: 'Dedicated staging FHIR sandbox environment for hospital IT sign-off.',
    status: 'PENDING',
    rejection_reason: null,
    reviewed_by_name: null,
    reviewed_at: null,
  },
  {
    id: 'exp_05',
    project_id: 'prj_03',
    submitted_by_id: 'usr_dev_03',
    submitted_by_name: 'Marcus Chen',
    expense_date: '2026-10-14',
    category: 'SOFTWARE',
    amount: 980.0,
    description: 'Global WCO Harmonized Tariff Schedule commercial API data feed.',
    status: 'PENDING',
    rejection_reason: null,
    reviewed_by_name: null,
    reviewed_at: null,
  },
  {
    id: 'exp_06',
    project_id: 'prj_01',
    submitted_by_id: 'usr_dev_02',
    submitted_by_name: 'Elena Rostova',
    expense_date: '2026-10-09',
    category: 'TRAVEL',
    amount: 620.0,
    description: 'First-class rail upgrade for onsite workshop without prior client pre-approval.',
    status: 'REJECTED',
    rejection_reason:
      'Client contract caps travel reimbursement at standard coach fare. Please re-submit at the $280.00 standard rate with itemized receipt.',
    reviewed_by_name: 'Alex Morgan',
    reviewed_at: '2026-10-10',
  },
];

export const AI_ADVISOR_DATA: Record<string, AiRiskAnalysis> = {
  prj_01: {
    project_id: 'prj_01',
    generated_at: '2026-10-17T10:15:00Z',
    deterministic_risk_status: 'CRITICAL',
    deterministic_drivers: [
      'Actual delivery cost ($59,712.50) has consumed 93.3% of the $64,000.00 planned cost budget.',
      'With 110.00 estimated remaining hours at $125.00/hr ($13,750.00), Projected Final Cost reaches $73,462.50 (+$9,462.50 / +14.8% over budget).',
      'An additional $3,400.00 in Pending expenses awaits review; if approved, projected overrun increases to +$12,862.50.',
    ],
    ai_summary:
      'Core Settlement Ledger v2 Migration is experiencing late-stage labor expansion driven by PostgreSQL partitioning rewrites and double-entry deadlock hardening. At the current blended rate of $125.00/hr, completing the 110 estimated remaining hours will exceed the planned delivery budget by $9,462.50 and compress commercial project margin from the planned 32.6% down to 22.7% (or 19.1% if the pending $3,400.00 security contractor expense is approved).',
    suggested_actions: [
      {
        id: 'act_1',
        title: 'Audit the $3,400.00 Pending Security Contractor Expense for Client Pass-Through',
        rationale:
          'External penetration testing for ISO-20022 compliance is frequently billable as a direct client pass-through under enterprise FinTech MSAs rather than absorbed into internal agency delivery budget.',
        estimated_impact: 'Preserves $3,400.00 in agency delivery budget (+3.6% margin protection).',
        action_type: 'REVIEW_EXPENSES',
      },
      {
        id: 'act_2',
        title: 'De-scope Non-Blocking Historical Ledger Archive Backfill to Phase 2 Retainer',
        rationale:
          'Approximately 45 of the 110 remaining hours involve historical pre-2024 ledger migration that is not required for the Nov 5 go-live cutover.',
        estimated_impact: 'Reduces remaining delivery cost by ~$5,625.00 (45 hrs @ $125/hr).',
        action_type: 'SCOPE_REVIEW',
      },
      {
        id: 'act_3',
        title: 'Shift Remaining Integration Testing from Principal ($135/hr) to Senior Engineer ($115/hr)',
        rationale:
          'Alex Morgan has logged 120.00 hours at $135.00/hr. Transitioning final QA harness verification to Elena Rostova lowers the effective burn rate on remaining hours.',
        estimated_impact: 'Saves ~$1,100.00 across remaining test execution effort.',
        action_type: 'RATE_AUDIT',
      },
    ],
    assumptions: [
      'Assumes the $3,400.00 Pending contractor expense and $620.00 Rejected travel expense are currently excluded from Actual Cost ($59,712.50).',
      'Values the 110.00 estimated remaining hours at the project planned rate of $125.00/hr.',
    ],
    missing_data_warnings: [],
  },
  prj_02: {
    project_id: 'prj_02',
    generated_at: '2026-10-17T10:15:00Z',
    deterministic_risk_status: 'WARNING',
    deterministic_drivers: [
      'Actual delivery cost ($45,718.75) has reached 87.9% of the $52,000.00 planned budget (above the 85.0% Warning threshold).',
      'Projected final cost ($53,518.75 based on 65.00 remaining hours @ $120.00/hr) exceeds planned budget by +$1,518.75 (+2.9%).',
    ],
    ai_summary:
      'FHIR Patient Telemetry Portal is near its planned budget ceiling after intensive clinician UX and accessibility testing (160.00 hrs). The projected overrun is currently modest (+$1,518.75), but a pending $1,450.00 staging infrastructure expense could push total projected cost to $54,968.75 (+5.7% overrun) if approved without offset.',
    suggested_actions: [
      {
        id: 'act_201',
        title: 'Review Pending $1,450.00 Staging FHIR Sandbox Expense Before Approval',
        rationale:
          'Verify whether the staging cluster can be torn down immediately after hospital IT sign-off to prorate cloud spend.',
        estimated_impact: 'Avoids up to $800.00 in recurring staging infrastructure cost.',
        action_type: 'REVIEW_EXPENSES',
      },
      {
        id: 'act_202',
        title: 'Timebox Final HL7 Stream Edge-Case Refinements to 50 Hours',
        rationale:
          'Trimming remaining engineering buffer from 65.00 hrs to 50.00 hrs brings Projected Final Cost to $51,718.75 (under the $52,000.00 budget).',
        estimated_impact: 'Eliminates the $1,518.75 projected overrun and restores Healthy status.',
        action_type: 'UPDATE_ESTIMATE',
      },
    ],
    assumptions: [
      'Excludes $1,450.00 in Pending infrastructure expenses until Manager approval.',
    ],
    missing_data_warnings: [],
  },
  prj_03: {
    project_id: 'prj_03',
    generated_at: '2026-10-17T10:15:00Z',
    deterministic_risk_status: 'INCOMPLETE_DATA',
    deterministic_drivers: [
      'Estimated remaining hours are currently null (unestimated).',
      'Actual labor cost to date is $21,250.00 (47.2% of $45,000.00 planned budget), with $980.00 in Pending expenses.',
    ],
    ai_summary:
      'Customs Tariff Rules Engine has consumed 47.2% of its planned delivery budget ($21,250.00 across 170.00 logged hours), but no final cost or margin forecast can be computed because estimated remaining hours have not been entered. Supplying an updated effort estimate is required to verify whether the Dec 10 deadline is achievable within the remaining $23,750.00 budget.',
    suggested_actions: [
      {
        id: 'act_301',
        title: 'Enter Estimated Remaining Hours with Lead Engineer Marcus Chen',
        rationale:
          'At the $120.00/hr planned rate, the project can afford at most 197.90 additional hours (or 189.75 hours if the $980.00 pending software expense is approved) before breaching the $45,000.00 budget.',
        estimated_impact: 'Unlocks deterministic Projected Final Cost and Margin forecasting.',
        action_type: 'UPDATE_ESTIMATE',
      },
      {
        id: 'act_302',
        title: 'Review Pending $980.00 WCO Tariff Data Feed Expense',
        rationale:
          'Approve or reject the pending API data feed expense so actual non-labor cost reflects committed spend.',
        estimated_impact: 'Clarifies remaining labor budget ceiling.',
        action_type: 'REVIEW_EXPENSES',
      },
    ],
    assumptions: [
      'Cannot assume 0 remaining hours; forecast metrics remain intentionally withheld until estimate is entered.',
    ],
    missing_data_warnings: [
      'Missing required forecast input: estimated_remaining_hours is null.',
    ],
  },
  prj_04: {
    project_id: 'prj_04',
    generated_at: '2026-10-17T10:15:00Z',
    deterministic_risk_status: 'HEALTHY',
    deterministic_drivers: [
      'Actual delivery cost ($14,950.00) is 41.5% of the $36,000.00 planned cost budget.',
      'Projected final cost ($25,300.00 including 90.00 remaining hours @ $115.00/hr) is $10,700.00 under budget.',
    ],
    ai_summary:
      'Automated Reconciliation Webhook Suite is tracking well under its planned delivery budget. With 130.00 hours logged ($14,950.00) and 90.00 hours estimated remaining ($10,350.00), the project is forecast to complete at $25,300.00, delivering a 53.1% commercial margin vs. the 33.3% planned target.',
    suggested_actions: [
      {
        id: 'act_401',
        title: 'Maintain Weekly Estimate Cadence Through Partner Sandbox Sign-Off',
        rationale:
          'Webhook retry edge cases during partner integration are the primary remaining risk factor prior to the Dec 18 deadline.',
        estimated_impact: 'Protects current $10,700.00 favorable budget variance.',
        action_type: 'UPDATE_ESTIMATE',
      },
    ],
    assumptions: [
      'Assumes remaining 90.00 hours execute at the $115.00/hr planned rate with zero pending expenses.',
    ],
    missing_data_warnings: [],
  },
};

export interface BlueprintMilestone {
  number: number;
  title: string;
  objective: string;
  files: string[];
  verificationGate: string;
}

export const IMPLEMENTATION_MILESTONES: BlueprintMilestone[] = [
  {
    number: 1,
    title: 'Audit Existing Frontend & Finalize Design System',
    objective: 'Establish 60-30-10 color tokens, Plus Jakarta Sans / Public Sans / JetBrains Mono typography, and null-safe financial formatters.',
    files: ['src/app/globals.css', 'src/lib/formatters.ts', 'src/types/api.ts'],
    verificationGate: 'formatCurrency(null) returns "Forecast Unavailable"; all tokens pass WCAG 2.2 AA contrast.',
  },
  {
    number: 2,
    title: 'Initialize & Verify the Frontend Toolchain',
    objective: 'Configure Next.js App Router, strict TypeScript, Tailwind CSS, shadcn/ui primitives, TanStack Query, RHF, Zod, and Sonner.',
    files: ['src/providers/query-provider.tsx', 'src/app/layout.tsx', 'src/components/ui/*'],
    verificationGate: 'npm run lint, tsc --noEmit, and production build pass with zero errors.',
  },
  {
    number: 3,
    title: 'Build the Reusable Application Shell & Navigation',
    objective: 'Implement role-aware SidebarNav, 3-zone TopBar with breadcrumbs, MobileNavDrawer, and multi-cue status badges.',
    files: ['src/components/layout/app-shell.tsx', 'src/components/shared/risk-status-badge.tsx'],
    verificationGate: 'Skip-to-content link works; mobile sticky header <= 56px; status badges include icon + text.',
  },
  {
    number: 4,
    title: 'Implement Login & Protected Application Routes',
    objective: 'Connect Django session/JWT auth, protect workspace routes via middleware & server layout, and enforce 403 role gates.',
    files: ['src/middleware.ts', 'src/features/auth/components/login-form.tsx', 'src/app/(auth)/login/page.tsx'],
    verificationGate: 'Unauthenticated users redirect with returnTo; Team Members blocked from /clients and /projects/new.',
  },
  {
    number: 5,
    title: 'Implement Shared Forms, Feedback Patterns & API Foundations',
    objective: 'Build typed apiClient with 10s/25s AbortController timeouts, Query Key Factory, server 400 field-error mapper, and 15 application states.',
    files: ['src/lib/api-client.ts', 'src/lib/query-keys.ts', 'src/lib/form-error-mapper.ts'],
    verificationGate: 'Server 400 field_errors map directly to inputs without erasing user values.',
  },
  {
    number: 6,
    title: 'Implement Client Management Workflows',
    objective: 'Build /clients list, search, /clients/new, /clients/[id] detail with related projects, and archive constraint dialog.',
    files: ['src/features/clients/components/client-list-table.tsx', 'src/features/clients/components/client-form.tsx'],
    verificationGate: 'Clients with ACTIVE projects cannot be archived; archive requires AlertDialog confirmation.',
  },
  {
    number: 7,
    title: 'Implement Project List, Creation, Editing & Detail Views',
    objective: 'Build /projects table + mobile cards, two-section ProjectForm with explicit null estimate toggle, and /projects/[id] workspace.',
    files: ['src/features/projects/components/project-form.tsx', 'src/features/projects/components/project-financial-strip.tsx'],
    verificationGate: 'Unknown remaining hours serialize as null (never 0) and display "Forecast Unavailable".',
  },
  {
    number: 8,
    title: 'Implement Time-Entry Workflows',
    objective: 'Build decimal hour logging (0.25–24.00 hrs), time history pagination, and automatic financial summary invalidation.',
    files: ['src/lib/validators/time-entry-schema.ts', 'src/features/time-entries/components/time-entry-form-dialog.tsx'],
    verificationGate: 'hourly_cost_snapshot is server-controlled; logging hours immediately updates Actual Cost.',
  },
  {
    number: 9,
    title: 'Implement Expense Workflows & Manager Approval Controls',
    objective: 'Build expense submission, PENDING/APPROVED/REJECTED badges, accounting disclosures, and Manager Approve/Reject modals.',
    files: ['src/features/expenses/components/expense-table.tsx', 'src/features/expenses/components/reject-expense-dialog.tsx'],
    verificationGate: 'Only APPROVED expenses add to Actual Cost; Reject requires a 5–300 char rejection_reason.',
  },
  {
    number: 10,
    title: 'Implement Financial Dashboards & Project Summaries',
    objective: 'Build decision-first /dashboard (5 KPIs, At-Risk Watchlist, Pending Approvals, Budget vs Forecast SVG chart + table toggle).',
    files: ['src/features/dashboard/components/manager-dashboard.tsx', 'src/features/projects/components/budget-forecast-chart.tsx'],
    verificationGate: 'Portfolio margin calculated from summed revenue & projected cost of forecastable projects.',
  },
  {
    number: 11,
    title: 'Implement the AI Risk Advisor Interface',
    objective: 'Build isolated <AiRiskAdvisorPanel /> with deterministic drivers, AI explanation, 2–4 interventions, assumptions, and retry state.',
    files: ['src/features/projects/components/ai-risk-advisor-panel.tsx', 'src/lib/validators/ai-advisor-schema.ts'],
    verificationGate: 'AI timeout/failure never breaks deterministic financial cards; clear non-authoritative framing.',
  },
  {
    number: 12,
    title: 'Complete Accessibility, Responsive, Error-State & Regression Testing',
    objective: 'Audit keyboard navigation, WCAG 2.2 AA contrast, 375px/768px/1440px viewports, and Vitest/RTL/Playwright test suites.',
    files: ['src/lib/__tests__/formatters.test.ts', 'e2e/marginwatch-critical-journeys.spec.ts'],
    verificationGate: '100% pass across all 12 QA checklist categories in docs/frontend/testing-and-acceptance.md.',
  },
  {
    number: 13,
    title: 'Prepare the Demo & Documentation Defense',
    objective: 'Verify realistic agency portfolio seed states and rehearse technical defense of financial formulas and architecture.',
    files: ['README.md', 'docs/frontend/*.md'],
    verificationGate: 'Clean production build and complete walkthrough of Critical Journeys 1, 2, and 3.',
  },
];
