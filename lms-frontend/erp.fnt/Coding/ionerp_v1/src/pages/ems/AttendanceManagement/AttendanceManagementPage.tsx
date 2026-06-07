import React, { useState, useEffect } from "react";
import { AttendanceReports } from "../../../components/Attendance";
import {
  attendanceApi,
  SaveAttendancePayload,
} from "../../../api/attendanceApi";
import UIButton from "../../../components/FormBuilder/fields/Button";
import { toast } from "react-toastify";
import {
  Calendar,
  TrendingUp,
  Clock,
  AlertCircle,
} from "lucide-react";
import "./AttendanceManagementPage.css";

interface Curriculum {
  id: string;
  name: string;
}

interface Term {
  id: string;
  name: string;
  curriculumId: string;
  term_name?: number | string;
  crclm_term_id?: number | string;
}

interface Course {
  id: string;
  name: string;
  code: string;
  curriculumId?: string;
  termId?: string;
  raw?: any;
}

interface Section {
  id: string;
  name: string;
}

interface Student {
  id: string;
  name: string;
  rollNumber: string;
  email: string;
  usn?: string;
  regno?: string;
}

type AttendanceStatus =
  | "present"
  | "absent"
  | "late"
  | "excused"
  | "not marked";


interface AttendanceRow extends Student {
  status: AttendanceStatus;
  remark: string;
  isChecked: boolean;
}

