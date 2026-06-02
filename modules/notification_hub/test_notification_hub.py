import sys
import os

# Ensure root of project and backend are in python path
root_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
backend_path = os.path.join(root_path, "backend")
for path in [root_path, backend_path]:
    if path not in sys.path:
        sys.path.insert(0, path)

from app.database import SessionLocal, engine, Base
from modules.notification_hub.models import Notification, UserNotificationPreference, NotificationHistory
from modules.notification_hub.notification_manager import send_notification, subscribe_notification_listeners
from modules.notification_hub.preference_manager import save_preferences, should_deliver
from modules.notification_hub.escalation_notifier import escalate_notification
from modules.event_system.event_bus import publish_event
from modules.event_system.event_subscribers import initialize_subscribers

def run_tests():
    print("Initializing Database tables...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # Clear existing logs for reproducibility
        db.query(Notification).delete()
        db.query(NotificationHistory).delete()
        db.query(UserNotificationPreference).delete()
        db.commit()

        print("\n--- 1. Testing User Preference Filtering ---")
        # Configure test preferences for user 'finance_guy'
        save_preferences(db, "finance_guy", {
            "in_app_enabled": True,
            "email_enabled": True,
            "slack_enabled": False,
            "sms_enabled": False,
            "severity_filter": "high",
            "subscribed_modules": ["finance"]
        })

        # Check delivery channels
        assert should_deliver(db, "finance_guy", "in_app", "high", "finance") is True
        assert should_deliver(db, "finance_guy", "email", "high", "finance") is True
        assert should_deliver(db, "finance_guy", "slack", "high", "finance") is False  # Slack disabled
        assert should_deliver(db, "finance_guy", "in_app", "low", "finance") is False  # Low priority filtered
        assert should_deliver(db, "finance_guy", "in_app", "high", "crm") is False  # Not subscribed to CRM
        print("✔ User preferences evaluated and applied correctly.")

        print("\n--- 2. Testing AI Template Summarization / Fallback ---")
        notif = send_notification(
            db=db,
            type="invoice_uploaded",
            priority="high",
            recipient="finance_guy",
            title="Invoice Loaded",
            payload={"filename": "test_payment.pdf", "amount": 5000.0},
            module="finance"
        )
        assert notif is not None
        assert notif.status == "sent"
        assert "test_payment.pdf" in notif.message
        print("✔ Template summarizer compiled message correctly.")

        print("\n--- 3. Testing Delivery History Logs ---")
        histories = db.query(NotificationHistory).filter(NotificationHistory.notification_id == notif.id).all()
        assert len(histories) == 2, f"Expected 2 deliveries (in_app, email), got {len(histories)}"
        channels = [h.channel for h in histories]
        assert "in_app" in channels
        assert "email" in channels
        assert all(h.status == "sent" for h in histories)
        print("✔ Notification delivery and latencies logged in histories successfully.")

        print("\n--- 4. Testing Incident Escalation System ---")
        escalated_notif = escalate_notification(db, str(notif.id))
        assert escalated_notif.status == "escalated"
        assert escalated_notif.priority == "critical"
        assert escalated_notif.recipient == "ops_director"
        assert "[ESCALATED]" in escalated_notif.title
        
        # Verify delivery to escalated user logged
        escalated_histories = db.query(NotificationHistory).filter(NotificationHistory.notification_id == notif.id).all()
        # original 2 + 1 new in_app delivery to ops_director
        assert len(escalated_histories) == 3
        print("✔ Notifications escalated, details updated, and secondary stakeholders alerted successfully.")

        print("\n--- 5. Testing Event-Driven Notification Cascade ---")
        # Bind Event Bus listeners
        initialize_subscribers()
        subscribe_notification_listeners()

        # Publish crm lead_created event -> triggers notification
        lead_event = publish_event(
            db=db,
            event_type="lead_created",
            source_module="crm",
            payload={"contact_name": "Elon Musk", "company": "SpaceX"},
            priority="medium"
        )

        # Check if crm notification was created for sales_user (with retry to allow background dispatcher to execute)
        import time
        crm_notif = None
        for _ in range(50):
            crm_notif = db.query(Notification).filter(
                Notification.type == "lead_created",
                Notification.recipient == "sales_user"
            ).first()
            if crm_notif:
                break
            time.sleep(0.1)
        
        assert crm_notif is not None
        assert "Elon Musk" in crm_notif.message
        print("✔ Central Event Bus events successfully trigger automatic notification routing.")

        print("\n✔ ALL NOTIFICATION HUB TESTS PASSED SUCCESSFULLY!")

    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
