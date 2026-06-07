import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DataTable from "../../../components/Table/DataTable";
import axiosInstance from "../../../utils/api";
import { LocalStorageHelper } from "../../../utils/localStorageHelper";
import { loginData } from "../../login/loginModel";
import { toast } from "react-toastify";

// ─── API routes ──
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

interface MetaOption {
    academic_batch_id: number;
    academic_batch_code: string;
    academic_batch_desc: string;
}
interface SemesterOption {
    semester_id: number;
    semester: number;
    semester_desc: string;
}
interface CourseOption {
    crs_id: number;
    crs_code: string;
    crs_title: string;
}
interface BloomLevel {
    bloom_id: number;
    bloom_name: string;
    bloom_code: string;
}
interface StudentOption {
    student_id: number;
    usno: string;
    name: string;
    first_name: string;
    last_name: string;
}

type ModalMode = "add" | "edit" | "share" | "review" | null;
type ActiveView = "list" | "submissions";

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

// ─── Page-scoped “Manage / Shared material” look (no external CSS, avoids conflicts) ──
const material = {
    panel: "rounded-[1.25rem] border border-indigo-100/70 bg-gradient-to-b from-indigo-50/70 to-white/80",
    panelInner: "p-4 sm:p-6",
    pill: "inline-flex items-center rounded-full bg-[#1f4e5f] text-white text-xs px-3 py-1 font-bold shadow-sm",
    hTitle: "text-sm font-bold text-indigo-900",
    metaText: "text-xs text-indigo-600",
    tile: "rounded-xl border border-indigo-100/70 bg-white/70 shadow-sm",
    tileStat: "text-xl font-bold",
    badge: {
        submitted: "text-indigo-700",
        pending: "text-yellow-700",
        graded: "text-green-700",
    },
    btnPrimary: "bg-[#1f4e5f] hover:bg-[#17404e] text-white",
    btnSecondary: "bg-indigo-50 hover:bg-indigo-100 text-[#1f4e5f] border border-indigo-200",
    btnDanger: "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200",
};


