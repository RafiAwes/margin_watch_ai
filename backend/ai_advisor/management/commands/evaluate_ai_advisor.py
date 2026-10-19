"""
Runs the 15 benchmark scenarios from docs/ai-risk-advisor.md §6 against the live Gemini model
and writes a Markdown report with automatic checks plus blank 1–5 columns for manual scoring.

Scenarios are synthetic Phase 6 inputs (no database access). Requires GEMINI_API_KEY.

    python manage.py evaluate_ai_advisor --dry-run          # build contexts only, no API calls
    python manage.py evaluate_ai_advisor                    # all 15 scenarios (15 API calls)
    python manage.py evaluate_ai_advisor --scenarios 3,7    # a subset
"""

import time
import uuid
from datetime import date
from decimal import Decimal as D
from pathlib import Path
from types import SimpleNamespace

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from ai_advisor.client import AdvisorError, AdvisorNotConfigured
from ai_advisor.context import build_context
from ai_advisor.services import advise, get_client
from profitability.services import ProjectFinancialInputs, summarize_project

RATE = D("100.0000")


def scenario(number, profile, expected, focus, *, revenue="50000", budget="30000", labor="0",
             remaining="100", approved=(), pending=(), entries=None, planned_rate=RATE):
    labor = D(labor)
    time_entries = entries if entries is not None else (((labor / RATE, RATE),) if labor > 0 else ())
    return {
        "number": number,
        "profile": profile,
        "expected_status": expected,
        "focus": focus,
        "inputs": ProjectFinancialInputs(
            currency="USD",
            contract_revenue=D(revenue),
            planned_cost_budget=D(budget),
            planned_hourly_cost=planned_rate,
            estimated_remaining_hours=D(remaining) if remaining is not None else None,
            expected_remaining_expenses=D("0.00"),
            time_entries=tuple(time_entries),
            approved_expenses=tuple(D(a) for a in approved),
            pending_expenses=tuple(D(a) for a in pending),
        ),
    }


SCENARIOS = [
    scenario(1, "Early project, low spend, low hours", "healthy",
             "Confirm safe trajectory; recommend a regular estimate cadence.", labor="2000", remaining="250"),
    scenario(2, "Mid-project, 50% budget consumed, on track", "healthy",
             "Note positive margin; warn against scope expansion without change orders.", labor="15000", remaining="120"),
    scenario(3, "82% budget consumed, forecast within budget", "at_risk",
             "Explain the 80% consumption heuristic; highlight the narrow buffer.", labor="24600", remaining="40"),
    scenario(4, "50% budget consumed, but huge remaining hours", "at_risk",
             "Highlight the forecast overrun driver; recommend scope triage or rate re-mix.", labor="15000", remaining="250"),
    scenario(5, "Actual spend at 105% of budget", "over_budget",
             "Immediate overrun alert; stop-work triage or client change order.", labor="31500", remaining="20"),
    scenario(6, "Actual spend at 140% of budget", "over_budget",
             "Severe overrun; senior leadership intervention and scope audit.", labor="42000", remaining="30"),
    scenario(7, "Missing estimated remaining hours", "insufficient_data",
             "Forecasting is blind until the team estimates remaining scope.", labor="12000", remaining=None),
    scenario(8, "Budget is $0.00 / missing", "insufficient_data",
             "No delivery-cost baseline exists to evaluate health against.", budget="0", labor="5000", remaining="40"),
    scenario(9, "Large pending expenses ($4,000 pending on a $10k budget)", "healthy",
             "Caution that approving pending expenses would push the project to at risk.",
             revenue="15000", budget="10000", labor="5000", remaining="30", pending=["4000"]),
    scenario(10, "High subcontractor expenses vs internal labor", "at_risk",
             "Identify subcontractor spend as the primary driver; suggest internal staffing.",
             labor="6000", remaining="100", approved=["16000"]),
    scenario(11, "Zero-revenue internal project", "healthy",
             "Acknowledge the non-commercial nature; focus purely on the cost ceiling.",
             revenue="0", budget="20000", labor="5000", remaining="50"),
    scenario(12, "Overrun driven by a recent rate snapshot increase", "at_risk",
             "Note the higher blended burn rate (per-person rates are not shared with the AI).",
             remaining="180", planned_rate=D("80.0000"),
             entries=((D("100"), D("80.0000")), (D("60"), D("150.0000")))),
    scenario(13, "Project 95% complete with a $100 budget buffer", "at_risk",
             "Recommend freezing non-essential polish to avoid crossing into over budget.",
             labor="29900", remaining="1"),
    scenario(14, "Negative projected profit margin (projected cost > revenue)", "at_risk",
             "Warn of delivery at an operating loss; prioritize commercial renegotiation.",
             revenue="25000", budget="26000", labor="20000", remaining="80"),
    scenario(15, "Large discrepancy between recorded hours and deliverables", "at_risk",
             "Advise auditing timesheet descriptions for out-of-scope work.", labor="18000", remaining="150"),
]

STATUS_WORDS = {
    "healthy": ("healthy",),
    "at_risk": ("at risk", "at-risk", "at_risk"),
    "over_budget": ("over budget", "over-budget", "over_budget"),
    "insufficient_data": ("insufficient data", "insufficient_data", "insufficient-data"),
}


