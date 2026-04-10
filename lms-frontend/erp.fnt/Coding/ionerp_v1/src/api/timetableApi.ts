import axiosInstance from "../utils/api";
import { toast } from "react-toastify";

export interface CopyDayRequest {
  sourceDate: string;
  targetDate: string;
  curriculumId?: number;
  termId?: number;
  sectionId?: string;
}

export interface TimetableResponse {
  success: boolean;
  data?: any;
  message?: string;
}

export interface ApiError {
  message: string;
  status?: number;
  details?: any;
}

export interface TimetableOptionItem {
  value: string;
  label: string;
  raw: any;
}

const SECTION_ID_KEYS = [
  "section_id",
  "batch_section_id",
  "id",
  "value",
];

const SECTION_LABEL_KEYS = [
  "section",
  "section_name",
  "section_label",
  "label",
  "name",
];

class TimetableApi {
  private unwrapData(responseData: any) {
    if (Array.isArray(responseData)) {
      return responseData;
    }

    if (Array.isArray(responseData?.data)) {
      return responseData.data;
    }

    if (Array.isArray(responseData?.items)) {
      return responseData.items;
    }

    if (Array.isArray(responseData?.rows)) {
      return responseData.rows;
    }

    return [];
  }

  private mapOptions(
    items: any[],
    config: {
      valueKeys: string[];
      labelKeys: string[];
      fallbackLabel: (item: any, index: number) => string;
    },
  ): TimetableOptionItem[] {
    return items
      .map((item, index) => {
        const value = config.valueKeys
          .map((key) => item?.[key])
          .find(
            (candidate) =>
              candidate !== undefined && candidate !== null && candidate !== "",
          );

        if (value === undefined || value === null || value === "") {
          return null;
        }

        const label = config.labelKeys
          .map((key) => item?.[key])
          .find(
            (candidate) => typeof candidate === "string" && candidate.trim(),
          );

        return {
          value: String(value),
          label: String(label || config.fallbackLabel(item, index)),
          raw: item,
        };
      })
      .filter(Boolean) as TimetableOptionItem[];
  }

  private normalizeSectionOption(item: any): TimetableOptionItem | null {
    if (typeof item === "string") {
      const sectionLabel = item.trim();
      return sectionLabel
        ? {
            value: sectionLabel,
            label: sectionLabel,
            raw: { section: sectionLabel, section_label: sectionLabel },
          }
        : null;
    }

    const sectionLabel = SECTION_LABEL_KEYS
      .map((key) => item?.[key])
      .find((candidate) => typeof candidate === "string" && candidate.trim());

    const sectionId = SECTION_ID_KEYS
      .map((key) => item?.[key])
      .find(
        (candidate) =>
          candidate !== undefined && candidate !== null && candidate !== "",
      );

    if (!sectionLabel && (sectionId === undefined || sectionId === null || sectionId === "")) {
      return null;
    }

    const normalizedLabel = String(
      sectionLabel ?? item?.value ?? item?.section_id ?? item?.id,
    ).trim();
    const normalizedId =
      sectionId !== undefined && sectionId !== null && sectionId !== ""
        ? String(sectionId)
        : normalizedLabel;

    return {
      value: normalizedId,
      label: normalizedLabel,
      raw: {
        ...item,
        section_label: normalizedLabel,
        section_name: item?.section_name ?? normalizedLabel,
        section: item?.section ?? normalizedLabel,
        section_id:
          item?.section_id ??
          item?.batch_section_id ??
          item?.id ??
          item?.value ??
          null,
      },
    };
  }

  async getCurriculums(): Promise<TimetableResponse> {
    try {
      const response = await axiosInstance.get("/api/v1/timetable/curriculums");
      const data = this.unwrapData(response.data);

      return {
        success: true,
        data: this.mapOptions(data, {
          valueKeys: ["crclm_id", "academic_batch_id", "id", "value"],
          labelKeys: [
            "curriculum_name",
            "crclm_name",
            "academic_batch_desc",
            "name",
            "label",
          ],
          fallbackLabel: (item) =>
            [item?.academic_batch_code, item?.academic_year]
              .filter(Boolean)
              .join(" ") ||
            `Curriculum ${item?.crclm_id || item?.academic_batch_id || item?.id}`,
        }),
      };
    } catch (error: any) {
      const errorMessage = this.handleError(
        error,
        "Failed to fetch curriculums",
      );
      return { success: false, message: errorMessage, data: [] };
    }
  }

