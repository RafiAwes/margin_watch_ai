# MarginWatch — Friendly Financial SaaS & Developer-Tool Design System Upgrade Plan

An end-to-end upgrade of both the **MarginWatch Frontend Architecture & UX Documentation (`docs/frontend/*.md`)** and the **Live Interactive Application (`src/*`)** to adopt the mandatory **Friendly Financial SaaS + Subtle Developer-Tool Visual Identity**.

---

## User Review Required

> [!IMPORTANT]
> **Synchronized Spec + Live Application Upgrade**
> Per your selection, we will update **both** the canonical specification suite (`docs/frontend/*.md`) **and** the live interactive React workspace (`src/*`) so the documentation and live application remain 100% aligned on design tokens, typography, component geometry, interaction states, and responsive breakpoints.

- **Palette Transformation**: Replaces the previous generic blue (`#1D4ED8`) and cool slate (`#F8FAFC` / `#0F172A`) tokens with **Soft Cloud (`#F6F7F9`)**, **Pure White (`#FFFFFF`)**, **Midnight Slate (`#202633`)**, and **Electric Indigo (`#6558D3`)**, paired with **Mint (`#0D9488` / `#10B981`)**, **Warm Amber (`#D97706`)**, and **Soft Rose-Red (`#E11D48`)** semantic health indicators.
- **Typography & Geometry**: Standardizes on **Inter** (`--font-sans` and `--font-display`) for friendly, high-legibility UI and headings, and **JetBrains Mono** (`tabular-nums`) strictly for financial figures, percentages, hours, and compact technical metadata—paired with **12px–16px (`rounded-xl` / `rounded-2xl`)** card radii, subtle borders (`#E4E7EC`), and restrained elevation shadows.
- **7-Tier Responsive Breakpoint Matrix**: Documents and enforces explicit layout rules across `320px`, `375px`, `430px`, `768px`, `1024px`, `1440px`, and `1920px` viewports with zero unintended horizontal overflow.

---

## Overview & Design Constitution

