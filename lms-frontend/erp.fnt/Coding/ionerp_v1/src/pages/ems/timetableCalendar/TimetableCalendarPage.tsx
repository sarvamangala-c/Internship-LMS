import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import timetableApi, { TimetableOptionItem } from "../../../api/timetableApi";

interface ScheduledClass {
  id: number;
  pgm_id: number;
  dept_id: number;
  academic_batch: string;
  semester: number;
  section: string;
  date: string;
  start_time: string;
  end_time: string;
  crs_code: string;
  faculty_id: number;
  status: string;
  batch_name: string;
  raw?: any;
}

const buttonClass =
  "text-xs font-semibold px-3 py-2 rounded border transition hover:border-slate-400 hover:bg-slate-50";
const selectedButtonClass =
  "text-xs font-semibold px-3 py-2 rounded border border-slate-500 bg-slate-100";

const toHHMM = (value: string) => value?.slice(0, 5) ?? "";

const parseSafeDate = (value: string | null | undefined): Date | null => {
  if (!value || !value.toString().trim()) {
    return null;
  }

  const parsed = parseISO(value.toString());
  return isValid(parsed) ? parsed : null;
};

const safeDate = (
  value: Date | null | undefined,
  fallback = new Date(),
): Date => (isValid(value) ? (value as Date) : fallback);

const safeFormat = (
  value: Date | null | undefined,
  fmt: string,
  fallback = "-",
) => {
  if (!value || !isValid(value)) return fallback;
  return format(value, fmt);
};

const normalizeApiDate = (value: string) => {
  const parsed = parseSafeDate(value);
  return parsed ? format(parsed, "yyyy-MM-dd") : "";
};

