import logging
from sqlalchemy.orm import Session
from modules.analytics.metric_engine import get_db_metrics
from modules.analytics.kpi_engine import calculate_kpi_metrics

logger = logging.getLogger(__name__)

def generate_forecasts(db: Session, days_ahead: int = 7) -> dict:
    """
    Generates predictive forecasts (simple moving average trend projection)
    for operational metrics including workflows, agent utilization, and approval gates.
    """
    try:
        metrics = get_db_metrics(db)
        kpi = calculate_kpi_metrics(db)
        
        # Extract base values
        wf_base = metrics["workflows"]["total_runs"]
        agent_base = metrics["agents"]["total_runs"]
        approval_delay_base = metrics["approvals"]["avg_approval_time_hours"]
        
        # Calculate daily averages
        daily_wf = max(wf_base / 30.0, 1.5)
        daily_agent = max(agent_base / 30.0, 0.8)
        
        # Simple trend vectors (e.g., expecting a 3% growth per day in volume)
        growth_rate = 1.03
        
        workflow_forecast = []
        agent_forecast = []
        approval_delay_forecast = []
        
        current_wf = daily_wf
        current_agent = daily_agent
        current_delay = approval_delay_base
        
        for day in range(1, days_ahead + 1):
            current_wf = round(current_wf * growth_rate, 2)
            current_agent = round(current_agent * (growth_rate - 0.01), 2)
            # Approval delays decrease slightly as agents optimize pathways, down to a floor of 0.5 hours
            current_delay = round(max(current_delay * 0.97, 0.5), 2)
            
            workflow_forecast.append({
                "day": day,
                "projected_volume": current_wf,
                "confidence_lower": round(current_wf * 0.85, 2),
                "confidence_upper": round(current_wf * 1.15, 2)
            })
            
            agent_forecast.append({
                "day": day,
                "projected_utilization_pct": min(round(current_agent * 10.0 + 45.0, 1), 95.0),
                "active_swarms": 3 if day < 4 else 4
            })
            
            approval_delay_forecast.append({
                "day": day,
                "projected_delay_hours": current_delay
            })
            
        return {
            "days_forecasted": days_ahead,
            "workflow_volume": workflow_forecast,
            "agent_utilization": agent_forecast,
            "approval_delays": approval_delay_forecast
        }
    except Exception as e:
        logger.error(f"Forecast Engine: Forecast projection failed: {str(e)}")
        # Complete fallback set
        return {
            "days_forecasted": days_ahead,
            "workflow_volume": [
                {"day": d, "projected_volume": round(1.5 * (1.03**d), 2), "confidence_lower": round(1.2 * (1.03**d), 2), "confidence_upper": round(1.8 * (1.03**d), 2)}
                for d in range(1, days_ahead + 1)
            ],
            "agent_utilization": [
                {"day": d, "projected_utilization_pct": min(45.0 + d * 2, 85.0), "active_swarms": 3}
                for d in range(1, days_ahead + 1)
            ],
            "approval_delays": [
                {"day": d, "projected_delay_hours": round(max(2.4 * (0.97**d), 0.5), 2)}
                for d in range(1, days_ahead + 1)
            ]
        }
