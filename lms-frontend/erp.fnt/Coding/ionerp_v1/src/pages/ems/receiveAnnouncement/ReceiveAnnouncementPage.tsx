import React, { useMemo, useState, useEffect, useCallback } from "react";
import DataTable from "../../../components/Table/DataTable";
import axiosInstance from "../../../utils/api";
import { LocalStorageHelper } from "../../../utils/localStorageHelper";
import { loginData } from "../../login/loginModel";
import { toast } from "react-toastify";

// ─── API Base ─────────────────────────────────────────────────────────────────
// Backend endpoints (Malagouda's announcement.py):
// GET  /announcements/received/{user_id}          → fetch received announcements
// GET  /announcements/unseen-count/{user_id}       → get unseen count
// POST /announcements/mark-seen/{ann_id}/{user_id} → mark as seen

// ─── Types ────────────────────────────────────────────────────────────────────
interface Announcement {
    id: number;
    description: string;
    delivery_date: string | null;
    delivery_time: string | null;
    created_at: string;
    seen_flag: number;   // 0 = unread, 1 = read
    seen_on: string | null;
}

const TYPE_COLORS: Record<string, string> = {
    General: "bg-gray-100 text-gray-700 border-gray-300",
    Academic: "bg-blue-100 text-blue-700 border-blue-300",
    Exam: "bg-red-100 text-red-700 border-red-300",
    Holiday: "bg-green-100 text-green-700 border-green-300",
    Event: "bg-purple-100 text-purple-700 border-purple-300",
};

