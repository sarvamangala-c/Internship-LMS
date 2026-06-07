from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from datetime import date, timedelta, datetime
from typing import Optional
from typing import List, Dict
from app.db import models  # This points to your models.py file
from fastapi import HTTPException, status


def _resolve_lms_semester_id(db: Session, academic_batch_id: Optional[int], semester_id: Optional[int]) -> Optional[int]:
    """Match access-control attendance routes: map crclm_term_id or semester number to iems_semester.semester_id."""
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
        return semester_row.semester_id if semester_row is not None else None

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

    return int(semester_id)

def delete_timetable_logic(db: Session, sem_time_table_id: int):
    """Requirement: Delete Timetable and its associated custom entries"""
    # 1. Delete associated scheduled entries in the custom timetable first (Foreign Key cleanup)
    # NOTE: Ensure the column name is correct (is it .id or .sem_time_table_id?)
    db.query(models.IEMSCustomTimeTable).filter(
        models.IEMSCustomTimeTable.sem_time_table_id == sem_time_table_id 
    ).delete(synchronize_session=False)
    
    # 2. Delete the main header
    timetable = db.query(models.IEMSemTimeTable).filter(models.IEMSemTimeTable.id == sem_time_table_id).first()
    if not timetable:
        return False
        
    db.delete(timetable)
    db.commit()
    return True

def reset_timetable_dates_logic(db: Session, sem_time_table_id: int):
    """Requirement: Reset Timetable Date (Clears the calendar for this timetable)"""
    # Check if timetable exists first
    exists = db.query(models.IEMSemTimeTable).filter(models.IEMSemTimeTable.id == sem_time_table_id).first()
    if not exists:
        return False

    db.query(models.IEMSCustomTimeTable).filter(
        models.IEMSCustomTimeTable.sem_time_table_id == sem_time_table_id
    ).delete(synchronize_session=False)
    
    db.commit()
    return True

def copy_class_day_logic(db: Session, source_date: date, target_date: date, section: str):
    """Requirement: Copy Class Day (Fixes '0 classes copied' error)"""
    
    # 1. VALIDATION: Find the classes to copy
    source_classes = db.query(models.IEMSCustomTimeTable).filter(
        models.IEMSCustomTimeTable.date == source_date,
        models.IEMSCustomTimeTable.section == section
    ).all()

    # If no classes found, return 0. The Router will then throw a 404 based on this.
    if not source_classes:
        return 0

    # 2. Check if target date already has classes (to avoid duplicates)
    existing_target_classes = db.query(models.IEMSCustomTimeTable).filter(
        models.IEMSCustomTimeTable.date == target_date,
        models.IEMSCustomTimeTable.section == section
    ).first()
    
    if existing_target_classes:
        # Optional: You can choose to delete existing or raise an error
        # For now, we return 0 to indicate no NEW classes were copied via this logic
        return 0

    new_entries = []
    for cls in source_classes:
        # Create a new instance without the original primary key (ID)
        new_class = models.IEMSCustomTimeTable(
            pgm_id=cls.pgm_id,
            dept_id=cls.dept_id,
            academic_batch=cls.academic_batch,
            semester=cls.semester,
            section=cls.section,
            date=target_date, # Use the NEW date
            start_time=cls.start_time,
            end_time=cls.end_time,
            crs_code=cls.crs_code,
            tt_batch_id=cls.tt_batch_id,
            faculty_id=cls.faculty_id,
            status=cls.status,
            org_id=cls.org_id,
            created_by=cls.created_by,
            created_on=datetime.now(),
            modified_by=cls.modified_by,
            modified_on=datetime.now(),
            batch_name=cls.batch_name,
            sem_time_table_id=cls.sem_time_table_id # Ensure FK is preserved
        )
        new_entries.append(new_class)
    
    db.add_all(new_entries)
    db.commit()
    return len(new_entries)

