# ADR-002: Single-Agency Architecture and Scoped Authorization

**Status:** Accepted  
**Date:** October 2026  
**Deciders:** Lead Architect, Django REST Framework Specialist, Full-Stack Developer  
**Related Documents:** [docs/requirements.md](../requirements.md), [docs/architecture.md](../architecture.md), [docs/data-model.md](../data-model.md), [docs/security-and-permissions.md](../security-and-permissions.md), [ADR-001](ADR-001-initial-architecture.md), [ADR-003](ADR-003-financial-rules-and-risk-classification.md)

---

## 1. Context & Problem Statement

MarginWatch is being developed as a focused, high-integrity project profitability and budget risk watchdog for an engineering assessment. Small software development agencies need immediate, unambiguous visibility into project burn rates, labor cost accumulation, and projected overruns.

Initial discussions considered whether to architect the system as a multi-tenant Software-as-a-Service (SaaS) platform featuring explicit `Agency`, `Tenant`, and `AgencyMembership` database models, or to implement a single-agency application.

Given the assessment scope, constrained implementation timeline, and the critical imperative to deliver flawless financial business logic, clean security boundaries, and high test coverage:
1. Multi-tenant abstractions (tenant routing, agency scoping filters on every SQL query, tenant isolation middleware, organization management endpoints) would consume excessive development and testing bandwidth without solving the primary financial problem.
2. The core business challenge is tracking project profitability within an agency, not managing multi-company SaaS subscriptions.

---

## 2. Decision

We have decided to architect MarginWatch as a **single-agency application**:
1. **Implicit Agency Representation:** The single software agency is represented implicitly by the deployed application instance itself.
2. **No Agency or AgencyMembership Models:** No `Agency`, `Tenant`, or `AgencyMembership` tables exist in the database.
3. **Core Model Baseline:** The database contains exactly six core models:
   - `User`
   - `Client`
   - `Project`
   - `ProjectAssignment`
   - `TimeEntry`
   - `Expense`
4. **Application Roles:** Users possess one of two application-level roles:
   - `MANAGER`: Full visibility across all agency clients, projects, financial summaries, and expense review workflows.
   - `TEAM_MEMBER`: Scoped access strictly to assigned projects, permitted to log time and submit expenses for those projects without viewing client contracts, project budgets, profit margins, or colleague cost rates.
5. **Project-Level Access Boundaries:** Access for team members is controlled explicitly via `ProjectAssignment` records linking `User` to `Project`.
6. **Multi-Agency Out of Scope:** Multi-agency and multi-tenant capabilities are declared out of scope for the MVP and must not introduce speculative abstractions or unused complexity into the codebase.

---

## 3. Alternatives Considered & Rejection Rationale

### Alternative 1: Multi-Tenant Architecture with `Agency` and `AgencyMembership` Tables
* **Description:** Introducing an `Agency` model, an `AgencyMembership` join model (allowing users to belong to multiple agencies with differing roles), and foreign keys `agency_id` on `Client`, `Project`, `TimeEntry`, and `Expense`.
* **Why Rejected:**
  - *Premature Generalization:* Adds substantial boilerplate across models, managers, serializers, and permission classes before proving the core financial calculation engine.
  - *Security & Leakage Risk:* Multi-tenant data segregation requires rigorous query filtering at every layer; any accidental omission of an `agency_id` filter creates a critical data leakage vulnerability.
  - *Assessment Dilution:* Distracts engineering focus away from the primary evaluation criteria: exact financial arithmetic, rate snapshot preservation, deterministic risk precedence, and safe AI integration.

### Alternative 2: Row-Level Tenant Isolation via Schema-per-Tenant or Separate Databases
* **Description:** Provisioning dedicated PostgreSQL schemas or distinct databases per agency.
* **Why Rejected:** Introduces immense DevOps, migration, and connection pooling complexity wholly disproportionate to an independent assessment project.

---

## 4. Consequences & Verification

### Positive Consequences
- **Radical Simplicity:** Removes complex agency-management routing, foreign keys, and redundant query filters.
- **Direct Authorization Logic:** Permissions evaluate `request.user.role == 'MANAGER'` and `ProjectAssignment` existence without traversing nested agency memberships.
- **Database Schema Clarity:** Exactly six clean, relational models with unambiguous foreign key relationships and clear deletion policies.
- **Robust Security Posture:** Eliminates tenant-switching and tenant-spoofing vectors. Financial data masking remains strictly enforced between Managers and Team Members.

### Negative Consequences & Trade-Offs
- The application cannot serve multiple commercial software agencies from a single deployed instance without deploying isolated environments per agency.
- Future multi-agency capabilities (if ever prioritized for a commercial SaaS pivot in v2.0+) would require a dedicated database migration adding tenancy keys. This trade-off is accepted as intentional and appropriate.

---

## 5. Review & Compliance Checklist

- [x] No `Agency` or `AgencyMembership` models are defined in documentation or data models.
- [x] No `agency_id` attributes are accepted or required in API request bodies or query parameters.
- [x] Application roles are strictly `MANAGER` and `TEAM_MEMBER`.
- [x] Team member access is governed strictly by `ProjectAssignment`.
- [x] All financial business rules, rate snapshotting, expense state machines, and deterministic risk classifications remain 100% intact.
