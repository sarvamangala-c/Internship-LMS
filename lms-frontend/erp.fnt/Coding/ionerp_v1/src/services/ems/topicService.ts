import { useAxios } from "../../hooks/useAxios";
import { ApiEndpoint } from "../../utils/ApiEndpoint/emsapiEndpoint";

export const useTopicService = () => {
  const { customApiCall } = useAxios<any, any>("", {
    method: "post",
    shouldFetch: false,
    loader: false,
  });

  // =====================================================
  // ✅ Get Curriculum List
  // =====================================================
  const getCurriculumList = async () => {
    try {
      console.log("DEBUG: topicService.getCurriculumList called");
      const response = await customApiCall<{}, any[]>(
        ApiEndpoint.topic.curriculumList,
        "post",
        {}
      );
      console.log("✅ Curriculum List fetched:", response);
      return response || [];
    } catch (error) {
      console.error("❌ Error fetching curriculum list:", error);
      return [];
    }
  };

  // =====================================================
  // ✅ Get Semester List
  // =====================================================
  const getSemesterList = async () => {
    try {
      const response = await customApiCall<{}, any[]>(
        ApiEndpoint.topic.semesterList,
        "post",
        {}
      );
      console.log("✅ Semester List fetched:", response);
      return response || [];
    } catch (error) {
      console.error("❌ Error fetching semester list:", error);
      return [];
    }
  };

  // =====================================================
  // ✅ Get Course List
  // 🔥 FIX: payload optional so dropdown can load all
  // =====================================================
  const getCourseList = async (
    payload: { curriculum_id?: number; semester_id?: number } = {}
  ) => {
    try {
      // Debugging: Log API endpoint and payload
      console.log("DEBUG: API Endpoint:", ApiEndpoint.topic.courseList);
      console.log("DEBUG: Payload:", payload);

      const response = await customApiCall<any, any[]>(
        ApiEndpoint.topic.courseList,
        "post",
        payload
      );
      // Debugging: Log API response
      console.log("DEBUG: API Response:", response);
      console.log("✅ Course List fetched:", response);
      return response || [];
    } catch (error) {
      console.error("❌ Error fetching course list:", error);
      return [];
    }
  };

  // =====================================================
  // ✅ Get Section List
  // 🔥 FIX: payload optional so dropdown can load all
  // =====================================================
  const getSectionList = async (
    payload: { course_id?: number; semester_id?: number; academic_batch_id?: number } = {}
  ) => {
    try {
      const response = await customApiCall<any, any[]>(
        ApiEndpoint.topic.sectionList,
        "post",
        payload
      );
      console.log("✅ Section List fetched:", response);
      return response || [];
    } catch (error) {
      console.error("❌ Error fetching section list:", error);
      return [];
    }
  };

  // =====================================================
  // ✅ Import Topic
  // =====================================================
// =====================================================
// ✅ Import Topic - FIXED: Uses correct /import_topic endpoint + customApiCall
// =====================================================
interface ImportTopicPayload {
  academic_batch_id: number;
  semester_id: number;
  course_id: number;
  section_id: number;
  instructor_id?: number | null;
  created_by: number;
}

const importTopic = async (payload: ImportTopicPayload) => {
  try {
    console.log("DEBUG: Calling importTopic with payload:", payload);
    const response = await customApiCall(
      ApiEndpoint.topic.importTopic,
      "post",
      payload
    );
    console.log("✅ Import topics response:", response);
    return response;
  } catch (error) {
    console.error("❌ Error importing topics:", error);
    throw error;
  }
};


  // =====================================================
  // ✅ Get Topic List
  // =====================================================
  const getTopicList = async (payload: {
    academic_batch_id: number;
    course_id: number;
    semester_id: number;
    section_id?: number;
    instructor_id?: number;
  }) => {
    try {
      const response = await customApiCall<any, any>(
        ApiEndpoint.topic.topicList,
        "post",
        payload
      );
      console.log("✅ Topic List fetched:", response);
      // Handle response - could be direct array or wrapped in {status, data, message}
      const data = Array.isArray(response) ? response : (response?.data ?? []);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error("❌ Error fetching topic list:", error);
      return [];
    }
  };

  // ✅ Get Cudos Topics (for import modal)
  // =====================================================
  const getCudosTopics = async (payload: {
    academic_batch_id: number;
    course_id: number;
    semester_id: number;
    section_id: number;
  }) => {
    try {
      const response = await customApiCall<any, any>(
        ApiEndpoint.topic.cudosTopics,
        "post",
        payload
      );
      console.log("✅ Cudos Topics fetched:", response);
      // Handle response - could be direct array or wrapped in {status, data, message}
      const data = Array.isArray(response) ? response : (response?.data ?? []);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error("❌ Error fetching cudos topics:", error);
      return [];
    }
  };

  // =====================================================
  // ✅ Update Topic
  // =====================================================
  const updateTopic = async (topicId: number, payload: any) => {
    try {
      const response = await customApiCall(
        `${ApiEndpoint.topic.updateTopic}/${topicId}`,
        "put",
        payload
      );
      console.log("✅ Topic updated:", response);
      return response;
    } catch (error) {
      console.error("❌ Error updating topic:", error);
      throw error;
    }
  };

  // =====================================================
  // ✅ Delete Topic
  // =====================================================
  const deleteTopic = async (topicId: number) => {
    try {
      const response = await customApiCall(
        `${ApiEndpoint.topic.deleteTopic}/${topicId}`,
        "delete"
      );
      console.log("✅ Topic deleted:", response);
      return response;
    } catch (error) {
      console.error("❌ Error deleting topic:", error);
      throw error;
    }
  };

  // =====================================================
  // ✅ Get Instructor List (GET method from backend)
  // =====================================================
  const getInstructorList = async () => {
    try {
      const response: any = await customApiCall<any, any[]>(
        ApiEndpoint.topic.instructorList,
        "get",
        {}
      );
      console.log("✅ Instructor List fetched:", response);
      // Handle response - could be array or have data property
      const data = Array.isArray(response) ? response : ((response as any)?.data || []);
      return data;
    } catch (error) {
      console.error("❌ Error fetching instructor list:", error);
      return [];
    }
  };

  // =====================================================
  // ✅ Update Instructor (using update_instructor API)
  // =====================================================
  const updateInstructor = async (mappingId: number, payload: { course_instructor_id: number }) => {
    try {
      const response = await customApiCall(
        `${ApiEndpoint.topic.updateInstructor}/${mappingId}`,
        "put",
        payload
      );
      console.log("✅ Instructor updated:", response);
      return response;
    } catch (error) {
      console.error("❌ Error updating instructor:", error);
      throw error;
    }
  };

// =====================================================
// ✅ Get Unmapped CUDOS Topics (Not yet imported)
// =====================================================
  const getUnmappedCudosTopics = async (payload: {
    course_id: number;
    semester_id: number;
    section_id: number;
  }) => {
    try {
      const response = await customApiCall<any, any[]>(
        ApiEndpoint.topic.cudosTopics,
        "post",
        payload
      );
      console.log("✅ Unmapped CUDOS Topics fetched:", response);
      return response || [];
    } catch (error) {
      console.error("❌ Error fetching unmapped cudos topics:", error);
      return [];
    }
  };

  // =====================================================
  // ✅ Import Selected Cudos Topics with Instructor
  // =====================================================
  const importCudosTopics = async (payload: {
    course_id: number;
    semester_id: number;
    section_id: number;
    topic_ids: number[];
    instructor_id: number;
    academic_batch_id: number;
  }) => {
    try {
      const response = await customApiCall(
        ApiEndpoint.topic.importCudosTopics,
        "post",
        payload
      );
      console.log("✅ Cudos Topics imported:", response);
      return response;
    } catch (error) {
      console.error("❌ Error importing cudos topics:", error);
      throw error;
    }
  };

  // =====================================================
  // ✅ Get Topic Schedules
  // =====================================================
  const getTopicSchedules = async (payload: { mapping_id: number }) => {
    try {
      const response = await customApiCall<any, any[]>(
        ApiEndpoint.topic.topicSchedules,
        "post",
        payload
      );
      console.log("✅ Topic Schedules fetched:", response);
      return response || [];
    } catch (error) {
      console.error("❌ Error fetching topic schedules:", error);
      return [];
    }
  };

  // =====================================================
  // ✅ Update Schedule
  // =====================================================
  const updateSchedule = async (
    scheduleId: number,
    payload: { conduction_date?: string; actual_delivery_date?: string }
  ) => {
    try {
      const response = await customApiCall(
        `${ApiEndpoint.topic.updateSchedule}/${scheduleId}`,
        "put",
        payload
      );
      console.log("✅ Schedule updated:", response);
      return response;
    } catch (error) {
      console.error("❌ Error updating schedule:", error);
      throw error;
    }
  };

  // =====================================================
  // ✅ Add Schedule
  // =====================================================
  const addSchedule = async (payload: {
    mapping_id: number;
    session_number: number;
    conduction_date?: string;
  }) => {
    try {
      const response = await customApiCall(
        ApiEndpoint.topic.addSchedule,
        "post",
        payload
      );
      console.log("✅ Schedule added:", response);
      return response;
    } catch (error) {
      console.error("❌ Error adding schedule:", error);
      throw error;
    }
  };

  // =====================================================
  // ✅ Add Extra Class
  // =====================================================
  const addExtraClass = async (payload: {
    mapping_id: number;
    class_date: string;
    start_time?: string;
    end_time?: string;
    notes?: string;
  }) => {
    try {
      const response = await customApiCall(
        ApiEndpoint.topic.addExtraClass,
        "post",
        payload
      );
      console.log("✅ Extra class added:", response);
      return response;
    } catch (error) {
      console.error("❌ Error adding extra class:", error);
      throw error;
    }
  };

  // =====================================================
  // ✅ Update Mapping (Assign Instructor)
  // =====================================================
  const updateMapping = async (
  mappingId: number,
  payload: {
    instructor_id: number;
    mapping_id?: number;
    course_id?: number;
    section_id?: number;
    topic_id?: number;
  }
) => {
  try {
    const response = await customApiCall(
      `${ApiEndpoint.topic.updateMapping}/${mappingId}`,
      "put",
      payload
    );
    console.log("✅ Mapping updated:", response);
    return response;
  } catch (error) {
    console.error("❌ Error updating mapping:", error);
    throw error;
  }
};
  // =====================================================
  // ✅ Add New Topic
  // =====================================================
  const addNewTopic = async (payload: {
    academic_batch_id: number;
    semester_id: number;
    course_id: number;
    section_id: number;
    topic_title: string;
    topic_code: string;
    topic_content?: string;
    topic_hrs?: string;
    num_of_sessions?: number;
    instructor_id: number;
  }) => {
    try {
      const response = await customApiCall(
        ApiEndpoint.topic.addNewTopic,
        "post",
        payload
      );
      console.log("✅ New topic added:", response);
      return response;
    } catch (error) {
      console.error("❌ Error adding new topic:", error);
      throw error;
    }
  };

  return {
    getCurriculumList,
    getSemesterList,
    getCourseList,
    getSectionList,
    importTopic,

    getTopicList,
    updateTopic,
    deleteTopic,
    // New methods
    getInstructorList,
    updateInstructor,
    getCudosTopics,
    getUnmappedCudosTopics,
    importCudosTopics,
    getTopicSchedules,
    updateSchedule,
    addSchedule,
    addExtraClass,
    updateMapping,
    addNewTopic,
  };
};