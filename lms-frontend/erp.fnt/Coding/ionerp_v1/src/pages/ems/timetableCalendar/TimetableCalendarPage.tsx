import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Copy,
  RotateCcw,
  Trash2,
  Calendar as CalendarIcon,
  X,
  AlertTriangle,
  Loader2,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import { ApiEndpoint } from "../../../utils/ApiEndpoint/emsapiEndpoint";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ScheduledClass {
  id: number;
  pgm_id: number;
  dept_id: number;
  academic_batch: string;
  semester: number;
  section: string;
  date: string; // "YYYY-MM-DD"
  start_time: string; // "08:30:00"
  end_time: string; // "09:30:00"
  crs_code: string;
  faculty_id: number;
  status: string;
  batch_name: string;
}

interface GridSlot {
  id: number;
  subject: string;
  time: string;
  status: string;
  batchName: string;
  startTime: string;
  endTime: string;
  date: string;
  section: string;
  rawClass: ScheduledClass;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const PERIODS = [
  { period: 1, start: "08:30", end: "09:30" },
  { period: 2, start: "09:30", end: "10:30" },
  { period: 3, start: "10:30", end: "11:30" },
  { period: 4, start: "11:30", end: "12:30" },
  { period: 5, start: "13:30", end: "14:30" },
  { period: 6, start: "14:30", end: "15:30" },
  { period: 7, start: "15:30", end: "16:30" },
];

const DAY_INDEX: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

// Normalise "08:30:00" → "08:30"
const toHHMM = (t: string) => t?.slice(0, 5) ?? "";

// Status → colour
const STATUS_COLORS: Record<string, string> = {
  active: "bg-blue-100 border-blue-400 text-blue-800",
  completed: "bg-green-100 border-green-400 text-green-800",
  cancelled: "bg-red-100 border-red-300 text-red-700",
  pending: "bg-yellow-100 border-yellow-400 text-yellow-800",
};
const slotColor = (status: string) =>
  STATUS_COLORS[status?.toLowerCase()] ??
  "bg-gray-100 border-gray-300 text-gray-700";

// ─── Component ────────────────────────────────────────────────────────────────
const TimetableCalendarPage: React.FC = () => {
  // ── Filters
  const [section, setSection] = useState<string>("A");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );

  // ── Data
  const [classes, setClasses] = useState<ScheduledClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Slot modal
  const [selectedSlot, setSelectedSlot] = useState<GridSlot | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>("");

