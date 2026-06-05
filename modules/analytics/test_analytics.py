import sys
import os

# Ensure the root of the project is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend")))

import unittest
from app.database import engine, Base, SessionLocal

from modules.analytics.metric_engine import get_db_metrics
from modules.analytics.kpi_engine import calculate_kpi_metrics
from modules.analytics.forecast_engine import generate_forecasts
from modules.analytics.aggregation_engine import aggregate_department_metrics, generate_ai_insights
from modules.analytics.report_generator import generate_report
from modules.analytics.router import get_alerts_endpoint

class TestAnalyticsBI(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        Base.metadata.create_all(bind=engine)

    def tearDown(self):
        self.db.close()

    def test_metric_engine(self):
        print("\n--- 1. Testing Metric Engine ---")
        metrics = get_db_metrics(self.db)
        self.assertIn("workflows", metrics)
        self.assertIn("agents", metrics)
        self.assertIn("search", metrics)
        self.assertIn("finance_crm", metrics)
        self.assertIn("approvals", metrics)
        self.assertIn("event_bus", metrics)
        self.assertTrue(metrics["workflows"]["total_runs"] >= 0)
        print("✔ Metrics compiled successfully.")

    def test_kpi_engine(self):
        print("\n--- 2. Testing KPI Engine ROI formulas ---")
        kpis = calculate_kpi_metrics(self.db)
        self.assertIn("summary", kpis)
        self.assertIn("timeframes", kpis)
        summary = kpis["summary"]
        self.assertIn("tasks_automated", summary)
        self.assertIn("hours_saved", summary)
        self.assertIn("cost_reduction", summary)
        self.assertIn("automation_roi_pct", summary)
        self.assertTrue(summary["automation_roi_pct"] >= 0)
        print(f"✔ ROI calculations completed. Computed ROI: {summary['automation_roi_pct']}%")

    def test_forecast_engine(self):
        print("\n--- 3. Testing Forecast Projections ---")
        forecasts = generate_forecasts(self.db, days_ahead=7)
        self.assertEqual(forecasts["days_forecasted"], 7)
        self.assertEqual(len(forecasts["workflow_volume"]), 7)
        self.assertEqual(len(forecasts["agent_utilization"]), 7)
        self.assertEqual(len(forecasts["approval_delays"]), 7)
        self.assertTrue(forecasts["workflow_volume"][0]["projected_volume"] > 0)
        print("✔ Forecast trend vectors calculated correctly.")

    def test_ai_insights(self):
        print("\n--- 4. Testing AI Insights Generator ---")
        insights = generate_ai_insights(self.db)
        self.assertTrue(len(insights) > 0)
        for insight in insights:
            self.assertIn("id", insight)
            self.assertIn("level", insight)
            self.assertIn("category", insight)
            self.assertIn("message", insight)
            self.assertIn("action", insight)
            self.assertIn(insight["level"], ["success", "warning", "info", "critical"])
        print(f"✔ AI Trend Insights generated successfully. Total insights: {len(insights)}")

    def test_report_generator(self):
        print("\n--- 5. Testing Executive Report Downloader ---")
        for report_type in ["weekly_ops", "monthly_finance", "quarterly_roi"]:
            report = generate_report(self.db, report_type)
            self.assertEqual(report["report_type"], report_type)
            self.assertTrue(len(report["markdown"]) > 0)
            self.assertIn("SYNTRA OS", report["markdown"])
            print(f"✔ Generated markdown for report type: '{report_type}'")

    def test_threshold_alerts(self):
        print("\n--- 6. Testing Threshold Alerts Triggering ---")
        # Test default/healthy boundaries
        res = get_alerts_endpoint(
            min_workflow_success_rate=50.0,
            max_approval_time_hours=100.0,
            db=self.db,
            current_user=None
        )
        self.assertEqual(res["status"], "nominal")
        self.assertEqual(res["alerts_count"], 0)
        
        # Test aggressive boundaries to force triggers
        res_triggered = get_alerts_endpoint(
            min_workflow_success_rate=99.9, # Exceeds default success rate
            max_approval_time_hours=0.01,   # Forces latency trigger
            db=self.db,
            current_user=None
        )
        self.assertEqual(res_triggered["status"], "triggered")
        self.assertTrue(res_triggered["alerts_count"] > 0)
        for alert in res_triggered["alerts"]:
            self.assertIn("metric", alert)
            self.assertIn("severity", alert)
            self.assertIn("message", alert)
        print(f"✔ Alert thresholds logic works. Triggered {res_triggered['alerts_count']} alerts in strict test.")

if __name__ == "__main__":
    unittest.main()
