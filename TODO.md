# Topic Coverage Status Tracking - REVISED PLAN (Reuse Existing APIs)

## Information Gathered:
✅ topic_management APIs exist: curriculum_list, semester_list, course_list, topic_list
✅ course_list: returns crs_id, crs_code, crs_title (add status_color, instructor)
✅ topic_list: returns topic details (add status, status_color, conducted_dates)
✅ DB tables: IEMSCourses, CudosTopic, LMSMapInstructorTopic, TopicLessonSchedule, IEMSUsers
✅ Status logic: CASE WHEN actual_delivery_date -> green | conduction_date -> orange | mapping exists -> blue | else red

## Plan:
1. ✅ Extend course_list → add status_color (orange if mapped, blue if LS not added), crs_code, instructor_name
2. ✅ Extend topic_list → add status/status_color based on lesson_schedule, conducted_dates[]
3. ⏳ Add /topic_management/coverage_status → curriculum_id/term_id → count by status
4. ✅ Remove topic_tracking module (deleted folder + routes.py reference)
5. [ ] Test APIs
6. [ ] Frontend uses existing endpoints

## Dependent Files Edited:
- ✅ topic_schema.py (CourseResponse, TopicResponse, CoverageStatusResponse)
- ✅ topic_routes.py (course_list + topic_list w/ status)
- ✅ routes.py (removed topic_tracking_router)
- ⏳ coverage_status_request.py (NEW)

## Follow-up Steps:
```
cd "d:/lmss/lms-backend/edu.erp/Coding/backend" && uvicorn app.main:app --reload
Test:
curl -X POST http://127.0.0.1:8000/api/v1/topic_management/course_list -H "Content-Type: application/json" -d '{"curriculum_id":1}'
curl -X POST http://127.0.0.1:8000/api/v1/topic_management/topic_list -H "Content-Type: application/json" -d '{"course_id":1,"semester_id":1}'
```

**Coverage tracking now embedded in existing topic_management APIs! 🎉**
