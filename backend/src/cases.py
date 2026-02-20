"""
ENVISIONGRID — Case Management
"""
from src import db


def open_case(alert_id: str, assigned_to: str = None, notes: str = None) -> str:
    return db.create_case(alert_id, assigned_to, notes)


def list_cases() -> list:
    return db.get_cases()


def patch_case(case_id: str, updates: dict):
    db.update_case(case_id, updates)