def sync_timetable_dates_logic(db: Session, sem_time_table_id: int, new_end_date: date):
    """Requirement: Add/Delete classes based on date range extension or reduction"""
    
    # 1. Get the current latest scheduled date for this timetable
    latest_class = db.query(models.IEMSCustomTimeTable).filter(
        models.IEMSCustomTimeTable.sem_time_table_id == sem_time_table_id
    ).order_by(models.IEMSCustomTimeTable.date.desc()).first()

    if not latest_class:
        return 0

    old_end_date = latest_class.date

    # CASE A: Date Reduced (DELETE classes beyond the new end date)
    if new_end_date < old_end_date:
        deleted_count = db.query(models.IEMSCustomTimeTable).filter(
            models.IEMSCustomTimeTable.sem_time_table_id == sem_time_table_id,
            models.IEMSCustomTimeTable.date > new_end_date
        ).delete(synchronize_session=False)
        db.commit()
        return deleted_count

    # CASE B: Date Increased (ADD classes using the last available day as a template)
    elif new_end_date > old_end_date:
        # Use the classes from the old_end_date as a pattern for new days
        template_classes = db.query(models.IEMSCustomTimeTable).filter(
            models.IEMSCustomTimeTable.sem_time_table_id == sem_time_table_id,
            models.IEMSCustomTimeTable.date == old_end_date
        ).all()

        if not template_classes:
            return 0

        new_entries = []
        current_date = old_end_date + timedelta(days=1)

        while current_date <= new_end_date:
            # Only add classes for Weekdays (0=Mon, 4=Fri)
            if current_date.weekday() <= 4: 
                for t_cls in template_classes:
                    new_class = models.IEMSCustomTimeTable(
                        pgm_id=t_cls.pgm_id,
                        dept_id=t_cls.dept_id,
                        academic_batch=t_cls.academic_batch,
                        semester=t_cls.semester,
                        section=t_cls.section,
                        date=current_date,
                        start_time=t_cls.start_time,
                        end_time=t_cls.end_time,
                        crs_code=t_cls.crs_code,
                        faculty_id=t_cls.faculty_id,
                        status=t_cls.status,
                        org_id=t_cls.org_id,
                        created_on=datetime.now(),
                        batch_name=t_cls.batch_name,
                        sem_time_table_id=sem_time_table_id
                    )
                    new_entries.append(new_class)
            current_date += timedelta(days=1)
        
        db.add_all(new_entries)
        db.commit()
        return len(new_entries)

    return 0


def get_timetable_created_dates_for_course(db: Session, crs_code: str):
    """Return distinct creation dates (date part of `created_on`) for custom timetable entries of a course."""
    rows = db.query(models.IEMSCustomTimeTable.created_on).filter(
        models.IEMSCustomTimeTable.crs_code == crs_code
    ).all()

    # Extract date portion and unique
    dates = sorted({r[0].date() for r in rows if r[0] is not None})
    return dates


def is_lesson_scheduled_on_date(db: Session, crs_code: str, day: date, section: Optional[str] = None):
    """Return True/False whether any scheduled class exists for given course on a date; optionally filter by section."""
    query = db.query(models.IEMSCustomTimeTable).filter(
        models.IEMSCustomTimeTable.crs_code == crs_code,
        models.IEMSCustomTimeTable.date == day
    )
    if section:
        query = query.filter(models.IEMSCustomTimeTable.section == section)

    exists = db.query(query.exists()).scalar()
    return bool(exists)


def get_scheduled_class_timings(db: Session, crs_code: str, day: date, section: Optional[str] = None):
    """Return list of scheduled class timings for a course on a date (optionally filtered by section)."""
    query = db.query(
        models.IEMSCustomTimeTable.start_time,
        models.IEMSCustomTimeTable.end_time,
        models.IEMSCustomTimeTable.section,
        models.IEMSCustomTimeTable.faculty_id,
        models.IEMSCustomTimeTable.batch_name
    ).filter(
        models.IEMSCustomTimeTable.crs_code == crs_code,
        models.IEMSCustomTimeTable.date == day
    )
    if section:
        query = query.filter(models.IEMSCustomTimeTable.section == section)

    rows = query.order_by(models.IEMSCustomTimeTable.start_time).all()

    timings = [
        {
            "start_time": r[0],
            "end_time": r[1],
            "section": r[2],
            "faculty_id": r[3],
            "batch_name": r[4]
        }
        for r in rows
    ]
    return timings


