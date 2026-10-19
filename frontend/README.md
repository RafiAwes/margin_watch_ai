# MarginWatch — Frontend

Single-page app for MarginWatch, built with **Vite 8, React 19, TypeScript and Tailwind CSS 4**.
It talks only to the Django REST API (`/api/v1/`); every financial figure, risk status and
permission comes from the backend. See the root [`README.md`](../README.md) for the full project.

## Run

```bash
npm install
npm run dev        # http://localhost:3000 — proxies /api to http://127.0.0.1:8000
npm run build      # production build into dist/
npx tsc --noEmit   # type check
```

Start the backend first (`python manage.py runserver` in `../backend`). Optional configuration:
copy `.env.example` to `.env.local`. Only `VITE_*` variables reach the browser, so never put
secrets here — the Gemini key lives in the backend environment.

## Structure

| Path | Purpose |
| :--- | :--- |
| `src/App.tsx` | Shell, navigation and the main screens (dashboard, projects, clients, time ledger, expenses, settings) |
| `src/components/auth/` | Sign-in and registration |
| `src/components/views/` | Project detail (financials, time, expenses, AI Risk Advisor panel), profile & team management |
| `src/components/modals/` | Project, client, time-entry, expense, estimate and rejection forms |
| `src/components/shared/` | Status badges, budget/forecast chart, *Load more* footer |
| `src/hooks/usePagedList.ts` | Server-side paging for large lists (one page at a time) |
| `src/services/api-client.ts` | Typed REST client: JWT bearer tokens, refresh with in-flight de-duplication, error-envelope parsing |
| `src/services/auth-and-store.ts` | Data helpers: transforms, page/summary fetchers, mutations |
| `src/services/financials.ts` | Maps backend financial summaries and dashboard totals onto UI types |
| `src/lib/financial-engine.ts` | Currency/percentage/hour **formatters only** — no financial calculations happen in the browser |
| `src/types/domain.ts` | Domain types |

## Conventions

- **Backend is authoritative.** The UI never computes budgets, forecasts or risk; it renders `/projects/financial-summaries/` and `/dashboard/summary/`.
- **Role-aware UI, server-enforced security.** Hiding a control for team members is a usability choice; the API masks and rejects on its own.
- **No bulk loading.** Time entries and expenses are fetched per screen with paging and filters; totals come from `/time-entries/summary/` and `/expenses/summary/`. They are not cached in `localStorage`.
- **Failures stay local.** A failed time-entry, expense or project write shows an error toast and leaves the screen unchanged; an AI advisor failure only affects its own panel.

## Design documents

[`docs/frontend/`](./docs/frontend/) holds the original pre-implementation UX blueprint (design
system, routes, accessibility, acceptance checklists). It was written for a Next.js + TanStack Query
stack; each document carries a note describing what was actually built.
