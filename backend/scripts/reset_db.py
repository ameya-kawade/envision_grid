"""
ENVISIONGRID — Reset Database
Clears all data from MongoDB. Use before demo reruns.
"""
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.db import reset_database

if __name__ == "__main__":
    reset_database()
    print("✅ Database reset complete. All collections cleared.")