def get_attendance_for_timing(db: Session, crs_code: str, day: date, start_time: str, end_time: str, section: Optional[str] = None, sem_time_table_id: Optional[int] = None) -> List[Dict]:
    """Fetch attendance rows for a specific class timing."""
    query = db.query(
        models.IEMSDailyAttendance.attendance_id,
        models.IEMSDailyAttendance.regno,
        models.IEMSDailyAttendance.usno,
        models.IEMSDailyAttendance.student_id,
        models.IEMSDailyAttendance.attendance_status,
        models.IEMSDailyAttendance.other_reason,
        models.IEMSDailyAttendance.posted_date,
        models.IEMSDailyAttendance.is_extra_class
    ).filter(
        models.IEMSDailyAttendance.crs_code == crs_code,
        models.IEMSDailyAttendance.result_year == day,
        models.IEMSDailyAttendance.start_time == start_time,
        models.IEMSDailyAttendance.end_time == end_time
    )

    if section:
        query = query.filter(models.IEMSDailyAttendance.section == section)
    if sem_time_table_id:
        query = query.filter(models.IEMSDailyAttendance.sem_time_table_id == sem_time_table_id)

    rows = query.all()
    return [
        {
            "attendance_id": r[0],
            "regno": r[1],
            "usno": r[2],
            "student_id": r[3],
            "attendance_status": r[4],
            "other_reason": r[5],
            "posted_date": r[6],
            "is_extra_class": r[7]
        }
        for r in rows
    ]


def save_attendance_batch(db: Session, attendance_list: List[Dict], meta: Dict) -> Dict:
    """Save or update attendance entries.

    attendance_list: list of dicts with keys: regno, usno(optional), student_id(optional), attendance_status, other_reason(optional), is_extra_class(optional)
    meta: dict with class context: crs_code, result_year (date), start_time, end_time, section, sem_time_table_id, user_id
    Returns counts of created/updated rows.
    """
    created = 0
    updated = 0
    now = datetime.utcnow()

    crs_code = meta.get("crs_code")
    result_year = meta.get("result_year")
    start_time = meta.get("start_time")
    end_time = meta.get("end_time")
    section = meta.get("section")
    sem_time_table_id = meta.get("sem_time_table_id")
    user_id = meta.get("user_id")

    for item in attendance_list:
        regno = item.get("regno")
        student_id = item.get("student_id")
        usno = item.get("usno")
        status_val = item.get("attendance_status")
        other = item.get("other_reason")
        is_extra = item.get("is_extra_class", 0)

        if not regno:
            continue

        # Find existing record
        existing = db.query(models.IEMSDailyAttendance).filter(
            models.IEMSDailyAttendance.crs_code == crs_code,
            models.IEMSDailyAttendance.result_year == result_year,
            models.IEMSDailyAttendance.start_time == start_time,
            models.IEMSDailyAttendance.end_time == end_time,
            models.IEMSDailyAttendance.regno == regno
        )
        if section:
            existing = existing.filter(models.IEMSDailyAttendance.section == section)
        if sem_time_table_id:
            existing = existing.filter(models.IEMSDailyAttendance.sem_time_table_id == sem_time_table_id)

        existing_row = existing.first()
        if existing_row:
            # Update
            existing_row.attendance_status = str(status_val)
            existing_row.other_reason = bool(other) if other else False
            existing_row.user_id = user_id
            existing_row.posted_date = now
            existing_row.updated_date = now
            existing_row.is_extra_class = is_extra
            db.add(existing_row)
            updated += 1
        else:
            # Insert
            new_row = models.IEMSDailyAttendance(
                result_year=result_year,
                crs_code=crs_code,
                student_id=student_id,
                regno=regno,
                usno=usno,
                section=section,
                start_time=start_time,
                end_time=end_time,
                attendance_status=str(status_val),
                other_reason=bool(other) if other else False,
                user_id=user_id,
                sem_time_table_id=sem_time_table_id,
                posted_date=now,
                created_date=now,
                updated_date=now,
                is_extra_class=is_extra
            )
            db.add(new_row)
            created += 1

    db.commit()
    return {"created": created, "updated": updated}