MarginWatch is designed as a **friendly, polished financial SaaS product with a subtle developer-tool aesthetic** (inspired by Linear, Stripe, and Raycast's approachable clarity).

### Core Design Tokens
| Token Role | Token Name | Hex Value | Usage & Contrast Contract |
| :--- | :--- | :--- | :--- |
| **App Canvas Background** | `--bg-canvas` | `#F6F7F9` | Soft Cloud primary viewport background (`60%` surface budget) |
| **Elevated Card Surface** | `--bg-surface` | `#FFFFFF` | Primary cards, tables, modals, and navigation rails (`30%` surface budget) |
| **Subtle Technical Surface** | `--bg-subtle` | `#EFEFF4` / `#F1F3F7` | Table headers, filter bars, code/metadata chips, and subtle grid headers |
| **Primary Text** | `--text-primary` | `#202633` | Midnight Slate for headings, primary copy, and financial values (`> 13:1` on white) |
| **Secondary Text** | `--text-secondary` | `#525B6C` | Supporting labels, descriptions, and table headers (`> 6.5:1` on white) |
| **Muted Metadata** | `--text-muted` | `#6E7787` | Compact technical metadata, timestamps, and axis ticks (`> 4.5:1` on white) |
| **Primary Brand Accent** | `--accent-primary` | `#6558D3` | Electric Indigo for primary CTAs, active tabs, focus rings, and interactive highlights (`#5446C0` hover, `#4638B0` active) |
| **Indigo Tinted Surface** | `--accent-subtle` | `#F3F1FF` | Active sidebar navigation pill, selected role cards, and AI Risk Advisor header accent (`#DCD7FE` border) |
| **Healthy (Mint)** | `--status-healthy` | `#059669` text / `#ECFDF5` bg / `#A7F3D0` border | On-budget projects and approved expenses (always paired with icon + text) |
| **Warning (Amber)** | `--status-warning` | `#B45309` text / `#FFFBEB` bg / `#FDE68A` border | At-risk projects (`85%–100%` budget consumed) and pending expenses |
| **Critical (Soft Red)** | `--status-critical` | `#BE123C` text / `#FFF1F2` bg / `#FECDD3` border | Over-budget projects (`> 100%` consumed or negative projected margin) |
| **Border & Hairline** | `--border-subtle` | `#E4E7EC` | Crisp `1px solid` structural card and table borders |

---

## User Experience & Interface Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Top Bar (#FFFFFF, 1px #E4E7EC border): Brand + Role Nav + Indigo CTA + User  │
├──────────────────┬───────────────────────────────────────────────────────────┤
│ Sidebar Rail     │ Main Canvas (#F6F7F9 Soft Cloud + Subtle Technical Grid)  │
│ (#FFFFFF)        │                                                           │
│                  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ • Watchdog       │ │ KPI Card │ │ KPI Card │ │ KPI Card │ │ KPI Card │       │
│ • Projects       │ │ 14px rad │ │ Tabular  │ │ Mint/Red │ │ Definition│      │
│ • Clients        │ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│ • Time Entries   │                                                           │
│ • Expenses       │ ┌───────────────────────────────────┬───────────────────┐ │
│ • Profile        │ │ Project Health & Needs Attention  │ Pending Approvals │ │
│                  │ │ Watchlist (8 Cols, 16px radius)   │ & Quick Actions   │ │
│ ──────────────── │ │ • Severity Badge (Mint/Amber/Red) │ (4 Cols)          │ │
│ User Profile     │ │ • Budget Progress Bar             │ • One-Click       │ │
│ Card + Log Out   │ │ • Null-Safe Forecast & Margin     │   Approve/Reject  │ │
└──────────────────┴─┴───────────────────────────────────┴───────────────────┴─┘
```

### 1. Dashboard & AI Risk Advisor Experience
- **KPI Cards (`12px–16px` radius, `1px solid #E4E7EC`, subtle shadow)**: Each card includes a clear metric title, a concise 1-line definition subtitle, tabular financial numeral (`JetBrains Mono`), and semantic status indicator.
- **Prominent Project Health & Needs-Attention Panel**: Ranked by severity (`CRITICAL` → `WARNING` → `INCOMPLETE_DATA` → `HEALTHY`) with inline visual budget progress bars, clear explanation of why the project is flagged, and direct action triggers.
- **Distinct, Balanced AI Risk Advisor Panel**: Styled as a supportive technical assistant card with a subtle Electric Indigo (`#F3F1FF`) header accent, clear separation between **Authoritative Backend Risk Classification** and **AI-Generated Advisory Interventions**, and explicit `null` remaining-hours warnings.

### 2. Responsive Breakpoint Matrix (320px to 1920px)
- **`320px` (Compact Mobile)**: Single-column stack, collapsible slide-over navigation drawer, KPI cards stacked 1-per-row with `12px` padding, project health rows rendered as compact mobile ledger cards, modals rendered as full-width bottom sheets, zero horizontal page overflow.
- **`375px` (Standard Mobile)**: Single-column layout with `16px` horizontal padding, touch-friendly `44px` minimum tap targets, responsive segmented controls with horizontal scroll containment where needed.
- **`430px` (Large Mobile)**: Single-column workspace with 2-column sub-grids inside mobile project ledger cards for Planned vs. Actual vs. Projected metrics.
- **`768px` (Tablet)**: 2-column KPI grid, horizontal top navigation links visible, responsive data tables with sticky primary column and horizontal scroll container, 2-column form grids.
- **`1024px` (Laptop)**: Persistent `256px` left sidebar rail + fluid main canvas, 3-column KPI grid, 12-column split views (`8 cols` primary table + `4 cols` secondary panel).
- **`1440px` (Desktop Standard)**: Full 5-column Manager KPI strip, spacious 12-column workspace container (`max-w-7xl`), side-by-side Budget vs. Forecast analytical chart and AI Risk Advisor.
- **`1920px` (Ultrawide Desktop)**: Centered `1440px` (`max-w-[1440px]`) content container with generous Soft Cloud (`#F6F7F9`) margin framing to prevent excessive line lengths or eye-tracking fatigue across wide financial tables.

---

## Technical Architecture & Planned Updates

### Part A — Documentation Suite Updates (`docs/frontend/*.md`)
1. **`docs/frontend/design-system.md`**:
   - Update color palette tokens to `#F6F7F9` (Soft Cloud), `#FFFFFF` (White Surface), `#202633` (Midnight Slate), `#6558D3` (Electric Indigo), and Mint/Amber/Soft Red semantic status tokens with WCAG 2.2 AA contrast ratios.
   - Update typography specification to **Inter** (`--font-sans` / `--font-display`) and **JetBrains Mono** (`--font-mono`, `tabular-nums` strictly for financial numerals and tiny technical metadata labels).
   - Document `12px–16px` (`rounded-xl` / `rounded-2xl`) card border radii, subtle developer-tool grid header textures, and interaction state tokens (`hover`, `focus-visible`, `active/pressed`, `loading`, `disabled`).
2. **`docs/frontend/accessibility-and-responsive-design.md`**:
   - Add the explicit 7-breakpoint responsive specification table covering **`320px`, `375px`, `430px`, `768px`, `1024px`, `1440px`, and `1920px`** viewports across every route, table, chart, form, and modal.
3. **`docs/frontend/routes-and-pages.md` & `docs/frontend/component-architecture.md`**:
   - Ensure Server Component vs. Client Component boundaries, TanStack Query mutation/filter patterns, and Django backend authority rules are explicitly cross-referenced with the updated visual and interaction specs.

### Part B — Live Interactive Application Updates (`src/*`)
1. **`index.html` & `src/index.css`**:
   - Load Google Fonts for **Inter** (`400, 500, 600, 700`) and **JetBrains Mono** (`400, 500, 600`).
   - Update CSS custom properties (`--background: #F6F7F9`, `--foreground: #202633`, `--primary: #6558D3`, `--primary-hover: #5446C0`, Mint/Amber/Soft Red status tokens) and add a subtle developer-tool dot/grid background utility class (`.bg-dev-grid`).
2. **`src/components/shared/StatusBadges.tsx`**:
   - Restyle `RiskStatusBadge`, `ExpenseStatusBadge`, `LifecycleText`, and `BudgetForecastChart` to use the Mint (`emerald/teal`), Warm Amber (`amber`), Soft Red (`rose`), and Electric Indigo (`#6558D3`) palette with `12px–16px` rounded containers and crisp tabular numerals.
3. **`src/components/auth/AuthScreen.tsx`, `src/components/views/ProjectDetailView.tsx`, `src/components/views/UserProfileView.tsx`, `src/components/modals/WorkflowModals.tsx`, and `src/App.tsx`**:
   - Upgrade all surfaces, buttons, focus rings, active navigation states, KPI cards (`rounded-xl` / `rounded-2xl`), AI Risk Advisor panel, and responsive containers (`320px` through `1920px`) to the `#F6F7F9` / `#202633` / `#6558D3` visual identity.