  async getTerms(curriculumId: number): Promise<TimetableResponse> {
    try {
      const response = await axiosInstance.get(
        `/api/v1/timetable/curriculums/${curriculumId}/terms`,
      );
      const data = this.unwrapData(response.data);
      console.log("[Timetable] terms response", data);
      const options = this.mapOptions(data, {
        valueKeys: ["crclm_term_id", "semester_id", "id", "value"],
        labelKeys: ["label", "name"],
        fallbackLabel: (item) =>
          `${item?.term_name ?? item?.semester ?? item?.semester_id ?? item?.crclm_term_id} - Semester`,
      });
      console.log("[Timetable] transformed term options", options);

      return {
        success: true,
        data: options,
      };
    } catch (error: any) {
      const errorMessage = this.handleError(error, "Failed to fetch terms");
      return { success: false, message: errorMessage, data: [] };
    }
  }

  async getSections(
    curriculumId: number,
    termId: number,
  ): Promise<TimetableResponse> {
    try {
      const response = await axiosInstance.get(
        `/api/v1/timetable/curriculums/${curriculumId}/terms/${termId}/sections`,
      );
      const rawSections = this.unwrapData(response.data);
      console.log("[Timetable] raw batch/sections API response", rawSections);

      const primaryOptions = (Array.isArray(rawSections) ? rawSections : [])
        .map((item) => this.normalizeSectionOption(item))
        .filter(Boolean) as TimetableOptionItem[];

      const hasNumericSectionId = primaryOptions.some((option) => {
        const sectionId = Number(
          option.raw?.section_id ??
            option.raw?.batch_section_id ??
            option.raw?.id ??
            option.value,
        );
        return Number.isFinite(sectionId) && sectionId > 0;
      });

      let mergedOptions = primaryOptions;

      if (!hasNumericSectionId) {
        const fallbackResponse = await axiosInstance.get("/api/v1/dropdown/sections", {
          params: {
            academic_batch_id: curriculumId,
            semester_id: termId,
          },
        });
        const fallbackSections = this.unwrapData(fallbackResponse.data);
        console.log("[Timetable] raw dropdown/sections fallback response", fallbackSections);

        const fallbackOptions = (Array.isArray(fallbackSections) ? fallbackSections : [])
          .map((item) => this.normalizeSectionOption(item))
          .filter(Boolean) as TimetableOptionItem[];

        const mergedMap = new Map<string, TimetableOptionItem>();
        [...fallbackOptions, ...primaryOptions].forEach((option) => {
          const labelKey = String(
            option.raw?.section ??
              option.raw?.section_name ??
              option.raw?.section_label ??
              option.label,
          )
            .trim()
            .toUpperCase();

          if (!labelKey) {
            return;
          }

          const existing = mergedMap.get(labelKey);
          const optionSectionId = Number(
            option.raw?.section_id ?? option.raw?.batch_section_id ?? option.raw?.id ?? option.value,
          );
          const existingSectionId = Number(
            existing?.raw?.section_id ?? existing?.raw?.batch_section_id ?? existing?.raw?.id ?? existing?.value,
          );

          if (!existing || (!Number.isFinite(existingSectionId) && Number.isFinite(optionSectionId))) {
            mergedMap.set(labelKey, option);
          }
        });

        mergedOptions = Array.from(mergedMap.values());
      }

      console.log("[Timetable] mapped dropdown options", mergedOptions);

      return {
        success: true,
        data: mergedOptions,
      };
    } catch (error: any) {
      const errorMessage = this.handleError(error, "Failed to fetch sections");
      return { success: false, message: errorMessage, data: [] };
    }
  }

  async getCourseTypes(): Promise<TimetableResponse> {
    try {
      const courseTypesUrl = "/api/v1/comman_function/course-types";
      const courseTypesMethod = "GET";
      console.log("[Timetable] course types request", {
        method: courseTypesMethod,
        url: courseTypesUrl,
      });
      const response = await axiosInstance.get(courseTypesUrl);
      const data = this.unwrapData(response.data);
      console.log("[Timetable] course types response", data);

      return {
        success: true,
        data: this.mapOptions(data, {
          valueKeys: ["course_type_id", "id", "value"],
          labelKeys: ["course_type_desc", "course_type_name", "name", "label"],
          fallbackLabel: (item) =>
            item?.course_type_code ||
            `Course Type ${item?.course_type_id || item?.id}`,
        }),
      };
    } catch (error: any) {
      const errorMessage = this.handleError(
        error,
        "Failed to fetch course types",
      );
      return { success: false, message: errorMessage, data: [] };
    }
  }

