"""
ENVISIONGRID — Alert Management
"""
from src import db


def create_alert_from_prediction(pred: dict) -> str:
    """Create an alert row from a prediction result. Returns ObjectId str."""
    return db.create_alert(pred)


def get_all_alerts() -> list:
    return db.get_alerts()
