import React, { useEffect, useState, useRef, useCallback } from "react";
import Select, { MultiValue } from "react-select";
import moment from "moment";
import * as XLSX from "xlsx";
import CustomDataTable from "./CustomDataTable";

import {
  getDepartments,
  getPrograms,
  getCurriculumList,
  getTermList,
  getSectionList,
  getDateInfo,
  generateReport,
  getDrilldown,
  DropdownOption,
  ReportRow,
  DrilldownRow,
} from "../../../services/ems/consolidatedAbsenteesReportService";

// ─── helpers ─────────────────────────────────────────────────────────────────
const toOptions = (list: DropdownOption[]) =>
  list.map((d) => ({ value: d.id, label: d.name }));

type SelectOption = { value: number; label: string };

// ─── DrilldownModal ───────────────────────────────────────────────────────────
interface DrilldownMeta {
  department: string;
  term: string;
  course: string;
  section: string;
  course_id: number;
  section_id: number;
}

interface DrilldownModalProps {
  open: boolean;
  meta: DrilldownMeta | null;
  startDate: string;
  endDate: string;
  onClose: () => void;
}

const DrilldownModal: React.FC<DrilldownModalProps> = ({
  open,
  meta,
  startDate,
  endDate,
  onClose,
}) => {
  const [rows, setRows] = useState<DrilldownRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open || !meta) return;
    setLoading(true);
    getDrilldown({
      course_id: meta.course_id,
      section_id: meta.section_id,
      start_date: startDate,
      end_date: endDate,
    })
      .then(setRows)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, meta, startDate, endDate]);

  if (!open || !meta) return null;

  const filtered = rows.filter(
    (r) =>
      r.student_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.usno?.toLowerCase().includes(search.toLowerCase())
  );

  const drillColumns = [
    { name: "Sl.No", selector: (_: DrilldownRow, i: number) => i + 1, width: "70px" },
    {
      name: "Date",
      selector: (r: DrilldownRow) => r.attendance_date,
      sortable: true,
      cell: (r: DrilldownRow) =>
        r.attendance_date
          ? moment(r.attendance_date).format("DD-MM-YYYY")
          : "-",
    },
    { name: "Student Name", selector: (r: DrilldownRow) => r.student_name, sortable: true },
    { name: "USN", selector: (r: DrilldownRow) => r.usno, sortable: true },
    {
      name: "Parent Contact No",
      selector: (r: DrilldownRow) => r.mobile || "-",
    },
    {
      name: "Student Contact No",
      selector: (r: DrilldownRow) => r.mobile || "-",
    },
  ];

  const tableCustomStyles = {
    tableWrapper: { width: '100%' },
    tableToolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: 13 },
    table: { borderCollapse: 'collapse', width: '100%', fontSize: 13 },
    headRow: { background: '#f1f3f5', fontWeight: 700 },
    headCells: { padding: '12px', borderBottom: '2px solid #dee2e6', fontSize: 13 },
    cells: { padding: '12px', borderBottom: '1px solid #dee2e6' },
    pagination: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '16px', marginTop: 8 }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.modalHeader}>
          <span style={{ fontWeight: 600, fontSize: 16 }}>Drilldown details</span>
          <button style={styles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>

        {/* Meta info */}
        <div style={styles.modalMeta}>
          <p>
            <strong>Department:</strong> {meta.department}
          </p>
          <p>
            <strong>Term:</strong> {meta.term}
          </p>
          <p>
            <strong>Course:</strong> {meta.course}
          </p>
          <p>
            <strong>Section:</strong> {meta.section}
          </p>
        </div>

        {/* Search */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <input
            style={styles.searchInput}
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 30 }}>Loading...</div>
        ) : (
          <CustomDataTable
            columns={drillColumns as any}
            data={filtered}
            pagination
            paginationPerPage={10}
            striped
            highlightOnHover
            customStyles={tableCustomStyles}
          />
        )}
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const ConsolidatedAbsenteesReport: React.FC = () => {
  // ── dropdown state
  const [deptOptions, setDeptOptions] = useState<SelectOption[]>([]);
  const [progOptions, setProgOptions] = useState<SelectOption[]>([]);
  const [currOptions, setCurrOptions] = useState<SelectOption[]>([]);
  const [termOptions, setTermOptions] = useState<SelectOption[]>([]);
  const [sectionOptions, setSectionOptions] = useState<SelectOption[]>([]);

  const [selectedDepts, setSelectedDepts] = useState<MultiValue<SelectOption>>([]);
  const [selectedProgs, setSelectedProgs] = useState<MultiValue<SelectOption>>([]);
  const [selectedCurrs, setSelectedCurrs] = useState<MultiValue<SelectOption>>([]);
  const [selectedTerms, setSelectedTerms] = useState<MultiValue<SelectOption>>([]);
  const [selectedSections, setSelectedSections] = useState<MultiValue<SelectOption>>([]);

  // ── date range - native HTML inputs
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [scheduledDates, setScheduledDates] = useState<string[]>([]);
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);

  // ── report
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [perPage, setPerPage] = useState(10);

  // ── drilldown
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillMeta, setDrillMeta] = useState<DrilldownMeta | null>(null);

  // ── load departments + date info on mount
  useEffect(() => {
    getDepartments().then((d: DropdownOption[]) => setDeptOptions(toOptions(d))).catch(console.error);
    getDateInfo()
      .then(({ latest_attendance_date, scheduled_dates }) => {
        setScheduledDates(scheduled_dates);
        if (latest_attendance_date) {
          const m = moment(latest_attendance_date);
          setStartDate(m.format("YYYY-MM-DD"));
          setEndDate(m.format("YYYY-MM-DD"));
        }
      })
      .catch(console.error);
  }, []);

  // ── cascade dropdowns
  useEffect(() => {
    setProgOptions([]);
    setSelectedProgs([]);
    setCurrOptions([]);
    setSelectedCurrs([]);
    setTermOptions([]);
    setSelectedTerms([]);
    setSectionOptions([]);
    setSelectedSections([]);
    if (selectedDepts.length === 1) {
      getPrograms(selectedDepts[0].value).then((d: DropdownOption[]) => setProgOptions(toOptions(d)));
    }
  }, [selectedDepts]);

  useEffect(() => {
    setCurrOptions([]);
    setSelectedCurrs([]);
    setTermOptions([]);
    setSelectedTerms([]);
    setSectionOptions([]);
    setSelectedSections([]);
    if (selectedProgs.length === 1) {
      getCurriculumList(selectedProgs[0].value).then((d: DropdownOption[]) => setCurrOptions(toOptions(d)));
    }
  }, [selectedProgs]);

  useEffect(() => {
    setTermOptions([]);
    setSelectedTerms([]);
    setSectionOptions([]);
    setSelectedSections([]);
    if (selectedCurrs.length === 1) {
      getTermList(selectedCurrs[0].value).then((d: DropdownOption[]) => setTermOptions(toOptions(d)));
    }
  }, [selectedCurrs]);

  useEffect(() => {
    setSectionOptions([]);
    setSelectedSections([]);
    if (selectedTerms.length === 1) {
      getSectionList(selectedTerms[0].value).then((d: DropdownOption[]) => setSectionOptions(toOptions(d)));
    }
  }, [selectedTerms]);

  // ── generate report
  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      alert("Please select a date range.");
      return;
    }
    setReportLoading(true);
    try {
      const payload = {
        start_date: startDate,
        end_date: endDate,
        department_ids: selectedDepts.length ? selectedDepts.map((d) => d.value) : null,
        program_ids: selectedProgs.length ? selectedProgs.map((d) => d.value) : null,
        curriculum_ids: selectedCurrs.length ? selectedCurrs.map((d) => d.value) : null,
        semester_ids: selectedTerms.length ? selectedTerms.map((d) => d.value) : null,
        section_ids: selectedSections.length ? selectedSections.map((d) => d.value) : null,
      };
      const data = await generateReport(payload);
      setReportData(data);
    } catch (err) {
      console.error(err);
      alert("Failed to generate report");
    } finally {
      setReportLoading(false);
    }
  };

  // ── export
  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      reportData.map((r) => ({
        Department: r.department,
        Term: r.term,
        Course: r.course,
        Section: r.section,
        "Absent Count": r.absent_count,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, "ConsolidatedAbsenteesReport.xlsx");
  };

  // ── filtered data for table
  const filteredData = reportData.filter(
    (r) =>
      r.department?.toLowerCase().includes(tableSearch.toLowerCase()) ||
      r.course?.toLowerCase().includes(tableSearch.toLowerCase()) ||
      r.section?.toLowerCase().includes(tableSearch.toLowerCase()) ||
      r.term?.toLowerCase().includes(tableSearch.toLowerCase())
  );

  // ── drilldown handler
  const openDrilldown = (row: ReportRow) => {
    setDrillMeta({
      department: row.department,
      term: row.term,
      course: row.course,
      section: row.section,
      course_id: row.course_id ?? 0,
      section_id: row.section_id ?? 0,
    });
    setDrillOpen(true);
  };

  // ── table columns
  const columns = [
    { name: "Department", selector: (r: ReportRow) => r.department, sortable: true, wrap: true },
    { name: "Term", selector: (r: ReportRow) => r.term, sortable: true, width: "140px" },
    { name: "Course", selector: (r: ReportRow) => r.course, sortable: true, wrap: true },
    { name: "Section", selector: (r: ReportRow) => r.section, sortable: true, width: "90px" },
    {
      name: "Absent Count",
      selector: (r: ReportRow) => r.absent_count,
      sortable: true,
      width: "130px",
    },
    {
      name: "Action",
      width: "130px",
      cell: (r: ReportRow) =>
        r.absent_count > 0 ? (
          <button style={styles.drillBtn} onClick={() => openDrilldown(r)}>
            Drilldown
          </button>
        ) : null,
    },
  ];

  const selectAllOption: SelectOption = { value: -1, label: "All selected" };

  const withAll = (opts: SelectOption[]) => [selectAllOption, ...opts];

  const handleMultiChange = (
    vals: MultiValue<SelectOption>,
    setter: React.Dispatch<React.SetStateAction<MultiValue<SelectOption>>>,
    options: SelectOption[]
  ) => {
    if (vals.some((v) => v.value === -1)) {
      setter(options); // select all real options
    } else {
      setter(vals);
    }
  };

  const dateLabel = startDate && endDate 
    ? `${moment(startDate).format("MMMM D, YYYY")} - ${moment(endDate).format("MMMM D, YYYY")}` 
    : "Select date range";

  const tableCustomStyles = {
    tableWrapper: { width: '100%' },
    tableToolbar: { 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginBottom: 12, 
      fontSize: 13 
    },
    table: { borderCollapse: 'collapse', width: '100%', fontSize: 13 },
    headRow: { background: '#f1f3f5', fontWeight: 700 },
    headCells: { padding: '12px', borderBottom: '2px solid #dee2e6', fontSize: 13 },
    cells: { padding: '12px', borderBottom: '1px solid #dee2e6' },
    pagination: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '16px', marginTop: 8 }
  };

  return (
    <div style={styles.page}>
      {/* Title */}
      <div style={styles.titleBar}>
        <span style={styles.titleText}>Consolidated Absentees Report</span>
      </div>

      {/* Filters */}
      <div style={styles.filterRow}>
        {/* Department */}
        <div style={styles.filterItem}>
          <label style={styles.label}>
            Department: <span style={{ color: "red" }}>*</span>
          </label>
          <Select
            isMulti
            options={withAll(deptOptions)}
            value={selectedDepts}
            onChange={(v) => handleMultiChange(v, setSelectedDepts, deptOptions)}
            placeholder="All selected"
            styles={selectStyles}
          />
        </div>

        {/* Program */}
        <div style={styles.filterItem}>
          <label style={styles.label}>
            Program: <span style={{ color: "red" }}>*</span>
          </label>
          <Select
            isMulti
            options={withAll(progOptions)}
            value={selectedProgs}
            onChange={(v) => handleMultiChange(v, setSelectedProgs, progOptions)}
            placeholder="All selected"
            isDisabled={!progOptions.length}
            styles={selectStyles}
          />
        </div>

        {/* Curriculum */}
        <div style={styles.filterItem}>
          <label style={styles.label}>Curriculum:</label>
          <Select
            isMulti
            options={withAll(currOptions)}
            value={selectedCurrs}
            onChange={(v) => handleMultiChange(v, setSelectedCurrs, currOptions)}
            placeholder="All selected"
            isDisabled={!currOptions.length}
            styles={selectStyles}
          />
        </div>

        {/* Term */}
        <div style={styles.filterItem}>
          <label style={styles.label}>Term:</label>
          <Select
            isMulti
            options={withAll(termOptions)}
            value={selectedTerms}
            onChange={(v) => handleMultiChange(v, setSelectedTerms, termOptions)}
            placeholder="All selected"
            isDisabled={!termOptions.length}
            styles={selectStyles}
          />
        </div>

        {/* Section */}
        <div style={styles.filterItem}>
          <label style={styles.label}>Section:</label>
          <Select
            isMulti
            options={withAll(sectionOptions)}
            value={selectedSections}
            onChange={(v) => handleMultiChange(v, setSelectedSections, sectionOptions)}
            placeholder="All selected"
            isDisabled={!sectionOptions.length}
            styles={selectStyles}
          />
        </div>
      </div>

      {/* Date + Buttons row */}
      <div style={styles.dateRow}>
        {/* Date range picker */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
          <div>
            <label style={styles.label}>From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                border: "1px solid #ccc",
                borderRadius: 4,
                padding: "7px 12px",
                fontSize: 13,
                background: "#fff",
                width: 140
              }}
            />
          </div>
          <div>
            <label style={styles.label}>To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                border: "1px solid #ccc",
                borderRadius: 4,
                padding: "7px 12px",
                fontSize: 13,
                background: "#fff",
                width: 140
              }}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div style={styles.btnGroup}>
          <button style={styles.generateBtn} onClick={handleGenerate} disabled={reportLoading}>
            {reportLoading ? "Generating..." : "Generate Report"}
          </button>
          <button style={styles.exportBtn} onClick={handleExportExcel} disabled={reportData.length === 0}>
            ⬇ Export Excel
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div style={styles.tableCard}>
        <div style={styles.tableToolbar}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>Show</span>
            <select
              value={perPage}
              onChange={(e) => setPerPage(Number(e.target.value))}
              style={styles.perPageSelect}
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span>entries</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>Search:</span>
            <input
              style={styles.searchInput}
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Search table..."
            />
          </div>
        </div>

        <CustomDataTable
          columns={columns as any}
          data={filteredData}
          pagination
          paginationPerPage={perPage}
          progressPending={reportLoading}
          striped
          highlightOnHover
          customStyles={tableCustomStyles}
          noDataComponent={
            <div style={{ padding: "24px", color: "#888" }}>
              No data available. Click "Generate Report" to load data.
            </div>
          }
        />
      </div>

      {/* Drilldown Modal */}
      <DrilldownModal
        open={drillOpen}
        meta={drillMeta}
        startDate={startDate}
        endDate={endDate}
        onClose={() => setDrillOpen(false)}
      />
    </div>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: "20px",
    fontFamily: "Segoe UI, sans-serif",
    background: "#f4f6f9",
    minHeight: "100vh",
  },
  titleBar: {
    background: "linear-gradient(135deg, #1a2e4a 0%, #2d4a6b 100%)",
    borderRadius: 6,
    padding: "14px 20px",
    marginBottom: 20,
  },
  titleText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: 600,
    letterSpacing: 0.5,
  },
  filterRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 16,
    background: "#fff",
    borderRadius: 6,
    padding: "16px",
    marginBottom: 16,
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  },
  filterItem: {
    flex: "1 1 180px",
    minWidth: 160,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#444",
    marginBottom: 4,
  },
  dateRow: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    background: "#fff",
    borderRadius: 6,
    padding: "16px",
    marginBottom: 16,
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  },
  btnGroup: {
    display: "flex",
    gap: 10,
  },
  generateBtn: {
    background: "#28a745",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    padding: "8px 20px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
  },
  exportBtn: {
    background: "#28a745",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    padding: "8px 20px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
  },
  tableCard: {
    background: "#fff",
    borderRadius: 6,
    padding: "16px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  },
  tableToolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    fontSize: 13,
  },
  perPageSelect: {
    border: "1px solid #ccc",
    borderRadius: 4,
    padding: "3px 6px",
    fontSize: 13,
  },
  searchInput: {
    border: "1px solid #ccc",
    borderRadius: 4,
    padding: "5px 10px",
    fontSize: 13,
    outline: "none",
  },
  drillBtn: {
    background: "#17a2b8",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    padding: "5px 12px",
    cursor: "pointer",
    fontWeight: 500,
    fontSize: 12,
  },
  // Modal
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modal: {
    background: "#fff",
    borderRadius: 8,
    width: "85vw",
    maxWidth: 900,
    maxHeight: "90vh",
    overflow: "auto",
    padding: "20px",
    position: "relative",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    paddingBottom: 10,
    borderBottom: "1px solid #eee",
  },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: 22,
    cursor: "pointer",
    color: "#666",
    lineHeight: 1,
  },
  modalMeta: {
    background: "#f8f9fa",
    borderRadius: 4,
    padding: "10px 14px",
    marginBottom: 14,
    fontSize: 13,
    lineHeight: 1.8,
  }
};

const selectStyles = {
  control: (base: any) => ({
    ...base,
    fontSize: 13,
    minHeight: 36,
    borderColor: "#ccc",
  }),
  menu: (base: any) => ({ ...base, zIndex: 9999, fontSize: 13 }),
  multiValue: (base: any) => ({ ...base, backgroundColor: "#e8f0fe" }),
};

export default ConsolidatedAbsenteesReport;