  async getCourses(request: {
    academic_batch_id: number;
    semester: number;
    course_type_id: number;
  }): Promise<TimetableResponse> {
    try {
      const coursesUrl = "/api/v1/comman_function/courses";
      const coursesMethod = "POST";
      console.log("[Timetable] courses request", {
        method: coursesMethod,
        url: coursesUrl,
        payload: request,
      });
      const response = await axiosInstance.post(coursesUrl, request);
      const data = this.unwrapData(response.data);
      console.log("[Timetable] courses response", data);

      return {
        success: true,
        data: this.mapOptions(data, {
          valueKeys: ["crs_id", "course_id", "id", "value"],
          labelKeys: [
            "crs_title",
            "course_name",
            "course_title",
            "name",
            "label",
          ],
          fallbackLabel: (item) =>
            [item?.crs_code, item?.course_code].find(Boolean) ||
            `Course ${item?.crs_id || item?.course_id || item?.id}`,
        }),
      };
    } catch (error: any) {
      const errorMessage = this.handleError(error, "Failed to fetch courses");
      return { success: false, message: errorMessage, data: [] };
    }
  }

  async getBatchSections(request: {
    academic_batch_id: number;
    semester_id: number;
    section_id?: string;
  }): Promise<TimetableResponse> {
    try {
      console.log("[Timetable] batch-sections payload", request);
      const response = await axiosInstance.post(
        "/api/v1/comman_function/batch-sections",
        request,
      );
      const data = this.unwrapData(response.data);
      console.log("[Timetable] raw batch/sections API response", data);

      const options = this.mapOptions(data, {
        valueKeys: ["sem_time_table_id", "timetable_id", "id", "value"],
        labelKeys: ["timetable_name", "title", "name", "label"],
        fallbackLabel: (item, index) =>
          [item?.start_date, item?.end_date].filter(Boolean).join(" to ") ||
          `Timetable ${item?.sem_time_table_id || item?.timetable_id || item?.id || index + 1}`,
      });
      console.log("[Timetable] mapped batch/sections options", options);

      return {
        success: true,
        data: options,
      };
    } catch (error: any) {
      const errorMessage = this.handleError(
        error,
        "Failed to fetch timetable options",
      );
      return { success: false, message: errorMessage, data: [] };
    }
  }