const ManageAssignmentPage: React.FC = () => {
    const authState = LocalStorageHelper.getObject<loginData>("auth_state");
    const userIdRef = useRef<number>((authState as any)?.user_id ?? (authState as any)?.id ?? 1);
    const userId = userIdRef.current;

    // Data state
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [loadingList, setLoadingList] = useState(false);
    const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
    const [loadingSubs, setLoadingSubs] = useState(false);

    // Meta state
    const [batches, setBatches] = useState<MetaOption[]>([]);
    const [semesters, setSemesters] = useState<SemesterOption[]>([]);
    const [courses, setCourses] = useState<CourseOption[]>([]);
    const [bloomLevels, setBloomLevels] = useState<BloomLevel[]>([]);

    // Share modal state
    const [shareStudents, setShareStudents] = useState<StudentOption[]>([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set());
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [shareFilter, setShareFilter] = useState({ academic_batch_id: "", semester_id: "", section: "" });

    // UI state
    const [activeView, setActiveView] = useState<ActiveView>("list");
    const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
    const [modalMode, setModalMode] = useState<ModalMode>(null);
    const [form, setForm] = useState(defaultForm);
    const [saving, setSaving] = useState(false);

    // Review state
    const [reviewRow, setReviewRow] = useState<StudentSubmission | null>(null);
    const [reviewForm, setReviewForm] = useState({
        secured_marks: 0,
        remark: "",
        action: "approve" as "approve" | "rework" | "pending",
    });

    const fetchAssignments = useCallback(async () => {
        setLoadingList(true);
        try {
            const r = await axiosInstance.get<{ data: { items: Assignment[] } }>(API.list, { params: { created_by: userId } });
            const items = r.data?.data?.items;
setAssignments(
                (Array.isArray(items) ? items : []).map((it: any, idx: number) => ({
                    ...it,
                    idX: it?.lms_assignment_id ?? idx,
                    isSelected: false,
                }))
            );
        } catch {
            toast.error("Failed to load assignments");
        } finally {
            setLoadingList(false);
        }
    }, [userId]);

    useEffect(() => {
        axiosInstance
            .get(API.options)
            .then((r: any) => {
                const d = r.data?.data;
                setBatches(Array.isArray(d?.academic_batches) ? d.academic_batches : []);
                setSemesters(Array.isArray(d?.semesters) ? d.semesters : []);
                setCourses(Array.isArray(d?.courses) ? d.courses : []);
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        fetchAssignments();
    }, [fetchAssignments]);

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

    const closeModal = () => {
        setModalMode(null);
        setForm(defaultForm);
        setReviewRow(null);
        setShareStudents([]);
        setSelectedStudentIds(new Set());
    };

    const openAdd = () => {
        setForm(defaultForm);
        setSelectedAssignment(null);
        setModalMode("add");
    };

    const openEdit = async (a: Assignment) => {
        // Keep minimal: load is optional; falling back to existing values.
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
                academic_batch_id: "",
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
        setSelectedStudentIds((prev) => {
            const s = new Set(prev);
            s.has(id) ? s.delete(id) : s.add(id);
            return s;
        });

    const submitted = useMemo(() => submissions.filter((s) => !!s.seen_on).length, [submissions]);
    const graded = useMemo(
        () => submissions.filter((s) => s.secured_marks !== null && s.secured_marks !== undefined).length,
        [submissions]
    );

    const assignmentColumns = useMemo(
        () =>
            [
                {
                    headerName: "Sl No.",
                    valueGetter: (p: any) => p.node.rowIndex + 1,
                    width: 75,
                    flex: 0,
                },
                {
                    headerName: "Title",
                    field: "assignment_name",
                    flex: 2,
                    cellRenderer: (p: any) => (
                        <span className="text-sm font-medium text-[#1f4e5f] cursor-pointer hover:underline" onClick={() => openSubmissions(p.data)}>
                            {p.value}
                        </span>
                    ),
                },
                { headerName: "Course ID", field: "crs_id", width: 110, flex: 0, cellRenderer: (p: any) => <span className="text-xs">{p.value ?? "—"}</span> },
                { headerName: "Due Date", field: "due_date", width: 130, flex: 0, cellRenderer: (p: any) => fmtDate(p.value) },
                {
                    headerName: "Shared",
                    field: "shared_students_count",
                    width: 90,
                    flex: 0,
                    cellRenderer: (p: any) => <span className="text-xs font-semibold text-indigo-700">{p.value ?? 0}</span>,
                },
                {
                    headerName: "Status",
                    field: "status",
                    width: 90,
                    flex: 0,
                    cellRenderer: (p: any) => (
                        <span
                            className={`text-xs px-2 py-0.5 rounded border font-medium ${
                                p.value === 1
                                    ? "bg-green-100 text-green-700 border-green-300"
                                    : "bg-gray-100 text-gray-600 border-gray-300"
                            }`}
                        >
                            {p.value === 1 ? "Active" : "Inactive"}
                        </span>
                    ),
                },
                {
                    headerName: "Actions",
                    width: 280,
                    flex: 0,
                    cellRenderer: (p: any) => (
                        <div className="flex gap-1 items-center h-full flex-wrap">
                            <button className="text-xs bg-[#1f4e5f] text-white px-2 py-1 rounded hover:bg-[#17404e]" onClick={() => openSubmissions(p.data)}>
                                View
                            </button>
                            <button
                                className="text-xs bg-indigo-50 text-[#1f4e5f] border border-indigo-200 px-2 py-1 rounded hover:bg-indigo-100"
                                onClick={() => openShare(p.data)}
                            >
                                Share
                            </button>
                            <button
                                className="text-xs bg-yellow-50 text-yellow-800 border border-yellow-200 px-2 py-1 rounded hover:bg-yellow-100"
                                onClick={() => openEdit(p.data)}
                            >
                                Edit
                            </button>
                            <button
                                className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded hover:bg-red-100"
                                onClick={() => handleDelete(p.data)}
                            >
                                Delete
                            </button>
                        </div>
                    ),
                },
            ] as any,
        [openSubmissions, openShare, openEdit, handleDelete]
    );

const submissionColumns = useMemo(
    () =>
        [
            {
                headerName: "USN",
                field: "student_usn",
                flex: 1,
                cellRenderer: (p: any) => <span className="text-xs font-mono">{p.value ?? "—"}</span>,
            },
            {
                headerName: "File",
                field: "file_name",
                flex: 2,
                cellRenderer: (p: any) => <span className="text-xs text-indigo-700">{p.value ?? "—"}</span>,
            },
            {
                headerName: "Seen On",
                field: "seen_on",
                flex: 1,
                cellRenderer: (p: any) => fmtDate(p.value),
            },
            {
                headerName: "Status",
                field: "accept_rework_flag",
                flex: 1,
                cellRenderer: (p: any) => {
                    const v = p.value;
                    const label = v === 1 ? "Approved" : v === 2 ? "Rework" : "Pending";
                    const cls =
                        v === 1
                            ? "bg-green-100 text-green-700 border-green-300"
                            : v === 2
                            ? "bg-red-100 text-red-700 border-red-300"
                            : "bg-yellow-100 text-yellow-700 border-yellow-300";
                    return <span className={`text-xs px-2 py-0.5 rounded border font-medium ${cls}`}>{label}</span>;
                },
            },
            {
                headerName: "Marks",
                field: "secured_marks",
                flex: 1,
                cellRenderer: (p: any) => <span className="text-xs">{p.value ?? "—"}</span>,
            },
            {
                headerName: "Actions",
                field: "action",
                flex: 2,
                cellRenderer: (p: any) => (
                    <button
                        className="text-xs bg-[#1f4e5f] text-white px-2 py-1 rounded hover:bg-[#17404e]"
                        onClick={() => openReview(p.data)}
                    >
                        Review
                    </button>
                ),
            },
        ] as any,
    [openReview]
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
                        <span className="text-indigo-600">Manage Assignment</span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">Assignments</h1>
                    <p className="text-slate-500 text-sm font-medium">Create, share and review student assignments.</p>
                </div>

                <div className="flex items-center gap-3">
                    <span className="bg-[#1f4e5f] text-white text-xs px-3 py-1 rounded-full font-bold shadow-sm">
                        {activeView === "list" ? "Manage" : "Submissions"}
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="bg-gradient-to-b from-slate-50/95 to-white/90 backdrop-blur-xl rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-200/50 overflow-hidden mt-6">
                <div className="p-6 border-b border-slate-100 bg-slate-50/30">
                    <div className="flex items-center gap-2 mb-4 text-sm">
                        <button
                            onClick={() => {
                                setActiveView("list");
                                setSelectedAssignment(null);
                            }}
                            className={`font-medium ${activeView === "list" ? "text-[#1f4e5f]" : "text-gray-400 hover:text-gray-600"}`}
                        >
                            Assignment List
                        </button>
                        {activeView === "submissions" && selectedAssignment && (
                            <>
                                <span className="text-gray-300">/</span>
                                <span className="text-[#1f4e5f] font-medium">{selectedAssignment.assignment_name} — Submissions</span>
                            </>
                        )}
                    </div>
                </div>

                <div className="p-6">
                    {activeView === "list" && (
                        <DataTable
                            columnDefs={assignmentColumns}
                            rowData={assignments}
                            pagination
                            pageSize={10}
                            showAddButton
                            showAddButtonName="Create Assignment"
                            addButtonHandler={openAdd}
                            showExportButton
                            showExportButtonName="Export"
                            showExportFileName="assignments"
                        />
                    )}

                    {activeView === "submissions" && selectedAssignment && (
                        <div>
                            <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 mb-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-bold text-indigo-900">{selectedAssignment.assignment_name}</p>
                                        <p className="text-xs text-indigo-600 mt-0.5">
                                            Due: {fmtDate(selectedAssignment.due_date)} · Shared with {selectedAssignment.shared_students_count} student(s)
                                        </p>
                                        {selectedAssignment.additional_info && (
                                            <p className="text-xs text-indigo-500 mt-1 italic">{selectedAssignment.additional_info}</p>
                                        )}
                                    </div>
                                    <div className="flex gap-4 text-center">
                                        <div>
                                            <p className="text-xl font-bold text-indigo-700">{submitted}</p>
                                            <p className="text-xs text-indigo-500">Submitted</p>
                                        </div>
                                        <div>
                                            <p className="text-xl font-bold text-yellow-600">{Math.max(0, submissions.length - submitted)}</p>
                                            <p className="text-xs text-gray-500">Pending</p>
                                        </div>
                                        <div>
                                            <p className="text-xl font-bold text-green-600">{graded}</p>
                                            <p className="text-xs text-gray-500">Graded</p>
                                        </div>
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
            </div>

            {/* Minimal modals kept out to ensure compilation; original complex UI can be reintroduced later. */}
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
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Marks Secured</label>
                                <input
                                    type="number"
                                    min={0}
                                    className="w-full border rounded px-3 py-2 text-sm"
                                    value={reviewForm.secured_marks}
                                    onChange={(e) => setReviewForm({ ...reviewForm, secured_marks: Number(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Decision</label>
                                <div className="flex gap-4">
                                    {(["approve", "rework"] as const).map((a) => (
                                        <label key={a} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                checked={reviewForm.action === a}
                                                onChange={() => setReviewForm({ ...reviewForm, action: a })}
                                                className="accent-[#1f4e5f]"
                                            />
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
                                    onChange={(e) => setReviewForm({ ...reviewForm, remark: e.target.value })}
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

            {/* Add/Edit Modal */}
            {(modalMode === "add" || modalMode === "edit") && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="bg-[#1f4e5f] text-white px-4 py-3 rounded-t-lg flex justify-between items-center sticky top-0">
                            <p className="font-semibold text-sm">{modalMode === "add" ? "Create Assignment" : "Edit Assignment"}</p>
                            <button onClick={closeModal} className="text-white hover:opacity-75 text-xl leading-none">&times;</button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Assignment Name *</label>
                                <input
                                    type="text"
                                    className="w-full border rounded px-3 py-2 text-sm"
                                    value={form.assignment_name}
                                    onChange={(e) => setForm({ ...form, assignment_name: e.target.value })}
                                    placeholder="Enter assignment name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Info</label>
                                <textarea
                                    rows={3}
                                    className="w-full border rounded px-3 py-2 text-sm resize-none"
                                    value={form.additional_info}
                                    onChange={(e) => setForm({ ...form, additional_info: e.target.value })}
                                    placeholder="Additional instructions or information"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Academic Batch</label>
                                    <select
                                        className="w-full border rounded px-3 py-2 text-sm"
                                        value={form.academic_batch_id}
                                        onChange={(e) => setForm({ ...form, academic_batch_id: e.target.value })}
                                    >
                                        <option value="">Select Batch</option>
                                        {batches.map((b) => (
                                            <option key={b.academic_batch_id} value={b.academic_batch_id}>
                                                {b.academic_batch_code} - {b.academic_batch_desc}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                                    <select
                                        className="w-full border rounded px-3 py-2 text-sm"
                                        value={form.semester_id}
                                        onChange={(e) => setForm({ ...form, semester_id: e.target.value })}
                                    >
                                        <option value="">Select Semester</option>
                                        {semesters.map((s) => (
                                            <option key={s.semester_id} value={s.semester_id}>
                                                {s.semester} - {s.semester_desc}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                                <select
                                    className="w-full border rounded px-3 py-2 text-sm"
                                    value={form.crs_id}
                                    onChange={(e) => setForm({ ...form, crs_id: e.target.value })}
                                >
                                    <option value="">Select Course</option>
                                    {courses.map((c) => (
                                        <option key={c.crs_id} value={c.crs_id}>
                                            {c.crs_code} - {c.crs_title}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date</label>
                                    <input
                                        type="date"
                                        className="w-full border rounded px-3 py-2 text-sm"
                                        value={form.issue_date}
                                        onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                                    <input
                                        type="date"
                                        className="w-full border rounded px-3 py-2 text-sm"
                                        value={form.due_date}
                                        onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Bloom's Taxonomy Levels</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {bloomLevels.map((b) => (
                                        <label key={b.bloom_id} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={form.bloom_ids.includes(b.bloom_id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setForm({ ...form, bloom_ids: [...form.bloom_ids, b.bloom_id] });
                                                    } else {
                                                        setForm({ ...form, bloom_ids: form.bloom_ids.filter((id) => id !== b.bloom_id) });
                                                    }
                                                }}
                                                className="accent-[#1f4e5f]"
                                            />
                                            <span className="text-sm">{b.bloom_name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="px-5 py-3 bg-gray-50 rounded-b-lg flex justify-end gap-2 sticky bottom-0">
                            <button onClick={closeModal} className="px-4 py-2 text-sm border rounded text-gray-600 hover:bg-gray-100">Cancel</button>
                            <button
                                onClick={handleSaveAssignment}
                                disabled={saving}
                                className="px-4 py-2 text-sm bg-[#1f4e5f] text-white rounded hover:bg-[#17404e] disabled:opacity-50"
                            >
                                {saving ? "Saving..." : modalMode === "add" ? "Create Assignment" : "Update Assignment"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Share Modal */}
            {modalMode === "share" && selectedAssignment && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="bg-[#1f4e5f] text-white px-4 py-3 rounded-t-lg flex justify-between items-center sticky top-0">
                            <div>
                                <p className="font-semibold text-sm">Share Assignment</p>
                                <p className="text-xs opacity-70">{selectedAssignment.assignment_name}</p>
                            </div>
                            <button onClick={closeModal} className="text-white hover:opacity-75 text-xl leading-none">&times;</button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-sm font-medium text-gray-700 mb-3">Filter Students</p>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Academic Batch</label>
                                        <select
                                            className="w-full border rounded px-2 py-1.5 text-xs"
                                            value={shareFilter.academic_batch_id}
                                            onChange={(e) => setShareFilter({ ...shareFilter, academic_batch_id: e.target.value })}
                                        >
                                            <option value="">All</option>
                                            {batches.map((b) => (
                                                <option key={b.academic_batch_id} value={b.academic_batch_id}>
                                                    {b.academic_batch_code}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Semester</label>
                                        <select
                                            className="w-full border rounded px-2 py-1.5 text-xs"
                                            value={shareFilter.semester_id}
                                            onChange={(e) => setShareFilter({ ...shareFilter, semester_id: e.target.value })}
                                        >
                                            <option value="">All</option>
                                            {semesters.map((s) => (
                                                <option key={s.semester_id} value={s.semester_id}>
                                                    {s.semester}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Section</label>
                                        <input
                                            type="text"
                                            className="w-full border rounded px-2 py-1.5 text-xs"
                                            value={shareFilter.section}
                                            onChange={(e) => setShareFilter({ ...shareFilter, section: e.target.value })}
                                            placeholder="A, B, C..."
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={loadShareStudents}
                                    className="mt-3 text-xs bg-indigo-50 text-[#1f4e5f] border border-indigo-200 px-3 py-1.5 rounded hover:bg-indigo-100"
                                >
                                    Load Students
                                </button>
                            </div>

                            {loadingStudents ? (
                                <div className="text-center py-8 text-gray-400 text-sm">Loading students...</div>
                            ) : shareStudents.length > 0 ? (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-medium text-gray-700">
                                            {selectedStudentIds.size} of {shareStudents.length} students selected
                                        </p>
                                        <button
                                            onClick={() => {
                                                setSelectedStudentIds(new Set(shareStudents.map((s) => s.student_id)));
                                            }}
                                            className="text-xs text-[#1f4e5f] hover:underline"
                                        >
                                            Select All
                                        </button>
                                    </div>
                                    <div className="border rounded-lg max-h-64 overflow-y-auto">
                                        {shareStudents.map((s) => (
                                            <label key={s.student_id} className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedStudentIds.has(s.student_id)}
                                                    onChange={() => toggleStudent(s.student_id)}
                                                    className="accent-[#1f4e5f]"
                                                />
                                                <span className="text-sm flex-1">
                                                    {s.name} ({s.usno})
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-400 text-sm">
                                    No students loaded. Apply filters and click "Load Students"
                                </div>
                            )}
                        </div>
                        <div className="px-5 py-3 bg-gray-50 rounded-b-lg flex justify-end gap-2 sticky bottom-0">
                            <button onClick={closeModal} className="px-4 py-2 text-sm border rounded text-gray-600 hover:bg-gray-100">Cancel</button>
                            <button
                                onClick={handleShare}
                                disabled={saving || selectedStudentIds.size === 0}
                                className="px-4 py-2 text-sm bg-[#1f4e5f] text-white rounded hover:bg-[#17404e] disabled:opacity-50"
                            >
                                {saving ? "Sharing..." : `Share with ${selectedStudentIds.size} Students`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageAssignmentPage;

