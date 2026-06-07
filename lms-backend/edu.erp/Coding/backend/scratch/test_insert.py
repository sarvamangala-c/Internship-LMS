
import sys
import os
from datetime import date
from sqlalchemy.orm import Session

# Add the backend path to sys.path
sys.path.append(r"d:\Testing_ion (1)\Testing_ion\lms-backend\edu.erp\Coding\backend")

from app.db import models
from app.core.database import SessionLocal

def test_insert():
    db = SessionLocal()
    try:
        print("Attempting to insert into iems_daily_attendance...")
        new_row = models.IEMSDailyAttendance(
            result_year=date(2026, 4, 1),
            crs_code="MATH101",
            regno="REG001",
            usno="1BM24CS001",
            attendance_status="1",
            start_time="09:00",
            end_time="10:00",
            is_extra_class=0,
            is_by_web=1,
            posted_date=date.today(),
            student_id=1
        )
        db.add(new_row)
        db.commit()
        print("Insert successful!")
        
        # Verify
        count = db.query(models.IEMSDailyAttendance).count()
        print(f"Total rows in iems_daily_attendance: {count}")
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    test_insert()
