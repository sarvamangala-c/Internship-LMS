import calendar
from datetime import date, datetime, timezone
from typing import Any, Dict, Optional

from fastapi import HTTPException, status
from sqlalchemy import and_, or_, text
from sqlalchemy.orm import Session

from app.access_control.models.user import User
from app.access_control.schemas.student import (
    StudentAttendanceDaywiseItem,
    StudentAttendanceSummaryItem,
    StudentCurriculumItem,
    StudentNotificationCounts,
    StudentNotificationItem,
    StudentTermItem,
)
from app.db import models


def _enrich_student_context_from_attendance(
    db: Session,
    student_context: Dict[str, Any],
) -> Dict[str, Any]:
    if (
        student_context.get("academic_batch_id") is not None
        and student_context.get("current_semester") is not None
        and student_context.get("section") is not None
    ):
        return student_context

    query = text(
        f"""
        SELECT
            ma.academic_batch_id,
            ma.semester_id,
            sec.section
        FROM lms_manage_attendance ma
        JOIN lms_map_student_attendance msa
            ON msa.attendance_id = ma.attendance_id
        LEFT JOIN iems_section sec
            ON sec.id = ma.section_id
        WHERE {_student_filter_sql('msa')}
        ORDER BY ma.attendance_date DESC, ma.attendance_id DESC
        LIMIT 1
        """
    )
    row = db.execute(
        query,
        {
            "student_id": student_context["student_id"],
            "student_usn": student_context["student_usn"],
        },
    ).mappings().first()

    if not row:
        return student_context

    if student_context.get("academic_batch_id") is None:
        student_context["academic_batch_id"] = row["academic_batch_id"]
    if student_context.get("current_semester") is None:
        student_context["current_semester"] = row["semester_id"]
    if student_context.get("section") is None:
        student_context["section"] = row["section"]
    return student_context


def _ensure_student_curriculum_access(
    student_context: Dict[str, Any],
    curriculum_id: int,
) -> None:
    student_curriculum_id = student_context.get("academic_batch_id")
    if student_curriculum_id is not None and curriculum_id != student_curriculum_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Selected curriculum is not available for this student",
        )


def resolve_student_context(
    db: Session,
    token: Optional[str] = None,
    student_id: Optional[int] = None,
) -> Dict[str, Any]:
    student = None
    auth_user_id = None

    if token:
        from app.access_control.utils.jwt import decode_jwt

        payload = decode_jwt(token)
        user_id = payload.get("sub") if payload else None
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
            )

        auth_user = db.query(User).filter(User.id == user_id).first()
        if not auth_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authenticated user not found",
            )

        auth_user_id = auth_user.id
        if auth_user.student_id:
            student = (
                db.query(models.IEMStudents)
                .filter(models.IEMStudents.student_id == auth_user.student_id)
                .first()
            )

    if student is None and student_id is not None:
        student = (
            db.query(models.IEMStudents)
            .filter(models.IEMStudents.student_id == student_id)
            .first()
        )

    if student is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Student identity could not be resolved. "
                "Pass student_id until auth is wired to iems_users.student_id."
            ),
        )

    student_context = {
        "student_id": student.student_id,
        "student_usn": student.usno,
        "academic_batch_id": student.academic_batch_id,
        "current_semester": student.current_semester,
        "section": student.section,
        "auth_user_id": auth_user_id,
    }
    return _enrich_student_context_from_attendance(db, student_context)


def _resolve_term_context(
    db: Session,
    curriculum_id: int,
    term_id: int,
) -> Dict[str, Optional[int]]:
    term_query = db.query(models.IEMSCrclmTerm).filter(
        models.IEMSCrclmTerm.crclm_id == curriculum_id
    )
    semester_query = db.query(models.IEMSemester).filter(
        models.IEMSemester.academic_batch_id == curriculum_id
    )

    resolved_term = term_query.filter(
        models.IEMSCrclmTerm.crclm_term_id == term_id
    ).first()
    if resolved_term is None:
        resolved_term = term_query.filter(
            models.IEMSCrclmTerm.term_name == term_id
        ).first()

    resolved_semester = None
    if resolved_term is not None:
        resolved_semester = semester_query.filter(
            models.IEMSemester.semester == resolved_term.term_name
        ).first()
    else:
        resolved_semester = semester_query.filter(
            or_(
                models.IEMSemester.semester_id == term_id,
                models.IEMSemester.semester == term_id,
            )
        ).first()

    if resolved_term is None and resolved_semester is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Term not found for the selected curriculum",
        )

    resolved_semester_id = (
        resolved_semester.semester_id
        if resolved_semester is not None
        else resolved_term.term_name
    )
    resolved_semester_number = (
        resolved_semester.semester
        if resolved_semester is not None
        else resolved_term.term_name
    )
    resolved_crclm_term_id = (
        resolved_term.crclm_term_id
        if resolved_term is not None
        else None
    )

    return {
        "curriculum_id": curriculum_id,
        "crclm_term_id": resolved_crclm_term_id,
        "semester_id": resolved_semester_id,
        "semester_number": resolved_semester_number,
    }


