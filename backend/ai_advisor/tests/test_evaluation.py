import json
import tempfile
from io import StringIO
from pathlib import Path
from unittest import mock

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, override_settings

from ai_advisor.management.commands import evaluate_ai_advisor
from ai_advisor.tests.test_services import FakeClient

# A reply with no figures passes the grounding check for any scenario
GENERIC_REPLY = json.dumps({
    "executive_summary": "The project is at risk according to the deterministic engine.",
    "primary_risk_drivers": ["Projected cost exceeds the planned budget."],
    "actionable_recommendations": ["Review remaining scope.", "Discuss a change order."],
    "data_gaps_and_assumptions": [],
})


class EvaluationCommandTests(SimpleTestCase):
    def test_all_scenarios_produce_their_documented_status(self):
        out = StringIO()
        call_command("evaluate_ai_advisor", "--dry-run", stdout=out)
        self.assertIn("15 scenario contexts built", out.getvalue())

    @override_settings(GEMINI_API_KEY="")
    def test_missing_key_is_a_clear_error(self):
        with self.assertRaises(CommandError) as ctx:
            call_command("evaluate_ai_advisor", "--scenarios", "1", stdout=StringIO())
        self.assertIn("GEMINI_API_KEY", str(ctx.exception))

    def test_report_is_written(self):
        with tempfile.TemporaryDirectory() as tmp:
            report = Path(tmp) / "eval.md"
            with mock.patch.object(evaluate_ai_advisor, "get_client", return_value=FakeClient(reply=GENERIC_REPLY)):
                call_command(
                    "evaluate_ai_advisor", "--scenarios", "4,7", "--output", str(report), stdout=StringIO()
                )
            text = report.read_text(encoding="utf-8")
        self.assertIn("**Valid replies:** 2/2", text)
        self.assertIn("| 4 | 50% budget consumed, but huge remaining hours | `at_risk` | ✅ | ✅ |", text)
        self.assertIn("## 7. Missing estimated remaining hours (`insufficient_data`)", text)
