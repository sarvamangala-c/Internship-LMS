from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.access_control.services import student_service
from app.core.database import get_db
from app.utils.http_return_helper import returnSuccess

router = APIRouter(prefix="/student", tags=["Student"])
optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)


def get_student_context(
    student_id: Optional[int] = Query(
        default=None,
        description="Temporary fallback while auth-to-student mapping is unavailable.",
    ),
    token: Optional[str] = Depends(optional_oauth2_scheme),
    db: Session = Depends(get_db),
):
    return student_service.resolve_student_context(
        db=db,
        token=token,
        student_id=student_id,
    )


@router.get("/notifications/unread")
def get_unread_notifications(
    student_context=Depends(get_student_context),
    db: Session = Depends(get_db),
):
    data = student_service.get_notification_items(
        db=db,
        student_context=student_context,
        is_read=False,
    )
    return returnSuccess(data)


@router.get("/notifications/read")
def get_read_notifications(
    student_context=Depends(get_student_context),
    db: Session = Depends(get_db),
):
    data = student_service.get_notification_items(
        db=db,
        student_context=student_context,
        is_read=True,
    )
    return returnSuccess(data)


@router.get("/notifications/counts")
def get_notification_counts(
    student_context=Depends(get_student_context),
    db: Session = Depends(get_db),
):
    data = student_service.get_notification_counts(
        db=db,
        student_context=student_context,
    )
    return returnSuccess(data)


@router.post("/notifications/{notification_id}/mark-read")
def mark_notification_read(
    notification_id: int,
    student_context=Depends(get_student_context),
    db: Session = Depends(get_db),
):
    student_service.mark_notification_read(
        db=db,
        student_context=student_context,
        notification_id=notification_id,
    )
    return returnSuccess({"notification_id": notification_id}, "Marked as read")


@router.get("/attendance/curriculums")
def get_student_curriculums(
    student_context=Depends(get_student_context),
    db: Session = Depends(get_db),
):
    data = student_service.get_student_curriculums(
        db=db,
        student_context=student_context,
    )
    return returnSuccess(data)


@router.get("/attendance/terms")
def get_student_terms(
    curriculum_id: int = Query(...),
    student_context=Depends(get_student_context),
    db: Session = Depends(get_db),
):
    data = student_service.get_student_terms(
        db=db,
        student_context=student_context,
        curriculum_id=curriculum_id,
    )
    return returnSuccess(data)


@router.get("/attendance/summary")
def get_student_attendance_summary(
    curriculum_id: int = Query(...),
    term_id: int = Query(...),
    from_month: str = Query(..., description="Use YYYY-MM."),
    to_month: str = Query(..., description="Use YYYY-MM."),
    student_context=Depends(get_student_context),
    db: Session = Depends(get_db),
):
    data = student_service.get_attendance_summary(
        db=db,
        student_context=student_context,
        curriculum_id=curriculum_id,
        term_id=term_id,
        from_month=from_month,
        to_month=to_month,
    )
    return returnSuccess(data)


@router.get("/attendance/daywise")
def get_student_attendance_daywise(
    curriculum_id: int = Query(...),
    term_id: int = Query(...),
    from_month: str = Query(..., description="Use YYYY-MM."),
    to_month: str = Query(..., description="Use YYYY-MM."),
    student_context=Depends(get_student_context),
    db: Session = Depends(get_db),
):
    data = student_service.get_attendance_daywise(
        db=db,
        student_context=student_context,
        curriculum_id=curriculum_id,
        term_id=term_id,
        from_month=from_month,
        to_month=to_month,
    )
    return returnSuccess(data)