// ─── Helper ───────────────────────────────────────────────────────────────────
const formatDate = (val: string | null): string => {
    if (!val) return "—";
    const d = new Date(val);
    return isNaN(d.getTime())
        ? val
        : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

// ─── Component ────────────────────────────────────────────────────────────────
const ReceiveAnnouncementPage: React.FC = () => {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
    const [filter, setFilter] = useState<"All" | "Unread" | "Read">("All");
    const [markingId, setMarkingId] = useState<number | null>(null);

    // ── Get logged-in user ID from localStorage ──────────────────────────────
    const authState = LocalStorageHelper.getObject<loginData>("auth_state");
    const userId = (authState as any)?.user_id ?? (authState as any)?.id ?? null;

    // ── Fetch announcements from backend ─────────────────────────────────────
    const fetchAnnouncements = useCallback(async () => {
        if (!userId) {
            toast.error("User not logged in properly. Cannot fetch announcements.");
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const response = await axiosInstance.get<{
                data: Announcement[];
                status: boolean;
                message: string;
            }>(`/api/v1/announcements/announcements/received/${userId}`);

            const data: Announcement[] = response.data?.data ?? [];
            setAnnouncements(data);
        } catch (err: any) {
            const msg = err.response?.data?.message || err.message || "Failed to load announcements";
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchAnnouncements();
    }, [fetchAnnouncements]);

    // ── Mark single announcement as seen ─────────────────────────────────────
    const markAsSeen = useCallback(
        async (ann: Announcement) => {
            if (ann.seen_flag === 1) return; // already read
            if (!userId) return;
            try {
                setMarkingId(ann.id);
                await axiosInstance.post(
                    `/api/v1/announcements/announcements/mark-seen/${ann.id}/${userId}`
                );

                // Update local state immediately (optimistic update)
                setAnnouncements(prev =>
                    prev.map(a =>
                        a.id === ann.id
                            ? { ...a, seen_flag: 1, seen_on: new Date().toISOString() }
                            : a
                    )
                );

                if (selectedAnnouncement?.id === ann.id) {
                    setSelectedAnnouncement(prev =>
                        prev ? { ...prev, seen_flag: 1, seen_on: new Date().toISOString() } : null
                    );
                }

                toast.success("Marked as read");
            } catch (err: any) {
                toast.error(err.response?.data?.message || "Failed to mark as read");
            } finally {
                setMarkingId(null);
            }
        },
        [userId, selectedAnnouncement]
    );

    // ── Mark all as seen ──────────────────────────────────────────────────────
    const markAllSeen = useCallback(async () => {
        const unread = announcements.filter(a => a.seen_flag === 0);
        if (!unread.length || !userId) return;

        try {
            // Call mark-seen for each unread announcement sequentially
            for (const ann of unread) {
                await axiosInstance.post(
                    `/api/v1/announcements/announcements/mark-seen/${ann.id}/${userId}`
                );
            }

            setAnnouncements(prev =>
                prev.map(a => ({ ...a, seen_flag: 1, seen_on: a.seen_on ?? new Date().toISOString() }))
            );

            toast.success(`Marked ${unread.length} announcements as read`);
        } catch (err: any) {
            toast.error("Failed to mark all as read");
        }
    }, [announcements, userId]);

    // ── Open detail modal (auto-mark as seen) ────────────────────────────────
    const openDetail = useCallback(
        (ann: Announcement) => {
            setSelectedAnnouncement(ann);
            if (ann.seen_flag === 0) {
                markAsSeen(ann);
            }
        },
        [markAsSeen]
    );

    const unseenCount = announcements.filter(a => a.seen_flag === 0).length;

    const filteredData = announcements.filter(a => {
        if (filter === "Unread") return a.seen_flag === 0;
        if (filter === "Read") return a.seen_flag === 1;
        return true;
    });

    // ── Columns ───────────────────────────────────────────────────────────────
    const columns = useMemo(
        () => [
            {
                headerName: "Sl No.",
                valueGetter: (p: any) => p.node.rowIndex + 1,
                width: 80,
                flex: 0,
            },
            {
                headerName: "Status",
                field: "seen_flag",
                width: 90,
                flex: 0,
                cellRenderer: (p: any) =>
                    p.value === 1 ? (
                        <span className="text-xs text-gray-400 font-medium">Read</span>
                    ) : (
                        <span className="flex items-center gap-1 text-xs font-semibold text-blue-600">
                            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />New
                        </span>
                    ),
            },
            {
                headerName: "Description",
                field: "description",
                flex: 2,
                cellRenderer: (p: any) => (
                    <span
                        className={`text-sm cursor-pointer hover:underline ${
                            p.data.seen_flag === 0 ? "font-semibold text-gray-900" : "text-gray-600"
                        }`}
                        onClick={() => openDetail(p.data)}
                    >
                        {p.value?.length > 60 ? `${p.value.slice(0, 60)}...` : p.value}
                    </span>
                ),
            },
            {
                headerName: "Date",
                field: "created_at",
                width: 140,
                flex: 0,
                valueFormatter: (p: any) => formatDate(p.value),
            },
            {
                headerName: "Delivery Date",
                field: "delivery_date",
                width: 130,
                flex: 0,
                valueFormatter: (p: any) => (p.value ? formatDate(p.value) : "—"),
            },
            {
                headerName: "Actions",
                field: "action",
                width: 160,
                flex: 0,
                cellRenderer: (p: any) => (
                    <div className="flex gap-1 items-center h-full">
                        <button
                            onClick={() => openDetail(p.data)}
                            className="text-xs bg-[#1f4e5f] hover:bg-[#17404e] text-white px-2 py-1 rounded"
                        >
                            View
                        </button>
                        {p.data.seen_flag === 0 && (
                            <button
                                onClick={() => markAsSeen(p.data)}
                                disabled={markingId === p.data.id}
                                className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded disabled:opacity-50"
                            >
                                {markingId === p.data.id ? "..." : "Mark Read"}
                            </button>
                        )}
                    </div>
                ),
            },
        ],
        [announcements, markingId, openDetail, markAsSeen]
    );

    // ─── Render ───────────────────────────────────────────────────────────────
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

            <div className="relative z-10 space-y-6">
                {/* Premium Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-br from-indigo-50/90 to-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-sm border border-indigo-100/50">
                    <div>
                        <div className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                            <span>Home</span>
                            <span className="text-slate-300">/</span>
                            <span>LMS</span>
                            <span className="text-slate-300">/</span>
                            <span className="text-indigo-600">Receive Announcement</span>
                        </div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Announcements</h1>
                        <p className="text-slate-500 text-sm font-medium">
                            View received announcements and mark them as read.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {unseenCount > 0 && (
                            <span className="bg-red-500 text-white text-xs px-3 py-1 rounded-full font-bold shadow-sm">
                                {unseenCount} New
                            </span>
                        )}
                    </div>
                </div>

                <div className="bg-gradient-to-b from-slate-50/95 to-white/90 backdrop-blur-xl rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-200/50 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex flex-wrap gap-6 items-end">
                        {/* Filter bar */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filter</label>
                            <div className="flex gap-2 flex-wrap">
                                {(["All", "Unread", "Read"] as const).map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setFilter(f)}
                                        className={`text-sm px-4 py-1.5 rounded-full border font-medium transition-colors ${
                                            filter === f
                                                ? "bg-[#1f4e5f] text-white border-[#1f4e5f]"
                                                : "text-gray-500 border-gray-300 hover:border-[#1f4e5f] hover:text-[#1f4e5f]"
                                        }`}
                                    >
                                        {f}
                                        {f === "Unread" && unseenCount > 0 && (
                                            <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                                {unseenCount}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2 items-center">
                            <button
                                onClick={fetchAnnouncements}
                                className="text-sm text-gray-500 hover:text-[#1f4e5f] px-3 py-1 border rounded hover:border-[#1f4e5f]"
                            >
                                🔄 Refresh
                            </button>
                            {unseenCount > 0 && (
                                <button
                                    onClick={markAllSeen}
                                    className="text-sm text-[#1f4e5f] hover:underline font-medium"
                                >
                                    ✓ Mark all as read
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="p-6">
                        {/* Summary stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                            {[
                                { label: "Total", value: announcements.length, color: "bg-gray-50 border-gray-200 text-gray-700" },
                                { label: "Unread", value: unseenCount, color: "bg-blue-50 border-blue-200 text-blue-700" },
                                { label: "Read", value: announcements.length - unseenCount, color: "bg-green-50 border-green-200 text-green-700" },
                            ].map(s => (
                                <div
                                    key={s.label}
                                    className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${s.color}`}
                                >
                                    <span className="text-2xl font-bold">{s.value}</span>
                                    <span className="text-xs font-medium opacity-80">{s.label} Announcements</span>
                                </div>
                            ))}
                        </div>

                        {/* Loading state */}
                        {loading ? (
                            <div className="flex items-center justify-center py-20 text-gray-400">
                                <div className="text-center">
                                    <div className="animate-spin text-4xl mb-3">⏳</div>
                                    <p className="text-sm">Loading announcements...</p>
                                </div>
                            </div>
                        ) : filteredData.length === 0 ? (
                            <div className="text-center py-16 text-gray-400">
                                <div className="text-5xl mb-3">📭</div>
                                <p className="text-base font-medium">No announcements available</p>
                                <p className="text-sm mt-1">
                                    {filter !== "All"
                                        ? `No ${filter.toLowerCase()} announcements.`
                                        : "Check back later for updates."}
                                </p>
                            </div>
                        ) : (
                            <DataTable
                                columnDefs={columns}
                                rowData={filteredData}
                                pagination
                                pageSize={10}
                                showExportButton
                                showExportButtonName="Export"
                                showExportFileName="announcements"
                            />
                        )}

                        {/* No user ID warning */}
                        {!userId && !loading && (
                            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                                ⚠️ Could not determine your user ID from session. Please log out and log in again.
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══ MODAL — View Announcement Detail ═══ */}
                {selectedAnnouncement && (
                    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-slate-100">
                            {/* Header */}
                            <div className="bg-[#1f4e5f] text-white px-6 py-4 flex justify-between items-center">
                                <div className="flex-1 pr-3">
                                    <p className="font-semibold text-sm">Announcement Detail</p>
                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                        <span
                                            className={`text-[10px] px-2 py-0.5 rounded border font-medium ${TYPE_COLORS["General"]}`}
                                        >
                                            Announcement
                                        </span>
                                        <span className="text-xs opacity-70">{formatDate(selectedAnnouncement.created_at)}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedAnnouncement(null)}
                                    className="text-white hover:opacity-75 text-xl leading-none mt-0.5"
                                >
                                    &times;
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="bg-gray-50 rounded-2xl p-5 space-y-2">
                                    {[
                                        { label: "📅 Created On", value: formatDate(selectedAnnouncement.created_at) },
                                        { label: "📌 Delivery Date", value: formatDate(selectedAnnouncement.delivery_date) },
                                        { label: "⏰ Delivery Time", value: selectedAnnouncement.delivery_time || "—" },
                                        {
                                            label: "👁️ Status",
                                            value:
                                                selectedAnnouncement.seen_flag === 1
                                                    ? `Read on ${formatDate(selectedAnnouncement.seen_on)}`
                                                    : "Unread",
                                        },
                                    ].map(({ label, value }) => (
                                        <div key={label} className="flex items-start gap-3">
                                            <span className="text-xs text-gray-500 w-32 shrink-0">{label}</span>
                                            <span className="text-sm font-medium text-gray-800">{value}</span>
                                        </div>
                                    ))}
                                </div>

                                <div>
                                    <p className="text-xs font-medium text-gray-600 mb-2">📝 Message</p>
                                    <div className="bg-white border rounded-2xl p-5 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                        {selectedAnnouncement.description}
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 py-4 bg-slate-50 rounded-b-[2.5rem] flex justify-between items-center">
                                <div>
                                    {selectedAnnouncement.seen_flag === 0 && (
                                        <button
                                            onClick={() => markAsSeen(selectedAnnouncement)}
                                            disabled={markingId === selectedAnnouncement.id}
                                            className="text-sm bg-green-600 text-white px-5 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50"
                                        >
                                            {markingId === selectedAnnouncement.id ? "Marking..." : "✓ Mark as Read"}
                                        </button>
                                    )}
                                </div>

                                <button
                                    onClick={() => setSelectedAnnouncement(null)}
                                    className="px-4 py-2 text-sm border rounded-xl text-gray-600 hover:bg-gray-100"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReceiveAnnouncementPage;

