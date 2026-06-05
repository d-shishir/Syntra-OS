from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database import get_db
from modules.auth_system.access_policies import get_current_user
from modules.analytics.metric_engine import get_db_metrics
from modules.analytics.kpi_engine import calculate_kpi_metrics
from modules.analytics.forecast_engine import generate_forecasts
from modules.analytics.aggregation_engine import aggregate_department_metrics, generate_ai_insights
from modules.analytics.report_generator import generate_report

router = APIRouter()

@router.get("/metrics")
def get_metrics_endpoint(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Retrieve raw operational telemetry data.
    """
    try:
        return get_db_metrics(db)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load operational metrics: {str(e)}"
        )

@router.get("/kpis")
def get_kpis_endpoint(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Retrieve calculated business KPIs (ROI, Time/Cost savings) across timeframes.
    """
    try:
        return calculate_kpi_metrics(db)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate KPIs: {str(e)}"
        )

@router.get("/dashboards")
def get_dashboards_endpoint(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Retrieve department-isolated operational telemetry.
    """
    try:
        return aggregate_department_metrics(db)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compile department dashboards: {str(e)}"
        )

@router.get("/insights")
def get_insights_endpoint(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Generate dynamic AI-driven trend insights and recommended adjustments.
    """
    try:
        return generate_ai_insights(db)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate trend insights: {str(e)}"
        )

@router.get("/forecasts")
def get_forecasts_endpoint(
    days_ahead: int = Query(7, ge=1, le=30),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Generate predictive volume, latency, and agent utilization projections.
    """
    try:
        return generate_forecasts(db, days_ahead=days_ahead)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compile forecasting projections: {str(e)}"
        )

@router.get("/reports")
def get_reports_endpoint(
    report_type: str = Query("weekly_ops", enum=["weekly_ops", "monthly_finance", "quarterly_roi"]),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Generate downloadable executive summaries in JSON and markdown.
    """
    try:
        return generate_report(db, report_type=report_type)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate operational report: {str(e)}"
        )

@router.get("/alerts")
def get_alerts_endpoint(
    min_workflow_success_rate: float = Query(90.0),
    max_approval_time_hours: float = Query(4.0),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Inspects current platform performance against specified thresholds and returns triggered alerts.
    """
    try:
        metrics = get_db_metrics(db)
        alerts = []
        
        # Check success rate
        wf_rate = metrics["workflows"]["success_rate"]
        if wf_rate < min_workflow_success_rate:
            alerts.append({
                "metric": "workflow_success_rate",
                "value": wf_rate,
                "threshold": min_workflow_success_rate,
                "severity": "high",
                "message": f"Workflow success rate is {wf_rate}%, which is below the threshold of {min_workflow_success_rate}%."
            })
            
        # Check approval latency
        app_time = metrics["approvals"]["avg_approval_time_hours"]
        if app_time > max_approval_time_hours:
            alerts.append({
                "metric": "avg_approval_time_hours",
                "value": app_time,
                "threshold": max_approval_time_hours,
                "severity": "medium",
                "message": f"Human review delay is {app_time} hours, exceeding the threshold of {max_approval_time_hours} hours."
            })
            
        return {
            "status": "triggered" if alerts else "nominal",
            "alerts_count": len(alerts),
            "alerts": alerts
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify threshold alerts: {str(e)}"
        )
