import tempfile
from collections import defaultdict
from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import text
from sqlalchemy.orm import Session

from ...db import models
from app.access_control.schemas.curriculum_schemas import (
    SectionOut, TimeTableOut, ScheduledClassOut, ScheduledClassUpdate
)
from ...core.database import get_db
# Import the service logic
from ..services import timetable_service 

router = APIRouter(tags=["Curriculum & Scheduling"])

_DAY_COLUMNS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


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

    resolved_term = None
    if crclm_term_id is not None:
        term_filters = [models.IEMSCrclmTerm.crclm_term_id == crclm_term_id]
        if academic_batch_id is not None:
            term_filters.append(models.IEMSCrclmTerm.crclm_id == academic_batch_id)
        resolved_term = db.query(models.IEMSCrclmTerm).filter(*term_filters).first()

    if resolved_term is None and requested_term is not None:
        term_filters = [models.IEMSCrclmTerm.crclm_term_id == requested_term]
        if academic_batch_id is not None:
            term_filters.append(models.IEMSCrclmTerm.crclm_id == academic_batch_id)
        resolved_term = db.query(models.IEMSCrclmTerm).filter(*term_filters).first()

    if resolved_term is None and requested_semester is not None and academic_batch_id is not None:
        resolved_term = db.query(models.IEMSCrclmTerm).filter(
            models.IEMSCrclmTerm.crclm_id == academic_batch_id,
            models.IEMSCrclmTerm.term_name == requested_semester,
        ).first()

    return resolved_term.term_name if resolved_term else requested_semester


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


