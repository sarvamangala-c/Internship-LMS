from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from ...db import models
from app.access_control.schemas.curriculum_schemas import (
    ScheduledClassOut, ScheduledClassUpdate
)
from ...core.database import get_db
from app.api.v1.ems_module.comman_functions.comman_function import (
    add_extra_class,
    check_duplicate,
    get_scheduled_classes,
    save_schedule,
)

router = APIRouter(tags=["Curriculum & Scheduling"])


def _resolve_semester_id(
    db: Session,
    academic_batch_id: Optional[int],
    semester: Optional[int],
    term: Optional[int],
    crclm_term_id: Optional[int],
) -> Optional[int]:
    requested_term = crclm_term_id if crclm_term_id is not None else term
    requested_semester = semester if semester is not None else requested_term
    if requested_semester is None:
        return None

    term_query = db.query(models.IEMSCrclmTerm)
    semester_query = db.query(models.IEMSemester)
    if academic_batch_id is not None:
        term_query = term_query.filter(models.IEMSCrclmTerm.crclm_id == academic_batch_id)
        semester_query = semester_query.filter(models.IEMSemester.academic_batch_id == academic_batch_id)

    resolved_term = term_query.filter(
        models.IEMSCrclmTerm.crclm_term_id == requested_semester
    ).first()
    if resolved_term is not None:
        semester_row = semester_query.filter(
            models.IEMSemester.semester == resolved_term.term_name
        ).first()
        return semester_row.semester_id if semester_row is not None else resolved_term.term_name

    semester_row = semester_query.filter(
        models.IEMSemester.semester_id == requested_semester
    ).first()
    if semester_row is not None:
        return semester_row.semester_id

    semester_row = semester_query.filter(
        models.IEMSemester.semester == requested_semester
    ).first()
    if semester_row is not None:
        return semester_row.semester_id

    return requested_semester


def _format_time_value(value) -> str:
    if value is None:
        return ""
    if isinstance(value, timedelta):
        total_seconds = int(value.total_seconds())
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    return str(value)