def get_attendance_lesson_dates(
    db: Session,
    academic_batch_id: int,
    semester_id: int,
    course_id: int,
    section_id: int,
) -> List[date]:
    """Fetch distinct scheduled lesson dates for attendance calendar highlighting."""
    query = text(
        """
        SELECT DISTINCT ls.plan_date AS lesson_date
        FROM lms_lesson_schedule ls
        WHERE ls.academic_batch_id = :academic_batch_id
            AND ls.semester_id = :semester_id
            AND ls.crs_id = :course_id
            AND ls.section_id = :section_id
            AND ls.plan_date IS NOT NULL
        ORDER BY ls.plan_date
        """
    )

    try:
        rows = db.execute(
            query,
            {
                "academic_batch_id": academic_batch_id,
                "semester_id": semester_id,
                "course_id": course_id,
                "section_id": section_id,
            },
        ).fetchall()
        return [row[0] for row in rows if row[0] is not None]
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch lesson dates: {exc}",
        ) from exc


def get_attendance_summary(
    db: Session,
    academic_batch_id: Optional[int],
    semester_id: Optional[int],
    course_id: Optional[int],
    section_id: Optional[int],
    from_date: Optional[date],
    to_date: Optional[date],
    only_present: bool = False,
) -> List[Dict]:
    """Return student-wise present/absent attendance summary."""
    print(
        "Attendance summary params:",
        {
            "academic_batch_id": academic_batch_id,
            "semester_id": semester_id,
            "course_id": course_id,
            "section_id": section_id,
            "from_date": from_date,
            "to_date": to_date,
            "only_present": only_present,
        },
    )

    conditions = []
    params: Dict = {}

    if academic_batch_id is not None:
        conditions.append("ma.academic_batch_id = :academic_batch_id")
        params["academic_batch_id"] = academic_batch_id
    if semester_id is not None:
        conditions.append("ma.semester_id = :semester_id")
        params["semester_id"] = semester_id
    if course_id is not None:
        conditions.append("ma.crs_id = :crs_id")
        params["crs_id"] = course_id
    if section_id is not None:
        conditions.append("ma.section_id = :section_id")
        params["section_id"] = section_id
    if from_date is not None and to_date is not None:
        conditions.append("ma.attendance_date BETWEEN :from_date AND :to_date")
        params["from_date"] = from_date
        params["to_date"] = to_date
    elif from_date is not None:
        conditions.append("ma.attendance_date >= :from_date")
        params["from_date"] = from_date
    elif to_date is not None:
        conditions.append("ma.attendance_date <= :to_date")
        params["to_date"] = to_date

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    query = text(
        f"""
        SELECT 
            s.usno AS usn,
            COALESCE(
                NULLIF(TRIM(s.name), ''),
                NULLIF(TRIM(CONCAT_WS(' ', s.first_name, s.middle_name, s.last_name)), ''),
                s.usno
            ) AS name,
            COUNT(CASE WHEN msa.attendance_status = 'Present' THEN 1 END) AS present,
            COUNT(CASE WHEN msa.attendance_status = 'Absent' THEN 1 END) AS absent
        FROM lms_manage_attendance ma
        JOIN lms_map_student_attendance msa 
            ON ma.attendance_id = msa.attendance_id
        JOIN iems_students s 
            ON s.usno = msa.student_usn
        {where_clause}
        GROUP BY s.name, s.first_name, s.middle_name, s.last_name, s.usno
        ORDER BY name
        """
    )

    try:
        rows = db.execute(query, params).fetchall()
        print("Attendance summary raw rows:", rows)

        students = [
            {
                "usn": row.usn,
                "name": row.name,
                "present": int(row.present or 0),
                "absent": int(row.absent or 0),
                "remarks": row.remarks or "",
            }
            for row in rows
        ]
        if only_present:
            students = [student for student in students if student["present"] > 0]
        print("Attendance summary mapped students:", students)
        return students
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch attendance summary: {exc}",
        ) from exc


