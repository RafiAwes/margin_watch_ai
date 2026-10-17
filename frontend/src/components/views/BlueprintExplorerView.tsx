import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Code2,
  FileText,
  Layers,
  Palette,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { IMPLEMENTATION_MILESTONES } from '../../data/seed-data';
import { SimulationStateMode } from '../../types/domain';
import { ExpenseStatusBadge, RiskStatusBadge } from '../shared/StatusBadges';

const DELIVERABLE_DOCS = [
  {
    path: 'docs/frontend/README.md',
    title: '1. Architecture Overview & Financial Rules',
    summary:
      'Repository audit findings, canonical financial formulas (hourly cost snapshots, approved-only expense inclusion, null remaining-hour semantics, aggregate portfolio margin math), RBAC matrix, and verified tech stack.',
    highlights: [
      'Actual Cost = sum(hours × hourly_cost_snapshot) + sum(APPROVED expenses only)',
      'estimated_remaining_hours === null → Forecast Unavailable (never $0.00)',
      'Portfolio Projected Margin = (Sum Revenue - Sum Projected Cost) / Sum Revenue',
    ],
  },
  {
    path: 'docs/frontend/design-system.md',
    title: '2. Design System & Visual Tokens',
    summary:
      '60-30-10 color allocation, WCAG 2.2 AA verified contrast table, 2+1 typography scale (Plus Jakarta Sans, Public Sans, JetBrains Mono tabular-nums), single-elevation depth, and 3-zone Top Bar Contract.',
    highlights: [
      'Primary Cobalt #1D4ED8 (6.7:1 contrast on white)',
      'Multi-cue status badges: Icon + Text + Semantic surface/border tokens',
      'Strict tabular numerals (font-variant-numeric: tabular-nums) across all financial figures',
    ],
  },
  {
    path: 'docs/frontend/routes-and-pages.md',
    title: '3. Route Inventory & Page Specifications',
    summary:
      'Evaluation and page-by-page blueprints for /login, /dashboard, /clients/*, /projects/*, /expenses, and /settings, plus financial chart specifications and the AI Risk Advisor interface.',
    highlights: [
      '14 evaluated routes with explicit role guards and mobile transformations',
      'Two-part Project Form separating Commercial Info from Delivery Planning',
      'Advisory-only AI Risk Advisor with timeout/error isolation',
    ],
  },
  {
    path: 'docs/frontend/component-architecture.md',
    title: '4. Reusable Component & Next.js Architecture',
    summary:
      '14 conceptual layers, feature-oriented folder layout, shared vs. feature-specific component boundaries, strict TypeScript rules, and Next.js App Router + TanStack Query strategy.',
    highlights: [
      'Zero financial formula reimplementation inside visual components',
      'Server Components for session & route guards; TanStack Query for client mutations',
      'Strict 10s CRUD timeout and 25s AI Risk Advisor AbortController timeout',
    ],
  },
  {
    path: 'docs/frontend/api-integration.md',
    title: '5. Django REST API Integration Contracts',
    summary:
      'Endpoint-to-feature mapping for Auth, Clients, Projects, Time Entries, Expenses, Dashboard, and AI Risk Analysis with exact JSON envelopes and TanStack Query cache invalidation matrices.',
    highlights: [
      'Approving an expense invalidates expenses, project financials, and dashboard summary',
      'Standardized 400 field_errors mapping to React Hook Form setError()',
      'Zero hardcoded production mock data',
    ],
  },
  {
    path: 'docs/frontend/forms-and-state.md',
    title: '6. Forms, Zod Validation & 15 Application States',
    summary:
      'State ownership matrix, Zod schemas for explicit null estimates and decimal hours (0.25–24.00), duplicate submission locks, and the 15 required application states.',
    highlights: [
      'Explicit estimate_unknown checkbox serializes null instead of 0',
      'Form inputs preserve user-typed values across failed requests',
      'All 15 states (loading, background refresh, empty, no results, 400/401/403/500, AI failure) specified',
    ],
  },
  {
    path: 'docs/frontend/accessibility-and-responsive-design.md',
    title: '7. WCAG 2.2 AA Accessibility & Responsive UX',
    summary:
      'Keyboard navigation matrix, focus trapping, ARIA live-region announcements, reduced-motion support, and mobile/tablet/desktop responsive layout adaptations.',
    highlights: [
      'Mobile sticky header capped at 56px (<= 15% viewport height)',
      'Desktop tables transform into structured Mobile Financial Ledger Cards (< 768px)',
      'Every chart provides an accessible Data Table toggle',
    ],
  },
  {
    path: 'docs/frontend/testing-and-acceptance.md',
    title: '8. Testing, QA Checklist & E2E Acceptance Criteria',
    summary:
      '12-category frontend QA checklist, 3 critical end-to-end user journeys with measurable acceptance criteria, and Vitest / React Testing Library / Playwright test plans.',
    highlights: [
      'Journey 1: Manager onboarding & missing-estimate triage',
      'Journey 2: Team Member time logging & RBAC enforcement',
      'Journey 3: Expense approval, budget breach & AI Risk Advisor recovery',
    ],
  },
  {
    path: 'docs/frontend/implementation-roadmap.md',
    title: '9. 13-Milestone Solo Developer Implementation Roadmap',
    summary:
      'Dependency-aware 13-milestone execution plan with objectives, prerequisites, file lists, manual test steps, and completion definitions.',
    highlights: [
      'Incremental milestone gates from design tokens to final demo defense',
      'Tailored for a solo developer completing the practical assessment',
    ],
  },
];

