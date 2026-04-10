import React from "react";

export const ViewTimetableModal = ({
  isOpen,
  onClose,
  onExport,
  timetableData,
}: any) => {
  if (!isOpen) return null;

  return (
    <div style={overlay}>
      <div
  style={{
    ...modal,
    maxHeight: "80vh",
    overflowY: "auto",
  }}
>
        
        {/* HEADER */}
        <div style={header}>
          <h3>View Time Table</h3>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        {/* EXPORT BUTTON */}
        <div style={{ textAlign: "right", marginBottom: "10px" }}>
          <button
  style={exportBtn}
  onClick={onExport}
>
  Export pdf
</button>
        </div>


        {/* TABLE */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
  <thead>
    <tr>
      <th style={th}>Days</th>
      <th style={th}>06:00 AM to 07:00 AM</th>
      <th style={th}>08:00 AM to 09:00 AM</th>
    </tr>
  </thead>

  <tbody>
    {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((day) => (
      <tr key={day}>
        <td style={td}>{day}</td>
        <td style={td}>ACVC403</td>
        <td style={td}>ACVC403</td>
      </tr>
    ))}
  </tbody>
  
</table>
{/* SUBJECT DETAILS TABLE */}
<div style={{ marginTop: "20px" }}>
  <table
  style={{
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: "0 8px",
  }}
>
    <thead>
      <tr>
        <th style={thStyle}>Subject Code</th>
        <th style={thStyle}>Subject</th>
        <th style={thStyle}>Initials</th>
        <th style={thStyle}>Faculty</th>
      </tr>
    </thead>

    <tbody>
  {Array.from(
    new Map(
      timetableData.map((item: any) => [item.course, item])
    ).values()
  ).map((row: any, index: number) => (
    <tr
  key={index}
  style={{
    backgroundColor: "#f9fafb",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    borderRadius: "6px",
  }}
>
      <td style={tdStyle}>
  {row.course?.split(" - ")[0] || "-"}
</td>
      <td style={tdStyle}>
  {row.course?.split(" - ")[1] || row.subject || "-"}
</td>
      <td style={tdStyle}>
        {row.initials || (row.faculty ? row.faculty[0] : "-")}
      </td>
      <td style={tdStyle}>{row.faculty || "-"}</td>
    </tr>
  ))}
</tbody>
  </table>
</div>


        {/* FOOTER */}
        <div style={{ textAlign: "right", marginTop: "15px" }}>
          <button onClick={onClose} style={closeFooterBtn}>
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

/* STYLES */

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0,0,0,0.4)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
};

const modal: React.CSSProperties = {
  background: "#fff",
  width: "750px",
  padding: "20px",
  borderRadius: "8px",
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "10px",
};

const closeBtn: React.CSSProperties = {
  border: "none",
  background: "none",
  cursor: "pointer",
  fontSize: "18px",
};

const exportBtn: React.CSSProperties = {
  backgroundColor: "#28a745",
  color: "#fff",
  padding: "6px 12px",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const closeFooterBtn: React.CSSProperties = {
  backgroundColor: "#dc3545",
  color: "#fff",
  padding: "6px 12px",
  border: "none",
  borderRadius: "4px",
};

const th: React.CSSProperties = {
  borderBottom: "1px solid #ddd",
  padding: "10px",
  textAlign: "left",
  fontWeight: 600,
};

const td: React.CSSProperties = {
  padding: "10px",
  borderBottom: "1px solid #eee",
};

const thStyle: React.CSSProperties = {
  padding: "12px",
  backgroundColor: "#e5e7eb",
  fontWeight: 600,
  fontSize: "13px",
  textAlign: "center",
};

const tdStyle: React.CSSProperties = {
  padding: "12px",
  textAlign: "center",
  fontSize: "13px",
  backgroundColor: "#fff",
};