def _coerce_lms_atype_status(rec: Dict) -> tuple:
    """Return (a_type_id, attendance_status). Convention: Present = 1, Absent = 0."""
    if rec.get("a_type_id") is not None:
        at = int(rec["a_type_id"])
        return (1, "Present") if at == 1 else (0, "Absent")
    if rec.get("present") is not None:
        if bool(rec["present"]):
            return 1, "Present"
        return 0, "Absent"
    return 1, "Present"


def apply_lms_map_student_status_updates(
    db: Session, attendance_id: int, status_records: Optional[List[Dict]]
) -> int:
    """UPDATE (or INSERT if missing) map rows for each USN. Returns number of rows touched."""
    if not status_records:
        return 0
    touched = 0
    upd_sql = text(
        """
        UPDATE lms_map_student_attendance
        SET a_type_id = :atype,
            attendance_status = :astatus,
            remarks = :remarks
        WHERE attendance_id = :aid
          AND TRIM(student_usn) = TRIM(:usn)
        """
    )
    ins_sql = text(
        """
        INSERT INTO lms_map_student_attendance (
            attendance_id,
            ssd_id,
            student_usn,
            a_type_id,
            attendance_status,
            refer_absent_status,
            remarks,
            activity,
            sms_sent,
            notification_sent,
            accept_flag,
            stud_attendance_doc_url
        )
        SELECT
            :aid,
            st.student_id,
            st.usno,
            :atype,
            :astatus,
            NULL,
            :remarks,
            '0',
            '0',
            '0',
            '0',
            NULL
        FROM iems_students st
        WHERE TRIM(st.usno) = TRIM(:usn)
          AND st.status = 1
          AND NOT EXISTS (
            SELECT 1
            FROM lms_map_student_attendance m
            WHERE m.attendance_id = :aid
              AND TRIM(m.student_usn) = TRIM(:usn)
          )
        """
    )
    for raw in status_records:
        usn = (raw.get("student_usn") or raw.get("usn") or "").strip()
        if not usn:
            continue
        atype, astatus = _coerce_lms_atype_status(raw)
        rem = raw.get("remarks") or ""
        res = db.execute(
            upd_sql,
            {
                "atype": atype,
                "astatus": astatus,
                "remarks": rem,
                "aid": attendance_id,
                "usn": usn,
            },
        )
        rc = int(res.rowcount or 0)
        if rc > 0:
            touched += rc
            continue
        res2 = db.execute(
            ins_sql,
            {
                "aid": attendance_id,
                "atype": atype,
                "astatus": astatus,
                "remarks": raw.get("remarks"),
                "usn": usn,
            },
        )
        if int(res2.rowcount or 0) > 0:
            touched += int(res2.rowcount or 0)
    db.commit()
    return touched