def _parse_month_range(
    from_month: str,
    to_month: str,
) -> tuple[date, date]:
    from_date = _parse_month_start(from_month)
    to_date = _parse_month_end(to_month)
    if from_date > to_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="from_month cannot be greater than to_month",
        )
    return from_date, to_date


def _parse_month_start(value: str) -> date:
    for fmt in ("%Y-%m", "%Y-%m-%d", "%Y/%m"):
        try:
            parsed = datetime.strptime(value, fmt)
            return date(parsed.year, parsed.month, 1)
        except ValueError:
            continue
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid from_month format. Use YYYY-MM.",
    )


def _parse_month_end(value: str) -> date:
    for fmt in ("%Y-%m", "%Y-%m-%d", "%Y/%m"):
        try:
            parsed = datetime.strptime(value, fmt)
            last_day = calendar.monthrange(parsed.year, parsed.month)[1]
            return date(parsed.year, parsed.month, last_day)
        except ValueError:
            continue
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid to_month format. Use YYYY-MM.",
    )


def _student_filter_sql(prefix: str = "msa") -> str:
    return (
        f"(({prefix}.ssd_id IS NOT NULL AND {prefix}.ssd_id = :student_id) "
        f"OR {prefix}.student_usn = :student_usn)"
    )


def get_notification_items(
    db: Session,
    student_context: Dict[str, Any],
    is_read: bool,
) -> list[dict]:
    query = text(
        f"""
        SELECT
            n.lmsn_id AS id,
            n.notify_description AS notice,
            COALESCE(
                NULLIF(TRIM(n.notify_attachment), ''),
                NULLIF(SUBSTRING_INDEX(TRIM(n.notify_document_url), '/', -1), '')
            ) AS file_name,
            NULLIF(TRIM(n.notify_document_url), '') AS file_url,
            COALESCE(
                TIMESTAMP(n.delivery_date, COALESCE(n.delivery_time, '00:00:00')),
                n.created_at
            ) AS sent_on,
            NULLIF(
                TRIM(
                    CONCAT(
                        COALESCE(u.title, ''),
                        CASE WHEN COALESCE(u.title, '') <> '' THEN ' ' ELSE '' END,
                        COALESCE(u.first_name, ''),
                        CASE
                            WHEN COALESCE(u.first_name, '') <> '' AND COALESCE(u.last_name, '') <> ''
                            THEN ' '
                            ELSE ''
                        END,
                        COALESCE(u.last_name, '')
                    )
                ),
                ''
            ) AS sender,
            COALESCE(msn.notify_seen_flag, 0) AS notify_seen_flag
        FROM lms_notifications n
        JOIN lms_map_student_notifications msn
            ON msn.lmsn_id = n.lmsn_id
        LEFT JOIN iems_users u
            ON u.id = n.created_by
        WHERE {_student_filter_sql('msn')}
            AND COALESCE(msn.notify_seen_flag, 0) = :seen_flag
        ORDER BY COALESCE(n.created_at, TIMESTAMP(n.delivery_date, COALESCE(n.delivery_time, '00:00:00'))) DESC, n.lmsn_id DESC
        """
    )

    rows = db.execute(
        query,
        {
            "student_id": student_context["student_id"],
            "student_usn": student_context["student_usn"],
            "seen_flag": 1 if is_read else 0,
        },
    ).mappings().all()

    items = []
    for row in rows:
        sender = row["sender"] or "System"
        item = StudentNotificationItem(
            id=row["id"],
            notice=row["notice"] or "",
            file_name=row["file_name"],
            file_url=row["file_url"],
            sent_on=row["sent_on"],
            sender=sender,
            is_read=bool(row["notify_seen_flag"]),
        )
        items.append(item.model_dump())
    return items


