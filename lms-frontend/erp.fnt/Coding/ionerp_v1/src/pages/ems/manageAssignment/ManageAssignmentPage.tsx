import React, { useMemo, useState, useEffect, useCallback } from "react";
import DataTable from "../../../components/Table/DataTable";
import axiosInstance from "../../../utils/api";
import { LocalStorageHelper } from "../../../utils/localStorageHelper";
import { loginData } from "../../login/loginModel";
import { toast } from "react-toastify";

// ─── API routes (prefix from routes.py: /manage-assignment, router prefix: /assignment) ──
const API = {
    options: "/api/v1/manage-assignment/assignment/meta/options",
    students: "/api/v1/manage-assignment/assignment/meta/students",
    bloomLevels: "/api/v1/manage-assignment/assignment/meta/bloom-levels",
    list: "/api/v1/manage-assignment/assignment/list",
    create: "/api/v1/manage-assignment/assignment/create",
    detail: (id: number) => `/api/v1/manage-assignment/assignment/${id}`,
    update: (id: number) => `/api/v1/manage-assignment/assignment/${id}`,
    delete: (id: number) => `/api/v1/manage-assignment/assignment/${id}`,
    share: (id: number) => `/api/v1/manage-assignment/assignment/${id}/share`,
    review: (mapId: number) => `/api/v1/manage-assignment/assignment/review/${mapId}`,
};

// ─── Types matching backend response fields ───────────────────────────────────
interface Assignment {
    lms_assignment_id: number;
    assignment_name: string;
    additional_info: string | null;
    crs_id: number | null;
    due_date: string | null;
    issue_date: string | null;
    status: number;
    created_by: number;
    created_date: string;
    shared_students_count: number;
}

interface StudentSubmission {
    map_assignment_student_id: number;
    ssd_id: number;
    student_usn: string;
    file_name: string | null;
    file_path: string | null;
    seen_on: string | null;
    accept_rework_flag: number | null; // 0=pending, 1=approved, 2=rework
    secured_marks: number | null;
    remark: string | null;
}

interface MetaOption { academic_batch_id: number; academic_batch_code: string; academic_batch_desc: string; }
interface SemesterOption { semester_id: number; semester: number; semester_desc: string; }
interface CourseOption { crs_id: number; crs_code: string; crs_title: string; }
interface BloomLevel { bloom_id: number; bloom_name: string; bloom_code: string; }
interface StudentOption { student_id: number; usno: string; name: string; first_name: string; last_name: string; }

type ModalMode = "add" | "edit" | "share" | "review" | null;
type ActiveView = "list" | "submissions";

const REVIEW_FLAG_LABEL: Record<number, string> = { 0: "Pending", 1: "Approved", 2: "Rework" };
const REVIEW_FLAG_COLOR: Record<number, string> = {
    0: "bg-yellow-100 text-yellow-700",
    1: "bg-green-100 text-green-700",
    2: "bg-red-100 text-red-700",
};