def sync_lms_map_student_attendance_for_class(
    db: Session,
    academic_batch_id: int,
    semester_id_ui: int,
    crs_id: int,
    section_id: int,
    attendance_date: date,
    created_by: Optional[int] = None,
    a_type_id: int = 1,
    tt_detail_id: Optional[int] = None,
    attendance_class_count: int = 1,
    manage_status: int = 1,
    attendance_id_override: Optional[int] = None,
    status_records: Optional[List[Dict]] = None,
) -> Dict:
    """
    Find or create `lms_manage_attendance` for the class/date, then insert any missing
    `lms_map_student_attendance` rows for all students on `iems_student_courses` in that section.
    """
    resolved_semester_id = _resolve_lms_semester_id(db, academic_batch_id, semester_id_ui)
    if resolved_semester_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not resolve semester_id for LMS attendance. Check academic_batch_id and semester/term.",
        )

    course = (
        db.query(models.IEMSCourses)
        .filter(
            models.IEMSCourses.crs_id == crs_id,
            models.IEMSCourses.academic_batch_id == academic_batch_id,
        )
        .first()
    )
    if course is None or not course.crs_code:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found for crs_id in this academic batch.",
        )

    sem_row = (
        db.query(models.IEMSemester)
        .filter(models.IEMSemester.semester_id == resolved_semester_id)
        .first()
    )
    course_semester = course.semester
    enrollment_semester = sem_row.semester if sem_row is not None else None

    section_row = (
        db.query(models.IEMSection)
        .filter(
            models.IEMSection.id == section_id,
            models.IEMSection.academic_batch_id == academic_batch_id,
        )
        .first()
    )
    if section_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section not found for section_id in this academic batch.",
        )

    tt_val = tt_detail_id if tt_detail_id is not None else 1

    find_sql = text(
        """
        SELECT attendance_id
        FROM lms_manage_attendance
        WHERE academic_batch_id = :ab
          AND semester_id = :sem
          AND crs_id = :crs
          AND section_id = :sec
          AND attendance_date = :adate
        LIMIT 1
        """
    )
    verify_override_sql = text(
        """
        SELECT attendance_id
        FROM lms_manage_attendance
        WHERE attendance_id = :ov
          AND academic_batch_id = :ab
          AND semester_id = :sem
          AND crs_id = :crs
          AND section_id = :sec
          AND attendance_date = :adate
        LIMIT 1
        """
    )
    found = None
    if attendance_id_override is not None:
        found = db.execute(
            verify_override_sql,
            {
                "ov": attendance_id_override,
                "ab": academic_batch_id,
                "sem": resolved_semester_id,
                "crs": crs_id,
                "sec": section_id,
                "adate": attendance_date,
            },
        ).scalar()

    if found is None:
        found = db.execute(
            find_sql,
            {
                "ab": academic_batch_id,
                "sem": resolved_semester_id,
                "crs": crs_id,
                "sec": section_id,
                "adate": attendance_date,
            },
        ).scalar()

    if found is not None:
        update_ma_status = text(
            """
            UPDATE lms_manage_attendance
            SET status = :st
            WHERE attendance_id = :aid
            """
        )
        db.execute(update_ma_status, {"st": manage_status, "aid": int(found)})
        db.commit()
    else:
        insert_ma = text(
            """
            INSERT INTO lms_manage_attendance (
                academic_batch_id, semester_id, crs_id, section_id,
                attendance_date, created_by, created_at, status,
                attendance_class_count, tt_detail_id
            ) VALUES (
                :ab, :sem, :crs, :sec,
                :adate, :cby, NOW(), :st,
                :acc, :ttd
            )
            """
        )
        db.execute(
            insert_ma,
            {
                "ab": academic_batch_id,
                "sem": resolved_semester_id,
                "crs": crs_id,
                "sec": section_id,
                "adate": attendance_date,
                "cby": created_by,
                "st": manage_status,
                "acc": attendance_class_count,
                "ttd": tt_val,
            },
        )
        db.commit()
        found = db.execute(
            find_sql,
            {
                "ab": academic_batch_id,
                "sem": resolved_semester_id,
                "crs": crs_id,
                "sec": section_id,
                "adate": attendance_date,
            },
        ).scalar()

    if found is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create or read lms_manage_attendance row.",
        )

    attendance_id = int(found)

    # Prefer enrollment semester from iems_semester; fall back to course.semester on the course row.
    sc_sem_filter = enrollment_semester if enrollment_semester is not None else course_semester
    sem_clause = " AND sc.semester = :scsem " if sc_sem_filter is not None else ""

    insert_map_sql = text(
        f"""
        INSERT INTO lms_map_student_attendance (
            attendance_id,
            ssd_id,
            student_usn,
            a_type_id,
            attendance_status,
            refer_absent_status,
            remarks,
            activity,
            sms_sent,
            notification_sent,
            accept_flag,
            stud_attendance_doc_url
        )
        SELECT DISTINCT
            :aid,
            st.student_id,
            st.usno,
            :atype,
            'Present',
            NULL,
            NULL,
            '0',
            '0',
            '0',
            '0',
            NULL
        FROM iems_student_courses sc
        JOIN iems_students st
          ON (st.regno = sc.regno OR st.usno = sc.usno)
        WHERE sc.batch_id = :ab
          AND sc.crs_code = :ccode
          AND TRIM(sc.section) = TRIM(:secname)
          AND sc.is_withdrawn = 0
          AND sc.is_drop = 0
          AND st.status = 1
          {sem_clause}
          AND NOT EXISTS (
            SELECT 1
            FROM lms_map_student_attendance m
            WHERE m.attendance_id = :aid
              AND m.student_usn = st.usno
          )
        """
    )

    try:
        exec_params: Dict = {
            "aid": attendance_id,
            "atype": a_type_id,
            "ab": academic_batch_id,
            "ccode": course.crs_code.strip(),
            "secname": (section_row.section or "").strip(),
        }
        if sc_sem_filter is not None:
            exec_params["scsem"] = sc_sem_filter
        result = db.execute(insert_map_sql, exec_params)
        inserted = result.rowcount if result.rowcount is not None else 0
        if inserted < 0:
            inserted = 0

        # Section roster: same batch + section label (ignore current_semester — often mismatches term UI)
        roster_params: Dict = {
            "aid": attendance_id,
            "atype": a_type_id,
            "ab": academic_batch_id,
            "secname": (section_row.section or "").strip(),
        }

        insert_roster_sql = text(
            """
            INSERT INTO lms_map_student_attendance (
                attendance_id,
                ssd_id,
                student_usn,
                a_type_id,
                attendance_status,
                refer_absent_status,
                remarks,
                activity,
                sms_sent,
                notification_sent,
                accept_flag,
                stud_attendance_doc_url
            )
            SELECT DISTINCT
                :aid,
                st.student_id,
                st.usno,
                :atype,
                'Present',
                NULL,
                NULL,
                '0',
                '0',
                '0',
                '0',
                NULL
            FROM iems_students st
            WHERE st.academic_batch_id = :ab
              AND TRIM(st.section) = TRIM(:secname)
              AND st.status = 1
              AND NOT EXISTS (
                SELECT 1
                FROM lms_map_student_attendance m
                WHERE m.attendance_id = :aid
                  AND m.student_usn = st.usno
              )
            """
        )
        result_roster = db.execute(insert_roster_sql, roster_params)
        ins2 = result_roster.rowcount if result_roster.rowcount is not None else 0
        if ins2 > 0:
            inserted += ins2
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync lms_map_student_attendance: {exc}",
        ) from exc

    rows_updated = 0
    if status_records:
        try:
            rows_updated = apply_lms_map_student_status_updates(db, attendance_id, status_records)
        except SQLAlchemyError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to apply LMS attendance status updates: {exc}",
            ) from exc

    count_sql = text(
        """
        SELECT COUNT(*) FROM lms_map_student_attendance
        WHERE attendance_id = :aid
        """
    )
    total_rows = int(db.execute(count_sql, {"aid": attendance_id}).scalar() or 0)

    return {
        "attendance_id": attendance_id,
        "rows_inserted_this_call": inserted,
        "rows_updated_this_call": rows_updated,
        "map_row_count": total_rows,
    }