def get_notification_counts(db: Session, student_context: Dict[str, Any]) -> dict:
    query = text(
        f"""
        SELECT
            SUM(CASE WHEN COALESCE(msn.notify_seen_flag, 0) = 0 THEN 1 ELSE 0 END) AS unread_count,
            SUM(CASE WHEN COALESCE(msn.notify_seen_flag, 0) = 1 THEN 1 ELSE 0 END) AS read_count
        FROM lms_map_student_notifications msn
        WHERE {_student_filter_sql('msn')}
        """
    )
    row = db.execute(
        query,
        {
            "student_id": student_context["student_id"],
            "student_usn": student_context["student_usn"],
        },
    ).mappings().first()

    counts = StudentNotificationCounts(
        unread_count=int((row["unread_count"] if row else 0) or 0),
        read_count=int((row["read_count"] if row else 0) or 0),
    )
    return counts.model_dump()


def mark_notification_read(
    db: Session,
    student_context: Dict[str, Any],
    notification_id: int,
) -> None:
    notification_map = (
        db.query(models.StudentNotificationMap)
        .filter(
            models.StudentNotificationMap.lmsn_id == notification_id,
            or_(
                and_(
                    models.StudentNotificationMap.ssd_id.isnot(None),
                    models.StudentNotificationMap.ssd_id == student_context["student_id"],
                ),
                models.StudentNotificationMap.student_usn == student_context["student_usn"],
            ),
        )
        .first()
    )

    if notification_map is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification mapping not found for this student",
        )

    notification_map.notify_seen_flag = 1
    notification_map.notify_seenon_datetime = datetime.now(timezone.utc)
    db.commit()


def get_student_curriculums(
    db: Session,
    student_context: Dict[str, Any],
) -> list[dict]:
    rows = (
        db.query(
            models.IEMSCurriculum.crclm_id,
            models.IEMSCurriculum.start_year,
            models.IEMSAcademicBatch.academic_batch_desc,
            models.IEMSAcademicBatch.academic_batch_code,
        )
        .outerjoin(
            models.IEMSAcademicBatch,
            models.IEMSAcademicBatch.academic_batch_id == models.IEMSCurriculum.crclm_id,
        )
        .filter(models.IEMSCurriculum.crclm_id == student_context["academic_batch_id"])
        .order_by(models.IEMSCurriculum.crclm_id.desc())
        .all()
    )

    items = []
    for row in rows:
        display_name = (
            row.academic_batch_desc
            or row.academic_batch_code
            or f"Curriculum {row.crclm_id} ({row.start_year})"
        )
        items.append(
            StudentCurriculumItem(
                curriculum_id=row.crclm_id,
                curriculum_name=display_name,
                start_year=row.start_year,
            ).model_dump()
        )
    return items


def get_student_terms(
    db: Session,
    student_context: Dict[str, Any],
    curriculum_id: int,
) -> list[dict]:
    _ensure_student_curriculum_access(student_context, curriculum_id)

    rows = (
        db.query(models.IEMSCrclmTerm, models.IEMSemester)
        .outerjoin(
            models.IEMSemester,
            and_(
                models.IEMSemester.academic_batch_id == curriculum_id,
                models.IEMSemester.semester == models.IEMSCrclmTerm.term_name,
            ),
        )
        .filter(models.IEMSCrclmTerm.crclm_id == curriculum_id)
        .order_by(models.IEMSCrclmTerm.term_name.asc())
        .all()
    )

    items = []
    for term, semester in rows:
        name = getattr(semester, "semester_desc", None) or f"Semester {term.term_name}"
        items.append(
            StudentTermItem(
                term_id=term.crclm_term_id,
                term_name=name,
                semester_id=getattr(semester, "semester_id", None),
                semester_number=term.term_name,
            ).model_dump()
        )
    return items


