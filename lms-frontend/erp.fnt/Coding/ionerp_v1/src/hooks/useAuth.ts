import { useState, useEffect, useCallback } from "react";
import { LocalStorageHelper } from "../utils/localStorageHelper";
import { useAxios } from "./useAxios";
import {
  loginData,
  loginPayload,
  OptionsResponse,
  orgDataResponse,
} from "../pages/login/loginModel";
import { ApiEndpoint } from "../utils/ApiEndpoint/emsapiEndpoint";
import { toast } from "react-toastify";
import { commonAPiResponse } from "../types/auth";
// import { useModalWithForm } from "../contexts/ModelFormContext";

export const AUTH_COOKIE_KEY = "auth_state";
export const AUTH_COOKIE_ORG_KEY = "auth_org_state";
export const AUTH_COOKIE_OPTIONData_KEY = "cookie_option_list";
export const AUTH_COOKIE_Department_KEY = "cookie_dept_option_list";
export const AUTH_APPLICATION_ROLE = "role";

export const useAuth = () => {
  const [authState, setAuthState] = useState<loginData | null>(() => {
    return LocalStorageHelper.getObject<loginData>(AUTH_COOKIE_KEY) || null;
  });

  const [currentOrg, setCurrentOrg] = useState<orgDataResponse | null>(() => {
    return (
      LocalStorageHelper.getObject<orgDataResponse>(AUTH_COOKIE_ORG_KEY) || null
    );
  });

  const [optionList, setOptionList] = useState<OptionsResponse | null>(() => {
    return (
      LocalStorageHelper.getObject<OptionsResponse>(
        AUTH_COOKIE_OPTIONData_KEY,
      ) || null
    );
  });

  const [applicationRole, setApplicationRole] = useState<string | null>(() => {
    return (
      LocalStorageHelper.getObject<string>(AUTH_APPLICATION_ROLE) || "main"
    );
  });

  const { loading, refetch, customApiCall } = useAxios<loginPayload, loginData>(
    ApiEndpoint.login,
    {
      method: "post",
      loader: true,
      shouldFetch: false,
    },
  );

  // ✅ FIXED EFFECT
  useEffect(() => {
    console.log("Current Role:", applicationRole);
    const role = LocalStorageHelper.getObject<string>(AUTH_APPLICATION_ROLE);

    if (authState && applicationRole !== role) {
      window.location.reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationRole, authState]);

  // ✅ STORAGE SYNC EFFECT
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea === localStorage) {
        switch (event.key) {
          case AUTH_COOKIE_KEY:
            setAuthState(
              LocalStorageHelper.getObject<loginData>(AUTH_COOKIE_KEY),
            );
            break;

          case AUTH_COOKIE_ORG_KEY:
            setCurrentOrg(
              LocalStorageHelper.getObject<orgDataResponse>(
                AUTH_COOKIE_ORG_KEY,
              ),
            );
            break;

          case AUTH_COOKIE_OPTIONData_KEY:
            setOptionList(
              LocalStorageHelper.getObject<OptionsResponse>(
                AUTH_COOKIE_OPTIONData_KEY,
              ),
            );
            break;

          case AUTH_APPLICATION_ROLE:
            setApplicationRole(
              LocalStorageHelper.getObject<string>(AUTH_APPLICATION_ROLE) ??
                "main",
            );
            break;
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);

    // ✅ FIXED MERGE DAMAGE
    // Effect to sync state with LocalStorage
    // Token-based authentication disabled - just check if authState exists
    if (authState) {
      LocalStorageHelper.setObject(AUTH_COOKIE_KEY, authState);
      LocalStorageHelper.setObject(AUTH_COOKIE_ORG_KEY, currentOrg);
      LocalStorageHelper.setObject(AUTH_COOKIE_OPTIONData_KEY, optionList);
      LocalStorageHelper.setObject(AUTH_APPLICATION_ROLE, applicationRole);
    } else {
      LocalStorageHelper.removeAll();
    }

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [applicationRole, authState, currentOrg, optionList]);

  const logout = useCallback(() => {
    setAuthState(null);
    setCurrentOrg(null);
    setOptionList(null);
    window.location.href = "/login";
  }, []);

  const deptList = useCallback(async () => {
    try {
      if (ApiEndpoint.common_api.deportment_list) {
        const response = await customApiCall<null, commonAPiResponse>(
          ApiEndpoint.common_api.deportment_list,
          "get",
        );
        if (response) {
          LocalStorageHelper.setObject(AUTH_COOKIE_Department_KEY, response);
        }
      }
    } catch (error) {
      console.debug(
        "Department list fetch is optional and may not be available",
      );
    }
  }, [customApiCall]);

  const login = useCallback(
    async (role: string, username: string, password: string) => {
      // ✅ DEMO LOGIN
      if (username === "demo" && password === "demo@123") {
        const demoData: loginData = {
          username: "Demo User",
          access_token: "demo-token-12345",
          token_type: "Bearer",
          first_name: "Demo",
          last_name: "User",
          user_id: 1, // Demo user ID — used for API calls like received announcements
          org_data: [
            { label: "Demo Organization", value: 1 },
            { label: "Test Organization", value: 2 },
          ],
          options: {
            user_type: [],
            role_list: [],
            get_hall_type_list: [],
            priority_list: [],
            designations: [],
            organisations: [],
            all_masters_list: [],
            get_academics_event: [],
            get_academics_event_status: [],
            get_grade_type_list: [],
            get_coursetype_list: [],
            get_coursetype_cia_marks: [],
            get_coursetype_options: [],
            get_event_status_options: [],
            get_section_list_options: [],
            get_admission_type_list: [],
            get_quota_list: [],
            get_category_options: [],
            get_blood_group_list_options: [],
            get_caste_list: [],
            get_religion_list: [],
            get_physically_cha_desc_list: [],
            get_education_details_list: [],
            get_occupation_list: [],
            get_certificate_list: [],
          },
        };

        try {
          LocalStorageHelper.setObject("role", "ionems");
          setApplicationRole("ionems");
          LocalStorageHelper.setObject(AUTH_COOKIE_KEY, demoData);
          LocalStorageHelper.setObject(
            AUTH_COOKIE_ORG_KEY,
            demoData.org_data[0],
          );
          LocalStorageHelper.setObject(
            AUTH_COOKIE_OPTIONData_KEY,
            demoData.options,
          );

          setOptionList(demoData.options);
          setCurrentOrg(demoData.org_data[0]);
          setAuthState(demoData);

          toast.success("Demo login successful!");
          return true;
        } catch {
          toast.error("Demo login failed. Please try again.");
          return false;
        }
      }

      // ✅ ORIGINAL LOGIN
      try {
        const response = await refetch({
          payload: { role, username, password },
        });

        if (!response) {
          toast.error("Login failed. Please try again.");
          return false;
        }

        LocalStorageHelper.setObject("role", role);
        setApplicationRole(role);

        if (response?.success && response.data) {
          if (!response.data.org_data?.length) {
            toast.error("User not associated to any organization");
            logout();
            return false;
          }

          try {
            LocalStorageHelper.setObject(AUTH_COOKIE_KEY, response.data);
            LocalStorageHelper.setObject(
              AUTH_COOKIE_ORG_KEY,
              response.data.org_data[0],
            );
            LocalStorageHelper.setObject(
              AUTH_COOKIE_OPTIONData_KEY,
              response.data.options,
            );

            setOptionList(response.data.options);
            setCurrentOrg(response.data.org_data[0]);
            setAuthState(response.data);
            deptList();

            return true;
          } catch {
            toast.error("Failed to save login information. Please try again.");
            logout();
            return false;
          }
        } else {
          toast.error("Invalid credentials");
          return false;
        }
      } catch (error) {
        console.error("Login error:", error);
        toast.error("Login failed. Please try again.");
        return false;
      }
    },
    [deptList, logout, refetch],
  );

  const setCurrentOrgData = useCallback(
    (selectOrgID: string) => {
      if (!authState) logout();

      if (selectOrgID && authState) {
        const findOrg = authState.org_data.find(
          (item) => item.value === Number(selectOrgID),
        );

        if (findOrg) {
          LocalStorageHelper.setObject(AUTH_COOKIE_ORG_KEY, findOrg);
          setCurrentOrg(findOrg);
          window.location.href = "/";
        }
      }
    },
    [authState, logout],
  );

  return {
    authState,
    optionList,
    loading,
    login,
    logout,
    currentOrg,
    isAuthenticated: !!authState,
    setCurrentOrgData,
    deptList,
    applicationRole,
    setApplicationRole,
  };
};
