# MarginWatch — Project Profitability & Budget Watchdog

A modern, full-stack financial monitoring and delivery-cost watchdog built for small- to mid-sized software agencies.

---

## 1. Project Overview & Problem Statement

Small software agencies routinely face a critical operational hazard: **projects that silently exceed their planned delivery-cost budgets before management detects the overrun.**

This failure mode typically occurs due to:
* **Unrecorded or Delayed Time Tracking:** Labor costs accumulate invisibly between billing cycles.
* **Untracked Expenses:** Direct project expenditures (subcontractors, cloud licenses, hardware) are tallied after the fact rather than monitored in real time.
* **Flawed Forecasting:** Management frequently equates **budget consumed** with **project completion percentage**, failing to anticipate the cost required to complete the remaining scope, or silently converting missing estimates to zero.

### The Question MarginWatch Answers
> *"Based on recorded work hours, approved expenses, and estimated remaining work, is this project likely to exceed its planned delivery-cost budget?"*

---

## 2. Proposed Solution & Financial Monitoring Approach

MarginWatch establishes an automated early-warning watchdog for agency delivery operations. By combining **historical rate-snapshotted time tracking**, **two-stage expense approval**, **pure deterministic financial calculations**, and a **server-side AI Risk Advisor**, the platform gives agency leadership real-time visibility into project burn rates, projected final costs, and actionable overrun mitigations.

### Core Financial Principles
- **Authoritative Backend Engine:** All financial calculations and risk classifications are owned exclusively by the backend, codified in Python 3.15 using exact fixed-point decimal arithmetic.
- **Strict Separation of Actuals vs. Forecasts:** Incurred costs ($C_{actual}$) represent established facts, while projected completion costs ($C_{projected}$) represent forward-looking estimates.
- **Unambiguous Missing Estimates Policy:** `null` remaining hours denotes an unknown estimate and suppresses forecasts, preventing false zero-estimate optimism.
- **Strict Precedence Hierarchy:**
  1. `over_budget` ($C_{actual} > B$) — takes absolute priority over missing forecast data.
  2. `insufficient_data` — within budget, but required forecast inputs are missing.
  3. `at_risk` — projected overrun ($C_{projected} > B$) or configurable consumption warning heuristic ($P_{consumed} \ge 80.0\%$).
  4. `healthy` — spending and projections are within budget.

For complete mathematical definitions, rules, and worked examples, see:
* [`docs/financial-rules.md`](docs/financial-rules.md)
* [`docs/decisions/ADR-002-financial-rules-and-risk-classification.md`](docs/decisions/ADR-002-financial-rules-and-risk-classification.md)

---

## 3. Intended Users & Primary Roles

| Role | Responsibilities & Access |
| :--- | :--- |
| **Agency Manager** | Full financial visibility across all agency clients and projects. Configures project budgets, contract revenues, and employee cost rates; reviews, approves, or rejects project expenses; analyzes deterministic risk statuses; and requests AI risk advice. |
| **Team Member** | Scoped access to assigned projects. Logs daily work hours, views their own logged time entries, and submits project-related reimbursable expenses with receipt references. Does not have access to client contracts, agency budgets, profit margins, or colleague wage rates. |

---

## 4. Planned Core Features (v1.0 MVP)

* **Client & Project Baselines:** Manage client accounts and establish project budgets, contract revenues, and estimated remaining effort.
* **Rate-Snapshotted Time Entries:** Team members log hours against assigned projects. The system captures the user's active hourly cost rate at the exact moment of entry (`cost_rate_snapshot`), ensuring historical project financials are immutable against future wage changes.
* **Expense Approval State Machine:** Logged direct expenses initiate in `PENDING` status and are excluded from project costs until an Agency Manager explicitly reviews and marks them `APPROVED` or `REJECTED` (with mandatory reason).
* **Deterministic Financial Engine:** Pure, backend-authoritative calculation service using exact fixed-point decimal arithmetic to compute labor costs, budget consumption, projected final costs, and profit margins.
* **Four-Tier Risk Classification:** Projects are deterministically categorized via a strict precedence hierarchy into `healthy`, `at_risk`, `over_budget`, or `insufficient_data`.
* **AI Risk Advisor:** A server-side advisory service powered by Google Gemini that generates plain-language executive summaries, pinpoints primary risk drivers, and recommends 2 to 4 practical operational interventions based strictly on calculated metrics.

---

## 5. Technology Stack

