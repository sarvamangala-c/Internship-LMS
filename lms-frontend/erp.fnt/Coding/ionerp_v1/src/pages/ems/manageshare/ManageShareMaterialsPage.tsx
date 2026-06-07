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
            headerName: "Actions", field: "action", width: 320, flex: 0,
            cellRenderer: (params: any) => (
                <div className="flex gap-2 items-center h-full">
                    <button 
                        onClick={() => openEdit(params.data)} 
                        className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                        title="Edit Material"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button 
                        onClick={() => openShare(params.data)} 
                        className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                        title="Share with Students"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                    </button>
                    <button 
                        onClick={() => openViewStudents(params.data)} 
                        className="p-2 bg-teal-50 text-teal-600 rounded-xl hover:bg-teal-600 hover:text-white transition-all shadow-sm"
                        title="View Recipients"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    </button>
                    <button 
                        onClick={() => handleDownload(params.data)} 
                        className="p-2 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-600 hover:text-white transition-all shadow-sm"
                        title="Download Document"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </button>
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
        <div className="relative min-h-screen p-1">
            {/* Dynamic Mesh Background Layer - Increased Saturation */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-300/40 rounded-full blur-[140px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-200/50 rounded-full blur-[140px] animate-pulse" style={{ animationDelay: '2s' }} />
                <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-amber-100/60 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '4s' }} />
            </div>

            <div className="relative z-10 space-y-6">
                {/* Premium Header & Breadcrumbs - Added Indigo Gradient */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-br from-indigo-50/90 to-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-sm border border-indigo-100/50">
                <div>
                    <div className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                        <span>Home</span>
                        <span className="text-slate-300">/</span>
                        <span>LMS</span>
                        <span className="text-slate-300">/</span>
                        <span className="text-indigo-600">Share Materials</span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">Material Distribution</h1>
                    <p className="text-slate-500 text-sm font-medium">Manage and share academic resources with students.</p>
                </div>
                <button 
                    onClick={openAdd}
                    className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 transition-all active:scale-95"
                >
                    <span className="mr-2 text-lg">+</span> Upload Material
                </button>
            </div>

            {/* Insight Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Total Resources', value: materials.length, icon: '📚', color: 'indigo', status: 'Archive', gradient: 'from-indigo-50/95 to-white/70' },
                    { label: 'Active Sections', value: sectionOptions.length, icon: '🏢', color: 'emerald', status: 'Operational', gradient: 'from-emerald-50/95 to-white/70' },
                    { label: 'Global Reach', value: '450+', icon: '🌐', color: 'amber', status: 'Live', gradient: 'from-amber-50/95 to-white/70' }
                ].map((stat, i) => (
                    <div key={i} className={`bg-gradient-to-br ${stat.gradient} backdrop-blur-xl p-6 rounded-[2rem] shadow-sm border border-${stat.color}-200/60 relative overflow-hidden group hover:shadow-xl hover:shadow-${stat.color}-200/50 transition-all duration-500`}>
                        <div className={`absolute top-0 left-0 w-1.5 h-full bg-${stat.color}-500/60`} />
                        <div className={`absolute -right-4 -bottom-4 w-24 h-24 bg-${stat.color}-500/5 rounded-full blur-2xl group-hover:bg-${stat.color}-500/10 transition-colors duration-500`} />
                        
                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <span className={`text-2xl p-2 bg-${stat.color}-50 rounded-xl shadow-inner`}>{stat.icon}</span>
                            <span className={`text-[10px] font-black uppercase tracking-wider text-${stat.color}-600 bg-${stat.color}-50 px-2.5 py-1 rounded-lg`}>{stat.status}</span>
                        </div>
                        <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.25em] mb-1 relative z-10">{stat.label}</h3>
                        <p className="text-3xl font-black text-slate-900 tracking-tighter relative z-10">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="bg-gradient-to-b from-slate-50/95 to-white/90 backdrop-blur-xl rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-200/50 overflow-hidden">
                {/* ── Enhanced Filter Bar ── */}
                <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex flex-wrap gap-6 items-end">
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Target Section <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative group">
                            <select
                                className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none text-slate-800 text-sm font-bold cursor-pointer"
                                value={sectionId}
                                onChange={e => setSectionId(Number(e.target.value))}
                            >
                                <option value="">Select Section</option>
                                {sectionOptions.map(s => (
                                    <option key={s.id} value={s.id}>{s.section}</option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={fetchMaterials}
                        disabled={!sectionId}
                        className="px-8 py-2.5 bg-slate-800 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-900 shadow-md shadow-slate-200 disabled:opacity-50 transition-all active:scale-95"
                    >
                        Scan Materials
                    </button>
                </div>

                <div className="p-6">
                    <DataTable
                        columnDefs={materialColumns}
                        rowData={materials}
                        pagination
                        pageSize={10}
                        showAddButton={false}
                        showExportButton={true}
                        showExportButtonName="Export Archive"
                        showExportFileName="share_materials"
                    />
                </div>
            </div>

            {/* ═══ MODAL — Add / Edit ═══ */}
            {(modalMode === "add" || modalMode === "edit") && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-300">
                        <div className="bg-indigo-600 text-white px-8 py-6 flex justify-between items-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-indigo-600 to-indigo-500" />
                            <div className="relative z-10">
                                <span className="font-black text-xs uppercase tracking-widest opacity-75">Material Editor</span>
                                <h2 className="text-xl font-black tracking-tight">{modalMode === "add" ? "Upload New Content" : "Update Resource"}</h2>
                            </div>
                            <button onClick={closeModal} className="relative z-10 bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Document Title <span className="text-rose-500">*</span></label>
                                <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="e.g. Physics Module 1" value={formTitle} onChange={e => setFormTitle(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Brief Description</label>
                                <textarea rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                                    placeholder="Provide context for students..." value={formDesc} onChange={e => setFormDesc(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                                    {modalMode === "add" ? "Target File " : "Replacement File (Optional) "}
                                </label>
                                <div className="relative group">
                                    <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx"
                                        id="materialFile"
                                        className="hidden"
                                        onChange={e => setFormFile(e.target.files?.[0] || null)} />
                                    <label htmlFor="materialFile" className="flex items-center justify-between bg-slate-50 border-2 border-dashed border-slate-200 group-hover:border-indigo-400 group-hover:bg-indigo-50/30 rounded-2xl px-6 py-4 cursor-pointer transition-all">
                                        <div className="flex items-center space-x-3">
                                            <span className="text-2xl opacity-50">📄</span>
                                            <span className="text-xs font-bold text-slate-500 group-hover:text-indigo-600 truncate max-w-[200px]">
                                                {formFile ? formFile.name : "Select Document (PDF, Word, PPT)"}
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Browse</span>
                                    </label>
                                </div>
                                {modalMode === "edit" && selectedMaterial && !formFile && (
                                    <p className="text-[10px] font-bold text-slate-400 pl-1 italic">Current: {selectedMaterial.file_name}</p>
                                )}
                            </div>
                        </div>
                        <div className="px-8 py-6 bg-slate-50 flex justify-end gap-3">
                            <button onClick={closeModal} className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Cancel</button>
                            <button onClick={handleSave} disabled={saving || !formTitle.trim() || (modalMode === "add" && !formFile)}
                                className="px-8 py-2.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 disabled:opacity-50 transition-all active:scale-95">
                                {saving ? "Processing..." : modalMode === "add" ? "Launch Material" : "Update Resource"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ MODAL — Share ═══ */}
            {modalMode === "share" && selectedMaterial && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 animate-in fade-in slide-in-from-bottom-8 duration-300">
                        <div className="bg-emerald-600 text-white px-8 py-6 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-emerald-600 to-emerald-500" />
                            <div className="relative z-10 flex justify-between items-center">
                                <div>
                                    <span className="font-black text-xs uppercase tracking-widest opacity-75">Student Distribution</span>
                                    <h2 className="text-xl font-black tracking-tight line-clamp-1">{selectedMaterial.document_name}</h2>
                                </div>
                                <button onClick={closeModal} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                        <div className="p-8">
                            {studentOptions.length === 0 ? (
                                <div className="text-center py-12">
                                    <span className="text-4xl block mb-2 opacity-20">👤</span>
                                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No target students found</p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-between items-center mb-6">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{studentOptions.length} Potentials Identified</p>
                                        <button className="text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700"
                                            onClick={() => setSelectedUsns(selectedUsns.length === studentOptions.length ? [] : studentOptions.map(s => String(s.value)))}>
                                            {selectedUsns.length === studentOptions.length ? "Deselect All" : "Select All"}
                                        </button>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                        {studentOptions.map(s => (
                                            <label key={s.value} className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border ${selectedUsns.includes(String(s.value)) ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50/50 border-transparent hover:border-slate-200'}`}>
                                                <div className="flex items-center space-x-3">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${selectedUsns.includes(String(s.value)) ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                                        {s.label.charAt(0)}
                                                    </div>
                                                    <span className={`text-sm font-bold ${selectedUsns.includes(String(s.value)) ? 'text-emerald-900' : 'text-slate-600'}`}>{s.label}</span>
                                                </div>
                                                <input type="checkbox" checked={selectedUsns.includes(String(s.value))} onChange={() => toggleUsn(String(s.value))} className="hidden" />
                                                {selectedUsns.includes(String(s.value)) && <span className="text-emerald-600">✓</span>}
                                            </label>
                                        ))}
                                    </div>
                                    {selectedUsns.length > 0 && (
                                        <div className="mt-6 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                            <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest text-center">Ready to share with {selectedUsns.length} students</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="px-8 py-6 bg-slate-50 flex justify-end gap-3">
                            <button onClick={closeModal} className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Abort</button>
                            <button onClick={handleShare} disabled={sharing || selectedUsns.length === 0}
                                className="px-8 py-2.5 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-100 disabled:opacity-50 transition-all active:scale-95">
                                {sharing ? "Distributing..." : `Broadcast to Students`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ MODAL — View Students ═══ */}
            {modalMode === "viewStudents" && selectedMaterial && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100">
                        <div className="bg-slate-800 text-white px-8 py-6 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-slate-800 to-slate-700" />
                            <div className="relative z-10 flex justify-between items-center">
                                <div>
                                    <span className="font-black text-xs uppercase tracking-widest opacity-75">Distribution Audit</span>
                                    <h2 className="text-xl font-black tracking-tight line-clamp-1">{selectedMaterial.document_name}</h2>
                                </div>
                                <button onClick={closeModal} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                        <div className="p-8">
                            {mappedStudents.length === 0 ? (
                                <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-3xl">
                                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest italic">No active recipients recorded</p>
                                </div>
                            ) : (
                                <div className="rounded-3xl border border-slate-100 overflow-hidden shadow-inner bg-slate-50/50 p-2">
                                    <DataTable columnDefs={mappedStudentColumns} rowData={mappedStudents} pagination pageSize={10} />
                                </div>
                            )}
                        </div>
                        <div className="px-8 py-6 bg-slate-50 flex justify-end">
                            <button onClick={closeModal} className="px-8 py-2.5 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-900 transition-all active:scale-95">Close Audit</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
);
};

export default ManageShareMaterialsPage;
