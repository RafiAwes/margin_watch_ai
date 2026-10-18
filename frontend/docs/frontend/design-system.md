# MarginWatch Design System Specification

## 1. Visual Identity & Aesthetic Direction

MarginWatch is designed as a **friendly, polished financial SaaS product with a subtle developer-tool aesthetic** (inspired by Linear, Stripe, and Raycast). The interface balances **approachable usability** with **high-precision financial clarity**:

- **Comfortable & Trustworthy**: Soft Cloud (`#F6F7F9`) canvas backgrounds paired with crisp Pure White (`#FFFFFF`) elevated cards, generous whitespace, and `12px–16px` (`rounded-xl` / `rounded-2xl`) border radii.
- **Midnight Slate & Electric Indigo Hierarchy**: High-contrast Midnight Slate (`#202633`) typography for effortless reading paired with Electric Indigo (`#6558D3`) for primary interactive accents, active navigation indicators, and focus states.
- **Restrained Developer-Tool Precision**: Subtle dot/grid header textures, compact technical metadata badges (`11px` uppercase or code identifiers), and strict tabular numerals (`font-variant-numeric: tabular-nums`) on all currency, hour, and percentage values.
- **Strict Anti-Bloat Guardrails**:
  - **No** excessive monospace text on body paragraphs or prose descriptions.
  - **No** neon colors, cyberpunk styling, dark-mode-only contrast traps, or heavy glassmorphism (`backdrop-blur`).
  - **No** decorative sparklines or unrequested charts that do not directly support a budget or staffing decision.

---

## 2. Color System & WCAG 2.2 AA Contrast Tokens

### 2.1 Surface & Neutral Palette (60-30-10 Allocation)
| Token Name | CSS Variable | Hex Value | Surface Role | Contrast vs. `#202633` |
| :--- | :--- | :--- | :--- | :--- |
| **Soft Cloud Canvas (60%)** | `--bg-canvas` | `#F6F7F9` | Primary application viewport background | `13.4:1` (AAA) |
| **White Surface (30%)** | `--bg-surface` | `#FFFFFF` | Cards, data tables, modals, top bar, sidebar rail | `14.8:1` (AAA) |
| **Subtle Technical Surface** | `--bg-subtle` | `#F0F2F6` | Table headers, filter toolbars, metadata wells | `12.6:1` (AAA) |
| **Midnight Slate (Primary Text)** | `--text-primary` | `#202633` | Headings, primary body copy, financial figures | — |
| **Slate Secondary Text** | `--text-secondary` | `#4E5666` | Supporting descriptions, form labels, table headers | `7.2:1` on `#FFFFFF` (AAA) |
| **Muted Metadata Text** | `--text-muted` | `#697386` | Timestamps, axis labels, subtle technical hints | `4.7:1` on `#FFFFFF` (AA) |
| **Subtle Border** | `--border-subtle` | `#E3E6ED` | Card perimeters, table row dividers (`1px solid`) | — |
| **Strong Input Border** | `--border-strong` | `#CBD0DC` | Form inputs, selects, and secondary button borders | — |

### 2.2 Primary Brand Accent — Electric Indigo (10%)
| Token Name | CSS Variable | Hex Value | Usage | Contrast Ratio |
| :--- | :--- | :--- | :--- | :--- |
| **Electric Indigo Primary** | `--accent-primary` | `#6558D3` | Primary CTA buttons, active tab indicators, focus rings | `5.3:1` vs `#FFFFFF` (AA) |
| **Electric Indigo Hover** | `--accent-hover` | `#5346BF` | Hover state for primary buttons and interactive links | `6.6:1` vs `#FFFFFF` (AA) |
| **Electric Indigo Pressed** | `--accent-active` | `#4437A8` | Active/pressed state for primary buttons | `8.1:1` vs `#FFFFFF` (AAA) |
| **Indigo Tinted Surface** | `--accent-subtle` | `#F3F1FF` | Active sidebar navigation state, AI Risk Advisor header | `13.5:1` vs `#3E329E` |
| **Indigo Subtle Border** | `--accent-border` | `#DAD4FC` | Border for indigo callouts and selected role cards | — |

### 2.3 Semantic Financial Health & Status Palette
Every semantic status indicator **must** pair color with an explicit text label and a distinct vector icon (`CheckCircle2`, `AlertTriangle`, `AlertOctagon`, `HelpCircle`) so status is never conveyed by color alone.

