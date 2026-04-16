export const ApiEndpoint = {
  login: "api/v1/auth/login",
  change_password: "api/v1/auth/change-password",
  FORGOT_PASSWORD: "api/v1/auth/forgot-password",
  master_soft_delete: "comman_function/soft_delete",

  dashboard_info: "dashboard_info_route/dashboard_info",
  dashboard_info_all_data: "dashboard_info_route/dashboard_info_all_data",

  fetch_result_year_options: "comman_function/fetch_result_year_options",

  department: {
    save_department: "department/save_department",
    department_list: "comman_function/department_list",
  },

  bos: {
    list: "bos_members/list",
    save: "bos_members/save",
    delete: "bos_members/delete",
  },

  common_api: {
    deportment_list: "comman_function/get_dept_programtype",
    batch_cycle_list: "comman_function/batch_cycle_list",
    get_semester_list: "comman_function/get_semester_list",
    occubationoption: "course_type/get_temp_cia_occasion",
    get_batch_terms: "class_time_table/get_batch_terms",
    gettimetablesession: "class_time_table/fetch_student_section_list",
    get_section_list: "comman_function/fetch_student_section_list",
    get_cycle_semester_list: "comman_function/get_cycle_semester_list",
    fetch_student_section_list: "comman_function/fetch_student_section_list",
    fetch_student_course: "course_reg/fetch_student_course_usn",
    get_student_course_usn: "std_exam_reg/fetch_student_course",
    get_university_list: "",
    is_result_yearbacklog: "comman_function/is_result_yearbacklog",
    is_backlog_with_cia_see: "comman_function/is_backlog_with_cia_see",
    is_cycle: "comman_function/is_cycle",
    grade_cardno_sem: "comman_function/get_gc_sem",
    fetch_backlog_course: "comman_function/fetch_backlog_course",
    school_department_list: "/comman_function/school_department_list",
    fetch_gc_sem: "comman_function/get_gc_sem",
    upload_gc_csv: "grade_card_no/upload_gc_csv",
    fetch_gc: "grade_card_no/fetch_gc",
  },
  
  allMaster: {
    get_all_masters_list: "all_master/all_masters_list",
    get_all_org_info: "",
    parents_occupation_master_list: "all_master/parents_occupation_master_list",
    save_parents_occupation_master: "all_master/save_parents_occupation_master",
    event_type_master_list: "all_master/event_type_master_list",
    save_event_type_master: "all_master/save_event_type_master",
    course_type_list: "all_master/course_type_list",
    save_course_type: "all_master/save_course_type",
    occasion_type_list: "all_master/occasion_type_list",
    save_occasion_type: "all_master/save_occasion_type",
    exam_session_list: "all_master/exam_session_list",
    save_exam_session: "all_master/save_exam_session",
    caste_list: "all_master/caste_list",
    save_caste: "all_master/save_caste",
    city_list: "comman_function/city_list",
    exam_hall_list: "all_master/exam_hall_list",
    save_hall: "all_master/save_hall",
    state_list: "comman_function/state_list",
    country_list: "comman_function/country_list",
    common_city_list: "comman_function/city_list",
    save_city: "all_master/save_city",
    course_occasion_type_list: "all_master/course_occasion_type_list",
  },

  academicBatch: {
    grade_type_details: "academic_batch/grade_type_details",
    getTabledata: "comman_function/academic_batch_list",
    saveAcadamicBatch: "academic_batch/save_academic_batch",
  },



  material: {
    createMaterial: "/api/v1/material/create_material",
    materialList: "/api/v1/material/material_list",
    studentList: "/api/v1/material/student_list",
    shareMaterial: "/api/v1/material/share_material",
    downloadMaterial: "/api/v1/material/download_material",
    updateMaterial: "/api/v1/material/update_material",
    materialMappingList: "/api/v1/material/material_mapping_list",
  },

  timetable: {
    scheduledClasses: "/api/v1/timetable/scheduled-classes",
    scheduledClass: (id: number) => `/api/v1/timetable/scheduled-classes/${id}`,
    deleteTimetable: (id: number) => `/api/v1/timetable/${id}`,
    resetDates: (id: number) => `/api/v1/timetable/${id}/reset-dates`,
    copyDay: "/api/v1/timetable/copy-day",
    syncRange: (id: number) => `/api/v1/timetable/${id}/sync-range`,
    exportPdf: "/api/v1/timetable/export-pdf",
    getTimetables: "/api/v1/timetable/timetables",
  },

  quiz: {
    list: "api/v1/manage-quiz/list",
    details: (id: number) => `/api/v1/manage-quiz/${id}`,
    create: "/api/v1/manage-quiz/create",
    update: (id: number) => `/api/v1/manage-quiz/${id}`,
    delete: (id: number) => `/api/v1/manage-quiz/${id}`,
    question: {
      create: (quiz_id: number) => `/api/v1/manage-quiz/${quiz_id}/question`,
      update: (qq_id: number) => `/api/v1/manage-quiz/question/${qq_id}`,
      delete: (qq_id: number) => `/api/v1/manage-quiz/question/${qq_id}`,
    },
    share: (quiz_id: number) => `/api/v1/manage-quiz/${quiz_id}/share`,
    students: (quiz_id: number) => `/api/v1/manage-quiz/${quiz_id}/students`,
    topics: "/api/v1/manage-quiz/meta/topics",
    options: "/api/v1/manage-quiz/meta/options"
  },

  studentAssignmentReport: {
    assignmentList: "api/v1/student_assignment/assignment_list",
    report: "api/v1/student_assignment/report"
  },

  consolidatedAbsenteesReport: {
    departments: "api/v1/conso_absentees_report/departments",
    programs: (id: number) => `api/v1/conso_absentees_report/programs/${id}`,
    curriculum: (id: number) => `api/v1/conso_absentees_report/curriculum/${id}`,
    terms: (id: number) => `api/v1/conso_absentees_report/terms/${id}`,
    sections: (id: number) => `api/v1/conso_absentees_report/sections/${id}`,
    dateInfo: "api/v1/conso_absentees_report/date-info",
    report: "api/v1/conso_absentees_report/report",
    drilldown: "api/v1/conso_absentees_report/drilldown"
  },

  studentAttendanceReport: {
    curriculums: "/api/v1/timetable/curriculums",
    terms: (curriculumId: number | string) => `/api/v1/timetable/curriculums/${curriculumId}/terms`,
    sections: (curriculumId: number | string, termId: number | string) =>
      `/api/v1/dropdown/sections?academic_batch_id=${curriculumId}&semester_id=${termId}`,
    courses: "/api/v1/comman_function/courses",
    lessonDates: "/api/v1/access-control/attendance/lesson-dates",
    summary: "/api/v1/access-control/attendance/summary",
  },

  student: {
    notifications: {
      unread: "/api/v1/student/notifications/unread",
      read: "/api/v1/student/notifications/read",
      counts: "/api/v1/student/notifications/counts",
      markRead: (notificationId: number | string) =>
        `/api/v1/student/notifications/${notificationId}/mark-read`,
    },
    attendance: {
      curriculums: "/api/v1/student/attendance/curriculums",
      terms: "/api/v1/student/attendance/terms",
      summary: "/api/v1/student/attendance/summary",
      daywise: "/api/v1/student/attendance/daywise",
    },
  },

  consolidatedStudentMarksReport: {
    departments: "/api/v1/reports/marks/departments",
    curriculums: "/api/v1/reports/marks/curriculums",
    terms: "/api/v1/reports/marks/terms",
    sections: "/api/v1/reports/marks/sections",
    courses: "/api/v1/reports/marks/courses",
    report: "/api/v1/reports/consolidated-student-marks",
    graph: "/api/v1/reports/consolidated-student-marks/graph",
    export: "/api/v1/reports/consolidated-student-marks/export",
  },

  topic: {
    curriculumList: "api/v1/topic_management/curriculum_list",
    semesterList: "api/v1/topic_management/semester_list",
    courseList: "api/v1/topic_management/course_list",
    sectionList: "api/v1/topic_management/section_list_post",
    topicList: "api/v1/topic_management/topic_list",
    topicsToImport: "api/v1/topic_management/topics-to-import",
    importTopics: "api/v1/topic_management/import-topics",
    importTopic: "api/v1/topic_management/import_topic",
    importAllTopics: "api/v1/topic_management/import_all_topics",
    bulkImportTopics: "api/v1/topic_management/bulk_import_topics",
    updateTopic: "api/v1/topic_management/update_topic",
    deleteTopic: "api/v1/topic_management/delete_topic",
    instructorList: "api/v1/topic_management/instructor_list",
    updateInstructor: "api/v1/topic_management/update_instructor",
    cudosTopics: "api/v1/topic_management/cudos_topics",
    importCudosTopics: "api/v1/topic_management/import_cudos_topics",
    topicSchedules: "api/v1/topic_management/topic_schedules",
    updateSchedule: "api/v1/topic_management/update_schedule",
    addSchedule: "api/v1/topic_management/add_schedule",
    addExtraClass: "api/v1/topic_management/add_extra_class",
    updateMapping: "api/v1/topic_management/update_mapping",
    addNewTopic: "api/v1/topic_management/add_new_topic"
  }

} as const;
