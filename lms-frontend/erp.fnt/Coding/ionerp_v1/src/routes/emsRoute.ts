import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "../pages/ems/home";
import DepartmentPage from "../pages/ems/configuration/departmentDetail/departmentPage";
import { Outlet } from "react-router-dom";
import ChangePasswordPage from "../pages/changepassword";
import ManageShareMaterialsPage from "../pages/ems/manageshare/ManageShareMaterialsPage";
import TimetableListPage from "../pages/ems/configuration/timetable/TimetableListPage";
import ReceiveAnnouncementPage from "../pages/ems/receiveAnnouncement/ReceiveAnnouncementPage";
import SendAnnouncementPage from "../pages/ems/sendAnnouncement/SendAnnouncementPage";
import ManageAssignmentPage from "../pages/ems/manageAssignment/ManageAssignmentPage";
import AttendanceManagementPage from "../pages/ems/AttendanceManagement/AttendanceManagementPage";
import ConsolidatedStudentMarksReport from "../pages/ems/consolidatedStudentMarksReport/ConsolidatedStudentMarksReport";

export const EMSROUTE = [
  {
    name: "Home",
    href: "/",
    element: Home,
    roles: [],
    subItems: [],
  },
  {
    name: "Change Password",
    href: "/change_password",
    element: ChangePasswordPage,
    roles: [],
    subItems: [],
  },
  {
    name: "LMS",
    href: "",
    element: Outlet,
    roles: [],
    subItems: [
      {
        name: "Manage Share Materials",
        href: "manage-share-materials",
        roles: [],
        element: ManageShareMaterialsPage,
      },
      {
        name: "Timetable",
        href: "timetable",
        roles: [],
        element: TimetableListPage,
      },
      {
        name: "Receive Announcement",
        href: "receive-announcement",
        roles: [],
        element: ReceiveAnnouncementPage,
      },
      {
        name: "Send Announcement",
        href: "send-announcement",
        roles: [],
        element: SendAnnouncementPage,
      },
      {
        name: "Manage Assignment",
        href: "manage-assignment",
        roles: [],
        element: ManageAssignmentPage,
      },
      {
        name: "Attendance Management",
        href: "attendance-management",
        roles: [],
        element: AttendanceManagementPage,
      },
    ],
  },

  {
    name: "Reports",
    href: "",
    element: Outlet,
    roles: [],
    subItems: [
      {
        name: "Consolidated Student Marks Report",
        href: "consolidated-student-marks-report",
        roles: [],
        element: ConsolidatedStudentMarksReport,
      },
    ],
  },
];
