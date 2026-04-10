import axiosInstance from "../../utils/api";
import { ApiEndpoint } from "../../utils/ApiEndpoint/emsapiEndpoint";
import type { CreateQuizPayload } from "../../types/ems/quiz";
import { useAxios } from "../../hooks/useAxios";


export const useManageQuizService = () => {
  const { customApiCall } = useAxios("", {
    method: "post",
    shouldFetch: false,
    loader: false,
  });

  // Quiz CRUD
  const getQuizList = async (params?: any) => {
    const res: any = await axiosInstance.get(ApiEndpoint.quiz.list, { params });
    return res.data?.data?.items || res.data?.items || [];
  };

  const createQuiz = async (payload: CreateQuizPayload) => {
    const res: any = await axiosInstance.post(ApiEndpoint.quiz.create, payload);
    return res.data;
  };

  const deleteQuiz = async (id: number) => {
    const res: any = await axiosInstance.delete(ApiEndpoint.quiz.delete(id));
    return res.data;
  };

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

  const getMetaTopics = async (academic_batch_id: number, semester_id: number, crs_id: number) => {
    try {
      const params = { academic_batch_id, semester_id, crs_id };
      const res: any = await axiosInstance.get(ApiEndpoint.quiz.topics, { params });
      return res.data?.data || res.data || [];
    } catch { return []; }
  };

  // Detail methods
  const getQuizDetails = async (id: number) => {
    const res: any = await axiosInstance.get(ApiEndpoint.quiz.details(id));
    return res.data?.data || res.data || null;
  };

  const getStudents = async (id: number) => {
    const res: any = await axiosInstance.get(ApiEndpoint.quiz.students(id));
    return res.data?.data || res.data || [];
  };

  const shareQuiz = async (id: number, payload: any) => {
    const res: any = await axiosInstance.post(ApiEndpoint.quiz.share(id), payload);
    return res.data;
  };

  return {
    getQuizList,
    createQuiz,
    deleteQuiz,
    getCurriculums,
    getSemesters,
    getCourses,
    getSections,
    getMetaTopics,
    getQuizDetails,
    getStudents,
    shareQuiz
  };
};



