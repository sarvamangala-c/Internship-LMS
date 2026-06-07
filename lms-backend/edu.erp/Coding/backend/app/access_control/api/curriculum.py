# curriculum_routes.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

# Adjust these imports based on repository layout
from ...db import models
from app.access_control.schemas.curriculum_schemas import (
    CurriculumOut, TermOut, SectionOut, 
    TimeTableOut, ScheduledClassOut, ScheduledClassUpdate
)
from app.api.v1.ems_module.comman_functions.comman_function import (
    list_batch_sections,
    list_course_types,
    list_courses,
)

from ...core.database import get_db

router = APIRouter(tags=["Curriculum & Scheduling"])

# --- 1. List Curriculum API ---
@router.get("/timetable/curriculums", response_model=List[CurriculumOut])
def get_curriculums(db: Session = Depends(get_db)):
    curriculum_rows = (
        db.query(
            models.IEMSCurriculum.crclm_id,
            models.IEMSCurriculum.start_year,
            models.IEMSCurriculum.pgm_id,
            models.IEMSCurriculum.dept_id,
            models.IEMSAcademicBatch.academic_batch_desc,
            models.IEMSAcademicBatch.academic_batch_code,
        )
        .outerjoin(
            models.IEMSAcademicBatch,
            models.IEMSAcademicBatch.academic_batch_id == models.IEMSCurriculum.crclm_id,
        )
        .order_by(models.IEMSCurriculum.crclm_id)
        .all()
    )

    result = []
    for row in curriculum_rows:
        display_name = (
            row.academic_batch_desc
            or row.academic_batch_code
            or f"Curriculum {row.crclm_id} ({row.start_year})"
        )
        result.append(
            {
                "crclm_id": row.crclm_id,
                "start_year": row.start_year,
                "pgm_id": row.pgm_id,
                "dept_id": row.dept_id,
                "name": display_name,
            }
        )

    return result

# --- 2. List Terms Based on Curriculum API ---
@router.get("/timetable/curriculums/{crclm_id}/terms", response_model=List[TermOut])
def get_terms_by_curriculum(crclm_id: int, db: Session = Depends(get_db)):
    print(f"\n[TERMS API] Received crclm_id: {crclm_id}")
    print(f"[TERMS API] Type of crclm_id: {type(crclm_id)}")
    
    terms = db.query(models.IEMSCrclmTerm).filter(
        models.IEMSCrclmTerm.crclm_id == crclm_id
    ).all()
    
    print(f"[TERMS API] Found {len(terms)} terms for crclm_id={crclm_id}")
    for t in terms:
        print(f"[TERMS API] Term: crclm_term_id={t.crclm_term_id}, term_name={t.term_name}")
    
    # Return an empty list when no terms found to match the declared List response_model
    if not terms:
        print(f"[TERMS API] No terms found, returning empty list")
        return []
    return terms

# List Section Based on Curriculum & Term
@router.get("/timetable/curriculums/{crclm_id}/terms/{crclm_term_id}/sections", response_model=List[SectionOut])
def get_sections(crclm_id: int, crclm_term_id: str, db: Session = Depends(get_db)):
    print(
        f"[SECTIONS DEBUG] requested crclm_id={crclm_id}, crclm_term_id={crclm_term_id}"
    )

    try:
        requested_term_value = int(crclm_term_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="crclm_term_id must be numeric for sections lookup",
        ) from exc

    resolved_term = db.query(models.IEMSCrclmTerm).filter(
        models.IEMSCrclmTerm.crclm_id == crclm_id,
        models.IEMSCrclmTerm.crclm_term_id == requested_term_value
    ).first()

    if resolved_term is None:
        resolved_term = db.query(models.IEMSCrclmTerm).filter(
            models.IEMSCrclmTerm.crclm_id == crclm_id,
            models.IEMSCrclmTerm.term_name == requested_term_value
        ).first()

    semester_id = resolved_term.term_name if resolved_term else requested_term_value
    print(
        "[SECTIONS DEBUG] resolved_term="
        f"{resolved_term.crclm_term_id if resolved_term else None}, "
        f"semester_id={semester_id}"
    )

    sections_query = db.query(models.IEMSection.section).filter(
        models.IEMSection.academic_batch_id == crclm_id,
        models.IEMSection.semester_id == semester_id,
        models.IEMSection.section.isnot(None),
    ).distinct().order_by(models.IEMSection.section)

    compiled_query = sections_query.statement.compile(
        bind=db.bind,
        compile_kwargs={"literal_binds": True},
    )
    print(f"[SECTIONS DEBUG] SQL={compiled_query}")

    sections = sections_query.all()

    if not sections and resolved_term:
        fallback_query = db.query(models.IEMSection.section).filter(
            models.IEMSection.semester_id == semester_id,
            models.IEMSection.section.isnot(None),
        ).distinct().order_by(models.IEMSection.section)

        fallback_sql = fallback_query.statement.compile(
            bind=db.bind,
            compile_kwargs={"literal_binds": True},
        )
        print(
            "[SECTIONS DEBUG] No rows for academic_batch_id + semester_id. "
            f"Fallback SQL={fallback_sql}"
        )
        sections = fallback_query.all()

    return [{"section": sec[0]} for sec in sections if sec[0]]


router.add_api_route("/comman_function/course-types", list_course_types, methods=["GET"])
router.add_api_route("/comman_function/courses", list_courses, methods=["POST"])
router.add_api_route("/comman_function/batch-sections", list_batch_sections, methods=["POST"])
