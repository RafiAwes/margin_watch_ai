# ADR-001: Initial Architecture, Technology Stack, and AI Boundary

**Status:** Accepted (Initial Architectural Decision — Revisitable with Empirical Evidence)  
**Date:** October 2026  
**Deciders:** Lead Architect & Full-Stack Developer  
**Consulted:** Technical Evaluation Guidelines, Financial Domain Best Practices  


> **Amendment (October 2026):** the frontend was implemented as a **Vite + React 19 + TypeScript +
> Tailwind CSS single-page app** instead of Next.js (decision `DEC-002`: faster iteration, no SSR
> requirement for an authenticated dashboard, and a working prototype already existed). The decoupled
> API boundary, backend authority and AI boundary in this ADR are unchanged. The database is
> PostgreSQL on Neon from the start (SQLite remains a fallback when `DATABASE_URL` is unset). The
> rationale below is kept as the original decision record.

---

## 1. Context & Problem Statement

Small software delivery agencies struggle to detect impending budget overruns before they materialize as operational losses. MarginWatch is being designed to provide early warnings regarding project budget consumption, labor cost accumulation, and projected completion costs.

The system requires:
1. Rock-solid financial accuracy and auditability.
2. Clear separation of privileges between agency leadership and team contributors.
3. An intuitive, responsive user interface.
4. Intelligent advisory capabilities that enhance decision-making without introducing financial hallucinations or autonomous risks.
5. High developer velocity for an independent engineer while maintaining a clear evolution path to production scale.

---

## 2. Decision Summary

We have decided on the following initial architecture:
1. **Decoupled Architecture:** Separate Next.js frontend and Django REST Framework (DRF) backend communicating over a versioned REST API (`/api/v1/`).
2. **Backend Stack:** Python 3.15 with Django and Django REST Framework.
3. **Frontend Stack:** Next.js (App Router), TypeScript, and Tailwind CSS. *(Amended — see the note at the top: implemented as a Vite + React 19 SPA.)*
4. **Initial Database:** SQLite for local development (Phases 1–7), with a direct migration path to PostgreSQL for production deployments (Phase 8+).
5. **Deterministic Financial Engine:** All financial calculations and risk classifications are implemented as pure, deterministic Python functions using exact decimal arithmetic (`Decimal`).
6. **Advisory-Only AI Layer:** The Google Gemini API is accessed strictly server-side by the backend. It acts as an explanation and recommendation engine; it is never the source of truth for financial figures or project risk statuses, and it holds zero write permissions.

---

## 3. Rationale & Trade-Off Analysis

### 3.1 Why Separate Next.js and Django REST Framework?
* **Alternative Considered:** Next.js Full-Stack (Server Actions / Route Handlers) with an ORM like Prisma or Drizzle.
* **Why Django + Next.js was chosen:**
  - *Domain Separation:* Django provides a battle-tested, mature security model (authentication, permission checks, ORM security, admin interface) and Python's native `decimal.Decimal` module, which is the industry standard for financial software.
  - *Security Encapsulation:* Keeping the financial engine in a dedicated backend ensures that proprietary rate cards, historical cost snapshots, and AI credentials never leak into client-side JS bundles.
  - *Frontend Specialization:* Next.js provides modern React paradigms (server components, fast client navigation, reactive state) optimized for user experience.
* **Trade-Off:** Requires running two development servers (port 3000 and port 8000) and managing CORS headers during local development.

### 3.2 Why SQLite for Initial Development?
* **Alternative Considered:** PostgreSQL via Docker Compose from Day 1.
* **Why SQLite was chosen:**
  - *Simplicity & Portability:* SQLite is built into Python. It requires zero daemon installations, zero container configurations, and enables instantaneous project checkout and test execution.
  - *Django ORM Abstraction:* Django's ORM generates database-agnostic SQL. Standard data types (`CharField`, `DecimalField`, `ForeignKey`, `DateTimeField`) translate directly to PostgreSQL without code refactoring.
* **When PostgreSQL will be introduced:**
  - In Phase 8 (Production Readiness), PostgreSQL will be introduced to support concurrent database writes, robust connection pooling, and production deployment environments.

### 3.3 Why Keep Financial Calculations Purely Deterministic?
* **Alternative Considered:** Letting an AI model compute projected burn rates or allowing client-side JavaScript to compute margins.
* **Why Deterministic Backend Math was chosen:**
  - *Zero Hallucination Tolerance:* Financial software cannot tolerate "approximate" or hallucinatory figures. Agency owners make payroll and hiring decisions based on these metrics.
  - *Auditability & Reproducibility:* Deterministic math guarantees that two managers viewing the same project at the same moment see identical numbers to the exact cent.
* **Trade-Off:** Requires writing explicit formulas, validation checks, and unit test suites rather than relying on LLM reasoning.

### 3.4 Why Is AI Strictly an Advisory Layer?
* **Alternative Considered:** Autonomous AI agents capable of altering project budgets, sending emails to clients, or automatically approving timesheets/expenses.
* **Why Advisory AI was chosen:**
  - *Risk Containment:* Autonomous agent actions introduce significant operational risks (e.g., unintended budget reductions, accidental expense approvals, exposure of sensitive rate negotiations).
  - *Human-in-the-Loop:* MarginWatch uses AI to reduce cognitive load—explaining *why* a project is at risk and suggesting actionable mitigations—while leaving final operational decisions firmly in the hands of the Manager.
  - *Reliability:* If the external AI service experiences a network outage, quota limit, or latency spike, the core application continues to deliver full financial monitoring without degradation.

---

## 4. Consequences & Verification

### Positive Consequences
- Clear mental model and clean modularity for an independent developer.
- Rapid test execution using SQLite in-memory test databases.
- High security confidence with server-side rate masking and credential isolation.
- Complete audit trail with immutable rate snapshots.

### Negative Consequences / Risks
- Managing two languages (Python and TypeScript).
- Need for explicit API serialization and type synchronization between DRF and Next.js.
- Requires diligent mocking of external AI APIs in automated test suites to avoid test flakiness.

---

## 5. Review & Revisit Triggers

This decision record will be formally revisited if:
1. Concurrent write contention in local testing demonstrates limitations in SQLite before Phase 8.
2. Emerging requirements demand real-time bi-directional streaming (e.g., WebSockets for multi-user live timers).
3. Production deployment constraints favor an alternate hosting environment.