| Financial State | Text / Icon Hex | Surface Fill Hex | Border Hex | Progress Bar Fill | Contrast Ratio |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Healthy (`HEALTHY` / `APPROVED`)** — Mint | `#047857` | `#ECFDF5` | `#A7F3D0` | `#10B981` | `5.4:1` (AA) |
| **Warning (`WARNING` / `PENDING`)** — Amber | `#B45309` | `#FFFBEB` | `#FDE68A` | `#F59E0B` | `5.1:1` (AA) |
| **Critical (`CRITICAL` / `REJECTED`)** — Soft Red | `#BE123C` | `#FFF1F2` | `#FECDD3` | `#F43F5E` | `5.8:1` (AA) |
| **Incomplete (`INCOMPLETE_DATA`)** — Slate | `#4E5666` | `#F0F2F6` | `#CBD0DC` | `#94A3B8` (striped) | `6.4:1` (AA) |

---

## 3. Typography & Scannable Hierarchy

### 3.1 Font Families
- **UI & Headings (`--font-sans` / `--font-display`)**: `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`
  - Chosen for friendly legibility, crisp geometric proportions, and clean scannability at compact dashboard sizes.
- **Financial Numerals & Technical Metadata (`--font-mono`)**: `'JetBrains Mono', monospace` with `font-variant-numeric: tabular-nums`
  - Applied **exclusively** to currency amounts (`$112,500.00`), decimal work hours (`142.50 hrs`), percentages (`89.4%`), ISO dates (`2026-10-17`), and compact role/status codes (`MANAGER`, `USD`). Never used for multi-line prose.

### 3.2 Typographic Scale
| Element | Size (`rem` / `px`) | Line Height | Weight | Tracking | Font Family |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Page Title (`h1`)** | `1.5rem` (`24px`) | `2rem` (`32px`) | `700` (Bold) | `-0.02em` | `Inter` |
| **Section Header (`h2`)** | `1.0625rem` (`17px`) | `1.5rem` (`24px`) | `600` (SemiBold) | `-0.015em` | `Inter` |
| **Card / Panel Title (`h3`)** | `0.875rem` (`14px`) | `1.25rem` (`20px`) | `600` (SemiBold) | `-0.01em` | `Inter` |
| **KPI Hero Value** | `1.5rem` (`24px`) | `1.85rem` (`30px`) | `700` (Bold) | `-0.02em` | `JetBrains Mono` (`tabular-nums`) |
| **Primary Body Copy** | `0.875rem` (`14px`) | `1.375rem` (`22px`) | `400` / `500` | `0` | `Inter` |
| **Table Cell & UI Label** | `0.75rem` (`12px`) | `1.125rem` (`18px`) | `500` (Medium) | `0` | `Inter` |
| **Technical Metadata Label** | `0.6875rem` (`11px`) | `1rem` (`16px`) | `600` (SemiBold) | `+0.03em` | `JetBrains Mono` |

---

## 4. Card Geometry, Borders, Shadows & Technical Textures

- **Card Border Radius**:
  - Primary dashboard panels, tables, and modal dialogs: **`16px` (`rounded-2xl`)**
  - KPI summary cards, inner callout boxes, and filter bars: **`12px` (`rounded-xl`)**
  - Buttons, inputs, and segmented controls: **`8px` (`rounded-lg`)**
- **Borders & Elevation**:
  - Default Card: `1px solid #E3E6ED` with restrained ambient shadow `0 1px 3px 0 rgba(32, 38, 51, 0.04), 0 1px 2px -1px rgba(32, 38, 51, 0.02)`
  - Interactive Card Hover: Border transitions to `#CBD0DC` (`#DAD4FC` for primary action cards) with `0 4px 12px -2px rgba(32, 38, 51, 0.06)`
- **Subtle Developer-Tool Grid Texture (`.bg-dev-grid`)**:
  - Used sparingly on top summary headers and the AI Risk Advisor header: a `16px × 16px` radial dot matrix at `4%` opacity (`rgba(32, 38, 51, 0.045)`) that gives a tactile engineering-tool feel without visual noise.

---

## 5. Interaction States & Motion Specification

| State | Visual Specification |
| :--- | :--- |
| **Default** | Crisp `1px solid #E3E6ED` surface border, clear label contrast (`#202633`). |
| **Hover** | `150ms cubic-bezier(0.16, 1, 0.3, 1)` background shift (`#6558D3` → `#5346BF` on primary buttons; `#FFFFFF` → `#F6F7F9` on table rows). |
| **Focus-Visible** | Keyboard focus ring: `2px solid #6558D3` with `2px` offset (`focus-visible:ring-2 focus-visible:ring-[#6558D3] focus-visible:ring-offset-2`). |
| **Pressed / Active** | Subtle scale/color shift (`#4437A8` for primary buttons, `translate-y-[0.5px]`). |
| **Loading** | Geometry-matched shimmer skeleton (`#F0F2F6` to `#E3E6ED` pulse) or inline `Loader2` spinner with disabled button state (`opacity-60 cursor-not-allowed`). |
| **Reduced Motion** | `@media (prefers-reduced-motion: reduce)` disables all transform and pulse animations, preserving instant opacity/color feedback. |
