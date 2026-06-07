import axios from "axios";
import { LocalStorageHelper } from "./localStorageHelper";
import { loginData, orgDataResponse } from "../pages/login/loginModel";
import { toast } from "react-toastify";

const AUTH_COOKIE_KEY = "auth_state";
const AUTH_COOKIE_ORG_KEY = "auth_org_state";

// const axiosInstance = axios.create({
//   baseURL: process.env.REACT_APP_API_URL,
//   timeout: 10000,
//   withCredentials: true,
//   headers: {
//     "Content-Type": "application/json",
//   },
// });

const axiosInstance = axios.create({
  baseURL: (process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/` : "http://127.0.0.1:8000/"),
  headers: {
    "Content-Type": "application/json",
  },
});


axiosInstance.interceptors.request.use(
  (config) => {
    if (!config.headers) {
      config.headers = {};
    }
    const role = LocalStorageHelper.getObject<string>("role");
    const authOrg =
      LocalStorageHelper.getObject<orgDataResponse>(AUTH_COOKIE_ORG_KEY);
    config.headers.role = role;
    // Token-based authentication disabled
    // if (authState && authState?.access_token) {
    //   config.headers.Authorization = `Bearer ${authState.access_token}`;
    // }
    if (authOrg && authOrg?.value) {
      config.headers["org-id"] = authOrg?.value;
    }
    return config;
  },
  (error: any) => {
    return Promise.reject(error);
  },
);

axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.config?.skipGlobalErrorToast) {
      return Promise.reject(error);
    }
    // ✅ DEBOUNCE TOASTS - Prevent spam
    const now = Date.now();
    const errorKey = error.response?.status
      ? `http_${error.response.status}`
      : "network";
    const lastToastTime = (window as any).lastToastTime?.[errorKey] || 0;

    if (now - lastToastTime < 3000) {
      // 3s debounce per error type
      console.warn(`⏳ Toast debounced: ${errorKey}`);
      return Promise.reject(error);
    }

    (window as any).lastToastTime = (window as any).lastToastTime || {};
    (window as any).lastToastTime[errorKey] = now;

    if (error.response) {
      const status = error.response.status;

      // ✅ DROPDOWN ENDPOINTS - Suppress non-critical 404s
      const optionalEndpoints = [
        // Existing
        "comman_function/get_dept_programtype",
        "department_list",
        "comman_function/department_list",
        // ✅ NEW: Topic/StudentAssignment dropdowns (common failure points)
        "topic/curriculum_list",
        "topic/semester_list",
        "topic/course_list",
        "topic/section_list_post",
        "student_assignment/assignment_list",
      ];

      const requestUrl = error.config?.url || "";

      if (status === 404) {
        if (
          optionalEndpoints.some((endpoint) => requestUrl.includes(endpoint))
        ) {
          console.warn(`⚠️ Optional endpoint 404 (suppressed): ${requestUrl}`);
          return Promise.reject(error); // Fail silently for dropdowns
        }
        toast.error(
          error.response.data?.message ||
            `Resource not found: ${requestUrl.split("?")[0]}`,
        );
        return Promise.reject(error);
      }

      if (status === 401) {
        // Auth error - redirect to login
        LocalStorageHelper.removeAll();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      if (status >= 500 && error.config?.method === "get") {
        toast.error(`Server error (${status}). Retrying in 2s...`);
        // Simple retry logic only for GET requests
        return new Promise((resolve) => {
          setTimeout(() => resolve(axiosInstance(error.config)), 2000);
        });
      }

      // Other HTTP errors (400, 422, etc.)
      toast.error(error.response.data?.message || `Error ${status}`);
    } else {
      // ✅ NETWORK ERROR - Show ONCE, then log only
      const networkToastCount = (window as any).networkToastCount || 0;
      if (networkToastCount === 0) {
        toast.error(
          "Network error: Server is unreachable. Check if backend is running.",
        );
        (window as any).networkToastCount = 1;
      } else {
        console.error(
          "🌐 Network unreachable (toast suppressed after 1st):",
          error.message,
        );
      }
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