export const BlueprintExplorerView: React.FC<{
  simulationMode: SimulationStateMode;
  onChangeSimulationMode: (mode: SimulationStateMode) => void;
}> = ({ simulationMode, onChangeSimulationMode }) => {
  const [activeTab, setActiveTab] = useState<
    'DOCS' | 'ROADMAP' | 'DESIGN_SYSTEM' | 'STATE_TESTER'
  >('DOCS');
  const [completedMilestones, setCompletedMilestones] = useState<number[]>([
    1, 2, 3,
  ]);

  const toggleMilestone = (num: number) => {
    setCompletedMilestones((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-blue-700 mb-1">
              <BookOpen className="w-4 h-4" />
              <span>Architecture & Implementation Blueprint Explorer</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              MarginWatch Frontend Specification Suite
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl">
              Explore the 9 markdown specification files generated in{' '}
              <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                docs/frontend/*.md
              </code>
              , track your progress across the 13 implementation milestones, inspect the
              WCAG 2.2 AA design system tokens, and test all 15 application states live.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 self-start">
            <button
              type="button"
              onClick={() => setActiveTab('DOCS')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'DOCS'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              9 Spec Documents
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ROADMAP')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'ROADMAP'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              13-Milestone Roadmap ({completedMilestones.length}/13)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('DESIGN_SYSTEM')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'DESIGN_SYSTEM'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Design System Tokens
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('STATE_TESTER')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'STATE_TESTER'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              15 App States Simulator
            </button>
          </div>
        </div>
      </div>

      {/* Tab 1: 9 Deliverable Specification Documents */}
      {activeTab === 'DOCS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {DELIVERABLE_DOCS.map((doc) => (
            <div
              key={doc.path}
              className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {doc.path}
                  </span>
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                </div>
                <h2 className="text-base font-semibold text-slate-900 mt-2">
                  {doc.title}
                </h2>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {doc.summary}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Key Architectural Rules:
                </span>
                <ul className="space-y-1 text-xs text-slate-600">
                  {doc.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-blue-700 font-bold">·</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: 13-Milestone Implementation Roadmap */}
      {activeTab === 'ROADMAP' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Dependency-Aware 13-Milestone Implementation Sequence
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Click any milestone to mark/unmark completion as you implement the
                Next.js frontend.
              </p>
            </div>
            <div className="text-xs font-mono-tabular text-slate-700 bg-slate-100 px-3 py-1.5 rounded border border-slate-200">
              Completed: <strong>{completedMilestones.length}</strong> / 13 Milestones
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {IMPLEMENTATION_MILESTONES.map((m) => {
              const isDone = completedMilestones.includes(m.number);
              return (
                <div
                  key={m.number}
                  onClick={() => toggleMilestone(m.number)}
                  className={`p-4 flex items-start gap-3.5 cursor-pointer transition-colors ${
                    isDone ? 'bg-emerald-50/30' : 'hover:bg-slate-50'
                  }`}
                >
                  <button
                    type="button"
                    aria-label={`Toggle milestone ${m.number}`}
                    className="mt-0.5 text-slate-500 hover:text-blue-700"
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-400" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono-tabular font-semibold text-blue-700">
                        Milestone {String(m.number).padStart(2, '0')}
                      </span>
                      <span className="text-slate-300">·</span>
                      <h3
                        className={`text-sm font-semibold ${
                          isDone ? 'text-slate-500 line-through' : 'text-slate-900'
                        }`}
                      >
                        {m.title}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{m.objective}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                      <span>
                        <strong className="text-slate-700">Modules:</strong>{' '}
                        <code className="font-mono">{m.files.join(', ')}</code>
                      </span>
                      <span>·</span>
                      <span>
                        <strong className="text-slate-700">Gate:</strong>{' '}
                        {m.verificationGate}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Design System Tokens & Multi-Cue Badges */}
      {activeTab === 'DESIGN_SYSTEM' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
              <Palette className="w-4 h-4 text-blue-700" />
              <h2 className="text-base font-semibold text-slate-900">
                60-30-10 Color System & WCAG 2.2 AA Contrast
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded border border-slate-200 bg-[#F8FAFC]">
                <div className="font-semibold text-slate-900">Canvas (60%)</div>
                <div className="font-mono text-slate-600 mt-0.5">#F8FAFC</div>
              </div>
              <div className="p-3 rounded border border-slate-200 bg-white">
                <div className="font-semibold text-slate-900">Surface (30%)</div>
                <div className="font-mono text-slate-600 mt-0.5">#FFFFFF · #E2E8F0</div>
              </div>
              <div className="p-3 rounded border border-blue-800 bg-[#1D4ED8] text-white">
                <div className="font-semibold">Brand Cobalt (10%)</div>
                <div className="font-mono opacity-90 mt-0.5">#1D4ED8 (6.7:1)</div>
              </div>
            </div>

            <div className="pt-2 space-y-2.5">
              <div className="text-xs font-semibold text-slate-700">
                Multi-Cue Status Tokens (Icon + Text + Surface + Border):
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <RiskStatusBadge status="HEALTHY" />
                <RiskStatusBadge status="WARNING" />
                <RiskStatusBadge status="CRITICAL" />
                <RiskStatusBadge status="INCOMPLETE_DATA" />
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <ExpenseStatusBadge status="PENDING" />
                <ExpenseStatusBadge status="APPROVED" />
                <ExpenseStatusBadge status="REJECTED" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
              <Layers className="w-4 h-4 text-blue-700" />
              <h2 className="text-base font-semibold text-slate-900">
                2+1 Typography & Tabular Numeral Discipline
              </h2>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block">
                  Display Face (--font-display: Plus Jakarta Sans 700)
                </span>
                <span className="font-display text-lg font-bold text-slate-900 block mt-0.5">
                  Portfolio Profitability Watchdog
                </span>
              </div>
              <div className="p-3 rounded bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block">
                  Body & Control Face (--font-sans: Public Sans 400/500)
                </span>
                <span className="text-sm text-slate-800 block mt-0.5">
                  Only approved expenses contribute to actual project delivery cost.
                </span>
              </div>
              <div className="p-3 rounded bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block">
                  Financial Telemetry (--font-mono: JetBrains Mono tabular-nums)
                </span>
                <div className="font-mono-tabular text-sm font-semibold text-slate-900 mt-1 space-y-0.5">
                  <div className="flex justify-between">
                    <span>Contract Revenue:</span>
                    <span>$120,000.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Actual Delivery Cost:</span>
                    <span> $59,712.50</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: 15 Application States Simulator */}
      {activeTab === 'STATE_TESTER' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Interactive Application State Simulator
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Switch global simulation mode to inspect how Dashboard, Projects, and
                Clients handle Loading Skeletons, Zero-Data Onboarding, Network Errors,
                and 403 Permission Denials.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'NORMAL', label: 'Normal Populated State' },
                  { id: 'LOADING_SKELETON', label: 'Initial Loading Skeleton' },
                  { id: 'EMPTY_ZERO_DATA', label: 'Zero-Data Onboarding' },
                  { id: 'NETWORK_ERROR', label: 'Network / 500 Failure' },
                  { id: 'PERMISSION_DENIED_403', label: '403 Permission Denied' },
                ] as { id: SimulationStateMode; label: string }[]
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => onChangeSimulationMode(mode.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                    simulationMode === mode.id
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700">
            Current Active State Mode:{' '}
            <strong className="font-mono text-blue-700">{simulationMode}</strong>. Switch
            to the <strong>Dashboard</strong> or <strong>Projects</strong> view in the
            sidebar to see this state rendered live across the workspace.
          </div>
        </div>
      )}
    </div>
  );
};
