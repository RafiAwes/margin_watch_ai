# Phase 8 — AI Risk Advisor: Implementation Plan

**Status:** DRAFT — awaiting owner review (no code written yet)
**Date:** October 19, 2026
**Authorities:** [`docs/ai-risk-advisor.md`](../ai-risk-advisor.md), [`docs/api-specification.md` §8](../api-specification.md), [`docs/security-and-permissions.md` §3.3, §4, §5.2](../security-and-permissions.md), [`docs/requirements.md` FR-028…030, US-M7](../requirements.md), [`docs/testing-strategy.md` TC-AI-01…05](../testing-strategy.md)
**Builds on:** Phase 6 financial summary (`profitability.selectors.summarize_projects`)

---

## 1. Goal

A manager clicks **Analyze risk** on a project and receives a plain-language explanation of the
deterministic status plus 2–4 concrete recommendations, produced by Gemini **server-side** from the
Phase 6 figures only. The AI never calculates, never changes the status, never writes data, and its
failure never affects the financial screens.

**Done means:**
- `POST /api/v1/projects/{id}/ai-risk-analysis/` (manager-only, 10/hour/user) returning spec §8.1.
- Sanitized context (no names, emails, wages, descriptions), strict output validation, 503/502 fallbacks.
- TC-AI-01…05 + sanitization + grounding tests pass with a **mocked** Gemini (no network in tests).
- Frontend panel uses the real endpoint; the fake seeded AI text is removed.
- An evaluation report of the 15 benchmark scenarios, produced by a command you run with a real key.

---

## 2. Findings that change the original spec

| # | Finding | Impact |
|:-:|:--|:--|
| F1 | **Model.** Docs specify `gemini-2.5-flash`. Google's models page now lists `gemini-3.8-flash` / `gemini-3.6-flash` as current stable Flash models and says 2.5 access is limited to users who used it recently, so a new key may not reach it. | Model must be configurable (`GEMINI_MODEL`, already in `.env.example`); default proposed in D1. |
| F2 | **SDK.** `google-genai` is at 2.31.0 (Oct 14, 2026), requires Python ≥ 3.10; JSON output is documented via `response_json_schema` (not the older `response_schema`). | Use current API names; verify timeout units in the installed version (sources disagree: seconds vs ms). |
| F3 | **Python 3.15.** Your `projectfinance` env is Python 3.15.0; `google-genai` classifiers list up to 3.14 and it depends on `pydantic` (not installed). Wheels may be missing. | Fallback planned (D2): call the Gemini REST endpoint with the standard library. |
| F4 | **Dashboard spotlight** (`App.tsx`) generates an analysis automatically on every dashboard load. With a real model that is a paid call per page view and burns the 10/hour limit. | D5. |
| F5 | **Frontend type mismatch.** The panel's `AiRiskAnalysis` (`ai_summary`, `suggested_actions[].action_type`, …) does not match spec §3 (`executive_summary`, `primary_risk_drivers`, `actionable_recommendations`, `data_gaps_and_assumptions`). | Frontend type replaced by the spec shape. |
| F6 | **No throttling exists yet.** DRF throttles need a cache; none is configured (Django defaults to per-process local memory). | Fine for the MVP; noted for production. |

---

## 3. Decisions needed