const fmtDate = (v: string | null) => {
    if (!v) return "—";
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const defaultForm = {
    assignment_name: "",
    additional_info: "",
    academic_batch_id: "",
    semester_id: "",
    crs_id: "",
    issue_date: "",
    due_date: "",
    bloom_ids: [] as number[],
};

// ─── Component ────────────────────────────────────────────────────────────────
const ManageAssignmentPage: React.FC = () => {
    const authState = LocalStorageHelper.getObject<loginData>("auth_state");
    const userIdRef = React.useRef<number>((authState as any)?.user_id ?? (authState as any)?.id ?? 1);
    const userId = userIdRef.current;

    // ── Data state ──────────────────────────────────────────────────
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [loadingList, setLoadingList] = useState(false);
    const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
    const [loadingSubs, setLoadingSubs] = useState(false);

    // ── Meta state ──────────────────────────────────────────────────
    const [batches, setBatches] = useState<MetaOption[]>([]);
    const [semesters, setSemesters] = useState<SemesterOption[]>([]);
    const [courses, setCourses] = useState<CourseOption[]>([]);
    const [bloomLevels, setBloomLevels] = useState<BloomLevel[]>([]);

    // ── Share modal state ───────────────────────────────────────────
    const [shareStudents, setShareStudents] = useState<StudentOption[]>([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set());
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [shareFilter, setShareFilter] = useState({ academic_batch_id: "", semester_id: "", section: "" });

    // ── UI state ────────────────────────────────────────────────────
    const [activeView, setActiveView] = useState<ActiveView>("list");
    const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
    const [modalMode, setModalMode] = useState<ModalMode>(null);
    const [form, setForm] = useState(defaultForm);
    const [saving, setSaving] = useState(false);

    // ── Review state ────────────────────────────────────────────────
    const [reviewRow, setReviewRow] = useState<StudentSubmission | null>(null);
    const [reviewForm, setReviewForm] = useState({ secured_marks: 0, remark: "", action: "approve" as "approve" | "rework" | "pending" });

    // ── Load assignment list ────────────────────────────────────────
    const fetchAssignments = useCallback(async () => {
        setLoadingList(true);
        try {
            const r = await axiosInstance.get<{ data: { items: Assignment[] } }>(API.list, {
                params: { created_by: userId }
            });
            const items = r.data?.data?.items;
            setAssignments(Array.isArray(items) ? items : []);
        } catch {
            toast.error("Failed to load assignments");
        } finally {
            setLoadingList(false);
        }
    }, [userId]);

    // ── Load meta (batches, semesters, courses, bloom levels) — once only ───
    useEffect(() => {
        axiosInstance.get(API.options)
            .then((r: any) => {
                const d = r.data?.data;
                setBatches(Array.isArray(d?.academic_batches) ? d.academic_batches : []);
                setSemesters(Array.isArray(d?.semesters) ? d.semesters : []);
                setCourses(Array.isArray(d?.courses) ? d.courses : []);
            }).catch(() => { });

        axiosInstance.get(API.bloomLevels)
            .then((r: any) => {
                const d = r.data?.data;
                setBloomLevels(Array.isArray(d) ? d : []);
            }).catch(() => { });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Load assignment list — once on mount ────────────────────────
    useEffect(() => {
        fetchAssignments();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Load submissions when viewing a specific assignment ──────────
    const fetchSubmissions = useCallback(async (assignmentId: number) => {
        setLoadingSubs(true);
        try {
            const r = await axiosInstance.get<{ data: { shared_students: StudentSubmission[] } }>(API.detail(assignmentId));
            const d = r.data?.data?.shared_students;
            setSubmissions(Array.isArray(d) ? d : []);
        } catch {
            toast.error("Failed to load submissions");
        } finally {
            setLoadingSubs(false);
        }
    }, []);

    // ── Load students for share modal ───────────────────────────────
    const loadShareStudents = useCallback(async () => {
        setLoadingStudents(true);
        try {
            const params: Record<string, any> = {};
            if (shareFilter.academic_batch_id) params.academic_batch_id = Number(shareFilter.academic_batch_id);
            if (shareFilter.semester_id) params.semester_id = Number(shareFilter.semester_id);
            if (shareFilter.section) params.section = shareFilter.section;

            const r = await axiosInstance.get<{ data: { items: StudentOption[] } }>(API.students, { params });
            const items = r.data?.data?.items;
            setShareStudents(Array.isArray(items) ? items : []);
        } catch {
            toast.error("Failed to load students");
        } finally {
            setLoadingStudents(false);
        }
    }, [shareFilter]);

    // ── Handlers ────────────────────────────────────────────────────
    const closeModal = () => {
        setModalMode(null);
        setForm(defaultForm);
        setReviewRow(null);
        setShareStudents([]);
        setSelectedStudentIds(new Set());
    };

    const openAdd = () => { setForm(defaultForm); setSelectedAssignment(null); setModalMode("add"); };

    const openEdit = async (a: Assignment) => {
        try {
            const r = await axiosInstance.get<{ data: { assignment: any; bloom_ids: number[] } }>(API.detail(a.lms_assignment_id));
            const d = r.data?.data;
            setForm({
                assignment_name: d?.assignment?.assignment_name ?? a.assignment_name,
                additional_info: d?.assignment?.additional_info ?? "",
                academic_batch_id: String(d?.assignment?.academic_batch_id ?? ""),
                semester_id: String(d?.assignment?.semester_id ?? ""),
                crs_id: String(d?.assignment?.crs_id ?? ""),
                issue_date: d?.assignment?.issue_date?.substring(0, 10) ?? "",
                due_date: d?.assignment?.due_date?.substring(0, 10) ?? "",
                bloom_ids: Array.isArray(d?.bloom_ids) ? d.bloom_ids : [],
            });
        } catch {
            setForm({
                assignment_name: a.assignment_name,
                additional_info: a.additional_info ?? "",
                academic_batch_id: String(a.crs_id ?? ""),
                semester_id: "",
                crs_id: String(a.crs_id ?? ""),
                issue_date: a.issue_date?.substring(0, 10) ?? "",
                due_date: a.due_date?.substring(0, 10) ?? "",
                bloom_ids: [],
            });
        }
        setSelectedAssignment(a);
        setModalMode("edit");
    };

    const openShare = (a: Assignment) => {
        setSelectedAssignment(a);
        setShareFilter({ academic_batch_id: "", semester_id: "", section: "" });
        setSelectedStudentIds(new Set());
        setShareStudents([]);
        setModalMode("share");
    };

    const openSubmissions = (a: Assignment) => {
        setSelectedAssignment(a);
        setActiveView("submissions");
        fetchSubmissions(a.lms_assignment_id);
    };

    const openReview = (row: StudentSubmission) => {
        setReviewRow(row);
        setReviewForm({
            secured_marks: row.secured_marks ?? 0,
            remark: row.remark ?? "",
            action: row.accept_rework_flag === 1 ? "approve" : row.accept_rework_flag === 2 ? "rework" : "approve",
        });
        setModalMode("review");
    };

    const handleSaveAssignment = async () => {
        if (!form.assignment_name.trim()) return;
        setSaving(true);
        try {
            const payload = {
                assignment_name: form.assignment_name.trim(),
                additional_info: form.additional_info || null,
                academic_batch_id: form.academic_batch_id ? Number(form.academic_batch_id) : null,
                semester_id: form.semester_id ? Number(form.semester_id) : null,
                crs_id: form.crs_id ? Number(form.crs_id) : null,
                issue_date: form.issue_date || null,
                due_date: form.due_date || null,
                bloom_ids: form.bloom_ids,
                clo_ids: [],
                student_ids: [],
                status: 1,
                assess_attain_flag: 0,
                created_by: userId,
                modified_by: userId,
            };

            if (modalMode === "add") {
                await axiosInstance.post(API.create, payload);
                toast.success("Assignment created successfully!");
            } else if (modalMode === "edit" && selectedAssignment) {
                await axiosInstance.put(API.update(selectedAssignment.lms_assignment_id), { ...payload, modified_by: userId });
                toast.success("Assignment updated successfully!");
            }

            closeModal();
            fetchAssignments();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to save assignment");
        } finally {
            setSaving(false);
        }
    };

    const handleShare = async () => {
        if (!selectedAssignment || selectedStudentIds.size === 0) {
            toast.warning("Please select at least one student");
            return;
        }
        setSaving(true);
        try {
            await axiosInstance.post(API.share(selectedAssignment.lms_assignment_id), {
                student_ids: Array.from(selectedStudentIds),
                created_by: userId,
            });
            toast.success("Assignment shared with students!");
            closeModal();
            fetchAssignments();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to share assignment");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (a: Assignment) => {
        if (!window.confirm(`Delete "${a.assignment_name}"?`)) return;
        try {
            await axiosInstance.delete(API.delete(a.lms_assignment_id));
            toast.success("Assignment deleted");
            fetchAssignments();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to delete assignment");
        }
    };

    const handleReviewSave = async () => {
        if (!reviewRow) return;
        setSaving(true);
        try {
            await axiosInstance.post(API.review(reviewRow.map_assignment_student_id), {
                action: reviewForm.action,
                secured_marks: reviewForm.secured_marks,
                remark: reviewForm.remark,
                modified_by: userId,
            });
            toast.success("Review saved successfully!");
            closeModal();
            if (selectedAssignment) fetchSubmissions(selectedAssignment.lms_assignment_id);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to save review");
        } finally {
            setSaving(false);
        }
    };

    const toggleStudent = (id: number) =>
        setSelectedStudentIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

    // ── Table column defs ────────────────────────────────────────────
    const assignmentColumns = useMemo(() => [
        { headerName: "Sl No.", valueGetter: (p: any) => p.node.rowIndex + 1, width: 75, flex: 0 },
        {
            headerName: "Title", field: "assignment_name", flex: 2,
            cellRenderer: (p: any) => (
                <span className="text-sm font-medium text-[#1f4e5f] cursor-pointer hover:underline" onClick={() => openSubmissions(p.data)}>
                    {p.value}
                </span>
            )
        },
        {
            headerName: "Course ID", field: "crs_id", width: 110, flex: 0,
            cellRenderer: (p: any) => <span className="text-xs">{p.value ?? "—"}</span>
        },
        { headerName: "Due Date", field: "due_date", width: 130, flex: 0, cellRenderer: (p: any) => fmtDate(p.value) },
        {
            headerName: "Shared", field: "shared_students_count", width: 90, flex: 0,
            cellRenderer: (p: any) => <span className="text-xs font-semibold text-indigo-700">{p.value ?? 0}</span>
        },
        {
            headerName: "Status", field: "status", width: 90, flex: 0,
            cellRenderer: (p: any) => (
                <span className={`text-xs px-2 py-0.5 rounded border font-medium ${p.value === 1 ? "bg-green-100 text-green-700 border-green-300" : "bg-gray-100 text-gray-600 border-gray-300"}`}>
                    {p.value === 1 ? "Active" : "Inactive"}
                </span>
            )
        },
        {
            headerName: "Actions", field: "action", width: 280, flex: 0,
            cellRenderer: (p: any) => (
                <div className="flex gap-1 items-center h-full flex-wrap">
                    <button onClick={() => openEdit(p.data)} className="text-[11px] bg-blue-600 hover:bg-blue-700 text-white px-1.5 py-0.5 rounded">Edit</button>
                    <button onClick={() => openSubmissions(p.data)} className="text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white px-1.5 py-0.5 rounded">Students</button>
                    <button onClick={() => openShare(p.data)} className="text-[11px] bg-green-600 hover:bg-green-700 text-white px-1.5 py-0.5 rounded">Share</button>
                    <button onClick={() => handleDelete(p.data)} className="text-[11px] bg-red-500 hover:bg-red-600 text-white px-1.5 py-0.5 rounded">Delete</button>
                </div>
            ),
        },
    ], [assignments]);

    const submissionColumns = useMemo(() => [
        { headerName: "Sl No.", valueGetter: (p: any) => p.node.rowIndex + 1, width: 75, flex: 0 },
        { headerName: "USN", field: "student_usn", flex: 1 },
        {
            headerName: "File", field: "file_name", width: 120, flex: 0,
            cellRenderer: (p: any) => p.value
                ? <button className="text-xs text-blue-600 hover:underline">📎 Download</button>
                : <span className="text-xs text-gray-400">Not Submitted</span>
        },
        { headerName: "Marks", field: "secured_marks", width: 90, flex: 0, cellRenderer: (p: any) => p.value !== null ? <span className="font-semibold text-green-700 text-xs">{p.value}</span> : <span className="text-gray-400 text-xs">—</span> },
        {
            headerName: "Review Status", field: "accept_rework_flag", width: 130, flex: 0,
            cellRenderer: (p: any) => {
                const flag = p.value ?? 0;
                return <span className={`text-xs px-2 py-0.5 rounded font-medium ${REVIEW_FLAG_COLOR[flag] ?? REVIEW_FLAG_COLOR[0]}`}>{REVIEW_FLAG_LABEL[flag] ?? "Pending"}</span>;
            }
        },
        {
            headerName: "Action", field: "action", width: 100, flex: 0,
            cellRenderer: (p: any) => p.data.file_name
                ? <button onClick={() => openReview(p.data)} className="text-[11px] bg-[#1f4e5f] hover:bg-[#17404e] text-white px-2 py-0.5 rounded">Review</button>
                : <span className="text-xs text-gray-400">—</span>
        },
    ], [selectedAssignment]);

    const submitted = submissions.filter(s => s.file_name).length;
    const graded = submissions.filter(s => s.secured_marks !== null).length;

    // ─────────────────────────────────────────────────────────────────
    return (
        <div className="p-6">
            <div className="bg-[#1f4e5f] text-white px-4 py-2 rounded-t-md font-semibold text-sm">
                Manage Assignment
            </div>
            <div className="border rounded-b-md bg-white p-4">
                {/* ── Breadcrumb ── */}
                <div className="flex items-center gap-2 mb-4 text-sm">
                    <button onClick={() => setActiveView("list")} className={`font-medium ${activeView === "list" ? "text-[#1f4e5f]" : "text-gray-400 hover:text-gray-600"}`}>
                        Assignment List
                    </button>
                    {activeView === "submissions" && selectedAssignment && (
                        <>
                            <span className="text-gray-300">/</span>
                            <span className="text-[#1f4e5f] font-medium">{selectedAssignment.assignment_name} — Submissions</span>
                        </>
                    )}
                </div>

                {/* ══ LIST VIEW ══ */}
                {activeView === "list" && (
                    <DataTable
                        columnDefs={assignmentColumns}
                        rowData={assignments}
                        pagination pageSize={10}
                        showAddButton showAddButtonName="Create Assignment"
                        addButtonHandler={openAdd}
                        showExportButton showExportButtonName="Export"
                        showExportFileName="assignments"
                    />
                )}

                {/* ══ SUBMISSIONS VIEW ══ */}
                {activeView === "submissions" && selectedAssignment && (
                    <div>
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 mb-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-bold text-indigo-900">{selectedAssignment.assignment_name}</p>
                                    <p className="text-xs text-indigo-600 mt-0.5">Due: {fmtDate(selectedAssignment.due_date)} · Shared with {selectedAssignment.shared_students_count} student(s)</p>
                                    {selectedAssignment.additional_info && (
                                        <p className="text-xs text-indigo-500 mt-1 italic">{selectedAssignment.additional_info}</p>
                                    )}
                                </div>
                                <div className="flex gap-4 text-center">
                                    <div><p className="text-xl font-bold text-indigo-700">{submitted}</p><p className="text-xs text-indigo-500">Submitted</p></div>
                                    <div><p className="text-xl font-bold text-yellow-600">{submissions.length - submitted}</p><p className="text-xs text-gray-500">Pending</p></div>
                                    <div><p className="text-xl font-bold text-green-600">{graded}</p><p className="text-xs text-gray-500">Graded</p></div>
                                </div>
                            </div>
                        </div>
                        {loadingSubs ? (
                            <div className="text-center py-10 text-gray-400 text-sm">Loading submissions...</div>
                        ) : (
                            <DataTable columnDefs={submissionColumns} rowData={submissions} pagination pageSize={10} />
                        )}
                    </div>
                )}
            </div>

            {/* ═══ MODAL — Add / Edit Assignment ═══ */}
            {(modalMode === "add" || modalMode === "edit") && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="bg-[#1f4e5f] text-white px-4 py-3 rounded-t-lg flex justify-between items-center sticky top-0">
                            <span className="font-semibold text-sm">{modalMode === "add" ? "Create Assignment" : "Edit Assignment"}</span>
                            <button onClick={closeModal} className="text-white hover:opacity-75 text-xl leading-none">&times;</button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Assignment Title <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f4e5f]"
                                    placeholder="e.g. React Hooks Assignment"
                                    value={form.assignment_name}
                                    onChange={e => setForm({ ...form, assignment_name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Academic Batch</label>
                                    <select
                                        className="w-full border rounded px-3 py-2 text-sm"
                                        value={form.academic_batch_id}
                                        onChange={e => setForm({ ...form, academic_batch_id: e.target.value })}
                                    >
                                        <option value="">Select Batch</option>
                                        {batches.map(b => <option key={b.academic_batch_id} value={b.academic_batch_id}>{b.academic_batch_code} — {b.academic_batch_desc}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                                    <select
                                        className="w-full border rounded px-3 py-2 text-sm"
                                        value={form.semester_id}
                                        onChange={e => setForm({ ...form, semester_id: e.target.value })}
                                    >
                                        <option value="">Select Semester</option>
                                        {semesters.map(s => <option key={s.semester_id} value={s.semester_id}>Sem {s.semester} — {s.semester_desc}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                                <select
                                    className="w-full border rounded px-3 py-2 text-sm"
                                    value={form.crs_id}
                                    onChange={e => setForm({ ...form, crs_id: e.target.value })}
                                >
                                    <option value="">Select Course</option>
                                    {courses.map(c => <option key={c.crs_id} value={c.crs_id}>{c.crs_code} — {c.crs_title}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date</label>
                                    <input type="date" className="w-full border rounded px-3 py-2 text-sm" value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                                    <input type="date" className="w-full border rounded px-3 py-2 text-sm" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description / Instructions</label>
                                <textarea
                                    rows={3}
                                    className="w-full border rounded px-3 py-2 text-sm resize-none"
                                    placeholder="Describe the assignment requirements..."
                                    value={form.additional_info}
                                    onChange={e => setForm({ ...form, additional_info: e.target.value })}
                                />
                            </div>
                            {bloomLevels.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Bloom's Taxonomy Levels</label>
                                    <div className="flex flex-wrap gap-2">
                                        {bloomLevels.map(b => (
                                            <label key={b.bloom_id} className="flex items-center gap-1 cursor-pointer text-sm">
                                                <input
                                                    type="checkbox"
                                                    checked={form.bloom_ids.includes(b.bloom_id)}
                                                    onChange={() => {
                                                        const ids = form.bloom_ids.includes(b.bloom_id)
                                                            ? form.bloom_ids.filter(id => id !== b.bloom_id)
                                                            : [...form.bloom_ids, b.bloom_id];
                                                        setForm({ ...form, bloom_ids: ids });
                                                    }}
                                                    className="accent-[#1f4e5f]"
                                                />
                                                {b.bloom_name}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="px-5 py-3 bg-gray-50 rounded-b-lg flex justify-end gap-2 sticky bottom-0">
                            <button onClick={closeModal} className="px-4 py-2 text-sm border rounded text-gray-600 hover:bg-gray-100">Cancel</button>
                            <button
                                onClick={handleSaveAssignment}
                                disabled={!form.assignment_name.trim() || saving}
                                className="px-4 py-2 text-sm bg-[#1f4e5f] text-white rounded hover:bg-[#17404e] disabled:opacity-50"
                            >
                                {saving ? "Saving..." : modalMode === "add" ? "Create Assignment" : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ MODAL — Share Assignment ═══ */}
            {modalMode === "share" && selectedAssignment && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
                        <div className="bg-green-600 text-white px-4 py-3 rounded-t-lg flex justify-between items-center">
                            <span className="font-semibold text-sm">Share Assignment — {selectedAssignment.assignment_name}</span>
                            <button onClick={closeModal} className="text-white hover:opacity-75 text-xl leading-none">&times;</button>
                        </div>
                        <div className="p-4 space-y-3 overflow-y-auto flex-1">
                            {/* Filters */}
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Batch</label>
                                    <select
                                        className="w-full border rounded px-2 py-1.5 text-sm"
                                        value={shareFilter.academic_batch_id}
                                        onChange={e => setShareFilter(f => ({ ...f, academic_batch_id: e.target.value }))}
                                    >
                                        <option value="">All</option>
                                        {batches.map(b => <option key={b.academic_batch_id} value={b.academic_batch_id}>{b.academic_batch_code}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Semester</label>
                                    <select
                                        className="w-full border rounded px-2 py-1.5 text-sm"
                                        value={shareFilter.semester_id}
                                        onChange={e => setShareFilter(f => ({ ...f, semester_id: e.target.value }))}
                                    >
                                        <option value="">All</option>
                                        {semesters.map(s => <option key={s.semester_id} value={s.semester_id}>Sem {s.semester}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Section</label>
                                    <select
                                        className="w-full border rounded px-2 py-1.5 text-sm"
                                        value={shareFilter.section}
                                        onChange={e => setShareFilter(f => ({ ...f, section: e.target.value }))}
                                    >
                                        <option value="">All</option>
                                        {["A", "B", "C", "D"].map(s => <option key={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                            <button
                                onClick={loadShareStudents}
                                disabled={loadingStudents}
                                className="text-sm bg-[#1f4e5f] text-white px-4 py-1.5 rounded hover:bg-[#17404e] disabled:opacity-50"
                            >
                                {loadingStudents ? "Loading..." : "🔍 Search Students"}
                            </button>

                            {/* Student list */}
                            {shareStudents.length === 0 && !loadingStudents && (
                                <p className="text-sm text-gray-400 text-center py-4">No students found. Click Search.</p>
                            )}
                            {shareStudents.length > 0 && (
                                <div className="border rounded overflow-y-auto max-h-52">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th className="p-2 w-8">
                                                    <input
                                                        type="checkbox"
                                                        checked={shareStudents.length > 0 && shareStudents.every(s => selectedStudentIds.has(s.student_id))}
                                                        onChange={() => {
                                                            const all = shareStudents.every(s => selectedStudentIds.has(s.student_id));
                                                            setSelectedStudentIds(all ? new Set() : new Set(shareStudents.map(s => s.student_id)));
                                                        }}
                                                    />
                                                </th>
                                                <th className="p-2 text-left text-xs font-semibold text-gray-600">Name</th>
                                                <th className="p-2 text-left text-xs font-semibold text-gray-600">USN</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {shareStudents.map(s => (
                                                <tr
                                                    key={s.student_id}
                                                    className={`cursor-pointer border-b hover:bg-green-50 ${selectedStudentIds.has(s.student_id) ? "bg-green-50" : ""}`}
                                                    onClick={() => toggleStudent(s.student_id)}
                                                >
                                                    <td className="p-2">
                                                        <input type="checkbox" checked={selectedStudentIds.has(s.student_id)} onChange={() => toggleStudent(s.student_id)} onClick={e => e.stopPropagation()} />
                                                    </td>
                                                    <td className="p-2 text-xs font-medium">{s.name || `${s.first_name} ${s.last_name}`.trim()}</td>
                                                    <td className="p-2 text-xs font-mono text-gray-500">{s.usno}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            <p className="text-xs text-gray-500">{selectedStudentIds.size} student(s) selected</p>
                        </div>
                        <div className="px-4 py-3 bg-gray-50 rounded-b-lg flex justify-end gap-2">
                            <button onClick={closeModal} className="px-4 py-2 text-sm border rounded text-gray-600 hover:bg-gray-100">Cancel</button>
                            <button
                                onClick={handleShare}
                                disabled={selectedStudentIds.size === 0 || saving}
                                className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                            >
                                {saving ? "Sharing..." : `Share with ${selectedStudentIds.size} Student(s)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ MODAL — Review / Grade Submission ═══ */}
            {modalMode === "review" && reviewRow && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                        <div className="bg-[#1f4e5f] text-white px-4 py-3 rounded-t-lg flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-sm">Review Submission</p>
                                <p className="text-xs opacity-70">{reviewRow.student_usn}</p>
                            </div>
                            <button onClick={closeModal} className="text-white hover:opacity-75 text-xl leading-none">&times;</button>
                        </div>
                        <div className="p-5 space-y-4">
                            {reviewRow.file_name && (
                                <div className="bg-gray-50 rounded p-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 text-xs">Submitted file</span>
                                        <button className="text-blue-600 text-xs hover:underline">📎 {reviewRow.file_name}</button>
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Marks Secured</label>
                                <input
                                    type="number"
                                    min={0}
                                    className="w-full border rounded px-3 py-2 text-sm"
                                    value={reviewForm.secured_marks}
                                    onChange={e => setReviewForm({ ...reviewForm, secured_marks: Number(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Decision</label>
                                <div className="flex gap-4">
                                    {(["approve", "rework"] as const).map(a => (
                                        <label key={a} className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" checked={reviewForm.action === a} onChange={() => setReviewForm({ ...reviewForm, action: a })} className="accent-[#1f4e5f]" />
                                            <span className={`text-sm font-medium ${a === "approve" ? "text-green-700" : "text-orange-600"}`}>
                                                {a === "approve" ? "Approve" : "Send for Rework"}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks / Feedback</label>
                                <textarea
                                    rows={3}
                                    className="w-full border rounded px-3 py-2 text-sm resize-none"
                                    placeholder="Add feedback for the student..."
                                    value={reviewForm.remark}
                                    onChange={e => setReviewForm({ ...reviewForm, remark: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="px-5 py-3 bg-gray-50 rounded-b-lg flex justify-end gap-2">
                            <button onClick={closeModal} className="px-4 py-2 text-sm border rounded text-gray-600 hover:bg-gray-100">Cancel</button>
                            <button
                                onClick={handleReviewSave}
                                disabled={saving}
                                className="px-4 py-2 text-sm bg-[#1f4e5f] text-white rounded hover:bg-[#17404e] disabled:opacity-50"
                            >
                                {saving ? "Saving..." : "Save Review"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageAssignmentPage;
