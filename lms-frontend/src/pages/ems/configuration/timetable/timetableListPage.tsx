import React, { useState, useEffect } from "react";
import api from "../../../../utils/api";
import ScheduleClassModal from "./ScheduleClassModal";
import { scheduleClassApi } from "../../../../api/scheduleClassApi";

import {
  CopyClassDayModal,
  DeleteTimetableModal,
}from "../../../../components/TimetableOptions";
import { toast } from "react-toastify";

import { ViewTimetableModal } from "../../../../components/ViewTimetableModal";

const TimetableListPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showViewModal, setShowViewModal] = useState(false);

  const [timetableData, setTimetableData] = useState<any[]>([]);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showScheduleClassModal, setShowScheduleClassModal] = useState(false);
  const [showEditPopup, setShowEditPopup] = useState(false);
  const [editingRow, setEditingRow] = useState<any>(null);
  const [showTimetableModal, setShowTimetableModal] = useState(false);

  const [selectedCurriculum, setSelectedCurriculum] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedTimetable, setSelectedTimetable] = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [startTime, setStartTime] = useState("06:00");
  const [endTime, setEndTime] = useState("17:00");

  const [method, setMethod] = useState("Regular");
  const [showOptions, setShowOptions] = useState(false);
  
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
  try {
    setLoading(true);

    const res = await api.get(
      "/api/v1/timetable/scheduled-classes",
      {
        params: {
          academic_batch_id: 1,
          semester_id: selectedTerm || 1,
        },
      }
    );

    console.log("API DATA:", res.data);

    setTimetableData(res.data || []);
  } catch (error) {
    console.error("Error fetching timetable:", error);
    setError("Failed to load timetable");
  } finally {
    setLoading(false);
  }
};

  const handleDelete = async (id: any) => {
    if (
      window.confirm("Are you sure you want to delete this scheduled class?")
    ) {
      try {
        await scheduleClassApi.delete(id);
        fetchData();
      } catch (err) {
        console.error("Delete failed", err);
      }
    }
  };

  const fetchTimetable = async () => {
    try {
      setLoading(true);

      const response = await api.get("/api/v1/timetable/timetables", {
        params: {
          term: selectedTerm || "1",
          section: selectedSection || "A",
        },
      });

      setTimetableData(response.data as any[]);
    } catch (error) {
      console.error("Error fetching timetable:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyClassDay = async (sourceDate: string, targetDate: string) => {
    try {
      // Get classes for source date
      const sourceClasses = timetableData.filter(
        (cls) => cls.date === sourceDate,
      );

      if (sourceClasses.length === 0) {
        toast.info("No classes found on the source date");
        return;
      }

      // Copy classes to target date
      const copiedClasses = sourceClasses.map((cls) => ({
        ...cls,
        id: undefined,
        date: targetDate,
        createdAt: new Date().toISOString(),
      }));

      // Save each copied class
      for (const classData of copiedClasses) {
        await scheduleClassApi.saveSchedule(classData);
      }

      toast.success(
        `Copied ${sourceClasses.length} classes from ${sourceDate} to ${targetDate}`,
      );
      fetchData();
    } catch (error) {
      toast.error("Failed to copy classes");
    }
  };

  const handleResetTimetable = async (resetDate: string) => {
    try {
      // Get classes for the specified date
      const classesToDelete = timetableData.filter(
        (cls) => cls.date === resetDate,
      );

      if (classesToDelete.length === 0) {
        toast.info("No classes found on the specified date");
        return;
      }

      // Delete each class
      for (const classData of classesToDelete) {
        await scheduleClassApi.delete(classData.id);
      }

      toast.success(
        `Reset timetable for ${resetDate}. Deleted ${classesToDelete.length} classes.`,
      );
      fetchData();
    } catch (error) {
      toast.error("Failed to reset timetable");
    }
  };

  const handleDeleteTimetable = async (
    deleteOption: string,
    dateRange?: { startDate: string; endDate: string },
  ) => {
    try {
      let classesToDelete: any[] = [];

      if (deleteOption === "all") {
        classesToDelete = timetableData;
      } else if (deleteOption === "range" && dateRange) {
        classesToDelete = timetableData.filter(
          (cls) =>
            cls.date >= dateRange.startDate && cls.date <= dateRange.endDate,
        );
      }

      if (classesToDelete.length === 0) {
        toast.info("No classes found to delete");
        return;
      }

      // Delete each class
      for (const classData of classesToDelete) {
        await scheduleClassApi.delete(classData.id);
      }

      toast.success(`Deleted ${classesToDelete.length} classes`);
      fetchData();
    } catch (error) {
      toast.error("Failed to delete timetable");
    }
  };

  const handleApply = () => {
    fetchTimetable();
  };

  const handleExportPDF = async () => {
    try {
      const academic_batch_id = 1;
      const semester_id = selectedTerm || 1;

      const url = `http://127.0.0.1:8000/api/v1/comman_function/timetable/export-pdf?academic_batch_id=${academic_batch_id}&semester_id=${semester_id}`;

      const response = await fetch(url);

      const blob = await response.blob();

      const downloadUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "timetable.pdf";

      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Export failed", error);
    }
  };

  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const timeSlots = [
    "06:00",
    "07:00",
    "08:00",
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
  ];

  return (
    <div style={pageStyle}>
      {loading && (
  <p style={{ padding: "10px", color: "#2563eb" }}>
    Loading timetable...
  </p>
)}
      {error && (
        <div
          style={{
            backgroundColor: "#fee2e2",
            color: "#991b1b",
            padding: "10px",
            borderRadius: "6px",
            marginBottom: "15px",
          }}
        >
          {error}
        </div>
      )}
      {/* Schedule Class Modal */}
      <ScheduleClassModal
        show={showScheduleClassModal}
        onClose={() => setShowScheduleClassModal(false)}
        onSave={async (data) => {
          console.log("Saving schedule data:", data);
          try {
            for (const d of data.days) {
              await scheduleClassApi.saveSchedule({
                courseType: data.courseType,
                course: data.course,
                section: data.batch,
                location: "TBD",
                day: d.name,
                startTime: d.startTime,
                endTime: d.endTime,
                time: `${d.startTime} - ${d.endTime}`,
              });
            }
            setShowScheduleClassModal(false);
            fetchData();
          } catch (error) {
            console.error("Failed to save schedule:", error);
          }
        }}
      />

      {/* Options Modals */}
      <CopyClassDayModal
        isOpen={showCopyModal}
        onClose={() => setShowCopyModal(false)}
        onCopyComplete={(success: boolean, message: string) => {
          console.log("Copy completed:", { success, message });
        }}
      />

      <DeleteTimetableModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onDeleteComplete={(success: boolean, message: string) => {
          console.log("Delete completed:", { success, message });
        }}
      />

      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 600 }}>
          📅 Timetable Management
        </h1>
        <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "14px" }}>
          View and manage class schedules for each department and semester.
        </p>
      </div>

      {/* Filters */}
      <div style={filterCard}>
        {/* Curriculum */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label style={{ fontSize: "13px", fontWeight: "600" }}>
            Curriculum
          </label>
          <select
            style={selectStyle}
            value={selectedCurriculum}
            onChange={(e) => setSelectedCurriculum(e.target.value)}
          >
            <option value="">Select Curriculum</option>
            <option value="1">BE in Civil Engg 2024-2028</option>
            <option value="2">BCA 2023-2026</option>
          </select>
        </div>

        {/* Term */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label style={{ fontSize: "13px", fontWeight: "600" }}>Term</label>
          <select
            style={selectStyle}
            value={selectedTerm}
            onChange={(e) => setSelectedTerm(e.target.value)}
          >
            <option value="">Select Term</option>
            <option value="1">1st Semester</option>
            <option value="2">2nd Semester</option>
            <option value="3">3rd Semester</option>
            <option value="4">4th Semester</option>
          </select>
        </div>

        {/* Section */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label style={{ fontSize: "13px", fontWeight: "600" }}>Section</label>
          <select
            style={selectStyle}
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
          >
            <option value="">Select Section</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
        </div>

        {/* Timetable */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label style={{ fontSize: "13px", fontWeight: "600" }}>
            Timetable
          </label>
          <select
            style={selectStyle}
            value={selectedTimetable}
            onChange={(e) => setSelectedTimetable(e.target.value)}
          >
            <option value="">Select Timetable</option>
            <option value="1">01-07-2026 to 05-01-2027</option>
          </select>
        </div>

        {/* Start Date */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label style={{ fontSize: "13px", fontWeight: "600" }}>
            Start Date
          </label>
          <input
            type="date"
            style={selectStyle}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        {/* End Date */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label style={{ fontSize: "13px", fontWeight: "600" }}>
            End Date
          </label>
          <input
            type="date"
            style={selectStyle}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

       
      </div>

      {/* Time Settings */}
      <div
        style={{
          display: "flex",
          gap: "20px",
          marginBottom: "20px",
          alignItems: "center",
        }}
      >
        {/* Start Time */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label style={{ fontSize: "13px", fontWeight: "600" }}>
            Start Time
          </label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => {
  setStartTime(e.target.value);
  fetchTimetable();
}}
            style={selectStyle}
          />
        </div>

        {/* End Time */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label style={{ fontSize: "13px", fontWeight: "600" }}>
            End Time
          </label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            style={selectStyle}
          />
        </div>

        {/* Regular / Bypass */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label style={{ fontSize: "13px", fontWeight: "600" }}>
            Regular/Bypass Method
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            style={selectStyle}
          >
            <option value="Regular">Regular</option>
            <option value="Bypass">Bypass</option>
          </select>
        </div>
      </div>

      {/* Table Actions */}
      <div style={{ marginBottom: "15px", display: "flex", gap: "10px" }}>
  <button
    style={{
      backgroundColor: "#2563eb",
      color: "#fff",
      padding: "8px 16px",
      borderRadius: "6px",
      border: "none",
      cursor: "pointer",
    }}
    onClick={() => setShowScheduleClassModal(true)}
  >
    Schedule Class
  </button>

  {/* OPTIONS BUTTON */}
  <div style={{ position: "relative" }}>
  <button
    style={{
      backgroundColor: "#e5e7eb",
      padding: "8px 16px",
      borderRadius: "6px",
      border: "none",
      cursor: "pointer",
    }}
    onClick={() => setShowOptions(!showOptions)}
  >
    Options ▼
  </button>

  {showOptions && (
    <div
      style={{
        position: "absolute",
        top: "40px",
        left: 0,
        backgroundColor: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "6px",
        boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
        width: "180px",
        zIndex: 10,
      }}
    >
      <div
  style={optionItem}
  onClick={() => {
  setShowViewModal(true);
  setShowOptions(false);
}}
>
  Export Timetable
</div>

<div
  style={optionItem}
  onClick={() => {
    setShowCopyModal(true);
    setShowOptions(false);
  }}
>
  Copy Class Day
</div>

<div
  style={optionItem}
  onClick={() => {
    setShowResetModal(true);
    setShowOptions(false);
  }}
>
  Reset Timetable
</div>

<div
  style={{
    ...optionItem,
    color: "red",
    borderBottom: "none",
  }}
  onClick={() => {
    setShowDeleteModal(true);
    setShowOptions(false);
  }}
>
  Delete
</div>

    </div>
  )}
</div>
</div>
{timetableData.length === 0 && !loading && (
  <p style={{ padding: "10px" }}>No timetable data available</p>
)}

      <div style={tableWrapper}>
  <div style={{ display: "flex", border: "1px solid #e5e7eb" }}>
    
    {/* TIME COLUMN */}
    <div style={{ width: "90px", background: "#f9fafb" }}>
      <div style={{ height: "50px" }}></div>
      {timeSlots.map((time) => (
        <div
          key={time}
          style={{
            height: "80px",
            borderBottom: "1px solid #e5e7eb",
            fontSize: "12px",
            padding: "5px",
            textAlign: "right",
          }}
        >
          {formatTimeToAMPM(time)}
        </div>
      ))}
    </div>

    {/* DAYS */}
    {days.map((day) => (
      <div key={day} style={{ flex: 1, position: "relative" }}>
        
        {/* HEADER */}
        <div
          style={{
            height: "50px",
            background: "#6b7280",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 600,
          }}
        >
          {day}
        </div>

        {/* GRID */}
        <div style={{ position: "relative", height: `${timeSlots.length * 80}px` }}>
          
          {timeSlots.map((_, i) => (
            <div
              key={i}
              style={{
                height: "80px",
                borderBottom: "1px solid #f3f4f6",
              }}
            ></div>
          ))}

          {/* CLASSES */}
          {timetableData
            .filter((c) => c.day === day)
            .map((cls, i) => {
              const start = cls.startTime?.slice(0, 5) || "09:00";
              const end = cls.endTime?.slice(0, 5) || "10:00";

              const startParts = start.split(":").map(Number);
const endParts = end.split(":").map(Number);

const startInMinutes = startParts[0] * 60 + startParts[1];
const endInMinutes = endParts[0] * 60 + endParts[1];

const top = (startInMinutes - 6 * 60);
const height = (endInMinutes - startInMinutes);
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    top: `${top}px`,
                    left: "5px",
                    right: "5px",
                    height: `${height}px`,
                    background: "#bfdbfe",
                    borderLeft: "4px solid #2563eb",
                    padding: "5px",
                    fontSize: "11px",
                    borderRadius: "4px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
  <div style={{ fontWeight: 600, fontSize: "10px" }}>
    {formatTimeToAMPM(start)} - {formatTimeToAMPM(end)}
  </div>

  <div style={{ display: "flex", gap: "5px" }}>
    <span
      style={{ cursor: "pointer" }}
      onClick={() => {
        setEditingRow(cls);
        setShowEditPopup(true);
      }}
    >
      ✏️
    </span>

    <span
      style={{ cursor: "pointer", color: "red" }}
      onClick={() => handleDelete(cls.id)}
    >
      🗑️
    </span>
  </div>
</div>

<div style={{ fontSize: "11px", fontWeight: 600 }}>
  {cls.subject || cls.course}
</div>

<div style={{ fontSize: "10px" }}>
  {cls.faculty}
</div>
                </div>
              );
            })}
        </div>
      </div>
    ))}
  </div>
</div>

      {/* Edit Popup */}
      {showEditPopup && (
  <div style={popupOverlay}>
    <div style={{ ...popupBox, width: "400px" }}>
      <h3 style={{ marginBottom: "15px" }}>Edit Class</h3>

      {/* Class Day */}
      <div style={{ marginBottom: "10px", fontSize: "14px" }}>
        <strong>Class:</strong> {editingRow?.day}
      </div>

      {/* Time Inputs */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
        <div>
          <label style={{ fontSize: "12px" }}>Start Time *</label>
          <input
            type="time"
            value={editingRow?.startTime || ""}
            onChange={(e) =>
              setEditingRow({
                ...editingRow,
                startTime: e.target.value,
              })
            }
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ fontSize: "12px" }}>End Time *</label>
          <input
            type="time"
            value={editingRow?.endTime || ""}
            onChange={(e) =>
              setEditingRow({
                ...editingRow,
                endTime: e.target.value,
              })
            }
            style={inputStyle}
          />
        </div>
      </div>

      {/* Course Dropdown */}
      <div style={{ marginBottom: "15px" }}>
        <label style={{ fontSize: "12px" }}>Course *</label>
        <select
          value={editingRow?.course || ""}
          onChange={(e) =>
            setEditingRow({
              ...editingRow,
              course: e.target.value,
            })
          }
          style={{ ...inputStyle, width: "100%" }}
        >
          <option value="">Select Course</option>
          <option value="Break">Break</option>
          <option value="ACVC403">ACVC403 - Analysis of Structures</option>
          <option value="ACVC404">ACVC404 - Hydrology</option>
          <option value="AHRM407">AHRM407 - Research Methodology</option>
          <option value="AHTC406">AHTC406 - Technical Management</option>
          <option value="AMBE408">AMBE408 - Biology for Engineers</option>
        </select>
      </div>

      {/* Buttons */}
      <div style={{ textAlign: "right" }}>
        <button
          style={cancelBtn}
          onClick={() => setShowEditPopup(false)}
        >
          Close
        </button>

        <button
          style={saveBtn}
          onClick={() => {
            const updated = timetableData.map((item) =>
              item.id === editingRow.id ? editingRow : item
            );

            setTimetableData(updated);
            setShowEditPopup(false);
          }}
        >
          Update
        </button>
      </div>
    </div>
  </div>
)}
      {/* Timetable Modal */}
      <ViewTimetableModal
  isOpen={showViewModal}
  onClose={() => setShowViewModal(false)}
  onExport={handleExportPDF}
  timetableData={timetableData}
/>
    </div>

  );
};

// Helper to convert "06:00" to "06:00 AM"
const formatTimeToAMPM = (timeStr: string) => {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const num = hour % 12 || 12;
  return `${num.toString().padStart(2, "0")}:${m || "00"} ${ampm}`;
};

const pageStyle: React.CSSProperties = {
  padding: "24px",
  backgroundColor: "#f9fafb",
  minHeight: "100vh",
};

const filterCard: React.CSSProperties = {
  display: "flex",
  gap: "20px",
  padding: "20px",
  backgroundColor: "#fff",
  borderRadius: "10px",
  marginBottom: "24px",
  alignItems: "flex-end",
  flexWrap: "wrap",
  boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
};

const selectStyle: React.CSSProperties = {
  padding: "8px",
  minWidth: "160px",
};

const applyBtn: React.CSSProperties = {
  padding: "8px 16px",
  backgroundColor: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
};

const tableWrapper: React.CSSProperties = {
  backgroundColor: "#fff",
  borderRadius: "8px",
  padding: "16px",
  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "10px",
  borderBottom: "1px solid #e5e7eb",
  backgroundColor: "#f3f4f6",
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid #e5e7eb",
  transition: "background-color 0.2s",
  textAlign: "center",
  verticalAlign: "middle",
  minWidth: "120px",
};

const editBtn: React.CSSProperties = {
  padding: "6px 12px",
  backgroundColor: "#16a34a",
  color: "#fff",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
};

const popupOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0,0,0,0.4)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};

const popupBox: React.CSSProperties = {
  backgroundColor: "#fff",
  padding: "20px",
  width: "320px",
  borderRadius: "8px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px",
  marginTop: "10px",
};

const cancelBtn: React.CSSProperties = {
  padding: "6px 12px",
  marginRight: "10px",
};

const saveBtn: React.CSSProperties = {
  padding: "6px 12px",
  backgroundColor: "#2563eb",
  color: "#fff",
  border: "none",
};

const optionItem: React.CSSProperties = {
  padding: "10px",
  cursor: "pointer",
  borderBottom: "1px solid #f3f4f6",
};
export default TimetableListPage;