class Command(BaseCommand):
    help = "Evaluate the AI Risk Advisor against the 15 benchmark scenarios (docs/ai-risk-advisor.md §6)."

    def add_arguments(self, parser):
        parser.add_argument("--scenarios", help="Comma-separated scenario numbers (default: all 15).")
        parser.add_argument("--dry-run", action="store_true", help="Build and check contexts without calling Gemini.")
        parser.add_argument("--output", help="Report path (default: docs/evaluations/ai-advisor-<date>.md).")

    def handle(self, *args, **options):
        selected = SCENARIOS
        if options["scenarios"]:
            wanted = {int(n) for n in options["scenarios"].split(",")}
            selected = [s for s in SCENARIOS if s["number"] in wanted]

        prepared = []
        for s in selected:
            summary = summarize_project(
                s["inputs"], warning_threshold_pct=settings.MARGINWATCH_CONSUMPTION_WARNING_PCT
            )
            if summary.risk.status != s["expected_status"]:
                raise CommandError(
                    f"Scenario {s['number']} produces {summary.risk.status}, expected {s['expected_status']}."
                )
            project = SimpleNamespace(id=uuid.uuid5(uuid.NAMESPACE_URL, f"marginwatch-eval-{s['number']}"), status="ACTIVE")
            prepared.append((s, build_context(project, summary)))

        if options["dry_run"]:
            for s, context in prepared:
                self.stdout.write(f"{s['number']:>2}. {s['profile']} → {context['deterministic_status']}")
            self.stdout.write(self.style.SUCCESS(f"{len(prepared)} scenario contexts built; no API calls made."))
            return

        try:
            client = get_client()
        except AdvisorNotConfigured:
            raise CommandError(
                "GEMINI_API_KEY is not set. Add it to the repo-root .env.local "
                "(GEMINI_API_KEY=...) and run again, or use --dry-run."
            )
        rows = []
        for s, context in prepared:
            self.stdout.write(f"Scenario {s['number']}: {s['profile']} ...")
            started = time.monotonic()
            try:
                advice, error = advise(context, client), None
            except AdvisorError as exc:
                advice, error = None, f"{exc.default_code}: {exc.detail}"
            elapsed = time.monotonic() - started
            mentions = bool(advice) and any(
                w in advice["executive_summary"].lower() for w in STATUS_WORDS[context["deterministic_status"]]
            )
            rows.append({"scenario": s, "advice": advice, "error": error, "seconds": elapsed, "mentions_status": mentions})
            self.stdout.write(f"   {'OK' if advice else 'FAILED ' + error} ({elapsed:.1f}s)")

        path = Path(options["output"] or settings.BASE_DIR.parent / "docs" / "evaluations" / f"ai-advisor-{date.today()}.md")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(self.report(rows), encoding="utf-8")
        passed = sum(1 for r in rows if r["advice"])
        self.stdout.write(self.style.SUCCESS(f"{passed}/{len(rows)} valid replies. Report: {path}"))

    def report(self, rows):
        lines = [
            f"# AI Risk Advisor Evaluation — {date.today()}",
            "",
            f"**Model:** `{settings.GEMINI_MODEL}` · **Scenarios:** {len(rows)} · "
            f"**Valid replies:** {sum(1 for r in rows if r['advice'])}/{len(rows)} "
            "(schema + grounding check, plan D3)",
            "",
            "Automatic checks are filled in. Score the last four columns 1–5 by hand "
            "(docs/ai-risk-advisor.md §6): **NF** numerical faithfulness, **SA** status alignment, "
            "**AC** actionability, **DG** data-gap identification.",
            "",
            "| # | Profile | Status | Valid | Status named | Time | NF | SA | AC | DG |",
            "|:-:|:--|:--|:-:|:-:|--:|:-:|:-:|:-:|:-:|",
        ]
        for r in rows:
            s = r["scenario"]
            lines.append(
                f"| {s['number']} | {s['profile']} | `{s['expected_status']}` | "
                f"{'✅' if r['advice'] else '❌'} | {'✅' if r['mentions_status'] else '—'} | "
                f"{r['seconds']:.1f}s |  |  |  |  |"
            )
        for r in rows:
            s = r["scenario"]
            lines += ["", f"## {s['number']}. {s['profile']} (`{s['expected_status']}`)", "",
                      f"*Expected focus:* {s['focus']}", ""]
            if not r["advice"]:
                lines.append(f"**Rejected / failed:** {r['error']}")
                continue
            a = r["advice"]
            lines += [f"**Summary:** {a['executive_summary']}", "", "**Drivers:**"]
            lines += [f"- {d}" for d in a["primary_risk_drivers"]]
            lines += ["", "**Recommendations:**"]
            lines += [f"{i}. {rec}" for i, rec in enumerate(a["actionable_recommendations"], 1)]
            if a["data_gaps_and_assumptions"]:
                lines += ["", "**Data gaps & assumptions:**"]
                lines += [f"- {g}" for g in a["data_gaps_and_assumptions"]]
        return "\n".join(lines) + "\n"
