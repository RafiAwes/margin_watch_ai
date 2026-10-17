# MarginWatch Accessibility (WCAG 2.2 AA) & Mobile-First Responsive Specification

## 1. Accessibility Standard & Governance (WCAG 2.2 Level AA)

MarginWatch enforces **WCAG 2.2 Level AA** compliance across all financial tables, KPI cards, forms, modals, and charts.

### 1.1 Contrast & Non-Color Status Signaling
- **Text Contrast**: Midnight Slate (`#202633`) on Soft Cloud (`#F6F7F9`) achieves `13.4:1`, and on White (`#FFFFFF`) achieves `14.8:1`. Secondary Slate (`#4E5666`) achieves `7.2:1`. Electric Indigo (`#6558D3`) with white text achieves `5.3:1`.
- **Non-Color Redundancy**: Every Mint (`HEALTHY` / `APPROVED`), Amber (`WARNING` / `PENDING`), Soft Red (`CRITICAL` / `REJECTED`), and Slate (`INCOMPLETE_DATA`) badge pairs a distinct semantic icon (`CheckCircle2`, `AlertTriangle`, `AlertOctagon`, `HelpCircle`) with an explicit text label.
- **Accessible Charts**: The `BudgetForecastChart` includes an accessible `"View as Table"` toggle and screen-reader-accessible `<table>` fallback so all financial comparisons are inspectable without relying on visual bars.

### 1.2 Keyboard Navigation & Focus Management
- **Skip Link**: First tab stop renders a visible `"Skip to main workspace"` link targeting `#main-content`.
- **Focus Ring**: Every interactive control displays a high-visibility `2px solid #6558D3` focus outline on `:focus-visible`.
- **Modal Dialogs**: All create/edit/reject/logout modals enforce `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, Escape-key dismissal, and focus restoration to the invoking button.
- **Inline Validation**: Form errors bind via `aria-invalid="true"` and `role="alert"` so screen readers announce field-level remediation guidance immediately.

---

## 2. Mobile-First 7-Tier Responsive Breakpoint Matrix

MarginWatch is architected **mobile-first** from `320px` up to `1920px` ultrawide monitors, preventing unintended horizontal page overflow at every viewport width.

### 2.1 Viewport Behavior Specification (`320px` – `1920px`)

| Viewport Width | Target Device Class | Navigation Shell | Dashboard KPI Grid | Project Health & Ledger Tables | Forms, Modals & Charts |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`320px`** | Compact Mobile (iPhone SE / Fold folded) | Sticky `56px` top bar with hamburger trigger; slide-over drawer (`max-w-[88vw]`). Top-bar text links and secondary CTA hidden. | `1 column` vertical stack (`gap-3`, `12px` card padding); compact `20px` tabular numerals. | Tables transform into stacked **Mobile Financial Ledger Cards** (`12px` radius) showing Project, Risk Badge, and a 2×2 key-value summary grid. | Modals render as full-width bottom/viewport sheets (`p-4`); form fields stack `1 column`; chart legends wrap vertically. |
| **`375px`** | Standard Mobile (iPhone 15 / 16) | Sticky top bar with brand wordmark, profile avatar menu, and slide-over navigation drawer. | `1 column` stack (`gap-3.5`, `16px` card padding) with full 1-line metric definitions visible. | Stacked **Mobile Financial Ledger Cards** with full Mint/Amber/Red progress bars and touch-friendly `44px` action buttons. | `1 column` form inputs (`h-10`); filter segmented controls scroll horizontally within a contained pill bar. |
| **`430px`** | Large Mobile (iPhone Pro Max / Pixel Pro) | Sticky top bar + slide-over drawer; primary `+ New` / `+ Log Hours` button visible in top bar. | `1 column` (or `2-col` compact sub-metrics) with generous spacing and zero text truncation on currency values. | Enhanced **Mobile Financial Ledger Cards** with inline variance figures and 1-tap workspace navigation. | Modals centered with `16px` margin; date and currency inputs stack cleanly with full helper text. |
| **`768px`** | Tablet Portrait (iPad Mini / Air) | Sticky top bar with horizontal role-governed text navigation links (`Dashboard`, `Projects`, `Time`, `Expenses`); drawer optional. | `2 columns` (`grid-cols-2 gap-4`); 5th KPI card spans full width or pairs cleanly. | Desktop semantic `<table>` activates inside an `overflow-x-auto` container with `whitespace-nowrap` on all currency/hour columns. | Form grids switch to `2 columns` (`sm:grid-cols-2`); modals render as centered `max-w-lg` / `max-w-2xl` cards (`16px` radius). |
| **`1024px`** | Laptop / Tablet Landscape | Persistent `256px` (`w-64`) left sidebar rail + fluid main workspace canvas (`px-6`). | `3 columns` (`lg:grid-cols-3 gap-4`) for balanced metric density. | 12-column split layout activates: **At-Risk Watchlist (`8 cols`)** + **Pending Approvals Queue (`4 cols`)**. | Project Detail workspace displays persistent summary header + 4-card KPI strip + horizontal tab bar. |
| **`1440px`** | Standard Desktop | Persistent `256px` left sidebar rail + `max-w-7xl` centered workspace canvas (`px-8`). | `5 columns` (`xl:grid-cols-5 gap-4`) single-row executive KPI strip. | Full multi-column financial tables visible without horizontal scrolling; side-by-side Budget Chart (`7 cols`) + AI Risk Advisor (`5 cols`). | Two-section Project Creation modal and Team Directory inline editing display all columns comfortably. |
| **`1920px`** | Ultrawide / 4K Monitor | Persistent `256px` left sidebar rail + centered `max-w-[1440px]` workspace container framed by Soft Cloud (`#F6F7F9`) whitespace. | `5 columns` executive KPI strip with comfortable reading cadence and bounded line lengths (`max-w-[70ch]` on AI prose). | Full financial tables with generous cell padding; prevents eye-tracking fatigue across ultra-wide screens. | Modals and side panels remain anchored to the centered workspace grid. |

---

## 3. Page-by-Page Responsive & Overflow Safeguards

1. **Dashboard (`/dashboard`)**:
   - KPI cards use `min-w-0` and `tabular-nums` so large currency figures (`$1,250,000.00`) never overflow card boundaries at `320px`.
   - The **At-Risk & Incomplete Projects Watchlist** and **Pending Expense Approvals** panels stack vertically below `1024px` (`grid-cols-1 lg:grid-cols-12`) and sit side-by-side (`8 cols` / `4 cols`) at `1024px+`.
2. **Projects Directory (`/projects`) & Project Detail (`/projects/[id]`)**:
   - Below `768px`, project rows automatically switch from `<table>` markup to responsive **Mobile Financial Ledger Cards** (`md:hidden`), eliminating horizontal table squinting on phones.
   - At `768px+`, semantic `<table>` views wrap in `overflow-x-auto` with `whitespace-nowrap` on financial columns.
   - Project Detail sub-navigation tabs (`Overview & AI Advisor`, `Time Entries`, `Expenses`, `Team & Rates`) use `overflow-x-auto no-scrollbar` on `320px–430px` viewports so all tabs remain reachable via touch.
3. **Authentication & Registration (`/login`)**:
   - Stacks the **Product & Role Overview** and **Sign-In / Registration Card** vertically below `1024px`, and renders a balanced `5-col / 7-col` split layout at `1024px–1920px`.