def get_attendance_summary(
    db: Session,
    student_context: Dict[str, Any],
    curriculum_id: int,
    term_id: int,
    from_month: str,
    to_month: str,
) -> list[dict]:
    _ensure_student_curriculum_access(student_context, curriculum_id)

    term_context = _resolve_term_context(db, curriculum_id, term_id)
    from_date, to_date = _parse_month_range(from_month, to_month)

    query = text(
        f"""
        SELECT
            COALESCE(NULLIF(TRIM(c.crs_title), ''), c.crs_code, CONCAT('Course ', ma.crs_id)) AS course,
            SUM(
                CASE
                    WHEN UPPER(TRIM(COALESCE(msa.attendance_status, ''))) IN ('PRESENT', 'P')
                    THEN 1
                    ELSE 0
                END
            ) AS present,
            COUNT(*) AS total_classes
        FROM lms_manage_attendance ma
        JOIN lms_map_student_attendance msa
            ON msa.attendance_id = ma.attendance_id
        LEFT JOIN iems_courses c
            ON c.crs_id = ma.crs_id
        WHERE {_student_filter_sql('msa')}
            AND ma.academic_batch_id = :curriculum_id
            AND ma.semester_id = :semester_id
            AND ma.attendance_date BETWEEN :from_date AND :to_date
            AND (
                :student_section IS NULL
                OR EXISTS (
                    SELECT 1
                    FROM iems_section sec
                    WHERE sec.id = ma.section_id
                        AND sec.academic_batch_id = :curriculum_id
                        AND sec.semester_id = :semester_id
                        AND sec.section = :student_section
                )
            )
        GROUP BY COALESCE(NULLIF(TRIM(c.crs_title), ''), c.crs_code, CONCAT('Course ', ma.crs_id))
        ORDER BY course
        """
    )

    rows = db.execute(
        query,
        {
            "student_id": student_context["student_id"],
            "student_usn": student_context["student_usn"],
            "curriculum_id": curriculum_id,
            "semester_id": term_context["semester_id"],
            "from_date": from_date,
            "to_date": to_date,
            "student_section": student_context["section"],
        },
    ).mappings().all()

    items = []
    for row in rows:
        total_classes = int(row["total_classes"] or 0)
        present = int(row["present"] or 0)
        percentage = round((present / total_classes) * 100, 2) if total_classes else 0.0
        items.append(
            StudentAttendanceSummaryItem(
                course=row["course"],
                present=present,
                total_classes=total_classes,
                percentage=percentage,
            ).model_dump()
        )
    return items


def get_attendance_daywise(
    db: Session,
    student_context: Dict[str, Any],
    curriculum_id: int,
    term_id: int,
    from_month: str,
    to_month: str,
) -> list[dict]:
    _ensure_student_curriculum_access(student_context, curriculum_id)

    term_context = _resolve_term_context(db, curriculum_id, term_id)
    from_date, to_date = _parse_month_range(from_month, to_month)

    query = text(
        f"""
        SELECT
            COALESCE(NULLIF(TRIM(c.crs_title), ''), c.crs_code, CONCAT('Course ', ma.crs_id)) AS course,
            ma.attendance_date AS attendance_date,
            CASE
                WHEN UPPER(TRIM(COALESCE(msa.attendance_status, ''))) IN ('PRESENT', 'P') THEN 'Present'
                WHEN UPPER(TRIM(COALESCE(msa.attendance_status, ''))) IN ('ABSENT', 'A') THEN 'Absent'
                ELSE COALESCE(msa.attendance_status, '')
            END AS attendance,
            NULLIF(TRIM(msa.stud_attendance_doc_url), '') AS attendance_document_url
        FROM lms_manage_attendance ma
        JOIN lms_map_student_attendance msa
            ON msa.attendance_id = ma.attendance_id
        LEFT JOIN iems_courses c
            ON c.crs_id = ma.crs_id
        WHERE {_student_filter_sql('msa')}
            AND ma.academic_batch_id = :curriculum_id
            AND ma.semester_id = :semester_id
            AND ma.attendance_date BETWEEN :from_date AND :to_date
            AND (
                :student_section IS NULL
                OR EXISTS (
                    SELECT 1
                    FROM iems_section sec
                    WHERE sec.id = ma.section_id
                        AND sec.academic_batch_id = :curriculum_id
                        AND sec.semester_id = :semester_id
                        AND sec.section = :student_section
                )
            )
        ORDER BY ma.attendance_date DESC, course ASC
        """
    )

    rows = db.execute(
        query,
        {
            "student_id": student_context["student_id"],
            "student_usn": student_context["student_usn"],
            "curriculum_id": curriculum_id,
            "semester_id": term_context["semester_id"],
            "from_date": from_date,
            "to_date": to_date,
            "student_section": student_context["section"],
        },
    ).mappings().all()

    items = []
    for row in rows:
        has_document = bool(row["attendance_document_url"])
        items.append(
            StudentAttendanceDaywiseItem(
                course=row["course"],
                attendance=row["attendance"] or "",
                attendance_document="View File" if has_document else None,
                attendance_document_url=row["attendance_document_url"],
                document_status="Uploaded" if has_document else None,
                attendance_date=row["attendance_date"],
            ).model_dump()
        )
    return items