def _fetch_timetable_export_rows(
    db: Session,
    academic_batch_id: Optional[int],
    curriculum: Optional[int],
    semester: Optional[int],
    term: Optional[int],
    crclm_term_id: Optional[int],
    section: Optional[str],
    start_date: Optional[date],
    end_date: Optional[date],
):
    batch_id = academic_batch_id if academic_batch_id is not None else curriculum
    resolved_semester_id = _resolve_semester_id(
        db=db,
        academic_batch_id=batch_id,
        semester=semester,
        term=term,
        crclm_term_id=crclm_term_id,
    )

    from_date = start_date
    to_date = end_date

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
            ls.plan_date,
            ls.start_time,
            ls.end_time,
            COALESCE(c.crs_code, '') AS crs_code,
            NULLIF(COALESCE(c.crs_title, ''), '') AS subject_name,
            COALESCE(sec.section, '') AS section,
            COALESCE(ab.academic_batch_desc, ab.academic_batch_code, CAST(ls.academic_batch_id AS CHAR)) AS batch_name,
            COALESCE(ls.semester_id, 0) AS semester,
            COALESCE(fm.instructor_id, 0) AS faculty_id,
            NULLIF(
                COALESCE(
                    NULLIF(TRIM(CONCAT_WS(' ', iu.first_name, iu.middle_name, iu.last_name)), ''),
                    NULLIF(TRIM(iu.username), '')
                ),
                ''
            ) AS faculty_name
        FROM lms_lesson_schedule ls
        LEFT JOIN iems_courses c
            ON c.crs_id = ls.crs_id
        LEFT JOIN iems_section sec
            ON sec.id = ls.section_id
        LEFT JOIN iems_academic_batch ab
            ON ab.academic_batch_id = ls.academic_batch_id
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
        ORDER BY ls.start_time ASC, ls.plan_date ASC, ls.lls_id ASC
        """
    )

    rows = db.execute(query, params).fetchall()
    return rows, batch_id, resolved_semester_id


def _build_export_pdf(rows, section: Optional[str], start_date: Optional[date], end_date: Optional[date]) -> str:
    if not rows:
        raise HTTPException(status_code=404, detail="No timetable rows found for the selected filters")

    styles = getSampleStyleSheet()
    title_style = styles["Title"]
    normal_style = styles["BodyText"]
    normal_style.fontName = "Helvetica"
    normal_style.fontSize = 8
    normal_style.leading = 10

    slots = []
    grid = defaultdict(list)
    batch_name = rows[0].batch_name
    semester = rows[0].semester
    effective_section = section or rows[0].section

    for row in rows:
        start_time = _format_time_value(row.start_time)
        end_time = _format_time_value(row.end_time)
        slot_label = f"{start_time} - {end_time}"
        day_name = row.plan_date.strftime("%A")
        if slot_label not in slots:
            slots.append(slot_label)
        if day_name in _DAY_COLUMNS:
            entry_lines = [row.crs_code or row.subject_name or "Class"]
            if row.subject_name and row.subject_name != row.crs_code:
                entry_lines.append(row.subject_name)
            if row.faculty_name:
                entry_lines.append(f"Faculty: {row.faculty_name}")
            entry_lines.append(row.plan_date.isoformat())
            grid[(slot_label, day_name)].append("<br/>".join(entry_lines))

    table_rows = [["Time", *_DAY_COLUMNS]]
    for slot_label in slots:
        row_cells = [Paragraph(slot_label, normal_style)]
        for day_name in _DAY_COLUMNS:
            entries = grid.get((slot_label, day_name), [])
            cell_text = "<br/><br/>".join(entries) if entries else "-"
            row_cells.append(Paragraph(cell_text, normal_style))
        table_rows.append(row_cells)

    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    temp_file.close()

    doc = SimpleDocTemplate(
        temp_file.name,
        pagesize=landscape(letter),
        leftMargin=24,
        rightMargin=24,
        topMargin=24,
        bottomMargin=24,
    )

    metadata = [
        f"Batch: {batch_name}",
        f"Semester: {semester}",
        f"Section: {effective_section or '-'}",
    ]
    if start_date or end_date:
        metadata.append(
            "Date Range: {start} to {end}".format(
                start=start_date.isoformat() if start_date else "-",
                end=end_date.isoformat() if end_date else "-",
            )
        )

    title = Paragraph("Timetable Export", title_style)
    subtitle = Paragraph(" | ".join(metadata), styles["Heading4"])

    time_col_width = 88
    day_col_width = (landscape(letter)[0] - doc.leftMargin - doc.rightMargin - time_col_width) / 7
    table = Table(
        table_rows,
        colWidths=[time_col_width] + [day_col_width] * 7,
        repeatRows=1,
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
                ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#e2e8f0")),
                ("ROWBACKGROUNDS", (1, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )

    detail_header_style = styles["Heading3"]
    detail_rows = [["Date", "Time", "Course Code", "Subject", "Faculty"]]
    for row in rows:
        detail_rows.append(
            [
                row.plan_date.isoformat(),
                f"{_format_time_value(row.start_time)} - {_format_time_value(row.end_time)}",
                row.crs_code or "",
                row.subject_name or "",
                row.faculty_name or "",
            ]
        )

    detail_table = Table(
        detail_rows,
        colWidths=[72, 92, 80, 180, 120],
        repeatRows=1,
    )
    detail_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f766e")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )

    doc.build(
        [
            title,
            Spacer(1, 8),
            subtitle,
            Spacer(1, 12),
            table,
            Spacer(1, 16),
            Paragraph("Scheduled Class Details", detail_header_style),
            Spacer(1, 8),
            detail_table,
        ]
    )
    return temp_file.name

# --- EXISTING CODE ---

@router.get("/timetable/timetables", response_model=List[TimeTableOut])
def get_timetables(term: str, section: str, db: Session = Depends(get_db)):
    results = db.query(
        models.IEMSTimeTable.time_table_id,
        models.IEMSTimeTable.crs_code,
        models.IEMSTimeTable.start_time,
        models.IEMSTimeTable.end_time,
        models.IEMSemTimeTable.section,
        models.IEMSemTimeTable.term
    ).join(
        models.IEMSemTimeTable,
        models.IEMSemTimeTable.id == models.IEMSTimeTable.sem_time_table_id
    ).filter(
        models.IEMSemTimeTable.term == term,
        models.IEMSemTimeTable.section == section
    ).all()

    return [
        {
            "time_table_id": row[0],
            "crs_code": row[1],
            "start_time": row[2],
            "end_time": row[3],
            "section": row[4],
            "term": row[5]
        }
        for row in results
    ]

# --- NEW TASKS AMENDED ---

# 1. DELETE TIMETABLE
@router.delete("/timetable/{sem_time_table_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_timetable(sem_time_table_id: int, db: Session = Depends(get_db)):
    success = timetable_service.delete_timetable_logic(db, sem_time_table_id)
    if not success:
        raise HTTPException(status_code=404, detail="Timetable not found")
    return None

# 2. RESET TIMETABLE DATES
@router.patch("/timetable/{sem_time_table_id}/reset-dates")
def reset_timetable(sem_time_table_id: int, db: Session = Depends(get_db)):
    success = timetable_service.reset_timetable_dates_logic(db, sem_time_table_id)
    if not success:
        raise HTTPException(status_code=404, detail="Timetable ID not found")
    return {"message": "Timetable dates reset successfully"}

# 3. COPY CLASS DAY (UPDATED WITH FRIEND'S FIXES)
@router.post("/timetable/copy-day")
def copy_day(
    source_date: date = Query(...), 
    target_date: date = Query(...), 
    section: str = Query(...), 
    db: Session = Depends(get_db)
):
    # Call the service logic
    count = timetable_service.copy_class_day_logic(db, source_date, target_date, section)
    
    # Logic Fix: If count is 0, it means nothing was found to copy. 
    # Instead of a success message, we throw a 404 error.
    if count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"No classes found for section {section} on {source_date} to copy."
        )
        
    return {"message": f"Successfully copied {count} classes to {target_date}"}

# 4. SYNC DATES
@router.patch("/timetable/{sem_time_table_id}/sync-range")
def sync_dates(
    sem_time_table_id: int, 
    end_date: date = Query(...), # Added Query here as well for consistency
    db: Session = Depends(get_db)
):
    deleted_count = timetable_service.sync_timetable_dates_logic(db, sem_time_table_id, end_date)
    return {"message": f"Sync complete. {deleted_count} classes removed beyond the new date range."}


# --- New endpoints requested ---
@router.get("/timetable/export-pdf")
def export_timetable(
    academic_batch_id: Optional[int] = Query(None),
    curriculum: Optional[int] = Query(None),
    semester: Optional[int] = Query(None),
    term: Optional[int] = Query(None),
    crclm_term_id: Optional[int] = Query(None),
    section: Optional[str] = Query(None),
    startDate: Optional[date] = Query(None),
    endDate: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    rows, _, _ = _fetch_timetable_export_rows(
        db=db,
        academic_batch_id=academic_batch_id,
        curriculum=curriculum,
        semester=semester,
        term=term,
        crclm_term_id=crclm_term_id,
        section=section,
        start_date=startDate,
        end_date=endDate,
    )
    pdf_path = _build_export_pdf(rows, section, startDate, endDate)
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=f"timetable-{date.today().isoformat()}.pdf",
    )


@router.get("/timetable/created-dates", response_model=List[date])
def get_created_dates(crs_code: str = Query(..., description="Course code"), db: Session = Depends(get_db)):
    """Return list of distinct creation dates for timetable entries for a given course."""
    dates = timetable_service.get_timetable_created_dates_for_course(db, crs_code)
    return dates


@router.get("/timetable/has-lesson")
def has_lesson(crs_code: str = Query(..., description="Course code"),
               day: date = Query(..., description="Date to check (YYYY-MM-DD)"),
               section: Optional[str] = Query(None, description="Optional section filter"),
               db: Session = Depends(get_db)):
    """Check if any lesson is scheduled for the given course on the specified date.

    Returns `{ 'scheduled': True|False }`.
    """
    # First check existence to avoid unnecessary timing queries when none exist
    exists = timetable_service.is_lesson_scheduled_on_date(db, crs_code, day, section)
    if not exists:
        return {"message": "No classes scheduled"}

    timings = timetable_service.get_scheduled_class_timings(db, crs_code, day, section)
    return {"scheduled": True, "timings": timings}


# router.add_api_route("/comman_function/timetable", get_timetable, methods=["GET"])
# router.add_api_route("/comman_function/timetable/export-pdf", export_timetable_pdf, methods=["GET"])
