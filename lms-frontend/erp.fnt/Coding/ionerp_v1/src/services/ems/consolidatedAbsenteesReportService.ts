import axios from "axios";
import { ApiEndpoint } from "../../utils/ApiEndpoint/emsapiEndpoint";

// Hardcoded to match utils/api.ts - no env/typing issues
const BASE = "http://127.0.0.1:8000";

function api(path: string) {
  return `${BASE}/${path}`.replace(/\/+/g, "/").replace(":/", "://");
}

// ── Dropdown types ────────────────────────────────────────────────
export interface DropdownOption {
  id: number;
  name: string;
}

// ── Report types ──────────────────────────────────────────────────
export interface ReportRequest {
  start_date: string;
  end_date: string;
  department_ids?: number[] | null;
  program_ids?: number[] | null;
  curriculum_ids?: number[] | null;
  semester_ids?: number[] | null;
  section_ids?: number[] | null;
}

export interface ReportRow {
  department: string;
  term: string;
  course: string;
  section: string;
  absent_count: number;
  // helpers added on client side
  course_id?: number;
  section_id?: number;
}

export interface DrilldownRequest {
  course_id: number;
  section_id: number;
  start_date: string;
  end_date: string;
}

export interface DrilldownRow {
  attendance_date: string;
  student_name: string;
  usno: string;
  mobile?: string;
}

// ── Dropdown APIs ─────────────────────────────────────────────────

export const getDepartments = async (): Promise<DropdownOption[]> => {
  const res = await axios.get<DropdownOption[]>(api(ApiEndpoint.consolidatedAbsenteesReport.departments));
  return res.data;
};

export const getPrograms = async (departmentId: number): Promise<DropdownOption[]> => {
  const res = await axios.get<DropdownOption[]>(
    api(ApiEndpoint.consolidatedAbsenteesReport.programs(departmentId))
  );
  return res.data;
};

// Reuse topic endpoints for Curriculum, Term(Semester), Section
export const getCurriculumList = async (programId: number): Promise<DropdownOption[]> => {
  const res = await axios.get<DropdownOption[]>(api(ApiEndpoint.consolidatedAbsenteesReport.curriculum(programId)));
  return res.data;
};

export const getTermList = async (curriculumId: number): Promise<DropdownOption[]> => {
  const res = await axios.get<DropdownOption[]>(api(ApiEndpoint.consolidatedAbsenteesReport.terms(curriculumId)));
  return res.data;
};

export const getSectionList = async (semesterId: number): Promise<DropdownOption[]> => {
  const res = await axios.get<DropdownOption[]>(api(ApiEndpoint.consolidatedAbsenteesReport.sections(semesterId)));
  return res.data;
};

// ── Date Info ─────────────────────────────────────────────────────

export const getDateInfo = async (): Promise<{
  latest_attendance_date: string | null;
  scheduled_dates: string[];
}> => {
  const res = await axios.get<{ latest_attendance_date: string | null; scheduled_dates: string[]; }>(api(ApiEndpoint.consolidatedAbsenteesReport.dateInfo));
  return res.data;
};

// ── Main Report ───────────────────────────────────────────────────

export const generateReport = async (payload: ReportRequest): Promise<ReportRow[]> => {
  const res = await axios.post<ReportRow[]>(api(ApiEndpoint.consolidatedAbsenteesReport.report), payload);
  return res.data;
};

// ── Drilldown ─────────────────────────────────────────────────────

export const getDrilldown = async (payload: DrilldownRequest): Promise<DrilldownRow[]> => {
  const res = await axios.post<DrilldownRow[]>(api(ApiEndpoint.consolidatedAbsenteesReport.drilldown), payload);
  return res.data;
};
