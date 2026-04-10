from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date

from app.access_control.schemas.attendance import (
    AttendanceSavePayload,
    AttendanceSummaryResponse,
    LessonDatesResponse,
)

from ...db import models
from ...core.database import get_db
from ..services import timetable_service
from app.api.v1.ems_module.comman_functions.comman_function import get_students

router = APIRouter(tags=["Attendance"])


def _ensure_required_params(params: dict) -> None:
    missing = [key for key, value in params.items() if value is None]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required query params: {', '.join(missing)}",
        )


def _resolve_semester_id(
    db: Session,
    academic_batch_id: Optional[int],
    semester_id: Optional[int],
) -> Optional[int]:
    if semester_id is None:
        return None

    term_query = db.query(models.IEMSCrclmTerm)
    semester_query = db.query(models.IEMSemester)
    if academic_batch_id is not None:
        term_query = term_query.filter(models.IEMSCrclmTerm.crclm_id == academic_batch_id)
        semester_query = semester_query.filter(models.IEMSemester.academic_batch_id == academic_batch_id)

    resolved_term = term_query.filter(
        models.IEMSCrclmTerm.crclm_term_id == semester_id
    ).first()
    if resolved_term is not None:
        semester_row = semester_query.filter(
            models.IEMSemester.semester == resolved_term.term_name
        ).first()
        return semester_row.semester_id if semester_row is not None else resolved_term.term_name

    semester_row = semester_query.filter(
        models.IEMSemester.semester_id == semester_id
    ).first()
    if semester_row is not None:
        return semester_row.semester_id

    semester_row = semester_query.filter(
        models.IEMSemester.semester == semester_id
    ).first()
    if semester_row is not None:
        return semester_row.semester_id

    return semester_id


@router.get("/attendance/fetch")
def fetch_attendance(
    crs_code: str = Query(...),
    day: date = Query(...),
    start_time: str = Query(...),
    end_time: str = Query(...),
    section: Optional[str] = Query(None),
    sem_time_table_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Fetch student attendance records for the selected class timing."""
    rows = timetable_service.get_attendance_for_timing(db, crs_code, day, start_time, end_time, section, sem_time_table_id)
    if not rows:
        return {"message": "No attendance records found"}
    return {"attendance": rows}


@router.post("/attendance/save")
def save_attendance(payload: AttendanceSavePayload, db: Session = Depends(get_db)):
    """Save attendance data (batch upsert). Provide `meta` with class context and `records` list."""
    # Validate meta required fields
    meta = payload.meta
    required = ["crs_code", "result_year", "start_time", "end_time"]
    for r in required:
        if r not in meta:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Missing meta field: {r}")

    # Convert result_year to date if it's a string
    if isinstance(meta.get("result_year"), str):
        try:
            from datetime import datetime as _dt
            meta["result_year"] = _dt.fromisoformat(meta["result_year"]).date()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid result_year format. Use YYYY-MM-DD.")

    attendance_list = [r.model_dump() for r in payload.records]
    result = timetable_service.save_attendance_batch(db, attendance_list, meta)
    return {"message": "Attendance saved", "result": result}


@router.get(
    "/access-control/attendance/lesson-dates",
    response_model=LessonDatesResponse,
    summary="Student Attendance Report lesson dates",
)
def get_lesson_dates(
    academic_batch_id: Optional[int] = Query(
        None,
        description="Curriculum / Academic Batch. Maps to academic_batch_id.",
    ),
    semester_id: Optional[int] = Query(
        None,
        description="Term. UI crclm_term_id is accepted and resolved internally to iems_semester.semester_id.",
    ),
    course_id: Optional[int] = Query(
        None,
        description="Course. Maps to lms_manage_attendance.crs_id / lms_lesson_schedule.crs_id.",
    ),
    section_id: Optional[int] = Query(
        None,
        description="Section. Maps to iems_section.id and attendance/schedule section_id.",
    ),
    db: Session = Depends(get_db),
):
    _ensure_required_params(
        {
            "academic_batch_id": academic_batch_id,
            "semester_id": semester_id,
            "course_id": course_id,
            "section_id": section_id,
        }
    )
    resolved_semester_id = _resolve_semester_id(db, academic_batch_id, semester_id)
    dates = timetable_service.get_attendance_lesson_dates(
        db=db,
        academic_batch_id=academic_batch_id,
        semester_id=resolved_semester_id,
        course_id=course_id,
        section_id=section_id,
    )
    return {
        "status": True,
        "message": "Success",
        "data": dates,
    }


@router.get(
    "/access-control/attendance/summary",
    response_model=AttendanceSummaryResponse,
    summary="Student Attendance Report summary",
)
def get_attendance_summary(
    academic_batch_id: Optional[int] = Query(
        None,
        description="Curriculum / Academic Batch. Maps to academic_batch_id.",
    ),
    semester_id: Optional[int] = Query(
        None,
        description="Term. UI crclm_term_id is accepted and resolved internally to iems_semester.semester_id.",
    ),
    course_id: Optional[int] = Query(
        None,
        description="Course. Maps to lms_manage_attendance.crs_id.",
    ),
    section_id: Optional[int] = Query(
        None,
        description="Section. Maps to iems_section.id and lms_manage_attendance.section_id.",
    ),
    from_date: Optional[date] = Query(None, description="Report start date."),
    to_date: Optional[date] = Query(None, description="Report end date."),
    only_present: bool = Query(
        False,
        description="Accepted for report flow compatibility. Summary still returns both present and absent totals.",
    ),
    db: Session = Depends(get_db),
):
    _ensure_required_params(
        {
            "academic_batch_id": academic_batch_id,
            "semester_id": semester_id,
            "course_id": course_id,
            "section_id": section_id,
            "from_date": from_date,
            "to_date": to_date,
        }
    )
    if from_date is not None and to_date is not None and from_date > to_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="from_date cannot be greater than to_date",
        )

    resolved_semester_id = _resolve_semester_id(db, academic_batch_id, semester_id)
    students = timetable_service.get_attendance_summary(
        db=db,
        academic_batch_id=academic_batch_id,
        semester_id=resolved_semester_id,
        course_id=course_id,
        section_id=section_id,
        from_date=from_date,
        to_date=to_date,
        only_present=only_present,
    )
    return {
        "status": True,
        "message": "Success",
        "data": students,
    }


router.add_api_route("/comman_function/students", get_students, methods=["GET"])