| # | Question | Options | Recommendation |
|:-:|:--|:--|:--|
| **D1** | Default model | A. `gemini-3.8-flash` (current stable Flash). B. Keep `gemini-2.5-flash`. C. `gemini-3.5-flash-lite` (cheaper). | **A**, overridable with `GEMINI_MODEL`. The evaluation report records the model used. |
| **D2** | Client library | **A.** Official `google-genai` SDK, pinned (`google-genai>=2.31,<3`). B. Direct REST call with `urllib` (no new dependencies). | **A if it installs on Python 3.15**; step 8.1 tries it first. If wheels fail, switch to **B** (same tests, same behaviour). |
| **D3** | Grounding check (numbers in the reply must exist in the context) | **A.** Reject the reply (502 "could not be validated") if it quotes a money figure, percentage or hour count not present in the context. B. Return it but list unverified numbers. C. No check. | **A** — it directly enforces "never invents figures". The allowed set includes every context value and its common display forms ($1,234.56 / $1,234 / 1234.56). The evaluation measures the rejection rate; if it is high we relax to B. |
| **D4** | Caching | **A.** Cache by a hash of the sanitized context (Django cache, 24 h). Same figures → same advice, no new call, response marked `"cached": true`. B. No cache (call every click). | **A** — saves cost and quota; any change to the figures produces a new hash and a fresh analysis. |
| **D5** | Dashboard spotlight (F4) | **A.** Show the deterministic risk reasons there plus an "Open AI analysis" link to the project page; no automatic AI call. B. Keep auto-analysis. | **A**. |
| **D6** | When no `GEMINI_API_KEY` is set | **A.** Endpoint returns `503 AI_NOT_CONFIGURED`; panel says "AI advisor is not configured". B. Keep the canned seed text as a fallback. | **A** — never present template text as AI output. The seed `AI_ADVISOR_DATA` and `buildProjectAiRiskAnalysis` are deleted. |
| **D7** | Project identity sent to Gemini | **A.** A neutral code `PRJ-<first 8 chars of the id>`; no project name, client name or description. B. Send the project name. | **A** (security §3.3: only project codes and anonymized metrics). |

---

## 4. Backend design

### 4.1 New app `backend/ai_advisor/` (no models)

```
ai_advisor/
  context.py     # Phase 6 summary → sanitized context dict (allow-list, not block-list)
  prompts.py     # system prompt (ai-risk-advisor.md §4) + output JSON schema (§3)
  client.py      # GeminiClient.generate(system, context, schema) → raw text; typed errors
  validation.py  # parse + validate output (schema, item counts, lengths) + grounding check (D3)
  services.py    # analyze_project(project) → AdvisorResult; caching (D4); error mapping
  views.py, urls.py
  management/commands/evaluate_ai_advisor.py   # 15-scenario evaluation (needs real key)
  tests/test_context.py, test_validation.py, test_services.py, test_api.py
```

### 4.2 Context (allow-list — only these keys are ever sent)

`project_code`, `project_status`, `currency`, `contract_revenue`, `planned_cost_budget`,
`total_hours_logged`, `actual_labor_cost`, `approved_expenses`, `actual_total_cost`,
`budget_consumption_percentage`, `estimated_remaining_hours`, `planned_hourly_cost_rate`,
`estimated_remaining_labor_cost`, `expected_remaining_expenses`, `projected_final_cost`,
`projected_cost_variance`, `projected_profit`, `projected_profit_margin_percentage`,
`pending_expenses_count`, `pending_expenses_total`, `deterministic_status`, `deterministic_rule`,
`deterministic_reasons`, `warning_threshold_percentage`, `assumptions`.

Never sent: project/client names, descriptions, any user name or email, per-person rates or
time-entry rows, expense descriptions. A test asserts the serialized context contains none of the
fixture's names, emails or descriptions.

### 4.3 Model call

- System prompt = ai-risk-advisor.md §4 verbatim, plus "quote only figures that appear in the context".
- Structured JSON output (`response_mime_type="application/json"` + JSON schema), low temperature (0.2), output-token cap.
- **10 s timeout** enforced by the client; no automatic retries inside the 10 s budget.
- Typed errors → HTTP: timeout → `503 AI_TIMEOUT`; HTTP 429 → `503 AI_QUOTA_EXCEEDED`; other provider/network errors → `503 AI_UNAVAILABLE`; missing key → `503 AI_NOT_CONFIGURED`; invalid JSON / schema / grounding failure → `502 AI_RESPONSE_INVALID`. All in the standard error envelope, message always ends with "Deterministic financials remain valid."

### 4.4 Output validation (ai-risk-advisor.md §3)

`executive_summary`: non-empty, ≤ 600 chars · `primary_risk_drivers`: 1–3 strings ·
`actionable_recommendations`: 2–4 strings · `data_gaps_and_assumptions`: 0–4 strings ·
no extra keys · each string ≤ 400 chars · grounding check (D3).

### 4.5 Endpoint

