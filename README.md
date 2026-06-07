# Design and Development of course learning and attendance Management System

## Features
### EMS: Receive Announcement
- List received announcements in a table (pagination + export)
- Filter: **All / Unread / Read**
- Unread counter badge (“New”)
- **Mark Read** per announcement
- **✓ Mark all as read**
- Click description to open a **detail modal**
- Modal shows created/delivery dates and read status
- Loading state + empty state UI
- Toast notifications

### EMS: Send Announcement
- Tabs: **✉️ Compose** and **📤 Sent**
- Choose recipient type: **student / faculty / parent**
- Filter recipients in modal:
  - Department → Program → Curriculum
  - Semester + Section
- Multi-select recipients with checkbox list + select-all
- Compose form:
  - Delivery date and time
  - Message input with character count
- Preview panel (recipient type + message)
- Confirm-send modal
- After sending:
  - View sent announcements list
  - Delete a sent announcement

### EMS: Manage Assignment
- Assignment list table with actions:
  - **View Submissions**
  - **Share**
  - **Edit**
  - **Delete**
- Submissions view:
  - Shows counts for submitted/pending/graded
  - Table includes file info, seen on, status, secured marks
  - **Review** per student submission
- Modals for:
  - Create/Edit assignment (batch/semester/course/dates + Bloom levels)
  - Share assignment (filter + select multiple students)
  - Review submission (approve or send for rework + marks + remark)

### EMS: Attendance Management (AttendanceManagementPage)
- Manage attendance for a selected class context (curriculum/term/course/section)
- Student attendance table where rows can be marked as:
  - present / absent
  - includes per-row remark input
- Actions supported in UI:
  - **Enable** attendance for editing (after finalized)
  - **Finalize** attendance (freezes status)
  - **Mark all present** helper
- Sync attendance mapping to LMS backend (calls `attendanceApi.syncLmsAttendanceMap`)
- Reports panel (AttendanceReports component) to view generated attendance reports
- Loading states for curriculums/terms/courses/sections/students/records
- Toast notifications for success/errors

---

## 🛠️ Technology Stack
### Frontend
- React + TypeScript
- TailwindCSS
- DataTable component for listing/pagination/export
- Axios instance (`axiosInstance`)
- localStorage auth state (`LocalStorageHelper`)
- Toast notifications (`react-toastify`)

### Backend
- Python API served via Uvicorn (`uvicorn app.main:app --reload`)

---

## 🔄 User Flow (high-level)
1. User logs in and navigates to EMS module pages.
2. Frontend fetches data via REST APIs.
3. User performs actions:
   - Receive: filter → view → mark read
   - Send: compose → filter/select recipients → confirm → send → view/delete sent
   - Assignments: create/edit → share → view submissions → review
   - Attendance: select context → mark per student → finalize/sync → view reports
4. Frontend shows results using modals/tables/toasts.

---

## Prerequisites
- Frontend: Node.js + npm
- Backend: Python 3.x
- Virtual environment recommended for backend

---

## Installation
### Backend (from `Testing_ion/lms-backend/readme.txt`)
1. Create venv:
   - `python -m venv env` OR `python -m venv .venv`
2. Activate (Windows):
   - `.venv\Scripts\activate`
3. Install deps:
   - `pip install -r requirements.txt`

### Frontend
1. `cd Testing_ion/lms-frontend/erp.fnt/Coding/ionerp_v1`
2. `npm install`

---

## Running the Application
### Backend
- `uvicorn app.main:app --reload`
- Optional host/port from docs:
  - `uvicorn app.main:app --reload --host 10.91.0.213 --port 8001`

### Frontend
- `npm start`
- Default URL per CRA-style docs: `http://localhost:3000`

---

## 🎨 UI Features
- Modern gradient/premium headers
- Mesh/gradient background effects
- Table-based layouts with pagination + export
- Modal workflows for selection/details/confirmation
- Emoji-enhanced labels
- Loading spinners + empty states
- Toast notifications for success/error
- Edit/Finalize state handling (Attendance page)
