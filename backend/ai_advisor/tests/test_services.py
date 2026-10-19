"""
TC-AI-01…04 + configuration, caching and SDK error mapping. Gemini is always faked.
"""

import json
from decimal import Decimal as D
from unittest import mock

import httpx
from django.core.cache import cache
from django.test import SimpleTestCase, TestCase, override_settings
from google.genai import errors as genai_errors

from ai_advisor import services
from ai_advisor.client import (
    AdvisorNotConfigured,
    AdvisorQuotaExceeded,
    AdvisorResponseInvalid,
    AdvisorTimeout,
    AdvisorUnavailable,
    GeminiClient,
)
from clients.models import Client
from projects.models import Project
from time_tracking.models import TimeEntry
from users.models import User, UserRole

VALID_REPLY = {
    "executive_summary": "The project is at risk: projected cost $6,500 exceeds the $6,000 budget.",
    "primary_risk_drivers": ["Remaining labor of 50 hours at $50/hr ($2,500) drives the overrun of $500."],
    "actionable_recommendations": [
        "Trim non-essential scope from the 50 remaining hours.",
        "Ask the client for a change order covering the $500 overrun.",
    ],
    "data_gaps_and_assumptions": ["Assumes the 50-hour estimate is current."],
}


class FakeClient:
    def __init__(self, reply=None, error=None):
        self.reply = json.dumps(VALID_REPLY) if reply is None else reply
        self.error = error
        self.calls = []

    def generate(self, *, system_prompt, user_message, response_schema):
        self.calls.append(user_message)
        if self.error:
            raise self.error
        return self.reply


@override_settings(
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "ai-tests"}},
    GEMINI_MODEL="gemini-test-model",
)
class AnalyzeProjectTests(TestCase):
    def setUp(self):
        cache.clear()
        manager = User.objects.create_user(
            email="manager@agency.com", password="ManagerPass123!", role=UserRole.MANAGER,
            default_hourly_cost_rate=D("100.0000"),
        )
        client = Client.objects.create(name="Acme Corp", created_by=manager)
        # Scenario 2: actual $4,000, 50 h × $50 remaining → projected $6,500 > $6,000 → at_risk
        self.project = Project.objects.create(
            client=client, name="Scenario 2", contract_revenue=D("10000.00"),
            planned_cost_budget=D("6000.00"), planned_hourly_cost=D("50.0000"),
            estimated_remaining_hours=D("50.00"), created_by=manager,
        )
        for _ in range(2):
            TimeEntry.objects.create(
                project=self.project, user=manager, work_date="2026-10-01",
                recorded_hours=D("20.00"), description="Build",
            )

    def analyze(self, fake):
        with mock.patch.object(services, "get_client", return_value=fake):
            return services.analyze_project(self.project)

    def test_tc_ai_01_valid_reply(self):
        fake = FakeClient()
        result = self.analyze(fake)
        self.assertEqual(result.deterministic_status, "at_risk")
        self.assertEqual(result.advice["primary_risk_drivers"], VALID_REPLY["primary_risk_drivers"])
        self.assertEqual(result.model, "gemini-test-model")
        self.assertFalse(result.cached)
        self.assertTrue(result.generated_at.endswith("Z"))
        # The model saw the deterministic figures, not names
        self.assertIn('"projected_final_cost": "6500.00"', fake.calls[0])
        self.assertNotIn("Scenario 2", fake.calls[0])

    def test_tc_ai_02_timeout(self):
        with self.assertRaises(AdvisorTimeout) as ctx:
            self.analyze(FakeClient(error=AdvisorTimeout()))
        self.assertEqual(ctx.exception.status_code, 503)

    def test_tc_ai_03_quota(self):
        with self.assertRaises(AdvisorQuotaExceeded) as ctx:
            self.analyze(FakeClient(error=AdvisorQuotaExceeded()))
        self.assertEqual(ctx.exception.status_code, 503)

    def test_tc_ai_04_malformed_reply(self):
        for reply in ("Sure! The project looks risky.", json.dumps({"summary": "x"})):
            with self.assertRaises(AdvisorResponseInvalid) as ctx:
                self.analyze(FakeClient(reply=reply))
            self.assertEqual(ctx.exception.status_code, 502)

    def test_hallucinated_figure_is_rejected(self):
        bad = dict(VALID_REPLY, executive_summary="Projected cost will reach $7,900 (at risk).")
        with self.assertRaises(AdvisorResponseInvalid):
            self.analyze(FakeClient(reply=json.dumps(bad)))

    @override_settings(GEMINI_API_KEY="")
    def test_not_configured(self):
        with self.assertRaises(AdvisorNotConfigured) as ctx:
            services.analyze_project(self.project)
        self.assertEqual(ctx.exception.status_code, 503)

    def test_same_figures_use_the_cache(self):
        fake = FakeClient()
        self.analyze(fake)
        second = self.analyze(fake)
        self.assertTrue(second.cached)
        self.assertEqual(len(fake.calls), 1)

    def test_changed_figures_trigger_a_fresh_analysis(self):
        fake = FakeClient()
        self.analyze(fake)
        self.project.estimated_remaining_hours = D("40.00")  # projected cost changes to $6,000
        self.project.save()
        result = self.analyze(FakeClient(reply=json.dumps(dict(
            VALID_REPLY,
            executive_summary="Healthy: projected cost $6,000 equals the $6,000 budget.",
            primary_risk_drivers=["Remaining 40 hours at $50/hr ($2,000)."],
            actionable_recommendations=["Hold scope.", "Re-estimate weekly."],
        ))))
        self.assertFalse(result.cached)

    def test_failures_are_not_cached(self):
        with self.assertRaises(AdvisorTimeout):
            self.analyze(FakeClient(error=AdvisorTimeout()))
        result = self.analyze(FakeClient())
        self.assertFalse(result.cached)