# --- 5. List Scheduled Classes API ---
@router.get("/timetable/scheduled-classes", response_model=List[ScheduledClassOut])
def list_scheduled_classes(
    academic_batch_id: Optional[int] = Query(None),
    curriculum: Optional[int] = Query(None),
    semester: Optional[int] = Query(None),
    term: Optional[int] = Query(None),
    crclm_term_id: Optional[int] = Query(None),
    section: Optional[str] = Query(None),
    date: Optional[date] = Query(None),
    startDate: Optional[date] = Query(None),
    endDate: Optional[date] = Query(None),
    db: Session = Depends(get_db)
):
    batch_id = academic_batch_id if academic_batch_id is not None else curriculum
    resolved_semester_id = _resolve_semester_id(
        db=db,
        academic_batch_id=batch_id,
        semester=semester,
        term=term,
        crclm_term_id=crclm_term_id,
    )

    from_date = startDate or date
    to_date = endDate or date

    conditions = ["ls.plan_date IS NOT NULL"]
    params = {}

    if batch_id is not None:
        conditions.append("ls.academic_batch_id = :academic_batch_id")
        params["academic_batch_id"] = batch_id
    if resolved_semester_id is not None:
        conditions.append("ls.semester_id = :semester_id")
        params["semester_id"] = resolved_semester_id
    if section:
        conditions.append("sec.section = :section")
        params["section"] = section
    if from_date is not None:
        conditions.append("ls.plan_date >= :from_date")
        params["from_date"] = from_date
    if to_date is not None:
        conditions.append("ls.plan_date <= :to_date")
        params["to_date"] = to_date

    query = text(
        f"""
        SELECT
            ls.lls_id AS id,
            COALESCE(ab.pgm_id, sec.pgm_id, 0) AS pgm_id,
            COALESCE(ab.dept_id, sec.dept_id, 0) AS dept_id,
            COALESCE(ab.academic_batch_code, CAST(ls.academic_batch_id AS CHAR)) AS academic_batch,
            COALESCE(ls.semester_id, 0) AS semester,
            COALESCE(sec.section, '') AS section,
            ls.plan_date AS date,
            ls.start_time AS start_time,
            ls.end_time AS end_time,
            COALESCE(c.crs_code, '') AS crs_code,
            NULLIF(COALESCE(c.crs_title, ''), '') AS subject_name,
            COALESCE(fm.instructor_id, 0) AS faculty_id,
            NULLIF(
                COALESCE(
                    NULLIF(TRIM(CONCAT_WS(' ', iu.first_name, iu.middle_name, iu.last_name)), ''),
                    NULLIF(TRIM(iu.username), '')
                ),
                ''
            ) AS faculty_name,
            CAST(COALESCE(ls.status, 0) AS CHAR) AS status,
            COALESCE(ab.academic_batch_desc, ab.academic_batch_code, CAST(ls.academic_batch_id AS CHAR)) AS batch_name
        FROM lms_lesson_schedule ls
        LEFT JOIN iems_section sec
            ON sec.id = ls.section_id
        LEFT JOIN iems_academic_batch ab
            ON ab.academic_batch_id = ls.academic_batch_id
        LEFT JOIN iems_courses c
            ON c.crs_id = ls.crs_id
        LEFT JOIN (
            SELECT map_latest.crs_id, map_latest.section_id, map_latest.instructor_id
            FROM lms_map_instructor_topic map_latest
            INNER JOIN (
                SELECT crs_id, section_id, MAX(inst_map_id) AS max_inst_map_id
                FROM lms_map_instructor_topic
                GROUP BY crs_id, section_id
            ) latest_map
                ON latest_map.crs_id = map_latest.crs_id
                AND latest_map.section_id = map_latest.section_id
                AND latest_map.max_inst_map_id = map_latest.inst_map_id
        ) fm
            ON fm.crs_id = ls.crs_id
            AND fm.section_id = ls.section_id
        LEFT JOIN iems_users iu
            ON iu.id = fm.instructor_id
        WHERE {' AND '.join(conditions)}
        ORDER BY ls.plan_date ASC, ls.start_time ASC, ls.lls_id ASC
        """
    )

    rows = db.execute(query, params).fetchall()
    return [
        ScheduledClassOut(
            id=row.id,
            pgm_id=int(row.pgm_id or 0),
            dept_id=int(row.dept_id or 0),
            academic_batch=row.academic_batch or "",
            semester=int(row.semester or 0),
            section=row.section or "",
            date=row.date,
            start_time=_format_time_value(row.start_time),
            end_time=_format_time_value(row.end_time),
            crs_code=row.crs_code or "",
            subject_name=row.subject_name,
            faculty_id=int(row.faculty_id or 0),
            faculty_name=row.faculty_name,
            status=row.status or "0",
            batch_name=row.batch_name or "",
        )
        for row in rows
    ]


# --- 6. Edit Scheduled Class API ---
@router.put("/timetable/scheduled-classes/{class_id}", response_model=ScheduledClassOut)
def edit_scheduled_class(
    class_id: int,
    class_update: ScheduledClassUpdate,
    db: Session = Depends(get_db)
):
    db_class = db.query(models.IEMSCustomTimeTable).filter(
        models.IEMSCustomTimeTable.id == class_id
    ).first()
    if not db_class:
        raise HTTPException(status_code=404, detail="Scheduled class not found")

    # Support both Pydantic v1 (`.dict`) and v2 (`.model_dump`)
    if hasattr(class_update, "model_dump"):
        update_data = class_update.model_dump(exclude_unset=True)
    else:
        update_data = class_update.dict(exclude_unset=True)

    for key, value in update_data.items():
        setattr(db_class, key, value)

    db.commit()
    db.refresh(db_class)
    return db_class


# --- 7. Delete Scheduled Class API ---
@router.delete("/timetable/scheduled-classes/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scheduled_class(class_id: int, db: Session = Depends(get_db)):
    db_class = db.query(models.IEMSCustomTimeTable).filter(
        models.IEMSCustomTimeTable.id == class_id
    ).first()
    if not db_class:
        raise HTTPException(status_code=404, detail="Scheduled class not found")

    db.delete(db_class)
    db.commit()
    return None


router.add_api_route("/comman_function/schedule-class", save_schedule, methods=["POST"])
router.add_api_route("/comman_function/check-duplicate", check_duplicate, methods=["POST"])
# router.add_api_route("/comman_function/scheduled-classes", get_scheduled_classes, methods=["GET"])
router.add_api_route("/comman_function/add-extra-class", add_extra_class, methods=["POST"])
