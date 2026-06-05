import datetime
import json
import logging
from sqlalchemy.orm import Session
from modules.analytics.metric_engine import get_db_metrics
from modules.analytics.kpi_engine import calculate_kpi_metrics
from modules.analytics.aggregation_engine import aggregate_department_metrics

logger = logging.getLogger(__name__)

def generate_report(db: Session, report_type: str) -> dict:
    """
    Generates structured JSON metadata and a formatted Markdown executive report.
    Supported report_types: 'weekly_ops', 'monthly_finance', 'quarterly_roi'
    """
    metrics = get_db_metrics(db)
    kpis = calculate_kpi_metrics(db)
    dept = aggregate_department_metrics(db)
    
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    
    if report_type == "weekly_ops":
        title = "Weekly Operations Report"
        description = "Summary of workflow volume, agent swarms, and integration API performance."
        markdown = f"""# SYNTRA OS — EXECUTIVE REPORT
## {title}
*Generated on: {now}*

---

### 1. OPERATIONAL VOLUMES
- **Total Workflows Executed**: {metrics['workflows']['total_runs']} runs
- **Workflow Success Rate**: {metrics['workflows']['success_rate']}%
- **Agent Swarm Executions**: {metrics['agents']['total_runs']} tasks
- **Active Agent Swarms**: {metrics['agents']['active_swarms']}
- **Connected Services**: {metrics['integrations']['connected_services_count']} APIs
- **Central Event Bus Actions**: {metrics['event_bus']['events_published']} events

### 2. COMPLIANCE & HUMAN APPROVALS
- **Total Approval Requests**: {metrics['approvals']['total_requests']}
- **Pending Actions**: {metrics['approvals']['pending_count']} reviews
- **Escalated Alerts**: {metrics['approvals']['escalated_count']}
- **Average Approval Latency**: {metrics['approvals']['avg_approval_time_hours']} hours

### 3. RECOMMENDATIONS & KEY ACTIONS
1. Monitor step durations for any workflow integration slowdowns.
2. Delegate low-risk approval gates to agent swarms to reduce the {metrics['approvals']['avg_approval_time_hours']} hr human latency window.
"""
    elif report_type == "monthly_finance":
        title = "Monthly Financial Audit Report"
        description = "Summary of invoice audits, payroll verification, and financial anomalies."
        markdown = f"""# SYNTRA OS — EXECUTIVE REPORT
## {title}
*Generated on: {now}*

---

### 1. FINANCIAL FLOW VOLUME
- **Invoices Audited**: {metrics['finance_crm']['invoices_audited']}
- **Payroll Checks Cleared**: {metrics['finance_crm']['payroll_checked']}
- **Estimated Monetary Volume**: ${metrics['finance_crm']['total_financial_volume']:,.2f}

### 2. FRAUD AND ANOMALY DETECTION
- **Anomalies Flagged**: {metrics['finance_crm']['anomalies_flagged']}
- **Discrepancy Action Rate**: {round((metrics['finance_crm']['anomalies_flagged'] / max(metrics['finance_crm']['invoices_audited'], 1) * 100), 1)}%

### 3. COMPLIANCE INSTRUCTIONS
- All flagged anomalies require direct human review in the review queue.
- Re-run search index checks weekly to ensure compliance indexing captures all invoice PDFs.
"""
    else: # quarterly_roi
        title = "Quarterly Automation ROI Report"
        description = "Telemetry analysis of hours saved, labor cost reduction, and AI integration efficiency."
        markdown = f"""# SYNTRA OS — EXECUTIVE REPORT
## {title}
*Generated on: {now}*

---

### 1. AUTOMATION IMPACT
- **Total Automated Operations**: {kpis['summary']['tasks_automated']} tasks
- **Hours Saved**: {kpis['summary']['hours_saved']} developer/admin hours
- **Estimated ROI Ratio**: {kpis['summary']['automation_roi_pct']}%

### 2. COST BREAKDOWN
- **Gross Labor Cost Reduction**: ${kpis['summary']['cost_reduction']:,.2f}
- **Estimated AI Model/API Costs**: ${round((metrics['workflows']['total_runs'] + metrics['agents']['total_runs']) * 0.05, 2):,.2f}
- **Net Quarterly Cost Savings**: ${round(kpis['summary']['cost_reduction'] - ((metrics['workflows']['total_runs'] + metrics['agents']['total_runs']) * 0.05), 2):,.2f}

### 3. EXECUTIVE CONCLUSION
Syntra OS automation continues to provide strong ROI by routing repeatable actions to Agent Swarms. We recommend extending CRM workflows to capture additional sales pipelines.
"""

    return {
        "report_type": report_type,
        "title": title,
        "description": description,
        "generated_at": now,
        "markdown": markdown,
        "data": {
            "metrics": metrics,
            "kpis": kpis,
            "departments": dept
        }
    }