class GeminiClientErrorMappingTests(SimpleTestCase):
    """The real client turns SDK/network failures into typed 502/503 errors."""

    def make_client(self):
        return GeminiClient(api_key="test-key", model="gemini-test-model", timeout_seconds=10)

    def generate_with(self, *, side_effect=None, return_value=None):
        with mock.patch("google.genai.Client") as Client:
            generate = Client.return_value.models.generate_content
            if side_effect is not None:
                generate.side_effect = side_effect
            else:
                generate.return_value = return_value
            text = self.make_client().generate(system_prompt="s", user_message="u", response_schema={})
            return text, Client, generate

    def test_success_and_request_options(self):
        text, Client, generate = self.generate_with(return_value=mock.Mock(text='{"ok": true}'))
        self.assertEqual(text, '{"ok": true}')
        http_options = Client.call_args.kwargs["http_options"]
        self.assertEqual(http_options.timeout, 10_000)  # milliseconds
        self.assertIsNone(http_options.retry_options)  # never retry inside the budget
        config = generate.call_args.kwargs["config"]
        self.assertEqual(config.response_mime_type, "application/json")
        self.assertEqual(generate.call_args.kwargs["model"], "gemini-test-model")

    def test_timeout(self):
        with self.assertRaises(AdvisorTimeout):
            self.generate_with(side_effect=httpx.ReadTimeout("slow"))

    def test_quota(self):
        with self.assertRaises(AdvisorQuotaExceeded):
            self.generate_with(side_effect=genai_errors.ClientError(429, {"error": {"message": "quota"}}))

    def test_bad_key_or_model(self):
        with self.assertRaises(AdvisorUnavailable) as ctx:
            self.generate_with(side_effect=genai_errors.ClientError(400, {"error": {"message": "API key not valid"}}))
        self.assertIn("GEMINI_API_KEY", str(ctx.exception.detail))

    def test_server_and_unexpected_errors(self):
        for error in (genai_errors.ServerError(503, {"error": {"message": "overloaded"}}), RuntimeError("boom")):
            with self.assertRaises(AdvisorUnavailable):
                self.generate_with(side_effect=error)

    def test_empty_reply(self):
        with self.assertRaises(AdvisorResponseInvalid):
            self.generate_with(return_value=mock.Mock(text=None))

    def test_missing_key(self):
        with self.assertRaises(AdvisorNotConfigured):
            GeminiClient(api_key="", model="m", timeout_seconds=10)
