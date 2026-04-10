import React, { useMemo, useState, useEffect, useCallback } from "react";
import DataTable from "../../../components/Table/DataTable";
import axiosInstance from "../../../utils/api";
import { LocalStorageHelper } from "../../../utils/localStorageHelper";
import { toast } from "react-toastify";

// ─── Types ────────────────────────────────────────────────────────────────────
interface MaterialRow {
    mat_id: number;
    document_name: string;
    file_name: string;
    description: string;
    created_by: number;
    created_date: string;
}

interface SectionOption { id: number; section: string; }
interface StudentOption { value: number; label: string; }
interface MappedStudent { student_usn: string; student_name: string; }

type ModalMode = "add" | "edit" | "share" | "viewStudents" | null;

// ─── Component ────────────────────────────────────────────────────────────────
const ManageShareMaterialsPage: React.FC = () => {
    const authState = LocalStorageHelper.getObject<any>("auth_state");
    const userId: number = (authState as any)?.user_id ?? 1;

    // ── Filter State ──────────────────────────────────────────────────────────
    const [sectionId, setSectionId] = useState<number | "">("");
    const [sectionOptions, setSectionOptions] = useState<SectionOption[]>([]);

    // ── Data ──────────────────────────────────────────────────────────────────
    const [materials, setMaterials] = useState<MaterialRow[]>([]);

    // ── Modal ─────────────────────────────────────────────────────────────────
    const [modalMode, setModalMode] = useState<ModalMode>(null);
    const [selectedMaterial, setSelectedMaterial] = useState<MaterialRow | null>(null);
    const [formTitle, setFormTitle] = useState("");
    const [formDesc, setFormDesc] = useState("");
    const [formFile, setFormFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);

    // ── Share ─────────────────────────────────────────────────────────────────
    const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
    const [selectedUsns, setSelectedUsns] = useState<string[]>([]);
    const [sharing, setSharing] = useState(false);

    // ── View Students ─────────────────────────────────────────────────────────
    const [mappedStudents, setMappedStudents] = useState<MappedStudent[]>([]);

    // ── Load all sections on mount ────────────────────────────────────────────
    useEffect(() => {
        axiosInstance.get("/api/v1/material/dropdown/all_sections")
            .then((r: any) => {
                setSectionOptions(Array.isArray(r.data) ? r.data : []);
            })
            .catch(() => { });
    }, []);

    // ── Fetch material list ───────────────────────────────────────────────────
    const fetchMaterials = useCallback(async () => {
        if (!sectionId) {
            toast.warn("Please select a Section first.");
            return;
        }
        try {
            const r = await axiosInstance.post<any>("/api/v1/material/material_list", {
                academic_batch_id: 0,
                semester_id: 0,
                course_id: 0,
                section_id: sectionId,
            });
            const d = r.data?.data ?? r.data;
            setMaterials(Array.isArray(d) ? d : []);
        } catch {
            toast.error("Failed to load materials.");
        }
    }, [sectionId]);

    // ── Modal helpers ─────────────────────────────────────────────────────────
    const closeModal = () => {
        setModalMode(null); setSelectedMaterial(null);
        setFormTitle(""); setFormDesc(""); setFormFile(null);
        setSelectedUsns([]); setStudentOptions([]); setMappedStudents([]);
    };

    const openAdd = () => {
        if (!sectionId) { toast.warn("Please select a Section first."); return; }
        setFormTitle(""); setFormDesc(""); setFormFile(null);
        setSelectedMaterial(null); setModalMode("add");
    };

    const openEdit = (row: MaterialRow) => {
        setFormTitle(row.document_name); setFormDesc(row.description || "");
        setFormFile(null); setSelectedMaterial(row); setModalMode("edit");
    };

    const openShare = async (row: MaterialRow) => {
        setSelectedMaterial(row); setSelectedUsns([]); setStudentOptions([]);
        setModalMode("share");
        try {
            const r = await axiosInstance.post<any>("/api/v1/material/student_list", { section_id: sectionId || 0 });
            const d = r.data?.data ?? r.data;
            setStudentOptions(Array.isArray(d) ? d : []);
        } catch { toast.error("Failed to load students."); }
    };

    const openViewStudents = async (row: MaterialRow) => {
        setSelectedMaterial(row); setMappedStudents([]);
        setModalMode("viewStudents");
        try {
            const r = await axiosInstance.post<any>("/api/v1/material/material_mapping_list", { material_id: row.mat_id });
            const d = r.data?.data ?? r.data;
            setMappedStudents(Array.isArray(d) ? d : []);
        } catch { toast.error("Failed to load student mapping."); }
    };

    const handleDownload = (row: MaterialRow) =>
        window.open(`http://127.0.0.1:8000/api/v1/material/download_material/${row.mat_id}`, "_blank");

    // ── Save (add / edit) ─────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!formTitle.trim()) { toast.error("Title is required."); return; }
        if (modalMode === "add" && !formFile) { toast.error("Please upload a file."); return; }
        setSaving(true);

        const fd = new FormData();
        fd.append("title", formTitle.trim());
        fd.append("description", formDesc);
        if (formFile) fd.append("file", formFile);

        try {
            if (modalMode === "add") {
                fd.append("academic_batch_id", "0");
                fd.append("semester_id", "0");
                fd.append("course_id", "0");
                fd.append("section_id", String(sectionId));
                fd.append("created_by", String(userId));
                await axiosInstance.post("/api/v1/material/create_material", fd, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
                toast.success("Material uploaded successfully!");
            } else if (modalMode === "edit" && selectedMaterial) {
                await axiosInstance.put(`/api/v1/material/update_material/${selectedMaterial.mat_id}`, fd, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
                toast.success("Material updated successfully!");
            }
            closeModal();
            fetchMaterials();
        } catch (err: any) {
            toast.error(err?.response?.data?.detail || "Failed to save material.");
        } finally {
            setSaving(false);
        }
    };

    // ── Share with students ───────────────────────────────────────────────────
    const handleShare = async () => {
        if (!selectedMaterial || selectedUsns.length === 0) { toast.error("Select at least one student."); return; }
        setSharing(true);
        try {
            await axiosInstance.post("/api/v1/material/share_material", {
                material_id: selectedMaterial.mat_id,
                academic_batch_id: 0,
                section_id: sectionId,
                student_usns: selectedUsns,
            });
            toast.success("Material shared successfully!");
            closeModal();
        } catch (err: any) {
            toast.error(err?.response?.data?.detail || "Failed to share material.");
        } finally {
            setSharing(false);
        }
    };

    const toggleUsn = (usn: string) =>
        setSelectedUsns(prev => prev.includes(usn) ? prev.filter(u => u !== usn) : [...prev, usn]);

    // ── Column defs ───────────────────────────────────────────────────────────
    const materialColumns = useMemo(() => [
        { headerName: "Sl No.", valueGetter: (p: any) => p.node.rowIndex + 1, width: 80, flex: 0 },
        { headerName: "Title", field: "document_name", flex: 2 },
        { headerName: "File Name", field: "file_name", flex: 2 },
        { headerName: "Description", field: "description", flex: 2 },
        { headerName: "Uploaded On", field: "created_date", width: 150, flex: 0 },
        {
            headerName: "Actions", field: "action", width: 300, flex: 0,
            cellRenderer: (params: any) => (
                <div className="flex gap-1 items-center h-full flex-wrap">
                    <button onClick={() => openEdit(params.data)} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded">Edit</button>
                    <button onClick={() => openShare(params.data)} className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded">Share</button>
                    <button onClick={() => openViewStudents(params.data)} className="text-xs bg-teal-600 hover:bg-teal-700 text-white px-2 py-1 rounded">Students</button>
                    <button onClick={() => handleDownload(params.data)} className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded">Download</button>
                </div>
            ),
        },
    ], []);

    const mappedStudentColumns = useMemo(() => [
        { headerName: "Sl No.", valueGetter: (p: any) => p.node.rowIndex + 1, width: 80, flex: 0 },
        { headerName: "USN", field: "student_usn", flex: 1 },
        { headerName: "Name", field: "student_name", flex: 2 },
    ], []);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="p-6">
            <div className="bg-[#1f4e5f] text-white px-4 py-2 rounded-t-md font-semibold text-sm">
                Manage Share Materials
            </div>

            <div className="border rounded-b-md bg-white">
                {/* ── Filter Bar ── */}
                <div className="p-4 border-b bg-gray-50 flex flex-wrap gap-3 items-end">
                    {/* Section */}
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-600">
                            Section <span className="text-red-500">*</span>
                        </label>
                        <select
                            className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f4e5f] min-w-[160px]"
                            value={sectionId}
                            onChange={e => setSectionId(Number(e.target.value))}
                        >
                            <option value="">Select Section</option>
                            {sectionOptions.map(s => (
                                <option key={s.id} value={s.id}>{s.section}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={fetchMaterials}
                        disabled={!sectionId}
                        className="px-4 py-1.5 bg-[#1f4e5f] text-white text-sm rounded hover:bg-[#17404e] disabled:opacity-50 self-end"
                    >
                        Fetch Materials
                    </button>

                    {sectionOptions.length === 0 && (
                        <p className="text-xs text-amber-600 self-end">Loading sections...</p>
                    )}
                </div>

                <div className="p-4">
                    <DataTable
                        columnDefs={materialColumns}
                        rowData={materials}
                        pagination
                        pageSize={10}
                        showAddButton
                        showAddButtonName="Add Material"
                        addButtonHandler={openAdd}
                        showExportButton
                        showExportButtonName="Export"
                        showExportFileName="share_materials"
                    />
                </div>
            </div>

            {/* ═══ MODAL — Add / Edit ═══ */}
            {(modalMode === "add" || modalMode === "edit") && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
                        <div className="bg-[#1f4e5f] text-white px-4 py-3 rounded-t-lg flex justify-between items-center">
                            <span className="font-semibold text-sm">{modalMode === "add" ? "Add Material" : "Edit Material"}</span>
                            <button onClick={closeModal} className="text-white hover:opacity-75 text-xl leading-none">&times;</button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                                <input type="text" className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f4e5f]"
                                    placeholder="Enter material title" value={formTitle} onChange={e => setFormTitle(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea rows={3} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f4e5f] resize-none"
                                    placeholder="Optional description..." value={formDesc} onChange={e => setFormDesc(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {modalMode === "add" ? "Upload File " : "Replace File (optional) "}
                                    <span className="text-gray-400 text-xs">(pdf, doc, docx, ppt, pptx)</span>
                                    {modalMode === "add" && <span className="text-red-500"> *</span>}
                                </label>
                                <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx"
                                    className="w-full text-sm text-gray-600 border rounded px-3 py-2"
                                    onChange={e => setFormFile(e.target.files?.[0] || null)} />
                                {formFile && <p className="text-xs text-green-600 mt-1">Selected: {formFile.name}</p>}
                                {modalMode === "edit" && selectedMaterial && (
                                    <p className="text-xs text-gray-500 mt-1">Current file: {selectedMaterial.file_name}</p>
                                )}
                            </div>
                        </div>
                        <div className="px-5 py-3 bg-gray-50 rounded-b-lg flex justify-end gap-2">
                            <button onClick={closeModal} className="px-4 py-2 text-sm border rounded text-gray-600 hover:bg-gray-100">Cancel</button>
                            <button onClick={handleSave} disabled={saving || !formTitle.trim() || (modalMode === "add" && !formFile)}
                                className="px-4 py-2 text-sm bg-[#1f4e5f] text-white rounded hover:bg-[#17404e] disabled:opacity-50">
                                {saving ? "Saving..." : modalMode === "add" ? "Upload Material" : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ MODAL — Share ═══ */}
            {modalMode === "share" && selectedMaterial && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
                        <div className="bg-[#1f4e5f] text-white px-4 py-3 rounded-t-lg flex justify-between items-center">
                            <span className="font-semibold text-sm">Share — {selectedMaterial.document_name}</span>
                            <button onClick={closeModal} className="text-white hover:opacity-75 text-xl leading-none">&times;</button>
                        </div>
                        <div className="p-4">
                            {studentOptions.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-4">No students found for this section.</p>
                            ) : (
                                <>
                                    <div className="flex justify-between items-center mb-3">
                                        <p className="text-sm text-gray-600">{studentOptions.length} student(s) available</p>
                                        <button className="text-xs text-[#1f4e5f] underline"
                                            onClick={() => setSelectedUsns(selectedUsns.length === studentOptions.length ? [] : studentOptions.map(s => String(s.value)))}>
                                            {selectedUsns.length === studentOptions.length ? "Deselect All" : "Select All"}
                                        </button>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto border rounded divide-y">
                                        {studentOptions.map(s => (
                                            <label key={s.value} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                                                <input type="checkbox" checked={selectedUsns.includes(String(s.value))} onChange={() => toggleUsn(String(s.value))} className="rounded" />
                                                <span className="text-sm">{s.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                    {selectedUsns.length > 0 && <p className="text-xs text-green-600 mt-2">{selectedUsns.length} selected</p>}
                                </>
                            )}
                        </div>
                        <div className="px-4 py-3 bg-gray-50 rounded-b-lg flex justify-end gap-2">
                            <button onClick={closeModal} className="px-4 py-2 text-sm border rounded text-gray-600 hover:bg-gray-100">Cancel</button>
                            <button onClick={handleShare} disabled={sharing || selectedUsns.length === 0}
                                className="px-4 py-2 text-sm bg-[#1f4e5f] text-white rounded hover:bg-[#17404e] disabled:opacity-50">
                                {sharing ? "Sharing..." : `Share with ${selectedUsns.length} Student(s)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ MODAL — View Students ═══ */}
            {modalMode === "viewStudents" && selectedMaterial && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
                        <div className="bg-[#1f4e5f] text-white px-4 py-3 rounded-t-lg flex justify-between items-center">
                            <span className="font-semibold text-sm">Students — {selectedMaterial.document_name}</span>
                            <button onClick={closeModal} className="text-white hover:opacity-75 text-xl leading-none">&times;</button>
                        </div>
                        <div className="p-4">
                            {mappedStudents.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-4">No students have been shared this material yet.</p>
                            ) : (
                                <DataTable columnDefs={mappedStudentColumns} rowData={mappedStudents} pagination pageSize={10} />
                            )}
                        </div>
                        <div className="px-4 py-3 bg-gray-50 rounded-b-lg flex justify-end">
                            <button onClick={closeModal} className="px-4 py-2 text-sm border rounded text-gray-600 hover:bg-gray-100">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageShareMaterialsPage;
