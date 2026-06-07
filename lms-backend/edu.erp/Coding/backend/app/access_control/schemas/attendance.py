from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import date


class AttendanceRecord(BaseModel):
    regno: str
    usno: Optional[str] = None
    student_id: Optional[int] = None
    attendance_status: int  # 1-Finalize, 2-Draft, 0-Yet to take
    other_reason: Optional[str] = None
    is_extra_class: Optional[int] = 0


class AttendanceSavePayload(BaseModel):
    meta: Dict
    records: List[AttendanceRecord]


class LessonDatesResponse(BaseModel):
    status: bool
    message: str
    data: List[date]


class AttendanceSummaryStudent(BaseModel):
    usn: str
    name: str
    present: int
    absent: int


class AttendanceSummaryResponse(BaseModel):
    status: bool
    message: str
    data: List[AttendanceSummaryStudent]


class LmsMapStudentRecord(BaseModel):
    """Per-student LMS map row: `a_type_id` 1 = Present, 0 = Absent (when `present` is used, it sets the same)."""

    student_usn: str
    present: Optional[bool] = None
    a_type_id: Optional[int] = None
    remarks: Optional[str] = None


class LmsAttendanceSyncPayload(BaseModel):
    """Ensure `lms_manage_attendance` exists and `lms_map_student_attendance` has one row per enrolled student."""

    academic_batch_id: int
    semester_id: int
    crs_id: int
    section_id: int
    attendance_date: date
    created_by: Optional[int] = None
    a_type_id: int = 1
    tt_detail_id: Optional[int] = None
    attendance_class_count: int = 1
    manage_status: int = 1
    attendance_id: Optional[int] = None
    records: Optional[List[LmsMapStudentRecord]] = None
