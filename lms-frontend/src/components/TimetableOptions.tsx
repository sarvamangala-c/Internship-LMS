import React from "react";

export const CopyClassDayModal = ({
  isOpen,
  onClose,
  onCopyComplete,
}: any) => {
  const [fromDay, setFromDay] = React.useState<string>("");
const [toDay, setToDay] = React.useState<string>("");

if (!isOpen) return null;

const days: string[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const handleCopy = () => {
  if (!fromDay || !toDay) {
    alert("Please select both days");
    return;
  }

  if (fromDay === toDay) {
    alert("Cannot copy to same day");
    return;
  }

  onCopyComplete(true, `Copied from ${fromDay} to ${toDay}`);
  onClose();
};

  return isOpen ? (
  <div style={overlayStyle}>
    <div style={modalStyle}>
      <h3 style={{ marginBottom: "10px" }}>Copy Class Schedule</h3>

      <p style={{ fontSize: "13px", color: "#555", marginBottom: "15px" }}>
        Copy Class Schedule - where we copy a day's class schedule to another day when no classes were planned.
      </p>

      <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
        
        {/* FROM DAY */}
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>From day *</label>
          <select
            value={fromDay}
            onChange={(e) => setFromDay(e.target.value)}
            style={selectStyle}
          >
            <option value="">Select Day...</option>
            {days.map((d: string) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* TO DAY */}
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>To day *</label>
          <select
            value={toDay}
            onChange={(e) => setToDay(e.target.value)}
            style={selectStyle}
          >
            <option value="">Select Day...</option>
            {days.map((d: string) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* BUTTONS */}
      <div style={{ textAlign: "right" }}>
        <button
          onClick={onClose}
          style={{
            backgroundColor: "#dc3545",
            color: "#fff",
            padding: "6px 14px",
            border: "none",
            borderRadius: "4px",
            marginRight: "10px",
            cursor: "pointer"
          }}
        >
          Cancel
        </button>

        <button
          onClick={handleCopy}
          style={{
            backgroundColor: "#2563eb",
            color: "#fff",
            padding: "6px 14px",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          Apply
        </button>
      </div>
    </div>
  </div>
) : null;
};

export const DeleteTimetableModal = ({
  isOpen,
  onClose,
  onDeleteComplete,
}: any) => {
  if (!isOpen) return null;

  return (
    <div style={{ background: "#fff", padding: "20px" }}>
      <h3>Delete Timetable</h3>
      <button
        onClick={() => {
          onDeleteComplete(true, "Deleted");
          onClose();
        }}
      >
        Delete
      </button>
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0,0,0,0.4)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000
};

const modalStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  padding: "20px",
  width: "400px",
  borderRadius: "8px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
};

const labelStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  marginBottom: "5px",
  display: "block"
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px",
  borderRadius: "4px",
  border: "1px solid #ccc"
};