  // ── Action modals
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Copy Day state
  const [copySourceDate, setCopySourceDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [copyTargetDate, setCopyTargetDate] = useState("");

  // Reset / Delete need a sem_time_table_id; use a text input for now
  const [semTimetableId, setSemTimetableId] = useState<string>("");

  // Action loading/message
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // ── Fetch scheduled classes
  const fetchClasses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { section };
      // Pass date only if the user picked one
      if (selectedDate) params.date = selectedDate;

      const res = await axios.get<ScheduledClass[]>(
        ApiEndpoint.timetable.scheduledClasses,
        { baseURL: "http://127.0.0.1:8000", params },
      );
      setClasses(res.data);
    } catch (err: any) {
      setError("Failed to load scheduled classes. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, [section, selectedDate]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  // ── Map classes → grid
  const getSlot = (day: string, period: number): GridSlot | null => {
    const p = PERIODS[period - 1];
    const match = classes.find((cls) => {
      const dow = new Date(cls.date).getDay();
      const dayName = DAY_INDEX[dow];
      return dayName === day && toHHMM(cls.start_time) === p.start;
    });
    if (!match) return null;
    return {
      id: match.id,
      subject: match.crs_code,
      time: `${toHHMM(match.start_time)} – ${toHHMM(match.end_time)}`,
      status: match.status,
      batchName: match.batch_name,
      startTime: match.start_time,
      endTime: match.end_time,
      date: match.date,
      section: match.section,
      rawClass: match,
    };
  };

  // ── Summary counts
  const totalClasses = classes.length;
  const uniqueDates = new Set(classes.map((c) => c.date)).size;
  const statusGroups = classes.reduce<Record<string, number>>((acc, c) => {
    const s = c.status?.toLowerCase() ?? "unknown";
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  // ─── Actions ────────────────────────────────────────────────────────────
  const handleCopyDay = async () => {
    setActionLoading(true);
    setActionMsg(null);
    try {
      await axios.post(ApiEndpoint.timetable.copyDay, null, {
        baseURL: "http://127.0.0.1:8000",
        params: {
          source_date: copySourceDate,
          target_date: copyTargetDate,
          section,
        },
      });
      setActionMsg(
        `✅ Successfully copied classes from ${copySourceDate} to ${copyTargetDate}`,
      );
      fetchClasses();
    } catch (e: any) {
      setActionMsg(`❌ ${e.response?.data?.detail ?? "Copy failed"}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetDates = async () => {
    if (!semTimetableId) {
      setActionMsg("❌ Please enter Timetable ID");
      return;
    }
    setActionLoading(true);
    setActionMsg(null);
    try {
      await axios.patch(
        `http://127.0.0.1:8000${ApiEndpoint.timetable.resetDates(Number(semTimetableId))}`,
      );
      setActionMsg("✅ Timetable dates reset successfully");
      fetchClasses();
    } catch (e: any) {
      setActionMsg(`❌ ${e.response?.data?.detail ?? "Reset failed"}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTimetable = async () => {
    if (!semTimetableId) {
      setActionMsg("❌ Please enter Timetable ID");
      return;
    }
    setActionLoading(true);
    setActionMsg(null);
    try {
      await axios.delete(
        `http://127.0.0.1:8000${ApiEndpoint.timetable.deleteTimetable(Number(semTimetableId))}`,
      );
      setActionMsg("✅ Timetable deleted successfully");
      setClasses([]);
      setIsDeleteModalOpen(false);
    } catch (e: any) {
      setActionMsg(`❌ ${e.response?.data?.detail ?? "Delete failed"}`);
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      {/* Header */}
      <div className="bg-[#1f4e5f] text-white px-4 py-2 rounded-t-md font-semibold text-sm flex items-center justify-between">
        <span>Timetable Calendar</span>
        <button
          onClick={fetchClasses}
          disabled={loading}
          title="Refresh"
          className="flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded transition"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      <div className="border rounded-b-md bg-white p-4">
        {/* ── Filters ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Section
            </label>
            <select
              className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1f4e5f]"
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              {["A", "B", "C", "D"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Date (filter by day)
            </label>
            <div className="relative">
              <CalendarIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="date"
                className="w-full border rounded pl-8 pr-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1f4e5f]"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Timetable ID (for reset/delete)
            </label>
            <input
              type="number"
              className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1f4e5f]"
              placeholder="e.g. 1"
              value={semTimetableId}
              onChange={(e) => setSemTimetableId(e.target.value)}
            />
          </div>
        </div>

        {/* ── Legend ── */}
        <div className="flex flex-wrap gap-3 mb-4">
          {Object.entries(STATUS_COLORS).map(([type, cls]) => (
            <div
              key={type}
              className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border ${cls}`}
            >
              <span className="w-2 h-2 rounded-full bg-current opacity-70"></span>
              <span className="capitalize">{type}</span>
            </div>
          ))}
          <span className="text-xs text-gray-400 ml-2 self-center">
            Click a slot for details
          </span>
        </div>

        {/* ── Action Toolbar ── */}
        <div className="flex flex-wrap items-center gap-2 mb-4 bg-gray-50 p-2 rounded-lg border border-gray-100">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-2 ml-1">
            Management Actions
          </span>
          {actionMsg && (
            <span
              className={`text-xs ml-2 ${actionMsg.startsWith("✅") ? "text-green-600" : "text-red-600"}`}
            >
              {actionMsg}
            </span>
          )}
        </div>

        {/* ── Loading / Error ── */}
        {loading && (
          <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading scheduled classes…</span>
          </div>
        )}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-12 text-red-500 gap-2">
            <WifiOff className="w-8 h-8" />
            <p className="text-sm font-medium">{error}</p>
            <button
              onClick={fetchClasses}
              className="mt-2 text-xs px-3 py-1.5 bg-red-50 border border-red-200 rounded text-red-600 hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Timetable Grid ── */}
        {!loading && !error && (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#1f4e5f] text-white">
                  <th className="border border-[#17404e] px-3 py-2.5 text-left font-semibold w-28">
                    Period / Day
                  </th>
                  {DAYS.map((day) => (
                    <th
                      key={day}
                      className="border border-[#17404e] px-2 py-2.5 text-center font-semibold min-w-[130px]"
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map(({ period, start, end }) => (
                  <tr
                    key={period}
                    className={period % 2 === 0 ? "bg-gray-50" : "bg-white"}
                  >
                    <td className="border border-gray-200 px-3 py-2 font-medium bg-gray-100 whitespace-nowrap">
                      <div className="font-semibold text-[#1f4e5f]">
                        P{period}
                      </div>
                      <div className="text-gray-400 text-[10px]">
                        {start} – {end}
                      </div>
                    </td>
                    {DAYS.map((day) => {
                      const slot = getSlot(day, period);
                      return (
                        <td key={day} className="border border-gray-200 p-1">
                          {slot ? (
                            <button
                              onClick={() => {
                                setSelectedSlot(slot);
                                setSelectedDay(day);
                              }}
                              className={`w-full text-left rounded border px-2 py-1.5 transition-all hover:shadow-sm hover:scale-[1.02] cursor-pointer ${slotColor(slot.status)}`}
                            >
                              <div className="font-semibold text-[11px] leading-tight truncate">
                                {slot.subject}
                              </div>
                              <div className="text-[10px] mt-0.5 opacity-70 truncate">
                                {slot.batchName}
                              </div>
                              <div className="text-[10px] opacity-60 capitalize">
                                {slot.status}
                              </div>
                            </button>
                          ) : (
                            <div className="w-full h-10 rounded border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center">
                              <span className="text-gray-300 text-[10px]">
                                Free
                              </span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && !error && classes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2 mt-4">
            <CalendarIcon className="w-10 h-10 opacity-30" />
            <p className="text-sm">
              No scheduled classes found for Section {section} on {selectedDate}
              .
            </p>
            <p className="text-xs">Try changing the date or section filter.</p>
          </div>
        )}

        {/* ── Summary Stats ── */}
        {!loading && !error && classes.length > 0 && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border px-4 py-3 bg-blue-50 border-blue-200 text-blue-700">
              <div className="text-xl font-bold">{totalClasses}</div>
              <div className="text-xs mt-0.5 opacity-80">Total Classes</div>
            </div>
            <div className="rounded-lg border px-4 py-3 bg-green-50 border-green-200 text-green-700">
              <div className="text-xl font-bold">
                {statusGroups["active"] ?? 0}
              </div>
              <div className="text-xs mt-0.5 opacity-80">Active</div>
            </div>
            <div className="rounded-lg border px-4 py-3 bg-yellow-50 border-yellow-200 text-yellow-700">
              <div className="text-xl font-bold">
                {statusGroups["pending"] ?? 0}
              </div>
              <div className="text-xs mt-0.5 opacity-80">Pending</div>
            </div>
            <div className="rounded-lg border px-4 py-3 bg-gray-50 border-gray-200 text-gray-500">
              <div className="text-xl font-bold">{uniqueDates}</div>
              <div className="text-xs mt-0.5 opacity-80">Days Scheduled</div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════
                MODAL — Slot Details
            ═══════════════════════════════════════════════ */}
      {selectedSlot && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div
              className={`px-4 py-3 rounded-t-lg flex justify-between items-center ${slotColor(selectedSlot.status)}`}
            >
              <div>
                <p className="font-semibold text-sm">{selectedSlot.subject}</p>
                <p className="text-xs opacity-80 capitalize">
                  {selectedSlot.status} — {selectedDay}
                </p>
              </div>
              <button
                onClick={() => setSelectedSlot(null)}
                className="text-current hover:opacity-75 text-xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                {[
                  { label: "📚 Course Code", value: selectedSlot.subject },
                  { label: "📅 Day", value: selectedDay },
                  { label: "📆 Date", value: selectedSlot.date },
                  {
                    label: "⏰ Start Time",
                    value: toHHMM(selectedSlot.startTime),
                  },
                  { label: "⏰ End Time", value: toHHMM(selectedSlot.endTime) },
                  { label: "👥 Batch", value: selectedSlot.batchName },
                  { label: "🔖 Section", value: selectedSlot.section },
                  { label: "✅ Status", value: selectedSlot.status },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-start gap-3">
                    <span className="text-xs text-gray-500 w-32 shrink-0">
                      {label}
                    </span>
                    <span className="text-sm font-medium text-gray-800 capitalize">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 py-3 bg-gray-50 rounded-b-lg flex justify-end">
              <button
                onClick={() => setSelectedSlot(null)}
                className="px-4 py-2 text-sm border rounded text-gray-600 hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
                MODAL — Copy Class Day
            ═══════════════════════════════════════════════ */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-blue-600 px-4 py-3 flex justify-between items-center text-white">
              <div className="flex items-center gap-2">
                <Copy className="w-4 h-4" />
                <h3 className="font-semibold text-sm">Copy Class Day</h3>
              </div>
              <button onClick={() => setIsCopyModalOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                  Source Date (copy FROM)
                </label>
                <input
                  type="date"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={copySourceDate}
                  onChange={(e) => setCopySourceDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                  Target Date (copy TO)
                </label>
                <input
                  type="date"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={copyTargetDate}
                  onChange={(e) => setCopyTargetDate(e.target.value)}
                />
              </div>
              {actionMsg && (
                <p
                  className={`text-xs ${actionMsg.startsWith("✅") ? "text-green-600" : "text-red-600"}`}
                >
                  {actionMsg}
                </p>
              )}
            </div>
            <div className="px-5 py-4 bg-gray-50 flex gap-2">
              <button
                onClick={() => setIsCopyModalOpen(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCopyDay}
                disabled={actionLoading || !copyTargetDate}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                Copy Day
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
                MODAL — Reset Timetable Dates
            ═══════════════════════════════════════════════ */}
      {isResetModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-orange-500 px-4 py-3 flex justify-between items-center text-white">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                <h3 className="font-semibold text-sm">Reset Timetable Dates</h3>
              </div>
              <button onClick={() => setIsResetModalOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-orange-50 p-3 rounded-lg flex gap-3 border border-orange-100">
                <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                <p className="text-xs text-orange-700 leading-relaxed">
                  This will clear all custom scheduled dates for Timetable ID:{" "}
                  <strong>{semTimetableId || "—"}</strong>. This cannot be
                  undone.
                </p>
              </div>
              {actionMsg && (
                <p
                  className={`text-xs ${actionMsg.startsWith("✅") ? "text-green-600" : "text-red-600"}`}
                >
                  {actionMsg}
                </p>
              )}
            </div>
            <div className="px-5 py-4 bg-gray-50 flex gap-2">
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-white"
              >
                Cancel
              </button>
              <button
                onClick={handleResetDates}
                disabled={actionLoading || !semTimetableId}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                Reset Dates
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
                MODAL — Delete Timetable
            ═══════════════════════════════════════════════ */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-red-50">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                Delete Timetable?
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                This will permanently delete Timetable ID{" "}
                <strong>{semTimetableId || "—"}</strong> and all its scheduled
                classes.
              </p>
              {actionMsg && (
                <p
                  className={`text-xs mt-3 ${actionMsg.startsWith("✅") ? "text-green-600" : "text-red-600"}`}
                >
                  {actionMsg}
                </p>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 flex gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-white"
              >
                No, Keep it
              </button>
              <button
                onClick={handleDeleteTimetable}
                disabled={actionLoading || !semTimetableId}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Yes, Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimetableCalendarPage;