  /**
   * Copy scheduled classes from one day to another
   */
  async copyDay(request: CopyDayRequest): Promise<TimetableResponse> {
    try {
      const response = await axiosInstance.post(
        "/api/v1/timetable/copy-day",
        request,
      );

      toast.success("Classes copied successfully!");
      return {
        success: true,
        data: response.data,
        message: "Classes copied successfully",
      };
    } catch (error: any) {
      const errorMessage = this.handleError(error, "Failed to copy classes");
      toast.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  /**
   * Reset timetable dates for a specific timetable
   */
  async resetTimetableDates(
    semTimeTableId: number,
  ): Promise<TimetableResponse> {
    try {
      const response = await axiosInstance.patch(
        `/api/v1/timetable/${semTimeTableId}/reset-dates`,
      );

      toast.success("Timetable dates reset successfully!");
      return {
        success: true,
        data: response.data,
        message: "Timetable dates reset successfully",
      };
    } catch (error: any) {
      const errorMessage = this.handleError(
        error,
        "Failed to reset timetable dates",
      );
      toast.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  /**
   * Delete a timetable
   */
  async deleteTimetable(semTimeTableId: number): Promise<TimetableResponse> {
    try {
      const response = await axiosInstance.delete(
        `/api/v1/timetable/${semTimeTableId}`,
      );

      toast.success("Timetable deleted successfully!");
      return {
        success: true,
        data: response.data,
        message: "Timetable deleted successfully",
      };
    } catch (error: any) {
      const errorMessage = this.handleError(
        error,
        "Failed to delete timetable",
      );
      toast.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  /**
   * Get timetables list
   */
  async getTimetables(params?: {
    curriculumId?: number;
    termId?: number;
    sectionId?: string;
  }): Promise<TimetableResponse> {
    try {
      const response = await axiosInstance.get("/api/v1/timetable/timetables", {
        params,
      });

      return {
        success: true,
        data: this.unwrapData(response.data),
      };
    } catch (error: any) {
      const errorMessage = this.handleError(
        error,
        "Failed to fetch timetables",
      );
      toast.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  /**
   * Get scheduled classes
   */
  async getScheduledClasses(params?: {
    curriculumId?: number;
    termId?: number;
    sectionId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<TimetableResponse> {
    try {
      const response = await axiosInstance.get(
        "/api/v1/timetable/scheduled-classes",
        { params },
      );

      return {
        success: true,
        data: this.unwrapData(response.data),
      };
    } catch (error: any) {
      const errorMessage = this.handleError(
        error,
        "Failed to fetch scheduled classes",
      );
      toast.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  /**
   * Update a scheduled class
   */
  async updateScheduledClass(
    classId: number,
    data: any,
  ): Promise<TimetableResponse> {
    try {
      const response = await axiosInstance.put(
        `/api/v1/timetable/scheduled-classes/${classId}`,
        data,
      );

      toast.success("Class updated successfully!");
      return {
        success: true,
        data: response.data,
        message: "Class updated successfully",
      };
    } catch (error: any) {
      const errorMessage = this.handleError(error, "Failed to update class");
      toast.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  /**
   * Delete a scheduled class
   */
  async deleteScheduledClass(classId: number): Promise<TimetableResponse> {
    try {
      const response = await axiosInstance.delete(
        `/api/v1/timetable/scheduled-classes/${classId}`,
      );

      toast.success("Class deleted successfully!");
      return {
        success: true,
        data: response.data,
        message: "Class deleted successfully",
      };
    } catch (error: any) {
      const errorMessage = this.handleError(error, "Failed to delete class");
      toast.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  /**
   * Sync date ranges for timetable
   */
  async syncDateRange(
    semTimeTableId: number,
    data: {
      startDate: string;
      endDate: string;
    },
  ): Promise<TimetableResponse> {
    try {
      const response = await axiosInstance.patch(
        `/api/v1/timetable/${semTimeTableId}/sync-range`,
        data,
      );

      toast.success("Date range synced successfully!");
      return {
        success: true,
        data: response.data,
        message: "Date range synced successfully",
      };
    } catch (error: any) {
      const errorMessage = this.handleError(error, "Failed to sync date range");
      toast.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  /**
   * Export timetable as PDF
   */
  async exportTimetablePdf(params?: {
    semTimeTableId?: number;
    curriculumId?: number;
    termId?: number;
    sectionId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<TimetableResponse> {
    try {
      const exportUrl = "/api/v1/timetable/export-pdf";
      console.log("[Timetable] export timetable final URL", exportUrl);
      console.log("[Timetable] export timetable params", params);
      const response = await axiosInstance.get(exportUrl, {
        params,
        responseType: "blob",
      });

      // Create download link
      const blob = new Blob([response.data as BlobPart], {
        type: "application/pdf",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `timetable_${new Date().getTime()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Timetable exported successfully!");
      return {
        success: true,
        message: "Timetable exported successfully",
      };
    } catch (error: any) {
      const errorMessage = this.handleError(
        error,
        "Failed to export timetable",
      );
      toast.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  /**
   * Handle API errors and return appropriate error messages
   */
  private handleError(error: any, defaultMessage: string): string {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;

      switch (status) {
        case 400:
          return (
            data?.message ||
            data?.detail ||
            "Bad request. Please check your input."
          );
        case 401:
          return "Authentication required. Please login again.";
        case 403:
          return "You do not have permission to perform this action.";
        case 404:
          return "The requested resource was not found.";
        case 409:
          return (
            data?.message || data?.detail || "Conflict with existing data."
          );
        case 422:
          // Validation errors
          if (data?.detail && Array.isArray(data.detail)) {
            return data.detail
              .map((err: any) => err.msg || err.message)
              .join(", ");
          }
          return data?.message || data?.detail || "Validation error.";
        case 500:
          return "Server error. Please try again later.";
        default:
          return data?.message || data?.detail || defaultMessage;
      }
    } else if (error.request) {
      // Network error
      return "Network error. Please check your connection and try again.";
    } else {
      // Other errors
      return error.message || defaultMessage;
    }
  }
}

export const timetableApi = new TimetableApi();
export default timetableApi;
