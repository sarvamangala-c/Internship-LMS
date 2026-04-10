import { useAxios } from "../../hooks/useAxios";
import { ApiEndpoint } from "../../utils/ApiEndpoint/emsapiEndpoint";

export const useStudentAssignmentReportService = () => {
  const { customApiCall } = useAxios("", {
    method: "post",
    shouldFetch: false,
    loader: false,
  });

  // =====================================================
  // ✅ DROPDOWNS - Reuse existing topic endpoints
  // =====================================================

  // Curriculum (reuse topic service pattern)
  const getCurriculums = async () => {
    try {
      const response = await customApiCall<{}, any[]>(
        ApiEndpoint.topic.curriculumList,
        "post",
        {}
      );
      console.log("✅ Curriculums fetched:", response);
      
      // Transform to consistent {value, label} format
      const transformed = (response || []).map((item: any) => ({
        value: item.value || item.id || "",
        label: item.label || item.academic_batch_desc || ""
      }));
      return transformed;
    } catch (error) {
      console.error("❌ Error fetching curriculums:", error);
      return [];
    }
  };

  // Semester  
  const getSemesters = async () => {
    try {
      const response = await customApiCall<{}, any[]>(
        ApiEndpoint.topic.semesterList,
        "post",
        {}
      );
      console.log("✅ Semesters fetched:", response);
      
      const transformed = (response || []).map((item: any) => ({
        value: item.value || item.id || "",
        label: item.label || item.semester_desc || `Semester ${item.semester}`
      }));
      return transformed;
    } catch (error) {
      console.error("❌ Error fetching semesters:", error);
      return [];
    }
  };

  // Courses (needs curriculum_id)
  const getCourses = async (curriculum_id?: number) => {
    try {
      console.log("DEBUG: getCourses payload:", { curriculum_id });
      const payload = curriculum_id ? { curriculum_id } : {};
      
      const response = await customApiCall<any, any[]>(
        ApiEndpoint.topic.courseList,
        "post",
        payload
      );
      console.log("✅ Courses fetched:", response);
      
      const transformed = (response || []).map((item: any) => ({
        value: item.value || item.crs_id || "",
        label: item.label || item.crs_title || ""
      }));
      return transformed;
    } catch (error) {
      console.error("❌ Error fetching courses:", error);
      return [];
    }
  };

  // Sections (needs course_id, semester_id, academic_batch_id=curriculum_id)
  const getSections = async (params: { 
    course_id?: number; 
    semester_id?: number; 
    curriculum_id?: number 
  } = {}) => {
    try {
      console.log("DEBUG: getSections params:", params);
      const payload = {
        course_id: params.course_id,
        semester_id: params.semester_id,
        academic_batch_id: params.curriculum_id
      };

      const response = await customApiCall<any, any[]>(
        ApiEndpoint.topic.sectionList,
        "post",
        payload
      );
      console.log("✅ Sections fetched:", response);
      
      const transformed = (response || []).map((item: any) => ({
        value: item.value || item.id || "",
        label: item.label || item.section || ""
      }));
      return transformed;
    } catch (error) {
      console.error("❌ Error fetching sections:", error);
      return [];
    }
  };

// =====================================================
// ✅ ASSIGNMENTS & REPORT - Student Assignment APIs
// =====================================================

// Get ALL assignments for initial table load (minimal params)
const getAllAssignments = async () => {
  try {
    console.log("DEBUG: getAllAssignments - loading all available assignments");
    const payload = {}; // Minimal/empty payload for broad results
    
    const response: any = await customApiCall(
      ApiEndpoint.studentAssignmentReport.assignmentList,
      "post",
      payload
    );
    console.log("✅ All Assignments response:", response);
    
    const data = Array.isArray(response?.data)
  ? response.data
  : Array.isArray(response)
  ? response
  : [];
    const transformed = data.map((item: any) => ({
      value: item.assignment_id || item.lms_assignment_id || "",
      label: item.assignment_name || `Assignment ${item.lms_assignment_id}`,
      course_id: item.course_id || item.crs_id,
      semester_id: item.semester_id,
      //section_id: item.section_id || null
    }));
    return transformed;
  } catch (error) {
    console.error("❌ Error fetching all assignments:", error);
    return [];
  }
};

// Enhanced getAssignments with optional section_id (preserves existing signature)
const getAssignments = async (
  course_id: number,
  semester_id: number,
  academic_batch_id: number
) => {
  try {
    console.log("🔗 API CALL:", ApiEndpoint.studentAssignmentReport.assignmentList, "payload:", { course_id, semester_id, academic_batch_id });
    
    const response: any = await customApiCall(
      ApiEndpoint.studentAssignmentReport.assignmentList,
      "post",
      {
        course_id,
        semester_id,
        academic_batch_id
      }
    );

    console.log("📡 RAW Backend API response:", response);
    console.log("🔍 response?.data:", response?.data, Array.isArray(response?.data));

    // ✅ Extract data array - handle both {status,data} and direct array
    const rawData = response?.data || response || [];
    const dataArray = Array.isArray(rawData) ? rawData : [];
    console.log("🔧 TRANSFORMED dataArray:", dataArray, dataArray.length);
    
    const options = dataArray.map((item: any) => ({
      value: item.value || item.lms_assignment_id || "",
      label: item.label || item.assignment_name || `Assignment ${item.lms_assignment_id || ''}`
    }));
    
    console.log("✅ FINAL options returned:", options);
    return options;

  } catch (error) {
    console.error("Assignment error:", error);
    return [];
  }
};


  const getStudentReport = async (assignment_id: number) => {
  try {
    const response: any = await customApiCall(
      ApiEndpoint.studentAssignmentReport.report,
      "post",
      { assignment_id }
    );

    const data =
      Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.data?.data)
        ? response.data.data
        : [];

    return data;

  } catch (error) {
    console.error("Report error:", error);
    return [];
  }
};

  // Export XLS (placeholder - needs backend endpoint if separate)
  const exportXLS = async (assignment_id: number, filters: any) => {
    try {
      console.log("DEBUG: exportXLS:", { assignment_id, filters });
      // Use same report endpoint or dedicated export endpoint
      // For now, reuse report endpoint (backend may handle export)
      const payload = { 
        lms_assignment_id: assignment_id,
        ...filters 
      };
      
      const response = await customApiCall(
        ApiEndpoint.studentAssignmentReport.report, 
        "post",
        payload
      );
      console.log("✅ XLS Export response:", response);
      return response;
    } catch (error) {
      console.error("❌ Error exporting XLS:", error);
      throw error;
    }
  };

  return {
    // Dropdowns
    getCurriculums,
    getSemesters, 
    getCourses,
    getSections,
    // Assignment/Report (enhanced)
    getAllAssignments,
    getAssignments,
    getStudentReport,
    exportXLS,
  };

};