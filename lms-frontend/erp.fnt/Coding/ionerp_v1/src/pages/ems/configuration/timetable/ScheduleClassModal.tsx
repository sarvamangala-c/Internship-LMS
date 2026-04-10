import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { timetableApi, TimetableOptionItem } from "../../../../api/timetableApi";

type DayName =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

interface DaySchedule {
  name: DayName;
  selected: boolean;
  startTime: string;
  endTime: string;
}

interface ScheduleClassModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (data: {
    courseTypeId: string;
    courseTypeLabel: string;
    courseId: string;
    courseLabel: string;
    days: DaySchedule[];
  }) => Promise<void> | void;
  curriculumId: string;
  curriculumLabel?: string;
  termId: string;
  termLabel?: string;
  semesterValue: number;
  sectionId: string;
  sectionLabel?: string;
  defaultStartTime: string;
  defaultEndTime: string;
}

const DAY_NAMES: DayName[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const buildDefaultDays = (startTime: string, endTime: string): DaySchedule[] =>
  DAY_NAMES.map((name) => ({
    name,
    selected: name !== "Sunday",
    startTime,
    endTime,
  }));

const ScheduleClassModal: React.FC<ScheduleClassModalProps> = ({
  show,
  onClose,
  onSave,
  curriculumId,
  curriculumLabel,
  termId,
  termLabel,
  semesterValue,
  sectionId,
  sectionLabel,
  defaultStartTime,
  defaultEndTime,
}) => {
  const [courseTypes, setCourseTypes] = useState<TimetableOptionItem[]>([]);
  const [courses, setCourses] = useState<TimetableOptionItem[]>([]);
  const [courseTypeId, setCourseTypeId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [days, setDays] = useState<DaySchedule[]>(buildDefaultDays(defaultStartTime, defaultEndTime));
  const [isLoadingCourseTypes, setIsLoadingCourseTypes] = useState(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const curriculumNumericId = Number(curriculumId);
  const termNumericId = Number(termId);
  const semesterNumericValue = Number(semesterValue);
  const sectionNumericId = Number(sectionId);
  const hasAcademicBatchId = Number.isFinite(curriculumNumericId) && curriculumNumericId > 0;
  const hasTermContext =
    (Number.isFinite(termNumericId) && termNumericId > 0) ||
    (Number.isFinite(semesterNumericValue) && semesterNumericValue > 0);
  const hasSectionContext =
    (Number.isFinite(sectionNumericId) && sectionNumericId > 0) ||
    Boolean(sectionLabel?.trim());

  useEffect(() => {
    if (!show) {
      return;
    }

    console.log("[ScheduleClassModal] opened with context", {
      selectedCrclmId: curriculumId || null,
      academic_batch_id: curriculumId || null,
      selectedCrclmTermId: termId || null,
      semester_id: termId || null,
      selectedSectionId: sectionId || null,
      section_id: sectionId || null,
      selectedSectionLabel: sectionLabel || null,
      selectedSectionName: sectionLabel || null,
      semesterValue: semesterValue || null,
    });

    setDays(buildDefaultDays(defaultStartTime, defaultEndTime));
    setCourseId("");
    setCourseTypeId("");
    setCourses([]);

    const loadCourseTypes = async () => {
      setIsLoadingCourseTypes(true);
      const response = await timetableApi.getCourseTypes();
      setCourseTypes((response.data as TimetableOptionItem[]) || []);
      setIsLoadingCourseTypes(false);
    };

    loadCourseTypes();
  }, [defaultEndTime, defaultStartTime, show]);

  useEffect(() => {
    if (!show || !hasAcademicBatchId || !hasTermContext) {
      setCourses([]);
      setCourseId("");
      return;
    }

    const loadCourses = async () => {
      setIsLoadingCourses(true);
      try {
        const selectedCurriculumId = curriculumNumericId;
        const selectedSemester = semesterNumericValue > 0 ? semesterNumericValue : termNumericId;
        const selectedCourseTypeId = Number(courseTypeId) > 0 ? Number(courseTypeId) : 1;
        const payload = {
          academic_batch_id: selectedCurriculumId,
          semester: selectedSemester,
          course_type_id: selectedCourseTypeId,
        };

        console.log("[ScheduleClassModal] loading courses request", {
          method: "POST",
          url: "/api/v1/comman_function/courses",
          payload,
          context: {
            selectedCrclmTermId: termId || null,
            semesterValue: semesterValue || null,
            section_id: sectionId || null,
          },
        });

        const response = await timetableApi.getCourses(payload);
        const courseOptions = (response.data as TimetableOptionItem[]) || [];
        setCourses(courseOptions);
        setCourseId("");
      } finally {
        setIsLoadingCourses(false);
      }
    };

    loadCourses();
  }, [
    courseTypeId,
    curriculumNumericId,
    hasAcademicBatchId,
    hasTermContext,
    sectionId,
    semesterNumericValue,
    show,
    termId,
    termNumericId,
    semesterValue,
  ]);

  const selectedCourseType = useMemo(
    () => courseTypes.find((item) => item.value === courseTypeId),
    [courseTypeId, courseTypes],
  );

  const selectedCourse = useMemo(
    () => courses.find((item) => item.value === courseId),
    [courseId, courses],
  );

  if (!show) {
    return null;
  }

  const toggleDay = (name: DayName) => {
    setDays((currentDays) =>
      currentDays.map((day) =>
        day.name === name ? { ...day, selected: !day.selected } : day,
      ),
    );
  };

  const updateDayTime = (name: DayName, field: "startTime" | "endTime", value: string) => {
    setDays((currentDays) =>
      currentDays.map((day) =>
        day.name === name ? { ...day, [field]: value } : day,
      ),
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!hasAcademicBatchId || !hasTermContext || !hasSectionContext) {
      toast.error("Select curriculum, term, and section before scheduling classes.");
      return;
    }

    if (!sectionNumericId) {
      toast.error("Selected batch/section is missing a valid section id.");
      return;
    }

    if (!courseTypeId) {
      toast.error("Course Type is required.");
      return;
    }

    if (!courseId) {
      toast.error("Course is required.");
      return;
    }

    const selectedDays = days.filter((day) => day.selected);
    if (selectedDays.length === 0) {
      toast.error("Select at least one day.");
      return;
    }

    const invalidDay = selectedDays.find((day) => !day.startTime || !day.endTime);
    if (invalidDay) {
      toast.error(`Enter start and end time for ${invalidDay.name}.`);
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        courseTypeId,
        courseTypeLabel: selectedCourseType?.label || "",
        courseId,
        courseLabel: selectedCourse?.label || "",
        days: selectedDays,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <div>
            <h2 style={titleStyle}>Schedule Class</h2>
            <p style={subtitleStyle}>Match the sir day-wise scheduling flow.</p>
          </div>
          <button type="button" onClick={onClose} style={closeButtonStyle} aria-label="Close">
            x
          </button>
        </div>

        <form onSubmit={handleSubmit} style={bodyStyle}>
          {(!hasAcademicBatchId || !hasTermContext || !hasSectionContext) && (
            <div style={contextWarningStyle}>
              Select curriculum, term, and section before loading courses.
            </div>
          )}

          <div style={topFieldsStyle}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Course Type</label>
              <select
                value={courseTypeId}
                onChange={(event) => setCourseTypeId(event.target.value)}
                disabled={isLoadingCourseTypes}
                style={inputStyle}
              >
                <option value="">{isLoadingCourseTypes ? "Loading..." : "Select Course Type"}</option>
                {courseTypes.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Course</label>
              <select
                value={courseId}
                onChange={(event) => setCourseId(event.target.value)}
                disabled={isLoadingCourses}
                style={inputStyle}
              >
                <option value="">
                  {isLoadingCourses ? "Loading..." : "Select Course"}
                </option>
                {courses.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Batch / Section</label>
              <input
                type="text"
                value={
                  sectionLabel?.trim()
                    ? sectionLabel
                    : sectionNumericId > 0
                      ? `Section #${sectionNumericId}`
                      : ""
                }
                readOnly
                style={inputStyle}
              />
            </div>
          </div>

          <div style={contextBannerStyle}>
            <span>Curriculum: {curriculumLabel || curriculumId || "-"}</span>
            <span>Academic Batch Id: {curriculumId || "-"}</span>
            <span>Term: {termLabel || termId || "-"}</span>
            <span>Semester / Term Id: {termId || semesterValue || "-"}</span>
            <span>Batch / Section: {sectionLabel || sectionId || "-"}</span>
            <span>Section Id: {sectionId || "-"}</span>
          </div>

          <div style={gridHeaderStyle}>
            <span style={{ ...headerCellStyle, flex: "0 0 180px" }}>Day</span>
            <span style={headerCellStyle}>Class Start Time</span>
            <span style={headerCellStyle}>Class End Time</span>
          </div>

          <div style={rowsWrapperStyle}>
            {days.map((day) => (
              <div key={day.name} style={rowStyle}>
                <label style={{ ...cellStyle, flex: "0 0 180px", fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={day.selected}
                    onChange={() => toggleDay(day.name)}
                    style={checkboxStyle}
                  />
                  {day.name}
                </label>
                <div style={cellStyle}>
                  <input
                    type="time"
                    value={day.startTime}
                    disabled={!day.selected}
                    onChange={(event) => updateDayTime(day.name, "startTime", event.target.value)}
                    style={timeInputStyle(day.selected)}
                  />
                </div>
                <div style={cellStyle}>
                  <input
                    type="time"
                    value={day.endTime}
                    disabled={!day.selected}
                    onChange={(event) => updateDayTime(day.name, "endTime", event.target.value)}
                    style={timeInputStyle(day.selected)}
                  />
                </div>
              </div>
            ))}
          </div>

          <div style={footerStyle}>
            <button type="button" onClick={onClose} style={secondaryButtonStyle}>
              Close
            </button>
            <button type="submit" disabled={isSaving} style={primaryButtonStyle(isSaving)}>
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(17, 24, 39, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: "24px",
};

const modalStyle: React.CSSProperties = {
  width: "min(960px, 100%)",
  maxHeight: "90vh",
  overflow: "hidden",
  backgroundColor: "#ffffff",
  border: "1px solid #d7dee7",
  borderRadius: "4px",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.2)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  padding: "18px 22px",
  borderBottom: "1px solid #d7dee7",
  backgroundColor: "#f8fafc",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "19px",
  fontWeight: 600,
  color: "#1f2937",
};

const subtitleStyle: React.CSSProperties = {
  margin: "4px 0 0",
  fontSize: "12px",
  color: "#64748b",
};

const closeButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#64748b",
  fontSize: "18px",
  cursor: "pointer",
  lineHeight: 1,
};

const bodyStyle: React.CSSProperties = {
  padding: "20px 22px 22px",
  maxHeight: "calc(90vh - 72px)",
  overflowY: "auto",
};

const topFieldsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "16px",
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "#334155",
};

const inputStyle: React.CSSProperties = {
  height: "36px",
  border: "1px solid #cbd5e1",
  borderRadius: "2px",
  padding: "0 10px",
  fontSize: "13px",
  color: "#0f172a",
  backgroundColor: "#ffffff",
};

const contextBannerStyle: React.CSSProperties = {
  display: "flex",
  gap: "18px",
  flexWrap: "wrap",
  marginTop: "16px",
  padding: "10px 12px",
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "2px",
  fontSize: "12px",
  color: "#475569",
};

const contextWarningStyle: React.CSSProperties = {
  marginBottom: "16px",
  padding: "10px 12px",
  border: "1px solid #fecaca",
  backgroundColor: "#fef2f2",
  color: "#b91c1c",
  borderRadius: "2px",
  fontSize: "12px",
};

const gridHeaderStyle: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  marginTop: "18px",
  padding: "0 12px 8px",
  borderBottom: "1px solid #d7dee7",
};

const headerCellStyle: React.CSSProperties = {
  flex: 1,
  fontSize: "12px",
  fontWeight: 700,
  textTransform: "uppercase",
  color: "#334155",
  letterSpacing: "0.04em",
};

const rowsWrapperStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  padding: "12px",
  borderBottom: "1px solid #eef2f7",
  alignItems: "center",
};

const cellStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "13px",
  color: "#1f2937",
};

const checkboxStyle: React.CSSProperties = {
  width: "14px",
  height: "14px",
  margin: 0,
};

const timeInputStyle = (enabled: boolean): React.CSSProperties => ({
  width: "100%",
  height: "34px",
  border: "1px solid #cbd5e1",
  borderRadius: "2px",
  padding: "0 10px",
  fontSize: "13px",
  color: enabled ? "#0f172a" : "#94a3b8",
  backgroundColor: enabled ? "#ffffff" : "#f8fafc",
});

const footerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  marginTop: "18px",
  paddingTop: "18px",
  borderTop: "1px solid #d7dee7",
};

const secondaryButtonStyle: React.CSSProperties = {
  height: "34px",
  padding: "0 16px",
  border: "1px solid #cbd5e1",
  borderRadius: "2px",
  backgroundColor: "#ffffff",
  color: "#334155",
  cursor: "pointer",
};

const primaryButtonStyle = (disabled: boolean): React.CSSProperties => ({
  height: "34px",
  padding: "0 18px",
  border: "1px solid #1d4ed8",
  borderRadius: "2px",
  backgroundColor: disabled ? "#93c5fd" : "#2563eb",
  color: "#ffffff",
  cursor: disabled ? "not-allowed" : "pointer",
  fontWeight: 600,
});

export default ScheduleClassModal;