const TimetableCalendarPage: React.FC = () => {
  const [curriculums, setCurriculums] = useState<TimetableOptionItem[]>([]);
  const [terms, setTerms] = useState<TimetableOptionItem[]>([]);
  const [courseTypes, setCourseTypes] = useState<TimetableOptionItem[]>([]);
  const [courses, setCourses] = useState<TimetableOptionItem[]>([]);
  const [sections, setSections] = useState<TimetableOptionItem[]>([]);

  const [selectedCurriculum, setSelectedCurriculum] = useState<string>("");
  const [selectedTerm, setSelectedTerm] = useState<string>("");
  const [selectedCourseType, setSelectedCourseType] = useState<string>("");
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");

  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [calendarView, setCalendarView] = useState<"month" | "week" | "day">(
    "month",
  );

  const [classes, setClasses] = useState<ScheduledClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedEvent, setSelectedEvent] = useState<ScheduledClass | null>(
    null,
  );
  const [refreshing, setRefreshing] = useState(false);

  const normalizedCurriculumId = Number(selectedCurriculum) || undefined;
  const normalizedTermId = Number(selectedTerm) || undefined;
  const safeCalendarDate = safeDate(calendarDate);
  const selectedSectionLabel = selectedSection
    ? sections.find((item) => item.value === selectedSection)?.label?.trim() ||
      selectedSection
    : undefined;

  const activeEvents = useMemo(() => {
    if (!selectedCourse) return classes;

    const selectedValue = selectedCourse.trim().toLowerCase();
    return classes.filter((item) => {
      const code = String(
        item.crs_code ?? item.raw?.crs_code ?? item.raw?.course_code ?? "",
      )
        .trim()
        .toLowerCase();
      const courseId = String(
        item.raw?.crs_id ?? item.raw?.course_id ?? item.raw?.id ?? "",
      )
        .trim()
        .toLowerCase();

      return code === selectedValue || courseId === selectedValue;
    });
  }, [classes, selectedCourse]);

  const currentMonthLabel = safeFormat(
    safeCalendarDate,
    "MMMM yyyy",
    safeFormat(new Date(), "MMMM yyyy"),
  );
  const currentWeekLabel = `${safeFormat(
    startOfWeek(safeCalendarDate, { weekStartsOn: 1 }),
    "dd MMM",
    safeFormat(new Date(), "dd MMM"),
  )} — ${safeFormat(endOfWeek(safeCalendarDate, { weekStartsOn: 1 }), "dd MMM yyyy", safeFormat(new Date(), "dd MMM yyyy"))}`;
  const currentDayLabel = safeFormat(
    safeCalendarDate,
    "eeee, dd MMMM yyyy",
    "-",
  );

  const weekDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(safeCalendarDate, { weekStartsOn: 1 }),
        end: endOfWeek(safeCalendarDate, { weekStartsOn: 1 }),
      }),
    [safeCalendarDate],
  );

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(safeCalendarDate), {
      weekStartsOn: 1,
    });
    const end = endOfWeek(endOfMonth(safeCalendarDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [safeCalendarDate]);

  const dayEvents = useMemo(
    () =>
      activeEvents.filter((item) => {
        const itemDate = parseSafeDate(item.date);
        return itemDate ? isSameDay(itemDate, safeCalendarDate) : false;
      }),
    [activeEvents, safeCalendarDate],
  );

  const fetchCurriculums = useCallback(async () => {
    try {
      const response = await timetableApi.getCurriculums();
      if (response.success) {
        setCurriculums(response.data ?? []);
      } else {
        setError(response.message ?? "Unable to load curriculums.");
      }
    } catch {
      setError("Unable to load curriculums.");
    }
  }, []);

  const fetchTerms = useCallback(async (curriculumId?: number) => {
    if (!curriculumId) {
      setTerms([]);
      return;
    }

    try {
      const response = await timetableApi.getTerms(curriculumId);
      if (response.success) {
        setTerms(response.data ?? []);
      } else {
        setError(response.message ?? "Unable to load terms.");
      }
    } catch {
      setError("Unable to load terms.");
    }
  }, []);

  const fetchSections = useCallback(
    async (curriculumId?: number, termId?: number) => {
      if (!curriculumId || !termId) {
        setSections([]);
        return;
      }

      try {
        const response = await timetableApi.getSections(curriculumId, termId);
        if (response.success) {
          setSections(response.data ?? []);
        } else {
          setError(response.message ?? "Unable to load sections.");
        }
      } catch {
        setError("Unable to load sections.");
      }
    },
    [],
  );

  const fetchCourseTypes = useCallback(async () => {
    try {
      const response = await timetableApi.getCourseTypes();
      if (response.success) {
        setCourseTypes(response.data ?? []);
      } else {
        setError(response.message ?? "Unable to load course types.");
      }
    } catch {
      setError("Unable to load course types.");
    }
  }, []);

  const fetchCourses = useCallback(async () => {
    if (!normalizedCurriculumId || !normalizedTermId || !selectedCourseType) {
      setCourses([]);
      return;
    }

    try {
      const response = await timetableApi.getCourses({
        academic_batch_id: normalizedCurriculumId,
        semester: normalizedTermId,
        course_type_id: Number(selectedCourseType),
      });
      if (response.success) {
        setCourses(response.data ?? []);
      } else {
        setError(response.message ?? "Unable to load courses.");
      }
    } catch {
      setError("Unable to load courses.");
    }
  }, [normalizedCurriculumId, normalizedTermId, selectedCourseType]);

  const fetchScheduledClasses = useCallback(async () => {
    if (!normalizedCurriculumId || !normalizedTermId) {
      setClasses([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const rangeStart =
        calendarView === "day"
          ? format(safeCalendarDate, "yyyy-MM-dd")
          : calendarView === "week"
            ? format(
                startOfWeek(safeCalendarDate, { weekStartsOn: 1 }),
                "yyyy-MM-dd",
              )
            : format(startOfMonth(safeCalendarDate), "yyyy-MM-dd");
      const rangeEnd =
        calendarView === "day"
          ? format(safeCalendarDate, "yyyy-MM-dd")
          : calendarView === "week"
            ? format(
                endOfWeek(safeCalendarDate, { weekStartsOn: 1 }),
                "yyyy-MM-dd",
              )
            : format(endOfMonth(safeCalendarDate), "yyyy-MM-dd");

      const response = await timetableApi.getScheduledClasses({
        academic_batch_id: normalizedCurriculumId,
        crclm_term_id: normalizedTermId,
        section: selectedSectionLabel || undefined,
        startDate: rangeStart,
        endDate: rangeEnd,
      });

      if (response.success) {
        setClasses(response.data ?? []);
      } else {
        setError(response.message ?? "Unable to load scheduled classes.");
        setClasses([]);
      }
    } catch {
      setError("Unable to load scheduled classes.");
      setClasses([]);
    } finally {
      setLoading(false);
    }
  }, [
    normalizedCurriculumId,
    normalizedTermId,
    selectedSection,
    calendarDate,
    calendarView,
  ]);

  useEffect(() => {
    fetchCurriculums();
    fetchCourseTypes();
  }, [fetchCurriculums, fetchCourseTypes]);

  useEffect(() => {
    if (curriculums.length > 0 && !selectedCurriculum) {
      setSelectedCurriculum(curriculums[0].value);
    }
  }, [curriculums, selectedCurriculum]);

  useEffect(() => {
    if (selectedCurriculum) {
      const curriculumId = Number(selectedCurriculum);
      fetchTerms(curriculumId);
      setSelectedTerm("");
      setSelectedSection("");
      setSelectedCourseType("");
      setSelectedCourse("");
      setSections([]);
      setCourses([]);
    } else {
      setTerms([]);
      setSections([]);
      setCourses([]);
    }
  }, [selectedCurriculum, fetchTerms]);

  useEffect(() => {
    if (selectedCurriculum && selectedTerm) {
      const curriculumId = Number(selectedCurriculum);
      const termId = Number(selectedTerm);
      fetchSections(curriculumId, termId);
    } else {
      setSections([]);
      setSelectedSection("");
    }
  }, [selectedCurriculum, selectedTerm, fetchSections]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    fetchScheduledClasses();
  }, [fetchScheduledClasses]);

  const hasViewControl = (view: "month" | "week" | "day") =>
    calendarView === view ? selectedButtonClass : buttonClass;

  const getEventTitle = (item: ScheduledClass) =>
    String(item.crs_code ?? item.raw?.crs_code ?? "Unknown course");

  const getEventSubtitle = (item: ScheduledClass) => {
    const batch =
      item.batch_name || item.academic_batch || item.raw?.batch_name;
    const sectionName =
      item.section || item.raw?.section || item.raw?.section_name;
    return [batch, sectionName].filter(Boolean).join(" • ");
  };

  const gridEventsByDay = useMemo(() => {
    return activeEvents.reduce<Record<string, ScheduledClass[]>>(
      (acc, item) => {
        const parsedDate = parseSafeDate(item.date);
        if (!parsedDate) return acc;
        const day = format(parsedDate, "yyyy-MM-dd");
        acc[day] = [...(acc[day] || []), item];
        return acc;
      },
      {},
    );
  }, [activeEvents]);

  const moveCalendar = (direction: "prev" | "next") => {
    setCalendarDate((current) => {
      if (calendarView === "month") {
        return direction === "prev"
          ? subMonths(current, 1)
          : addMonths(current, 1);
      }
      if (calendarView === "week") {
        return direction === "prev"
          ? subWeeks(current, 1)
          : addWeeks(current, 1);
      }
      return direction === "prev" ? subDays(current, 1) : addDays(current, 1);
    });
  };

  const refreshCalendar = async () => {
    setRefreshing(true);
    await fetchScheduledClasses();
    setRefreshing(false);
  };

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Timetable Calendar
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            View scheduled classes by curriculum, term, course and section.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshCalendar}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">
                Curriculum
              </label>
              <select
                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                value={selectedCurriculum}
                onChange={(event) => setSelectedCurriculum(event.target.value)}
              >
                <option value="">Select curriculum</option>
                {curriculums.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">
                Term / Semester
              </label>
              <select
                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                value={selectedTerm}
                onChange={(event) => setSelectedTerm(event.target.value)}
                disabled={!selectedCurriculum || terms.length === 0}
              >
                <option value="">Select term</option>
                {terms.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">
                Section
              </label>
              <select
                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                value={selectedSection}
                onChange={(event) => setSelectedSection(event.target.value)}
                disabled={!selectedTerm || sections.length === 0}
              >
                <option value="">All sections</option>
                {sections.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">
                Course Type
              </label>
              <select
                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                value={selectedCourseType}
                onChange={(event) => {
                  setSelectedCourseType(event.target.value);
                  setSelectedCourse("");
                }}
                disabled={!courseTypes.length}
              >
                <option value="">Select course type</option>
                {courseTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">
                Course
              </label>
              <select
                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                value={selectedCourse}
                onChange={(event) => setSelectedCourse(event.target.value)}
                disabled={!selectedCourseType || courses.length === 0}
              >
                <option value="">All courses</option>
                {courses.map((item) => {
                  const optionValue = String(
                    item.raw?.crs_code ?? item.raw?.course_code ?? item.value,
                  );
                  return (
                    <option
                      key={`${item.value}-${optionValue}`}
                      value={optionValue}
                    >
                      {item.label}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">
                Date
              </label>
              <input
                type="date"
                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                value={safeFormat(
                  safeCalendarDate,
                  "yyyy-MM-dd",
                  safeFormat(new Date(), "yyyy-MM-dd"),
                )}
                onChange={(event) =>
                  setCalendarDate(
                    parseSafeDate(event.target.value) ?? new Date(),
                  )
                }
              />
            </div>
          </div>
        </section>

        <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Calendar view
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">
                {calendarView === "month"
                  ? currentMonthLabel
                  : calendarView === "week"
                    ? currentWeekLabel
                    : currentDayLabel}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                className={buttonClass}
                type="button"
                onClick={() => moveCalendar("prev")}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                className={buttonClass}
                type="button"
                onClick={() => moveCalendar("next")}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={hasViewControl("month")}
              onClick={() => setCalendarView("month")}
            >
              Month
            </button>
            <button
              type="button"
              className={hasViewControl("week")}
              onClick={() => setCalendarView("week")}
            >
              Week
            </button>
            <button
              type="button"
              className={hasViewControl("day")}
              onClick={() => setCalendarView("day")}
            >
              Day
            </button>
          </div>

          <div className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>Events</span>
              <span className="font-semibold text-slate-900">
                {activeEvents.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Courses</span>
              <span className="font-semibold text-slate-900">
                {new Set(activeEvents.map((item) => item.crs_code)).size}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Sections</span>
              <span className="font-semibold text-slate-900">
                {new Set(activeEvents.map((item) => item.section)).size}
              </span>
            </div>
          </div>
        </aside>
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-5">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Calendar timeline
            </p>
            <p className="text-xs text-slate-500">
              Filtered by curriculum, term, section and course.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              onClick={refreshCalendar}
            >
              Refresh schedule
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center text-slate-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading classes...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            <p className="font-semibold">Unable to load timetable.</p>
            <p>{error}</p>
          </div>
        ) : !selectedCurriculum || !selectedTerm ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            Select a curriculum and term to see the calendar.
          </div>
        ) : activeEvents.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            No scheduled classes found for this selection.
          </div>
        ) : (
          <div className="space-y-4">
            {calendarView === "month" && (
              <div className="grid grid-cols-7 gap-px rounded-xl bg-slate-200 text-[11px]">
                {weekDays.map((date) => (
                  <div
                    key={date.toISOString()}
                    className="bg-slate-900 px-2 py-3 text-center text-white"
                  >
                    {format(date, "EEE")}
                  </div>
                ))}
                {monthDays.map((date) => {
                  const dateKey = format(date, "yyyy-MM-dd");
                  const events = gridEventsByDay[dateKey] ?? [];
                  const isCurrentMonth = isSameMonth(date, safeCalendarDate);
                  return (
                    <div
                      key={dateKey}
                      className={`min-h-[120px] overflow-hidden rounded-tl-md bg-white p-3 text-[13px] ${isCurrentMonth ? "" : "bg-slate-50 text-slate-400"}`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-semibold">
                          {format(date, "d")}
                        </span>
                        {isSameDay(date, new Date()) && (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                            Today
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {events.slice(0, 3).map((item) => (
                          <button
                            key={`event-${item.id}`}
                            type="button"
                            onClick={() => setSelectedEvent(item)}
                            className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-left text-[11px] hover:bg-slate-100"
                          >
                            <div className="font-semibold text-slate-900 truncate">
                              {getEventTitle(item)}
                            </div>
                            <div className="truncate text-slate-500">
                              {toHHMM(item.start_time)} —{" "}
                              {toHHMM(item.end_time)}
                            </div>
                          </button>
                        ))}
                        {events.length > 3 && (
                          <div className="text-xs text-slate-500">
                            +{events.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {calendarView === "week" && (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <div className="min-w-[740px]">
                  <div className="grid grid-cols-7 gap-px rounded-t-xl bg-slate-200 text-[12px]">
                    {weekDays.map((date) => (
                      <div
                        key={date.toISOString()}
                        className="bg-slate-900 px-3 py-3 text-white"
                      >
                        <div className="text-xs uppercase tracking-[0.15em] text-slate-300">
                          {format(date, "EEE")}
                        </div>
                        <div className="mt-2 font-semibold">
                          {format(date, "d MMM")}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-px bg-slate-200">
                    {weekDays.map((date) => {
                      const eventList =
                        gridEventsByDay[format(date, "yyyy-MM-dd")] ?? [];
                      return (
                        <div
                          key={date.toISOString()}
                          className="min-h-[260px] bg-white p-3"
                        >
                          <div className="space-y-3">
                            {eventList.map((item) => (
                              <button
                                key={`week-event-${item.id}`}
                                type="button"
                                onClick={() => setSelectedEvent(item)}
                                className="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left text-sm hover:border-slate-300"
                              >
                                <div className="font-semibold text-slate-900 truncate">
                                  {getEventTitle(item)}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {toHHMM(item.start_time)} —{" "}
                                  {toHHMM(item.end_time)}
                                </div>
                                <div className="mt-2 text-xs text-slate-500 truncate">
                                  {getEventSubtitle(item)}
                                </div>
                              </button>
                            ))}
                            {eventList.length === 0 && (
                              <div className="text-xs text-slate-400">
                                No classes
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {calendarView === "day" && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {currentDayLabel}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {dayEvents.length} classes scheduled
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  {dayEvents.map((item) => (
                    <button
                      key={`day-event-${item.id}`}
                      type="button"
                      onClick={() => setSelectedEvent(item)}
                      className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-slate-300"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {getEventTitle(item)}
                          </div>
                          <div className="mt-1 text-sm text-slate-500">
                            {getEventSubtitle(item)}
                          </div>
                        </div>
                        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                          {toHHMM(item.start_time)} — {toHHMM(item.end_time)}
                        </div>
                      </div>
                    </button>
                  ))}
                  {dayEvents.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                      No classes scheduled for this day.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-100 px-6 py-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {getEventTitle(selectedEvent)}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {getEventSubtitle(selectedEvent)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="text-slate-500 transition hover:text-slate-900"
              >
                Close
              </button>
            </div>
            <div className="space-y-4 p-6">
              {[
                { label: "Course", value: getEventTitle(selectedEvent) },
                {
                  label: "Section",
                  value:
                    selectedEvent.section || selectedEvent.raw?.section || "-",
                },
                {
                  label: "Batch",
                  value:
                    selectedEvent.batch_name ||
                    selectedEvent.academic_batch ||
                    "-",
                },
                { label: "Date", value: normalizeApiDate(selectedEvent.date) },
                {
                  label: "Time",
                  value: `${toHHMM(selectedEvent.start_time)} — ${toHHMM(selectedEvent.end_time)}`,
                },
                { label: "Status", value: selectedEvent.status || "-" },
              ].map((item) => (
                <div key={item.label} className="grid gap-1 text-sm">
                  <span className="text-xs uppercase tracking-[0.15em] text-slate-400">
                    {item.label}
                  </span>
                  <span className="font-medium text-slate-800">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimetableCalendarPage;
