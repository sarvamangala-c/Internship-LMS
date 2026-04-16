import React, { useState, useEffect } from "react";
import { AttendanceReports } from "../../components/Attendance";
import { attendanceApi } from "../../api/attendanceApi";
import UIButton from "../../components/FormBuilder/fields/Button";
import { toast } from "react-toastify";
import {
  Calendar,
  TrendingUp,
  Clock,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface Curriculum {
  id: string;
  name: string;
}

interface Term {
  id: string;
  name: string;
  curriculumId: string;
}

interface Course {
  id: string;
  name: string;
  code: string;
  curriculumId: string;
  termId: string;
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

interface SessionOption {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
}

interface AttendanceRow extends Student {
  status: AttendanceStatus;
  remark: string;
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
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReports, setShowReports] = useState(false);

  const sessionOptions: SessionOption[] = [
    { id: "1", label: "09:00 - 10:00", startTime: "09:00", endTime: "10:00" },
    { id: "2", label: "10:00 - 11:00", startTime: "10:00", endTime: "11:00" },
  ];

  useEffect(() => {
    loadCurriculums();
  }, []);

  const loadCurriculums = async () => {
    const res = await attendanceApi.getAttendanceCurriculums();
    setCurriculums(res.data || []);
  };

  const loadTerms = async (id: string) => {
    const res = await attendanceApi.getAttendanceTerms(id);
    setTerms(res.data || []);
  };

  const loadCoursesAndSections = async (c: string, t: string) => {
    const courseRes = await attendanceApi.getAttendanceCourses({
      academic_batch_id: Number(c),
      crclm_term_id: t,
    });

    const sectionRes = await attendanceApi.getAttendanceSections({
      academic_batch_id: Number(c),
      semester_id: Number(t),
    });

    setCourses(courseRes.data || []);
    setSections(sectionRes.data || []);
  };

  const loadStudents = async () => {
    if (!selectedCurriculum || !selectedSectionId) return;

    const res = await attendanceApi.getAttendanceStudents({
      academic_batch_id: Number(selectedCurriculum),
      section: selectedSectionId,
    });

    const data = res.data || [];

    setStudents(data);

    setAttendanceRows(
      data.map((s: any) => ({
        ...s,
        status: "not marked",
        remark: "",
      })),
    );
  };

  const loadAttendanceRecords = async () => {
    if (!selectedCourse || !selectedSectionId) return;

    const session = sessionOptions.find((s) => s.id === selectedSessionId);

    const res = await attendanceApi.getAttendanceFetch({
      crs_code: selectedCourse.code,
      day: selectedDate,
      start_time: session?.startTime || "",
      end_time: session?.endTime || "",
      section: selectedSectionId,
      sem_time_table_id: selectedSessionId,
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
    setAttendanceRows((prev) => prev.map((r) => ({ ...r, status: "present" })));
  };

  const saveDraft = async () => {
    if (!selectedCourse) return;

    const payload = {
      courseId: selectedCourse.id,
      date: selectedDate,
      records: attendanceRows,
      state: "draft" as const,
    };

    await attendanceApi.saveAttendance(payload);
    toast.success("Draft saved");
  };

  const finalizeAttendance = async () => {
    if (!selectedCourse) return;

    const payload = {
      courseId: selectedCourse.id,
      date: selectedDate,
      records: attendanceRows,
      state: "finalized" as const,
    };

    await attendanceApi.saveAttendance(payload);
    toast.success("Finalized");
  };

  const filtered = attendanceRows.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="p-6 bg-slate-100 min-h-screen">
      <div className="bg-white p-6 rounded-xl shadow">
        <div className="flex justify-between mb-4">
          <h2 className="font-bold">Attendance</h2>

          <UIButton onClick={loadStudents}>
            <Calendar className="w-4 h-4 mr-2" />
            Load Students
          </UIButton>
        </div>

        <div className="grid grid-cols-5 gap-4 mb-4">
          <select
            onChange={(e) => {
              setSelectedCurriculum(e.target.value);
              loadTerms(e.target.value);
            }}
          >
            <option>Select Curriculum</option>
            {curriculums.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            onChange={(e) => {
              setSelectedTerm(e.target.value);
              loadCoursesAndSections(selectedCurriculum, e.target.value);
            }}
          >
            <option>Select Term</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <select
            onChange={(e) => {
              const c = courses.find((x) => x.id === e.target.value);
              setSelectedCourse(c || null);
            }}
          >
            <option>Select Course</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select onChange={(e) => setSelectedSectionId(e.target.value)}>
            <option>Select Section</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        <div className="flex gap-2 mb-4">
          <UIButton onClick={markAllPresent}>Mark All Present</UIButton>
          <UIButton onClick={saveDraft}>Save Draft</UIButton>
          <UIButton onClick={finalizeAttendance}>Finalize</UIButton>
          <UIButton onClick={loadAttendanceRecords}>
            <RefreshCw className="w-4 h-4" />
          </UIButton>
        </div>

        <input
          placeholder="Search"
          className="mb-4 border p-2 w-full"
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <table className="w-full">
          <thead>
            <tr>
              <th>USN</th>
              <th>Name</th>
              <th>Status</th>
              <th>Remark</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id}>
                <td>{row.rollNumber}</td>
                <td>{row.name}</td>
                <td>
                  <button
                    onClick={() => handleRowStatusChange(row.id, "present")}
                  >
                    P
                  </button>
                  <button
                    onClick={() => handleRowStatusChange(row.id, "absent")}
                  >
                    A
                  </button>
                </td>
                <td>
                  <input
                    value={row.remark}
                    onChange={(e) =>
                      handleRowRemarkChange(row.id, e.target.value)
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
