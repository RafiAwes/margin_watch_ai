# MarginWatch — Project Profitability & Budget Watchdog

**MarginWatch** is a B2B financial SaaS application designed for small-to-midsize software agencies to monitor client project delivery costs against planned budgets, forecast final project profitability, manage time and expense workflows, and surface actionable AI-assisted risk explanations before profit erosion occurs.

---

## Core Operational Question

Every screen, metric, and workflow in MarginWatch is engineered to help agency leaders and delivery teams immediately answer:

> **“Which projects are financially at risk, why are they at risk, and what should I do next?”**

---

## Documentation Architecture

This repository contains the complete, assessment-ready **Frontend Architecture, UI/UX & Implementation Blueprint**. In accordance with strict assessment integrity constraints, no application source code has been pre-generated; instead, this specification suite provides the complete architectural, visual, data-contract, and milestone-by-milestone engineering blueprint required for a solo developer to implement and defend the system independently.

### Frontend Specification Suite (`docs/frontend/`)

| Document | Scope & Purpose |
| :--- | :--- |
| [**`docs/frontend/README.md`**](./docs/frontend/README.md) | Repository audit findings, baseline financial rules & formulas, role permission matrix, verified technology stack, and architectural principles. |
| [**`docs/frontend/design-system.md`**](./docs/frontend/design-system.md) | Visual design direction, 60-30-10 color token table with WCAG 2.2 AA contrast verification, 2+1 typography scale (`Plus Jakarta Sans`, `Public Sans`, `JetBrains Mono` with `tabular-nums`), spacing, elevation, and layout shell contracts. |
| [**`docs/frontend/routes-and-pages.md`**](./docs/frontend/routes-and-pages.md) | Complete route evaluation, access control matrix, and page-by-page UX specifications for `/login`, `/dashboard`, `/clients/*`, `/projects/*`, `/expenses`, and `/settings`, including financial visualizations and the AI Risk Advisor interface. |
| [**`docs/frontend/component-architecture.md`**](./docs/frontend/component-architecture.md) | Reusable component inventory across 14 conceptual layers, feature-oriented folder structure, Server vs. Client Component boundaries, Next.js App Router architecture, and strict TypeScript/import governance. |
| [**`docs/frontend/api-integration.md`**](./docs/frontend/api-integration.md) | Authoritative Django REST API integration contracts, request/response schemas, timeout/retry policies, RBAC error handling, and TanStack Query cache invalidation matrices. |
| [**`docs/frontend/forms-and-state.md`**](./docs/frontend/forms-and-state.md) | React Hook Form + Zod schema specifications, explicit `null` estimate handling, server `400` validation mapping, URL state synchronization, and the 15 mandatory application states. |
| [**`docs/frontend/accessibility-and-responsive-design.md`**](./docs/frontend/accessibility-and-responsive-design.md) | WCAG 2.2 AA accessibility compliance, keyboard navigation flows, ARIA live-region patterns, reduced-motion rules, and mobile/tablet/desktop responsive adaptations. |
| [**`docs/frontend/testing-and-acceptance.md`**](./docs/frontend/testing-and-acceptance.md) | Comprehensive QA verification checklist, end-to-end user journeys, measurable acceptance criteria, and automated test planning (Vitest, React Testing Library, Playwright). |
| [**`docs/frontend/implementation-roadmap.md`**](./docs/frontend/implementation-roadmap.md) | Dependency-aware, 13-milestone implementation sequence tailored for a solo developer, complete with tasks, file inventories, manual test procedures, and completion gates. |

---

## Quick Start for Implementation

1. Review [**`docs/frontend/README.md`**](./docs/frontend/README.md) to understand the repository audit findings, baseline financial rules, and role matrix.
2. Follow [**`docs/frontend/implementation-roadmap.md`**](./docs/frontend/implementation-roadmap.md) starting at **Milestone 1 (Audit existing frontend and finalize design system)** and **Milestone 2 (Initialize and verify the frontend toolchain)**.
3. Verify each milestone against the acceptance checklists in [**`docs/frontend/testing-and-acceptance.md`**](./docs/frontend/testing-and-acceptance.md).
