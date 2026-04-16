from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class StudentNotificationItem(BaseModel):
    id: int
    notice: str
    file_name: Optional[str] = None
    file_url: Optional[str] = None
    sent_on: Optional[datetime] = None
    sender: Optional[str] = None
    is_read: bool


class StudentNotificationCounts(BaseModel):
    unread_count: int
    read_count: int


class StudentCurriculumItem(BaseModel):
    curriculum_id: int
    curriculum_name: str
    start_year: Optional[int] = None


class StudentTermItem(BaseModel):
    term_id: int
    term_name: str
    semester_id: Optional[int] = None
    semester_number: Optional[int] = None


class StudentAttendanceSummaryItem(BaseModel):
    course: str
    present: int
    total_classes: int
    percentage: float


class StudentAttendanceDaywiseItem(BaseModel):
    course: str
    attendance: str
    attendance_document: Optional[str] = None
    attendance_document_url: Optional[str] = None
    document_status: Optional[str] = None
    attendance_date: date