`POST /api/v1/projects/{id}/ai-risk-analysis/` — `IsAuthenticated` + `IsManager`,
`ScopedRateThrottle` scope `ai_advisor` = `10/hour` (429 envelope `THROTTLED`). Response = spec §8.1
plus `model`, `cached`. Read-only: the view never writes to the database (TC-AI-05).

```json
{
  "project_id": "…",
  "deterministic_status": "at_risk",
  "ai_advisor": {
    "executive_summary": "…",
    "primary_risk_drivers": ["…"],
    "actionable_recommendations": ["…", "…"],
    "data_gaps_and_assumptions": ["…"]
  },
  "generated_at": "2026-10-19T10:15:00Z",
  "model": "gemini-3.8-flash",
  "cached": false
}
```

### 4.6 Settings / environment (backend only — never `VITE_*`)

`GEMINI_API_KEY` (required to enable), `GEMINI_MODEL` (default per D1), `GEMINI_TIMEOUT_SECONDS`
(default 10), `MARGINWATCH_AI_CACHE_SECONDS` (default 86400), throttle rate `ai_advisor: 10/hour`.

---

## 5. Frontend design

- `apiClient.ai.analyzeProject(id)`; `AiRiskAnalysis` type replaced by the spec §8.1 shape.
- Project detail panel: **Analyze risk** button (no automatic call), loading state, the four sections,
  `generated_at`, "cached" note, model name, "AI Advisory — explains, never changes figures" label.
- Errors shown inside the panel only (not configured / timed out / quota / invalid reply / rate limited);
  the rest of the page is untouched.
- Dashboard spotlight (D5): deterministic reasons + link to the project page.
- Delete `AI_ADVISOR_DATA` (seed) and `buildProjectAiRiskAnalysis` (D6). Hidden for team members.

---

## 6. Steps (one checkpoint each)

| Step | Work | Verification |
|:--:|:--|:--|
| 8.1 | Try `pip install google-genai` on Python 3.15; record result (D2). Add dependency to `requirements.txt` or choose REST. Inspect installed `HttpOptions` timeout units. | Import works / decision recorded |
| 8.2 | `context.py` + tests (allow-list, values match Phase 6 summary, no PII). | `test_context` |
| 8.3 | `prompts.py` + `validation.py` + tests (schema limits, extra keys, grounding pass/fail cases). | `test_validation` (no DB) |
| 8.4 | `client.py` + `services.py` (caching, error mapping) + tests with a fake client: TC-AI-01 success, 02 timeout, 03 quota, 04 malformed, not-configured, cache hit/miss. | `test_services` |
| 8.5 | View, URL, throttle + API tests: 200 shape, 401/403/404, 429 after 10 calls, TC-AI-05 (row counts unchanged). | `test_api` |
| 8.6 | Frontend: client method, types, panel states, spotlight change, remove mock AI. | `tsc`; browser with key unset → "not configured"; with key → real analysis |
| 8.7 | `evaluate_ai_advisor` command: builds the 15 scenarios as synthetic Phase 6 summaries, calls the live model, writes `docs/evaluations/ai-advisor-<date>.md` with automatic checks (valid schema, grounding, status mentioned) and blank 1–5 columns for your manual scoring. | You run it with your key |
| 8.8 | Docs (api-spec §8 model/caching/errors, ai-risk-advisor.md model + evaluation results, testing-strategy, architecture model name), full suite, PROJECT_CONTEXT sync. | Full suite + `tsc` |

Backend (8.1–8.5, 8.7) and frontend (8.6) can be committed separately as before.

---

## 7. Out of scope

Persisting analyses in the database (history), streaming responses, multi-language output, letting
the AI call tools or write data, automatic re-analysis on data change, production cache/throttle
backends (Redis).

## 8. Risks

- **Python 3.15 compatibility** of the SDK (F3) — mitigated by the REST fallback.
- **Model availability/pricing** changes — model is configurable; evaluation records the model.
- **Grounding false rejections** (model rounds "$94,900" to "$95k") — prompt forbids rounding; evaluation measures it; D3 fallback to "flag" mode.
- **Live evaluation needs your key and incurs small API costs** (15 calls).