const AttendanceManagementPage: React.FC = () => {
  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedCurriculum, setSelectedCurriculum] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState<"draft" | "finalized" | null>(null);
  const [isEditable, setIsEditable] = useState(true);
  const [lmsAttendanceId, setLmsAttendanceId] = useState<number | null>(null);


  const rowPresentForLms = (status?: AttendanceStatus) => status !== "absent";

  const syncLmsAttendanceForCurrentClass = async (
    rows: Array<{ usn?: string; regno?: string; rollNumber?: string; status?: AttendanceStatus }>,
    manageStatus: number = 1,
  ) => {
    if (
      !selectedCourse ||
      !selectedCurriculum ||
      !selectedSectionId ||
      !selectedTerm ||
      !selectedDate
    ) {
      return { success: false as const, data: null as any };
    }
    const selectedTermObj = terms.find((term) => String(term.id) === String(selectedTerm));
    const termForApi = Number(selectedTermObj?.id ?? selectedTerm);
    const crsIdNum = selectedCourse?.id != null ? Number(selectedCourse.id) : NaN;
    const secIdNum = Number(selectedSectionId);
    if (Number.isNaN(termForApi) || Number.isNaN(crsIdNum) || Number.isNaN(secIdNum)) {
      return { success: false as const, data: null as any };
    }
    const records = rows
      .map((row: any) => {
        const student_usn = String(row.usn || row.regno || row.rollNumber || "").trim();
        const isChecked = row.isChecked ?? (row.status === "present" || row.status === "Present" || row.status === "1");
        return {
          student_usn,
          present: isChecked,
          a_type_id: isChecked ? 1 : 0,
          remarks: row.remark || "",
        };
      })
      .filter((r) => r.student_usn);


    const syncRes = await attendanceApi.syncLmsAttendanceMap({
      academic_batch_id: Number(selectedCurriculum),
      semester_id: termForApi,
      crs_id: crsIdNum,
      section_id: secIdNum,
      attendance_date: selectedDate,
      attendance_id: lmsAttendanceId ?? undefined,
      manage_status: manageStatus,
      tt_detail_id: undefined,
      records,
    });
    if (syncRes.success && syncRes.data?.attendance_id != null) {
      setLmsAttendanceId(Number(syncRes.data.attendance_id));
    }
    return syncRes;
  };

  useEffect(() => {
    loadCurriculums();
  }, []);

  // Reset dependent dropdowns when curriculum changes
  useEffect(() => {
    if (!selectedCurriculum) {
      setTerms([]);
      setCourses([]);
      setSections([]);
      setSelectedTerm("");
    }
  }, [selectedCurriculum]);

  // Reset courses/sections when term changes
  useEffect(() => {
    if (!selectedTerm) {
      setCourses([]);
      setSections([]);
    }
  }, [selectedTerm]);

  useEffect(() => {
    setLmsAttendanceId(null);
  }, [
    selectedDate,
    selectedCurriculum,
    selectedTerm,
    selectedSectionId,
    selectedCourse?.id,
  ]);

  const loadCurriculums = async () => {
    try {
      const res = await attendanceApi.getAttendanceCurriculums();
      console.log("[Attendance] Curriculums API response:", res.data);
      const mappedCurriculums = (res.data || []).map((c: any) => ({
        id: c.crclm_id || c.id,
        name: `Batch ${c.start_year || ""} - ${c.name || c.academic_batch_desc || ""}`
          .replace(/\s+/g, " ")
          .trim(),
      }));
      console.log("[Attendance] Mapped curriculums:", mappedCurriculums);
      setCurriculums(mappedCurriculums);
    } catch (error) {
      console.error("[Attendance] Error loading curriculums:", error);
      setCurriculums([]);
    }
  };

  const loadTerms = async (id: string) => {
    console.log("[Attendance] Loading terms for curriculum:", id);
    if (!id) {
      console.warn("[Attendance] Curriculum ID is empty, skipping terms fetch");
      setTerms([]);
      return;
    }
    try {
      const res = await attendanceApi.getAttendanceTerms(id);
      console.log("[Attendance] Terms API response:", res.data);
      const mappedTerms = (res.data || []).map((t: any) => ({
        id: t.crclm_term_id,
        name: `Sem ${t.term_name}`,
        curriculumId: id,
        crclm_term_id: t.crclm_term_id,
        term_name: t.term_name,
      }));
      console.log("[Attendance] Mapped terms:", mappedTerms);
      setTerms(mappedTerms);
    } catch (error) {
      console.error("[Attendance] Error loading terms:", error);
      setTerms([]);
    }
  };

  const loadCoursesAndSections = async (c: string, t: string) => {
    if (!c || !t) {
      console.warn("[Attendance] Missing curriculum or term, skipping courses/sections", { c, t });
      setCourses([]);
      setSections([]);
      return;
    }

    // Find the selected term to get term_name (semester number)
    const selectedTermObj = terms.find((term) => String(term.id) === String(t));
    if (!selectedTermObj) {
      console.warn("[Attendance] Selected term not found in terms list", { t, availableTerms: terms });
      return;
    }

    const semesterNumber = Number(selectedTermObj.term_name ?? selectedTermObj.id);
    if (Number.isNaN(semesterNumber)) {
      console.warn("[Attendance] Selected term does not include a valid semester number", selectedTermObj);
      return;
    }
    console.log("[Attendance] Loading courses and sections", {
      curriculum: c,
      termId: t,
      semesterNumber: semesterNumber,
    });

    try {
      const courseRes = await attendanceApi.getAttendanceCourses({
        academic_batch_id: Number(c),
        semester: semesterNumber,
      });

      console.log("Raw courses response:", courseRes.data);
      const coursesData =
        courseRes.data?.data ||
        courseRes.data?.courses ||
        courseRes.data?.result ||
        courseRes.data ||
        [];

      const mappedCourses = Array.isArray(coursesData)
        ? coursesData.map((course: any) => ({
            id: String(course.crs_id || course.course_id || course.id || ""),
            name:
              course.crs_code && (course.course_name || course.crs_title)
                ? `${course.crs_code} - ${course.course_name || course.crs_title}`
                : course.course_name ||
                  course.crs_title ||
                  course.crs_code ||
                  course.course_code ||
                  course.name ||
                  "Unnamed Course",
            code: course.crs_code || "",
            raw: course,
          }))
        : [];
      setCourses(mappedCourses);

      const sectionRes = await attendanceApi.getAttendanceSections({
        academic_batch_id: Number(c),
        semester_id: semesterNumber,
      });

      console.log("[Attendance] Sections API response:", sectionRes.data);
      const mappedSections = (sectionRes.data || []).map((s: any) => ({
        id: s.id || s.section,
        name: s.section || s.name,
      }));
      setSections(mappedSections);
    } catch (error) {
      console.error("[Attendance] Error loading courses/sections:", error);
      setCourses([]);
      setSections([]);
    }
  };

  const loadStudents = async () => {
    console.log("[loadStudents] Called with:", {
      selectedCurriculum,
      selectedSectionId,
      selectedTerm,
      terms
    });

    if (!selectedCurriculum || !selectedSectionId || !selectedTerm) {
      console.warn("[loadStudents] Missing required fields");
      return;
    }

    const selectedTermObj = terms.find((term) => String(term.id) === String(selectedTerm));
    console.log("[loadStudents] Selected term object:", selectedTermObj);
    const termForApi = Number(selectedTermObj?.id ?? selectedTerm);
    if (Number.isNaN(termForApi)) {
      console.warn("[loadStudents] Invalid term for API");
      toast.warn("Select a valid term before loading students.");
      return;
    }
    console.log("[loadStudents] Term id for API (crclm_term_id):", termForApi);

    const selectedSectionObj = sections.find((s) => String(s.id) === String(selectedSectionId));
    const sectionName = selectedSectionObj?.name || selectedSectionId;
    console.log("[loadStudents] Section name:", sectionName);

    const payload: {
      academic_batch_id: number;
      semester_id: number;
      section: string;
      crs_code?: string;
      crs_id?: number;
    } = {
      academic_batch_id: Number(selectedCurriculum),
      semester_id: termForApi,
      section: sectionName,
    };
    if (selectedCourse?.code) {
      payload.crs_code = selectedCourse.code;
    }
    const crsIdNum = selectedCourse?.id != null ? Number(selectedCourse.id) : NaN;
    if (selectedCourse?.id != null && !Number.isNaN(crsIdNum)) {
      payload.crs_id = crsIdNum;
    }
    console.log("[loadStudents] API payload:", payload);

    const res = await attendanceApi.getAttendanceStudents(payload);
    console.log("[loadStudents] API response:", res);

    const data = res.data || [];
    console.log("[loadStudents] Student data:", data);

    // Map backend response to frontend interface
    const mappedStudents = data.map((s: any) => ({
      id: s.student_id || s.id,
      name: s.name || "",
      rollNumber: s.roll_number || s.usno || "",
      email: s.email || "",
      usn: s.usno || s.regno || "",
      regno: s.regno || "",
      section: s.section || "",
      academic_batch_id: s.academic_batch_id,
      current_semester: s.current_semester,
    }));

    console.log("[loadStudents] Mapped students:", mappedStudents);
    setStudents(mappedStudents);

    setAttendanceRows(
      mappedStudents.map((s: any) => ({
        ...s,
        status: "present",
        remark: "",
        isChecked: true,
      })),
    );

    const secIdNum = Number(selectedSectionId);
    if (
      selectedCourse &&
      !Number.isNaN(crsIdNum) &&
      !Number.isNaN(secIdNum) &&
      selectedDate
    ) {
      const syncRows = mappedStudents.map((s: any) => ({
        ...s,
        status: "present" as AttendanceStatus,
      }));
      const syncRes = await syncLmsAttendanceForCurrentClass(syncRows);
      if (syncRes.success && syncRes.data) {
        console.log("[loadStudents] LMS map sync:", syncRes.data);
        const msgParts = [];
        if (typeof syncRes.data.map_row_count === "number") {
          msgParts.push(`${syncRes.data.map_row_count} row(s)`);
        }
        if (typeof syncRes.data.rows_updated_this_call === "number" && syncRes.data.rows_updated_this_call > 0) {
          msgParts.push(`${syncRes.data.rows_updated_this_call} updated`);
        }
        if (msgParts.length) {
          toast.success(
            `LMS attendance (session ${syncRes.data.attendance_id}): ${msgParts.join(", ")}.`,
          );
        }
      } else {
        toast.warn(
          "Students loaded, but LMS database sync failed (check course/section/date and foreign keys).",
        );
      }
    }

    setAttendanceStatus(null);
    setIsEditable(true);
  };

  const loadAttendanceRecords = async () => {
    if (!selectedCourse || !selectedSectionId) return;

    const res = await attendanceApi.getAttendanceFetch({
      crs_code: selectedCourse.code,
      day: selectedDate,
      start_time: "09:00",
      end_time: "10:00",
      section: selectedSectionId,
      sem_time_table_id: undefined,
    });

    const data = res.data || [];

    setAttendanceRows((prev) =>
      prev.map((row) => {
        const rec = data.find(
          (r: any) => r.regno === row.rollNumber || r.usno === row.usn,
        );

        if (!rec) return row;

        return {
          ...row,
          status: rec.attendance_status?.toLowerCase() || "not marked",
          remark: rec.other_reason || "",
        };
      }),
    );
  };

  const handleRowStatusChange = (id: string, status: AttendanceStatus) => {
    setAttendanceRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r)),
    );
  };

  const handleRowRemarkChange = (id: string, remark: string) => {
    setAttendanceRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, remark } : r)),
    );
  };

  const markAllPresent = () => {
    setAttendanceRows((prev) => prev.map((r) => ({ ...r, status: "present", isChecked: true })));
  };

  const handleCheckboxChange = (id: string, checked: boolean) => {
    setAttendanceRows((prev) =>
      prev.map((r) => 
        r.id === id ? { ...r, isChecked: checked, status: checked ? "present" : "absent" } : r
      ),
    );
  };

  const enableAttendance = () => {
    setIsEditable(true);
    toast.success("Attendance enabled for modification");
  };


  const finalizeAttendance = async () => {
    if (!selectedCourse || !selectedCurriculum || !selectedSectionId) return;

    const selectedSectionObj = sections.find((s) => String(s.id) === String(selectedSectionId));
    const sectionName = selectedSectionObj?.name || selectedSectionId;


    const payload = {
      meta: {
        crs_code: selectedCourse.code,
        result_year: selectedDate,
        start_time: "09:00",
        end_time: "10:00",
        academic_batch_id: Number(selectedCurriculum),
        section: sectionName,
        sem_time_table_id: undefined,
      },
      records: attendanceRows.map((row) => ({
        regno: row.regno || row.usn || row.rollNumber,
        usno: row.usn || row.regno || row.rollNumber,
        student_id: Number(row.id),
        attendance_status: 1, // Finalized status
        other_reason: row.remark || "",
        is_extra_class: 0,
      })),
    };

    await attendanceApi.saveAttendance(payload as any);
    await syncLmsAttendanceForCurrentClass(attendanceRows, 1);
    setAttendanceStatus("finalized");
    setIsEditable(false);
    toast.success("Attendance finalized");
  };

  const filtered = attendanceRows.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="relative min-h-screen p-1">
      {/* Dynamic Mesh Background Layer */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-300/40 rounded-full blur-[140px] animate-pulse" />
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-200/50 rounded-full blur-[140px] animate-pulse"
          style={{ animationDelay: "2s" }}
        />
        <div
          className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-amber-100/60 rounded-full blur-[120px] animate-pulse"
          style={{ animationDelay: "4s" }}
        />
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-br from-indigo-50/90 to-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-sm border border-indigo-100/50">
        <div>
          <div className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
            <span>Home</span>
            <span className="text-slate-300">/</span>
            <span>LMS</span>
            <span className="text-slate-300">/</span>
            <span className="text-indigo-600">Attendance Management</span>
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Attendance</h1>
          <p className="text-slate-500 text-sm font-medium">Mark and manage student attendance.</p>
        </div>

        <div className="flex items-center gap-3">
          <span className="bg-[#1f4e5f] text-white text-xs px-3 py-1 rounded-full font-bold shadow-sm">
            {attendanceStatus === "finalized" ? "Finalized" : attendanceStatus === "draft" ? "Draft" : "Manage"}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="bg-gradient-to-b from-slate-50/95 to-white/90 backdrop-blur-xl rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-200/50 overflow-hidden mt-6">
        <div className="p-6">
          {/* Filter Section */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Curriculum</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                value={selectedCurriculum}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedCurriculum(value);
                  if (value) {
                    loadTerms(value);
                  }
                }}
              >
                <option value="">Select Curriculum</option>
                {curriculums.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Term</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                value={selectedTerm}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedTerm(value);
                  if (value && selectedCurriculum) {
                    loadCoursesAndSections(selectedCurriculum, value);
                  }
                }}
                disabled={!selectedCurriculum || terms.length === 0}
              >
                <option value="">Select Term</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Course</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                value={selectedCourse?.id || ""}
                onChange={(e) => {
                  const c = courses.find((x) => x.id === e.target.value);
                  setSelectedCourse(c || null);
                }}
                disabled={!selectedTerm || courses.length === 0}
              >
                <option value="">Select Course</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Section</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                disabled={!selectedTerm || sections.length === 0}
              >
                <option value="">Select Section</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input
                type="date"
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <button onClick={loadStudents} className="bg-[#1f4e5f] hover:bg-[#17404e] text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Load Students
            </button>
            <button onClick={markAllPresent} className="bg-indigo-50 hover:bg-indigo-100 text-[#1f4e5f] border border-indigo-200 px-4 py-2 rounded-lg text-sm font-medium transition-all">
              Mark All Present
            </button>
            <button onClick={finalizeAttendance} disabled={!isEditable} className="bg-[#1f4e5f] hover:bg-[#17404e] text-white px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50">
              Finalize
            </button>
            {attendanceStatus === "finalized" && (
              <button onClick={enableAttendance} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-lg text-sm font-medium transition-all">
                Enable
              </button>
            )}
          </div>

          {/* Status Badge */}
          {attendanceStatus && (
            <div className={`mb-4 p-3 rounded-lg border ${attendanceStatus === "finalized" ? "bg-green-50 text-green-800 border-green-200" : "bg-yellow-50 text-yellow-800 border-yellow-200"}`}>
              <span className="font-medium">Status:</span> {attendanceStatus === "finalized" ? "Finalized (Frozen)" : "Draft (Editable)"}
            </div>
          )}

          {/* Search */}
          <input
            placeholder="Search students..."
            className="mb-4 border rounded-lg px-4 py-2 w-full text-sm bg-white hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {/* Attendance Table */}
          <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-[#1f4e5f] to-[#2d6a7a] text-white">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider w-12">Present</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">USN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Remark</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-indigo-50/50 transition-colors">
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={row.isChecked}
                        onChange={(e) => handleCheckboxChange(row.id, e.target.checked)}
                        disabled={!isEditable}
                        className="w-5 h-5 accent-[#1f4e5f] cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-700">{row.usn || row.rollNumber}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${row.isChecked ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                        {row.isChecked ? "Present" : "Absent"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={row.remark}
                        onChange={(e) =>
                          handleRowRemarkChange(row.id, e.target.value)
                        }
                        disabled={!isEditable}
                        placeholder="Add remark..."
                        className="border rounded-lg px-3 py-1.5 text-sm w-32 bg-white hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AttendanceReports
        isOpen={showReports}
        onClose={() => setShowReports(false)}
        courseId={selectedCourse?.id || ""}
        courseName={selectedCourse?.name || ""}
      />
    </div>
  );
};

export default AttendanceManagementPage;