* **Frontend:** [Next.js](https://nextjs.org/) (App Router), [TypeScript](https://www.typescriptlang.org/), and [Tailwind CSS](https://tailwindcss.com/).
* **Backend:** [Python 3.15](https://www.python.org/), [Django](https://www.djangoproject.com/), and [Django REST Framework (DRF)](https://www.django-rest-framework.org/).
* **Database:** SQLite for rapid, zero-dependency local development (Phases 1–7), with a direct migration path to PostgreSQL for production environments (Phase 8+).
* **AI Provider:** [Google Gemini API](https://ai.google.dev/) (`gemini-2.5-flash`), accessed strictly server-to-server from the Django backend.
* **Testing:** Django TestCase / DRF APITestCase on Python 3.15 for backend unit and integration testing; planned Playwright/React Testing Library for frontend workflows.
* **Version Control:** Git & GitHub following Conventional Commits.

---

## 6. High-Level Architecture

MarginWatch enforces a decoupled, **backend-authoritative** architecture:

```
[ Browser Client ]
        │
        │ Next.js (TypeScript + Tailwind CSS)
        ▼
[ REST API Gateway: /api/v1/ ]
        │
        │ Django REST Framework (Python 3.15)
        ├──────────────────────────────────────────┐
        ▼                                          ▼
[ Deterministic Financial Engine ]         [ Server-Side AI Advisor ]
  • Exact Decimal Math (NUMERIC)             • Google Gemini API
  • Rate Snapshot Preservation              • Strictly Read-Only / Grounded
  • Precedence Risk Evaluator                • Privacy Sanitization
        │                                          │
        ▼                                          ▼
[ Relational Database (SQLite / Postgres) ] ◄──────┘
```

For architectural decisions, trade-offs, and request flows, see:
* [`docs/architecture.md`](docs/architecture.md)
* [`docs/decisions/ADR-001-initial-architecture.md`](docs/decisions/ADR-001-initial-architecture.md)

---

## 7. Planned Financial Metrics

| Metric | Calculation Method | Purpose |
| :--- | :--- | :--- |
| **Actual Labor Cost** | $\sum (\text{Recorded Hours} \times \text{Historical Rate Snapshot})$ | Cumulative internal labor expenditures to date. |
| **Approved Expenses** | $\sum \text{Expenses where status = APPROVED}$ | Verified direct non-labor expenditures. |
| **Actual Total Cost** | $\text{Actual Labor Cost} + \text{Approved Expenses}$ | Total funds burned to date ($C_{actual} = C_{labor} + C_{expense}$). |
| **Budget Consumption %** | $(\text{Actual Total Cost} / \text{Planned Cost Budget}) \times 100$ | Percentage of internal expenditure ceiling consumed. |
| **Estimated Remaining Labor Cost** | $\text{Estimated Remaining Hours} \times \text{Planned Hourly Cost}$ | Forecasted labor investment required to deliver scope (or `null` if unknown). |
| **Projected Final Cost** | $\text{Actual Total Cost} + \text{Remaining Labor Cost} + \text{Remaining Expenses}$ | Total expected cost at project completion (or `null` if unknown). |
| **Projected Profit** | $\text{Contract Revenue} - \text{Projected Final Cost}$ | Forecasted agency net earnings (or `null` if unknown). |
| **Projected Profit Margin %** | $(\text{Projected Profit} / \text{Contract Revenue}) \times 100$ | Expected margin health across project lifecycle (or `null` if unknown). |
| **Deterministic Risk Status** | Precedence: `over_budget` $\rightarrow$ `insufficient_data` $\rightarrow$ `at_risk` $\rightarrow$ `healthy` | Discrete operational status badge. |

For detailed mathematical rules and worked examples, see [`docs/financial-rules.md`](docs/financial-rules.md).

---

## 8. AI Risk Advisor Overview

The AI Risk Advisor serves as a consultative co-pilot for agency owners:
* **Strictly Advisory:** The AI cannot modify budgets, change rates, approve expenses, or override deterministic calculations.
* **Grounded Reasoning:** Operates exclusively upon verified, sanitized metrics supplied by the backend.
* **Concrete Interventions:** Delivers 2–4 prioritized operational recommendations (e.g., scope triage, staff re-balancing, client change orders).
* **Fault Tolerant:** An external AI provider timeout or rate limit will never disrupt the core financial calculations or prevent users from viewing authoritative metrics.

For complete behavioral specifications, prompt designs, and evaluation scenarios, see [`docs/ai-risk-advisor.md`](docs/ai-risk-advisor.md).

---

## 9. Security Principles

* **Zero Trust in the Client:** All authentication, authorization, validation, and calculations occur server-side.
* **Object-Level Access Control (OLAC):** Team members are restricted to projects to which they are assigned; cross-user entry editing is rejected (IDOR protection).
* **Wage & Margin Concealment:** Sensitive financial fields (internal wages, rate snapshots, contract margins) are stripped by backend serializers for non-manager roles.
* **Strict Secret Encapsulation:** The Google Gemini API key is isolated inside the backend environment and is never exposed to browser bundles.

For security specifications and permission matrices, see [`docs/security-and-permissions.md`](docs/security-and-permissions.md).

---

## 10. Repository Structure

```text
marginwatch/
├── README.md                      # Project overview and architectural guide
├── .gitignore                     # Git ignore rules for Python, Django, and Next.js
├── .env.example                   # Safe environment template with scope documentation
├── CONTRIBUTING.md                # Development workflow, commit conventions, and hygiene
├── docs/                          # Comprehensive technical documentation suite
│   ├── requirements.md            # Functional & non-functional requirements and acceptance criteria
│   ├── financial-rules.md         # Authoritative mathematical formulas and worked examples
│   ├── architecture.md            # Component design, tier responsibilities, and diagrams
│   ├── data-model.md              # Conceptual entities, fields, relationships, and ERD
│   ├── api-specification.md       # Planned REST API contract and endpoint specifications
│   ├── security-and-permissions.md# RBAC/OLAC matrix, data masking, and secrets hygiene
│   ├── testing-strategy.md        # Test pyramid, test matrix, and high-risk edge cases
│   ├── ai-risk-advisor.md         # AI specifications, prompt design, and 15 benchmark scenarios
│   ├── development-roadmap.md     # 10-phase milestone roadmap from Phase 0 to Phase 9
│   └── decisions/
│       ├── ADR-001-initial-architecture.md # Stack decisions, trade-offs, and rationale
│       └── ADR-002-financial-rules-and-risk-classification.md # Financial rules, missing estimates, and precedence
├── backend/                       # Django backend directory (initialized in Phase 1)
│   └── .gitkeep
└── frontend/                      # Next.js frontend directory (initialized in Phase 1)
    └── .gitkeep
```

---

## 11. Development Status & Roadmap

> [!NOTE]
> **Current Status: Phase 0 (Planning, Blueprint & Financial Rules Formalization Complete)**  
> Framework initialization and application logic are scheduled for subsequent milestones.

| Phase | Milestone Name | Status |
| :---: | :--- | :---: |
| **Phase 0** | Requirements, Financial Rules & Repository Blueprint | **Complete** |
| **Phase 1** | Repository & Framework Initialization | Planned Next |
| **Phase 2** | Database Design, Models & Migrations | Planned |
| **Phase 3** | Authentication, Authorization & User Roles | Planned |
| **Phase 4** | Core CRUD APIs & Expense State Machine | Planned |
| **Phase 5** | Financial Calculation Engine & Comprehensive Testing | Planned |
| **Phase 6** | Frontend Integration & Essential Workflows | Planned |
| **Phase 7** | AI Risk Advisor Integration & Evaluation | Planned |
| **Phase 8** | Security Hardening, Regression & Responsive Polish | Planned |
| **Phase 9** | Portfolio Polish, Documentation Finalization & Demo Prep | Planned |

For detailed phase tasks and definitions of done, see [`docs/development-roadmap.md`](docs/development-roadmap.md).

---

## 12. Planned Local Setup Instructions

*(The following instructions represent the planned setup workflow once the frameworks are initialized in Phase 1.)*

### Prerequisites
* Python 3.15 (via Conda `projectfinance` or virtual environment)
* Node.js 18+ and npm
* Git

### Forthcoming Setup Steps (Phase 1)
```bash
# 1. Clone repository
git clone https://github.com/your-username/marginwatch.git
cd marginwatch

# 2. Configure environment variables
cp .env.example .env
# Edit .env to add your local Django secret key and Gemini API key

# 3. Backend Setup (using Python 3.15)
cd backend

# Option A: Using Conda environment (recommended)
conda activate projectfinance

# Option B: Using standard venv with Python 3.15
# python -m venv venv
# source venv/bin/activate  # On Windows: .\venv\Scripts\activate

pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# 4. Frontend Setup (forthcoming in Phase 1)
cd ../frontend
npm install
npm run dev
```

---

## 13. Known Limitations (MVP Scope)

* **Single Currency per Project:** Projects operate in a single configured currency; multi-currency dynamic conversions are planned for v1.1+.
* **Manual Time Logging:** The MVP focuses on manual date and hours logging rather than automated desktop/mobile timer widgets.
* **Advisory AI:** The AI Risk Advisor provides operational advice and summaries; it intentionally does not perform autonomous actions or automated budget adjustments.
