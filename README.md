# MarginWatch — Project Profitability & Budget Watchdog

A full-stack financial watchdog for a single software agency. It tracks delivery costs against
fixed-price budgets, forecasts each project's final cost, classifies budget risk with a
deterministic rules engine, and uses a server-side Gemini model to explain the risk in plain
language — without ever letting the AI touch the numbers.

> *"Based on recorded work hours, approved expenses, and estimated remaining work, is this project
> likely to exceed its planned delivery-cost budget — and what should I do about it?"*

---

## Contents

1. [Why it exists](#1-why-it-exists)
2. [What it does](#2-what-it-does)
3. [Tech stack](#3-tech-stack)
4. [Architecture](#4-architecture)
5. [Financial engine](#5-financial-engine)
6. [AI Risk Advisor](#6-ai-risk-advisor)
7. [Getting started](#7-getting-started)
8. [Demo data](#8-demo-data)
9. [API overview](#9-api-overview)
10. [Testing](#10-testing)
11. [Performance](#11-performance)
12. [Repository structure](#12-repository-structure)
13. [Documentation](#13-documentation)
14. [Known limitations & next steps](#14-known-limitations--next-steps)

---

## 1. Why it exists

Agencies delivering fixed-price projects lose margin silently: hours accumulate between billing
cycles, expenses are tallied late, and "70 % of the budget spent" gets mistaken for "70 % done".
Missing estimates are often treated as zero, which makes a struggling project look finished.

MarginWatch makes the backend the single source of financial truth:

- **Actuals and forecasts are kept apart.** Money already spent is fact; projected completion cost is an estimate.
- **Unknown is not zero.** A project with no remaining-hours estimate gets `insufficient_data`, not a rosy forecast.
- **History is immutable.** Each time entry snapshots the person's hourly cost when it is logged; later raises never rewrite past costs.
- **Only approved expenses count.** Pending and rejected expenses never burn budget.
- **AI explains, never decides.** The model sees anonymized figures after the engine has run and cannot change them.

The product is deliberately **single-agency** (no tenants or agency models — see
[ADR-002](docs/decisions/ADR-002-single-agency-architecture.md)).

---

## 2. What it does

| Area | Built and tested |
| :--- | :--- |
| **Roles & accounts** | No public sign-up: managers create staff accounts with an initial password, staff sign in and change it. `MANAGER` sees and manages everything; `TEAM_MEMBER` sees only assigned projects, never budgets, margins or colleagues' rates (masked server-side). |
| **Clients & projects** | CRUD with soft-archiving, lifecycle statuses, contract revenue, cost budget, planned blended rate, nullable remaining-hours estimate, team assignments. |
| **Time tracking** | Hours (0.01–24) against assigned projects; immutable `hourly_cost_snapshot`; ledger with server-side paging. |
| **Expenses** | Submit → approve/reject (mandatory note on rejection); reviewed expenses can be neither edited nor deleted. |
| **Financial engine** | 8 formulas and a 4-rule risk classification in pure `Decimal` Python, matching the documented benchmark scenarios to the cent. |
| **Dashboard** | Portfolio totals, risk counts, projected final cost and margin per currency; per-project budget/forecast charts. |
| **AI Risk Advisor** | On-demand Gemini analysis per project: summary, risk drivers, 2–4 recommendations, data gaps — grounded, sanitized, cached, rate-limited. |
| **Demo data** | One command generates a realistic agency (34 staff, 80 projects, ~12k time entries) for exploring and load testing. |
| **API quality** | JWT auth with refresh rotation and blacklisting, uniform error envelope, pagination, validated filters, search, stable ordering. |

---

## 3. Tech stack

| Layer | Technology |
| :--- | :--- |
| **Backend** | Python 3.15, Django 6.1, Django REST Framework 3.18, SimpleJWT 5.5, django-filter, django-cors-headers |
| **Database** | PostgreSQL on [Neon](https://neon.tech) via `DATABASE_URL` (SQLite fallback when unset) |
| **AI** | Google Gemini via the official `google-genai` 2.x SDK, server-side only (default model `gemini-3.8-flash`, configurable) |
| **Frontend** | Vite 8, React 19, TypeScript, Tailwind CSS 4, lucide-react — a single-page app talking to the REST API |
| **Tooling** | Django test runner (unit, API, query-count tests), `tsc --noEmit` type checking |

The original blueprint specified a Next.js frontend; the implemented frontend is a Vite + React SPA
(decision `DEC-002`). Older planning documents that still describe Next.js carry a note saying so.

---

## 4. Architecture

```
 Browser (Vite + React SPA, port 3000)
   │  JWT Bearer token · /api/v1/* proxied by Vite in development
   ▼
 Django REST API (port 8000)
   ├── users          custom User (email login, role, hourly cost rate), auth endpoints
   ├── clients        client directory
   ├── projects       projects + assignments, demo-data generator
   ├── time_tracking  time entries with rate snapshots, ledger summary
   ├── expenses       two-stage review workflow, expense summary
   ├── profitability  pure financial engine, project & portfolio summaries   (no models)
   └── ai_advisor     context sanitizer, Gemini client, grounding validator  (no models)
   │
   ├──► PostgreSQL (Neon)
   └──► Google Gemini API (server-to-server; key never reaches the browser)
```

**Principles:** the backend owns every calculation, permission and validation; the UI hiding a
control is never treated as security. Financial models use `PROTECT` foreign keys so cost history
cannot be cascade-deleted. Full detail: [`docs/architecture.md`](docs/architecture.md).

---

## 5. Financial engine

`backend/profitability/services.py` — pure functions over `Decimal` (floats raise `TypeError`).

| Metric | Formula |
| :--- | :--- |
| Actual labor cost | Σ (hours × hourly cost snapshot), each entry rounded half-up to the cent |
| Actual expense cost | Σ approved expenses |
| Actual total cost | labor + approved expenses |
| Budget consumption % | actual ÷ budget × 100 (`null` if the budget is 0) |
| Remaining labor cost | remaining hours × planned rate (`null` if remaining hours unknown) |
| Projected final cost | actual + remaining labor + expected remaining expenses |
| Projected profit / margin | revenue − projected cost; ÷ revenue × 100 (`null` if revenue is 0) |

**Risk precedence (first match wins):**

1. `over_budget` — actual cost already exceeds the budget (beats missing data)
2. `insufficient_data` — budget missing/zero or remaining hours unknown
3. `at_risk` — projected cost exceeds budget, **or** ≥ 80 % consumed with work remaining (threshold configurable via `MARGINWATCH_CONSUMPTION_WARNING_PCT`)
4. `healthy` — everything within budget

Benchmark scenarios, edge cases and rounding rules: [`docs/financial-rules.md`](docs/financial-rules.md),
[ADR-003](docs/decisions/ADR-003-financial-rules-and-risk-classification.md).

---

## 6. AI Risk Advisor

`POST /api/v1/projects/{id}/ai-risk-analysis/` (managers only, 10 requests/hour/user).

- **Input:** the Phase 6 financial summary, built from an allow-list — the project is identified as `PRJ-xxxxxxxx`; no project/client names, descriptions, people, emails or individual rates are sent.
- **Output:** JSON with an executive summary, 1–3 risk drivers, 2–4 recommendations and data gaps, validated against a schema.
- **Grounding check:** a reply is rejected if it quotes any money figure, percentage or hour count that is not in the context.
- **Resilience:** one call, 10-second timeout, no retries; failures return `503`/`502` with an error code while all financial figures keep working.
- **Caching:** identical figures reuse the last analysis for 24 h; any change produces a fresh one.

**Evaluation** (`python manage.py evaluate_ai_advisor`, 15 benchmark scenarios from
[`docs/ai-risk-advisor.md`](docs/ai-risk-advisor.md)): with `gemini-3.5-flash-lite`, **13/15 valid
replies, 0 rejected by the grounding check**; the two failures were a provider timeout and a
provider "high demand" error. Report: [`docs/evaluations/ai-advisor-2026-10-19.md`](docs/evaluations/ai-advisor-2026-10-19.md).

---

## 7. Getting started

### Prerequisites

- Python 3.15 (e.g. a Conda env named `projectfinance`)
- Node.js 18+ and npm
- A PostgreSQL connection string (a free [Neon](https://neon.tech) database works), or nothing for SQLite
- Optional: a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) for the AI advisor

### 1. Configure environment

Create **`.env.local` in the repository root** (it is git-ignored) using [`.env.example`](.env.example):

```
DJANGO_SECRET_KEY=any-long-random-string
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
GEMINI_API_KEY=your-key            # optional
GEMINI_MODEL=gemini-3.8-flash      # optional; gemini-3.5-flash-lite if 3.8 is busy
```

### 2. Backend

```bash
cd backend
conda activate projectfinance
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_dev_users          # manager@agency.com / ManagerPass123!, dev@agency.com / DevPass123!
python manage.py seed_demo_data          # optional: realistic bulk data (see §8)
python manage.py runserver               # http://127.0.0.1:8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                              # http://localhost:3000 (proxies /api to :8000)
```

Sign in at <http://localhost:3000> with one of the accounts above. Managers see the portfolio
dashboard and add staff under **Profile & Team Governance**; team members see only their assigned
projects, time and expenses, and can change their password under **Profile & Security**. There is no
public sign-up — the first manager comes from `seed_dev_users` (or `createsuperuser`).

---

## 8. Demo data

```bash
python manage.py seed_demo_data                  # medium (default)
python manage.py seed_demo_data --scale large    # 66 staff, 180 projects, 24 months — load testing
python manage.py seed_demo_data --reset          # regenerate
python manage.py seed_demo_data --delete         # remove demo data only
```

The **medium** scale creates *Brightloop Studio*: 4 managers and 30 staff (including 2 former
employees and one pay raise each, so rate snapshots vary), 24 clients in USD/EUR/GBP, 80 projects in
every lifecycle status, ~11.7k time entries (~45k hours, max 9 h per person per day) and ~430
expenses in all review states. Budgets are derived from the generated actuals so the active
portfolio contains a realistic mix of healthy, at-risk, over-budget and missing-estimate projects.

- Deterministic for a given `--seed`; inserts in bulk (~17 s against Neon).
- Every record is tagged (`@brightloop-demo.io` staff, `[demo-seed]` clients), so `--delete` never touches real data.
- All demo staff sign in with **`DemoPass123!`** (the command prints a manager and a team-member email).

---

## 9. API overview

All endpoints are under `/api/v1/`, require a Bearer token unless noted, return the
`{count, next, previous, page_size, results}` envelope for lists and
`{"error": {"code", "message", "details"}}` for errors. Full contract:
[`docs/api-specification.md`](docs/api-specification.md).

| Area | Endpoints |
| :--- | :--- |
| Auth | `POST auth/login/` · `auth/refresh/` (public) · `auth/logout/` · `auth/change-password/` · `GET/PATCH auth/me/` — there is no public sign-up |
| Users | `users/` CRUD (writes manager-only; delete = deactivate) |
| Clients | `clients/` CRUD (manager-only; delete = archive) |
| Projects | `projects/` CRUD · `projects/{id}/assignments/` (list/add) · `projects/{id}/assignments/{assignment_id}/` (revoke) |
| Time | `time-entries/` CRUD (filters `project_id`, `client_id`, `user_id`, `date_from`, `date_to`, `search`, `ordering`) · `time-entries/summary/` |
| Expenses | `expenses/` CRUD (`status`, `category`, …) · `expenses/{id}/review/` (manager) · `expenses/summary/` |
| Financials | `projects/{id}/financial-summary/` · `projects/financial-summaries/` · `dashboard/summary/?currency=USD` (manager-only) |
| AI | `projects/{id}/ai-risk-analysis/` (manager-only, POST) |

---

## 10. Testing

```bash
cd backend
python manage.py test --keepdb                       # full suite: 181 tests
python manage.py test profitability.tests.test_services   # 31 engine tests, no database, < 1 s
cd ../frontend && npx tsc --noEmit                   # type check
```

| App | Tests | Covers |
| :--- | :---: | :--- |
| `users` | 24 | auth, refresh/blacklist, no public sign-up, password strength, change password, role masking, user management |
| `clients` | 9 | CRUD, manager-only access, archive vs. protected delete |
| `projects` | 14 | lifecycle, masking, assignments, demo-data generator invariants |
| `time_tracking` | 11 | hours limits, snapshot immutability, half-up rounding, scoping |
| `expenses` | 15 | review state machine, reviewed-expense protection |
| `profitability` | 50 | benchmark scenarios TC-NUM-01…08, edge cases, precedence boundaries, fixed query counts, endpoints |
| `ai_advisor` | 38 | sanitization (no PII), grounding, schema limits, timeouts/quota/malformed replies, cache, throttle, no DB writes |
| `config` | 20 | error envelope, pagination, filters, N+1 regression, stable paging |

Gemini is mocked in every automated test; nothing calls the network. The full suite takes several
minutes against a remote Neon database (most of it is network round-trips).

---

## 11. Performance

Measured with the medium demo data (11,722 time entries) against Neon:

| | Before optimisation | After |
| :--- | :--- | :--- |
| Browser sign-in until all data loaded | 107 s, 140+ requests | **8 s, 14 requests** |
| Browser storage used | 4.05 MB | **85 KB** |
| `GET /projects/` (first page) | 22 queries, 1.2 s | **3 queries, 0.19 s** |
| All clients | 70 queries, 5.7 s | **2 queries, 0.1 s** |
| `GET /dashboard/summary/` | 3 queries | 3 queries, ~0.3 s |
| Financial summaries for 119 projects | — | 4 queries, ~0.55 s |

How: N+1 queries removed with annotations/prefetching, aggregate `summary` endpoints instead of
summing thousands of rows in the browser, per-screen paging with *Load more*, a primary-key
tie-breaker so paging never duplicates or skips rows, and financial summaries that load any number
of projects in a fixed number of queries.

---

## 12. Repository structure

```
margin_watch/
├── backend/
│   ├── config/          settings, URLs, error envelope, pagination, ordering, query-param validation
│   ├── users/  clients/  projects/  time_tracking/  expenses/
│   ├── profitability/   financial engine (services.py), selectors, summary endpoints
│   ├── ai_advisor/      context, prompts, validation, Gemini client, evaluation command
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.tsx                     screens and workflows
│       ├── components/                 auth, views, modals, shared UI
│       ├── hooks/usePagedList.ts       server-side paging
│       ├── services/                   API client, data helpers, financial summaries
│       ├── lib/financial-engine.ts     display formatters only (no calculations)
│       └── types/domain.ts
├── docs/                specs, ADRs, implementation plans, AI evaluation report
├── .env.example
└── CONTRIBUTING.md
```

---

## 13. Documentation

| Document | Contents |
| :--- | :--- |
| [`docs/requirements.md`](docs/requirements.md) | Functional and non-functional requirements, user stories |
| [`docs/financial-rules.md`](docs/financial-rules.md) | Formulas, rounding, missing-estimate policy, risk precedence, benchmark scenarios |
| [`docs/architecture.md`](docs/architecture.md) | System architecture and data flows |
| [`docs/data-model.md`](docs/data-model.md) · [`docs/backend/backend-apps-and-data-models.md`](docs/backend/backend-apps-and-data-models.md) | Entities, constraints, deletion policy, app boundaries |
| [`docs/api-specification.md`](docs/api-specification.md) | REST contract, envelopes, error codes |
| [`docs/security-and-permissions.md`](docs/security-and-permissions.md) | Role matrix, masking, secrets, throttling |
| [`docs/ai-risk-advisor.md`](docs/ai-risk-advisor.md) | Advisor guardrails, prompt, schema, evaluation scenarios |
| [`docs/testing-strategy.md`](docs/testing-strategy.md) | Test plan and case IDs |
| [`docs/decisions/`](docs/decisions/) | ADR-001 architecture, ADR-002 single agency, ADR-003 financial rules |
| [`docs/plans/`](docs/plans/) | Implementation plans for the financial engine and AI advisor, with the decisions taken |

---

## 14. Known limitations & next steps

- **Frontend polish:** a full role-guard audit, loading skeletons/empty states everywhere, and a responsive/accessibility pass are still to do.
- **Offline fallbacks:** saving/archiving a client and updating a remaining-hours estimate can still fall back to browser-only state if the API call fails.
- **One currency per project:** totals are never mixed across currencies; there is no conversion.
- **AI availability:** the larger Gemini Flash models are sometimes overloaded; the model is configurable and failures never affect financial figures.
- **No CI pipeline or production deployment yet;** the test suite runs against a remote database and takes several minutes.
