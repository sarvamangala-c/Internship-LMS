import axiosInstance from "../utils/api";
import { scheduledClasses as mockScheduledClasses } from "../modules/scheduleClass/mockData";
import { toast } from "react-toastify";
import {
  getCourseNameById,
  getSectionNameById,
  getTopicNameById,
} from "../constants/scheduleConstants";
import { timetableApi } from "./timetableApi";

const STORAGE_KEY = "scheduled_classes";

/**
 * Normalizes a string and removes all special characters and extra spaces.
 * Ensures that "Room 101" and "Room-101" or "Room 101 " are treated identical.
 */
const normalize = (val: any) => {
  if (val === null || val === undefined) return "";
  return String(val)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
};

/**
 * Standardizes a class object for comparison.
 * Maps IDs to canonical names and normalizes all fields to prevent subtle duplicates.
 */
const getComparisonKey = (item: any) => {
  const date = normalize(item.date || item.classDate);
  const day = normalize(item.day);
  const startTime = item.startTime || "";
  const endTime = item.endTime || "";
  const time = normalize(
    item.time || (startTime && endTime ? `${startTime}-${endTime}` : ""),
  );

  // Resolve canonical names from IDs or fallback to raw names
  const course = normalize(
    item.course ||
      (item.courseId ? getCourseNameById(Number(item.courseId)) : ""),
  );
  const section = normalize(
    item.section ||
      (item.sectionId ? getSectionNameById(Number(item.sectionId)) : ""),
  );
  const topic = normalize(
    item.topic || (item.topicId ? getTopicNameById(Number(item.topicId)) : ""),
  );
  const location = normalize(item.location);

  return `${date}|${day}|${time}|${course}|${section}|${topic}|${location}`;
};

/**
 * Deduplicates an array of class objects based on their content fingerprint.
 */
const deduplicateData = (data: any[]) => {
  const uniqueMap = new Map();
  (Array.isArray(data) ? data : []).forEach((item: any) => {
    const key = getComparisonKey(item);
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, item);
    }
  });
  return Array.from(uniqueMap.values());
};

export const scheduleClassApi = {
  saveSchedule: async (data: any) => {
    try {
      if (Array.isArray(data)) {
        const responses = [];
        for (const row of data) {
          console.log("[scheduleClassApi] outgoing save payload", {
            method: "POST",
            url: "/api/v1/comman_function/schedule-class",
            payload: row,
          });
          const response = await axiosInstance.post(
            "/api/v1/comman_function/schedule-class",
            row,
            { skipGlobalErrorToast: true },
          );
          responses.push(response.data);
        }

        return { success: true, data: responses };
      }

      console.log("[scheduleClassApi] outgoing save payload", {
        method: "POST",
        url: "/api/v1/comman_function/schedule-class",
        payload: data,
      });
      const response = await axiosInstance.post(
        "/api/v1/comman_function/schedule-class",
        data,
        { skipGlobalErrorToast: true },
      );
      return { success: true, data: response.data };
    } catch (error: any) {
      console.log("[scheduleClassApi] saveSchedule error", {
        status: error.response?.status,
        errorBody: error.response?.data,
        errorMessage: error.message,
      });

      if (error.response) {
        const status = error.response.status;
        const backendMessage =
          error.response.data?.message ||
          error.response.data?.detail ||
          `Request failed with status ${status}`;
        return {
          success: false,
          status,
          message: backendMessage,
          errorResponse: error.response.data,
        };
      }

      if (error.request) {
        return {
          success: false,
          networkError: true,
          message:
            "Network error: Server is unreachable. Check if backend is running.",
        };
      }

      return {
        success: false,
        message: error.message || "Failed to schedule class.",
      };
    }
  },

  getAll: async () => {
    try {
      const response = await axiosInstance.get(
        "/api/v1/timetable/scheduled-classes",
      );
      const backendData = Array.isArray(response.data) ? response.data : [];
      if (backendData.length > 0) {
        const processedData = deduplicateData(backendData);
        return { success: true, data: processedData };
      }

      const existingData = localStorage.getItem(STORAGE_KEY);
      let dataFiltered = [];
      if (existingData) {
        dataFiltered = JSON.parse(existingData);
      } else {
        dataFiltered = [...mockScheduledClasses];
      }
      const cleanedData = deduplicateData(dataFiltered);
      return { success: true, data: cleanedData };
    } catch (error: any) {
      const existingData = localStorage.getItem(STORAGE_KEY);
      let data = existingData
        ? JSON.parse(existingData)
        : [...mockScheduledClasses];

      // Proactive cleanup of local data
      const cleanedData = deduplicateData(data);
      return { success: true, data: cleanedData };
    }
  },

  delete: async (target: any) => {
    try {
      await axiosInstance.delete(
        `/api/v1/timetable/scheduled-classes/${target}`,
      );
      return { success: true };
    } catch (error: any) {
      const existingData = localStorage.getItem(STORAGE_KEY);
      const scheduledClasses = existingData
        ? JSON.parse(existingData)
        : [...mockScheduledClasses];

      const targetStr = String(target).toLowerCase();

      const filtered = scheduledClasses.filter((cls: any) => {
        const itemKey = getComparisonKey(cls);
        const itemId = String(cls.id).toLowerCase();

        // Remove if ID matches OR if the fingerprint matches (deletes all clones)
        return itemId !== targetStr && itemKey !== targetStr;
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      return { success: true, allData: filtered };
    }
  },

  // New methods for timetable operations
  copyDay: timetableApi.copyDay.bind(timetableApi),
  resetTimetableDates: timetableApi.resetTimetableDates.bind(timetableApi),
  deleteTimetable: timetableApi.deleteTimetable.bind(timetableApi),
  getTimetables: timetableApi.getTimetables.bind(timetableApi),
  updateScheduledClass: timetableApi.updateScheduledClass.bind(timetableApi),
  deleteScheduledClass: timetableApi.deleteScheduledClass.bind(timetableApi),
  syncDateRange: timetableApi.syncDateRange.bind(timetableApi),
  exportTimetablePdf: timetableApi.exportTimetablePdf.bind(timetableApi),
};
