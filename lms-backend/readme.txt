1 Setup

//create virtual env
python -m venv env

python -m venv .venv

//Activate 
source ./env/bin/activate

//ensure latest version
python -m pip install --upgrade pip

//dependency installation
pip install -r requirements.txt


2 Command to runserver 
//Activate created venv and run app
source ./env/bin/activate
uvicorn app.main:app --reload

uvicorn app.main:app --reload --host 10.91.0.213 --port 8001


2 Command to runserver 
//Activate created venv and run app
.venv\Scripts\activate
uvicorn app.main:app --reload

uvicorn app.main:app --reload --host 10.91.0.213 --port 8001

D:\lms-backend\
cd lms-backend\edu.erp\Coding\backend
cd lms-frontend\erp.fnt\Coding\ionerp_v1


for POST/api/v1/topic_management/import_topic
Import Topic (Enhanced with automatic field derivation and idempotency)

Request Body (Backward Compatible):
{
  "academic_batch_id": 1,
  "semester_id": 1,
  "course_id": 1,
  "section_id": 2,
  "created_by": 1
}

Request Body (With Optional Fields):
{
  "academic_batch_id": 1,
  "semester_id": 1,
  "course_id": 1,
  "section_id": 2,
  "instructor_id": 1,  // Optional, defaults to created_by
  "topic_ids": [1, 2, 3],  // Optional, auto-fetched if not provided
  "created_by": 1
}

Response (Success):
{
  "status": true,
  "message": "Successfully processed 5 topics: 3 imported, 2 skipped",
  "data": {
    "imported": 3,
    "skipped": 2,
    "total_processed": 5
  }
}

Response (All topics already imported):
{
  "status": false,
  "message": "Topics already imported",
  "data": {
    "imported": 0,
    "skipped": 5,
    "total_processed": 5,
    "already_imported": true
  }
}

Features:
- Backward Compatible: Works with existing UI requests
- Auto-derivation: instructor_id defaults to created_by, topic_ids fetched from DB
- Idempotent: Uses INSERT ... SELECT ... WHERE NOT EXISTS to prevent duplicates
- Validates topic existence in cudos_topic for specified course/semester
- Checks for existing mappings per instructor (topic_id + instructor_id)
- Uses safe bulk INSERT with subquery for concurrency
- Returns detailed summary of imported/skipped topics
- Error handling with transaction rollback

Database Enhancement (Optional):
To guarantee no duplicates even under concurrency, add a unique constraint:
ALTER TABLE lms_map_instructor_topic ADD CONSTRAINT uk_topic_instructor UNIQUE (topic_id, instructor_id);

for PUT /api/v1/topic/update_topic/{topic_id}
Update Topic
topic id=14
{
  "topic_code": "T002",
  "topic_title": "Introduction Updated",
  "topic_content": "Updated content",
  "academic_batch_id": 1,
  "semester_id": 1,
  "course_id": 1,
  "created_by": 1
}

#2nd task edit topic values used to check
PUT
/api/v1/topic/edit_topic_schedule
Edit Topic Schedule
Request body
{
  "inst_map_id": 3,
  "conduction_date": "2026-03-07",
  "actual_delivery_date": "2026-03-07",
  "marks_expt": 1,
  "modified_by": 1
}

POST/api/v1/topic/add_extra_topic
Add Extra Topic

{
  "topic_id": 17,
  "academic_batch_id": 1,
  "semester_id": 1,
  "course_id": 1,
  "section_id": 1,
  "instructor_id": 1,
  "topic_hrs": "1",
  "num_of_sessions": 1,
  "created_by": 1
}

#3rd task
POST
/api/v1/material/share_material
Share material
{
  "material_id": 1,
  "academic_batch_id":1,
  "section_id": 1,
"student_usns": ["1RV21CS001","1RV21CS002"]
}

#4th task - Import Selected Topics
POST /api/v1/topic_management/import_selected_topics
Import selected topics from cudos_topic to lms_map_instructor_topic

Request Body:
{
  "academic_batch_id": 1,
  "semester_id": 1,
  "course_id": 1,
  "section_id": 1,
  "instructor_id": 1,
  "topic_ids": [1, 2, 3],
  "created_by": 1
}

Response:
{
  "status": true,
  "message": "Successfully processed 3 topics: 2 imported, 1 skipped",
  "data": {
    "imported": 2,
    "skipped": 1,
    "total_processed": 3
  }
}

Features:
- Idempotent: Multiple imports of same topics won't create duplicates
- Validates topic existence in cudos_topic
- Checks for existing mappings per instructor/course/section
- Maintains relational integrity with foreign keys
- Provides detailed import summary
- Error handling with transaction rollback
