# Contributing to MarginWatch

Thank you for your interest in contributing to **MarginWatch — Project Profitability & Budget Watchdog**.

This project is currently developed under an independent full-stack engineering workflow. The guidelines below are tailored to keep development disciplined, transparent, and auditable while remaining lightweight and practical for a single developer or small collaborative team.

---

## 1. Development Principles

1. **Documentation-Driven Development**: Requirements, business formulas, and API contracts defined in [`docs/`](docs/) are the authoritative source of truth. When technical decisions change, update the documentation alongside the code.
2. **Deterministic Financial Integrity**: Financial metrics and risk statuses must always be calculated using deterministic decimal arithmetic on the backend. Never rely on the client or non-deterministic AI for calculations.
3. **Defense in Depth**: The backend enforces all authorization and validation rules. Never trust client-side state.
4. **Independent Verifiability**: Every milestone must be backed by automated tests demonstrating that functional acceptance criteria are met.

---

## 2. Milestone-Driven Workflow

Work is organized according to the phases in [`docs/development-roadmap.md`](docs/development-roadmap.md). 

- Focus on one milestone at a time.
- Do not introduce out-of-scope abstractions or speculative features ahead of their scheduled milestone.
- Complete the milestone's Definition of Done before progressing to the next phase.

---

## 3. Branching and Commit Standards

### Branch Naming Conventions

Use short, descriptive branch names prefixed with the work type:

| Prefix | Usage | Example |
| :--- | :--- | :--- |
| `feat/` | New features or domain logic | `feat/time-entry-api` |
| `fix/` | Bug fixes and corrections | `fix/division-by-zero-budget` |
| `docs/` | Documentation additions or edits | `docs/financial-rules-worked-examples` |
| `test/` | Adding or updating test suites | `test/expense-approval-matrix` |
| `refactor/` | Code refactoring without changing behavior | `refactor/financial-service-cleanup` |
| `chore/` | Tooling, configuration, or dependency updates | `chore/initialize-marginwatch-repository` |

### Commit Message Conventions

Commit messages follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```text
<type>(<optional scope>): <short description in imperative present tense>

[optional body explaining motivation and trade-offs]

[optional footer noting issue references or breaking changes]
```

**Examples:**
- `feat(projects): add deterministic risk calculation service`
- `fix(expenses): reject approved expense deletion attempts`
- `docs(api): document error response envelope for authentication`
- `chore: initialize MarginWatch repository`

Keep commits small, atomic, and focused on a single logical change. Avoid monolithic "cleanup" commits.

---

## 4. Pre-Commit Sanity Checklist

Before committing changes to version control, verify the following:

- [ ] **Tests Pass**: Run the backend (Python 3.15) and frontend test suites locally.
- [ ] **No Secrets**: Ensure no API keys, database credentials, or secret keys are present in code or configuration.
- [ ] **Documentation Aligned**: If an API endpoint, data field, or formula was altered, corresponding documentation in `docs/` has been updated.
- [ ] **Lint and Format**: Code follows standard conventions (e.g., PEP 8 / `black` / `flake8` for Python 3.15, ESLint / Prettier for TypeScript).
- [ ] **Clean Git Status**: Only files intended for the commit are staged. No leftover scratch files or temporary databases.

---

## 5. Security & Secret Hygiene

- MarginWatch handles sensitive agency financial data (contract revenues, internal hourly costs, expense receipts).
- **Never commit `.env` or any file containing real credentials.** The repository includes a safe [`.env.example`](.env.example) template.
- The Google Gemini API key must **never** be exposed in the frontend or prefixed with `NEXT_PUBLIC_`.
- If a secret is accidentally committed, rotate the credential immediately and scrub the repository history.

---

## 6. Proposing Improvements or Reporting Issues

If you identify a bug, edge case in the financial rules, or architecture concern:

1. **Search Existing Documentation**: Check [`docs/requirements.md`](docs/requirements.md) and [`docs/financial-rules.md`](docs/financial-rules.md) to confirm whether the observed behavior is an intended specification.
2. **File an Issue**: Include a concise description, steps to reproduce, expected versus actual behavior, and reference the relevant requirement ID (e.g., `FR-012` or `NFR-004`).
3. **Propose an ADR**: For significant architectural or financial rule changes, draft an Architecture Decision Record in [`docs/decisions/`](docs/decisions/).
