import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import ScheduleClassModal from "./ScheduleClassModal";
import { scheduleClassApi } from "../../../../api/scheduleClassApi";
import {
  timetableApi,
  TimetableOptionItem,
} from "../../../../api/timetableApi";
import { LocalStorageHelper } from "../../../../utils/localStorageHelper";

type DayName =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

const DAY_NAMES: DayName[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const DAY_INDEX: Record<DayName, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const NEW_TIMETABLE_OPTION: TimetableOptionItem = {
  value: "new",
  label: "New Timetable",
  raw: { isNew: true },
};

interface SelectedSectionState {
  value: string;
  label: string;
  sectionId: string;
  raw: any | null;
}

const EMPTY_SELECTED_SECTION: SelectedSectionState = {
  value: "",
  label: "",
  sectionId: "",
  raw: null,
};

const doesSectionOptionMatch = (
  option: TimetableOptionItem,
  sectionValue: string,
) => {
  const normalizedSection = String(sectionValue || "")
    .trim()
    .toUpperCase();

  if (!normalizedSection) {
    return false;
  }

  const optionValues = [
    option?.value,
    option?.label,
    option?.raw?.section,
    option?.raw?.section_name,
    option?.raw?.section_label,
    option?.raw?.section_id,
    option?.raw?.batch_section_id,
    option?.raw?.sectionId,
    option?.raw?.id,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toUpperCase());

  return optionValues.includes(normalizedSection);
};

const doesOptionMatch = (
  option: TimetableOptionItem | undefined,
  selectedValue: string,
  additionalValues: Array<unknown> = [],
) => {
  const normalizedSelectedValue = String(selectedValue || "")
    .trim()
    .toUpperCase();

  if (!option || !normalizedSelectedValue) {
    return false;
  }

  const candidateValues = [option.value, option.label, ...additionalValues]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .map((value) => String(value).trim().toUpperCase());

  return candidateValues.includes(normalizedSelectedValue);
};

const resolveSemesterFromTerm = (termId: string, rawTerm?: any) => {
  const explicitSemester = Number(
    rawTerm?.semester ?? rawTerm?.term_name ?? rawTerm?.semester_id,
  );

  if (
    Number.isFinite(explicitSemester) &&
    explicitSemester > 0 &&
    explicitSemester < 100
  ) {
    return explicitSemester;
  }

  const numericTermId = Number(termId);
  if (!Number.isFinite(numericTermId) || numericTermId <= 0) {
    return 0;
  }

  return numericTermId >= 100 ? numericTermId - 100 : numericTermId;
};

const getNumericId = (...values: Array<unknown>) => {
  for (const value of values) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      return numericValue;
    }
  }

  return null;
};

const getFirstPlanDateForDay = (
  rangeStart: string,
  rangeEnd: string,
  dayName: DayName,
) => {
  if (!rangeStart || !rangeEnd) {
    return null;
  }

  const start = new Date(`${rangeStart}T00:00:00`);
  const end = new Date(`${rangeEnd}T00:00:00`);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start > end
  ) {
    return null;
  }

  const planDate = new Date(start);
  const targetDayIndex = DAY_INDEX[dayName];
  const dayOffset = (targetDayIndex - planDate.getDay() + 7) % 7;
  planDate.setDate(planDate.getDate() + dayOffset);

  if (planDate > end) {
    return null;
  }

  const year = planDate.getFullYear();
  const month = String(planDate.getMonth() + 1).padStart(2, "0");
  const day = String(planDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const TimetableListPage: React.FC = () => {
  const [curriculums, setCurriculums] = useState<TimetableOptionItem[]>([]);
  const [terms, setTerms] = useState<TimetableOptionItem[]>([]);
  const [sections, setSections] = useState<TimetableOptionItem[]>([]);
  const [timetables, setTimetables] = useState<TimetableOptionItem[]>([
    NEW_TIMETABLE_OPTION,
  ]);
  const [scheduledClasses, setScheduledClasses] = useState<any[]>([]);

  const [selectedCurriculum, setSelectedCurriculum] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedSectionState, setSelectedSectionState] =
    useState<SelectedSectionState>(EMPTY_SELECTED_SECTION);
  const [selectedTimetable, setSelectedTimetable] = useState("new");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [method, setMethod] = useState("Regular");

  const [isPageLoading, setIsPageLoading] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [loadingState, setLoadingState] = useState({
    curriculums: false,
    terms: false,
    sections: false,
    timetables: false,
  });
  const authState = LocalStorageHelper.getObject<any>("auth_state");
  const createdBy = getNumericId(authState?.user_id, authState?.id, 1) ?? 1;
  const selectedCurriculumOption = curriculums.find((curriculum) =>
    doesOptionMatch(curriculum, selectedCurriculum, [
      curriculum?.raw?.academic_batch_id,
      curriculum?.raw?.crclm_id,
      curriculum?.raw?.id,
    ]),
  );
  const selectedTermOption = terms.find((term) =>
    doesOptionMatch(term, selectedTerm, [
      term?.raw?.crclm_term_id,
      term?.raw?.semester_id,
      term?.raw?.id,
      term?.raw?.semester,
      term?.raw?.term_name,
    ]),
  );
  const selectedSectionOption = sections.find(
    (section) =>
      doesOptionMatch(section, selectedSection, [
        section?.raw?.section,
        section?.raw?.section_name,
        section?.raw?.section_label,
        section?.raw?.section_id,
        section?.raw?.batch_section_id,
        section?.raw?.sectionId,
        section?.raw?.id,
      ]) || doesSectionOptionMatch(section, selectedSection),
  );
  const selectedCurriculumId =
    getNumericId(
      selectedCurriculumOption?.raw?.academic_batch_id,
      selectedCurriculumOption?.raw?.crclm_id,
      selectedCurriculumOption?.raw?.id,
      selectedCurriculum,
    ) ?? 0;
  const selectedCrclmTermId =
    getNumericId(
      selectedTermOption?.raw?.crclm_term_id,
      selectedTermOption?.raw?.id,
      selectedTermOption?.raw?.semester_id,
      selectedTerm,
    ) ?? 0;
  const selectedSemesterId =
    getNumericId(
      selectedTermOption?.raw?.semester_id,
      selectedTermOption?.raw?.semester,
      selectedTermOption?.raw?.term_name,
      resolveSemesterFromTerm(selectedTerm, selectedTermOption?.raw),
    ) ?? 0;
  const selectedSectionId =
    getNumericId(
      selectedSectionState.sectionId,
      selectedSectionState.raw?.section_id,
      selectedSectionState.raw?.batch_section_id,
      selectedSectionState.raw?.id,
      selectedSectionOption?.raw?.section_id,
      selectedSectionOption?.raw?.batch_section_id,
      selectedSectionOption?.raw?.sectionId,
      selectedSectionOption?.raw?.id,
      selectedSectionOption?.value,
      selectedSection,
    ) ?? 0;
  const selectedTermRequestId =
    getNumericId(selectedCrclmTermId, selectedSemesterId, selectedTerm) ?? 0;
  const selectedSectionLabel =
    selectedSectionState.label ||
    selectedSectionOption?.label ||
    selectedSectionOption?.raw?.section ||
    selectedSectionOption?.raw?.section_name ||
    selectedSectionOption?.raw?.section_label ||
    selectedSection;
  const selectedCurriculumLabel =
    selectedCurriculumOption?.label ||
    selectedCurriculumOption?.raw?.curriculum_name ||
    selectedCurriculumOption?.raw?.academic_batch_desc ||
    selectedCurriculum;
  const selectedTermLabel =
    selectedTermOption?.label ||
    selectedTermOption?.raw?.term_name ||
    selectedTermOption?.raw?.semester_desc ||
    selectedTerm;
  const resolvedTermName =
    selectedSemesterId ||
    resolveSemesterFromTerm(selectedTerm, selectedTermOption?.raw);
  const selectedSectionValue = selectedSection.trim() || undefined;
  const selectedSectionRequestValue =
    (selectedSectionId ? String(selectedSectionId) : "") ||
    selectedSectionValue;
  const sectionLabelForScheduledClasses =
    selectedSectionLabel?.trim() || selectedSectionValue;
  const scheduledClassesQuery = useMemo(
    () => ({
      academic_batch_id: selectedCurriculumId || undefined,
      crclm_term_id: selectedTermRequestId || undefined,
      section: sectionLabelForScheduledClasses || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    [
      endDate,
      selectedCurriculumId,
      sectionLabelForScheduledClasses,
      selectedTermRequestId,
      startDate,
    ],
  );

  const formatDateForApi = (dateValue: string): string | undefined => {
    const trimmed = dateValue?.trim();
    if (!trimmed) {
      return undefined;
    }

    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return trimmed;
    }

    const dmyMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (dmyMatch) {
      const [, dd, mm, yyyy] = dmyMatch;
      return `${yyyy}-${mm}-${dd}`;
    }

    return undefined;
  };

  const syncSelectedSectionState = (
    sectionValue: string,
    options: TimetableOptionItem[],
  ) => {
    const matchedOption = options.find((option) =>
      doesSectionOptionMatch(option, sectionValue),
    );

    if (!matchedOption) {
      console.log("[TimetablePage] selected dropdown option on change", {
        selectedValue: sectionValue || null,
        selectedOption: null,
      });
      setSelectedSectionState(EMPTY_SELECTED_SECTION);
      return null;
    }

    const resolvedSectionId =
      getNumericId(
        matchedOption.raw?.section_id,
        matchedOption.raw?.batch_section_id,
        matchedOption.raw?.sectionId,
        matchedOption.raw?.id,
        matchedOption.value,
      ) ?? "";

    const nextState: SelectedSectionState = {
      value: matchedOption.value,
      label:
        matchedOption.raw?.section_label ||
        matchedOption.raw?.section_name ||
        matchedOption.raw?.section ||
        matchedOption.label,
      sectionId: resolvedSectionId ? String(resolvedSectionId) : "",
      raw: matchedOption.raw,
    };

    console.log("[TimetablePage] selected dropdown option on change", {
      selectedValue: sectionValue,
      selectedOption: nextState,
    });
    setSelectedSectionState(nextState);
    return nextState;
  };

  useEffect(() => {
    const loadCurriculums = async () => {
      setLoadingState((current) => ({ ...current, curriculums: true }));
      const response = await timetableApi.getCurriculums();
      setCurriculums((response.data as TimetableOptionItem[]) || []);
      setLoadingState((current) => ({ ...current, curriculums: false }));
    };

    loadCurriculums();
  }, []);

  useEffect(() => {
    console.log(
      "[TimetablePage] Selected section:",
      selectedSectionValue ?? "<empty>",
    );
  }, [selectedSectionValue]);

  useEffect(() => {
    if (!selectedSection) {
      setSelectedSectionState(EMPTY_SELECTED_SECTION);
      return;
    }

    syncSelectedSectionState(selectedSection, sections);
  }, [sections, selectedSection]);

  useEffect(() => {
    if (!selectedCurriculum) {
      console.log("[TimetablePage] resetting section", {
        reason: "curriculum changed or cleared",
        selectedSection,
        nextOptions: [],
      });
      setTerms([]);
      setSelectedTerm("");
      setSections([]);
      setSelectedSection("");
      setSelectedSectionState(EMPTY_SELECTED_SECTION);
      setTimetables([NEW_TIMETABLE_OPTION]);
      setSelectedTimetable("new");
      return;
    }

    const loadTerms = async () => {
      setLoadingState((current) => ({ ...current, terms: true }));
      const response = await timetableApi.getTerms(Number(selectedCurriculum));
      const termOptions = (response.data as TimetableOptionItem[]) || [];
      console.log("[TimetablePage] transformed term options", termOptions);
      setTerms(termOptions);
      setLoadingState((current) => ({ ...current, terms: false }));
    };

    console.log("[TimetablePage] resetting section", {
      reason: "curriculum changed",
      selectedSection,
      nextOptions: [],
    });
    setSelectedTerm("");
    setSections([]);
    setSelectedSection("");
    setSelectedSectionState(EMPTY_SELECTED_SECTION);
    setTimetables([NEW_TIMETABLE_OPTION]);
    setSelectedTimetable("new");
    loadTerms();
  }, [selectedCurriculum]);

  useEffect(() => {
    if (!selectedCurriculum || !selectedTerm) {
      console.log("[TimetablePage] resetting section", {
        reason: !selectedCurriculum
          ? "curriculum missing"
          : "term changed or cleared",
        selectedSection,
        nextOptions: [],
      });
      setSections([]);
      setSelectedSection("");
      setSelectedSectionState(EMPTY_SELECTED_SECTION);
      setTimetables([NEW_TIMETABLE_OPTION]);
      setSelectedTimetable("new");
      return;
    }

    const loadSections = async () => {
      setLoadingState((current) => ({ ...current, sections: true }));
      const response = await timetableApi.getSections(
        Number(selectedCurriculum),
        resolvedTermName,
      );
      const sectionOptions = (response.data as TimetableOptionItem[]) || [];
      console.log(
        "[TimetablePage] transformed section options",
        sectionOptions,
      );
      setSections(sectionOptions);

      console.log("[TimetablePage] section preservation check", {
        selectedSection,
        newOptions: sectionOptions,
      });

      const hasMatchingSection = sectionOptions.some((option) =>
        doesSectionOptionMatch(option, selectedSection),
      );
      if (selectedSection && !hasMatchingSection) {
        console.log("[TimetablePage] resetting section", {
          reason: "selected section not present in refreshed options",
          selectedSection,
          nextOptions: sectionOptions,
        });
        setSelectedSection("");
        setSelectedSectionState(EMPTY_SELECTED_SECTION);
      }

      const selectedTermOption = terms.find(
        (term) => term.value === selectedTerm,
      )?.raw;
      if (!startDate) {
        setStartDate(
          selectedTermOption?.start_date ||
            selectedTermOption?.semester_start_date ||
            "",
        );
      }
      if (!endDate) {
        setEndDate(
          selectedTermOption?.end_date ||
            selectedTermOption?.semester_end_date ||
            "",
        );
      }

      setLoadingState((current) => ({ ...current, sections: false }));
    };

    console.log("[TimetablePage] preserving section while refreshing options", {
      reason: "term selection active; reloading sections",
      selectedSection,
    });
    setTimetables([NEW_TIMETABLE_OPTION]);
    setSelectedTimetable("new");
    loadSections();
  }, [resolvedTermName, selectedCurriculum, selectedTerm, terms]);

  useEffect(() => {
    if (!selectedCurriculum || !selectedTerm) {
      setTimetables([NEW_TIMETABLE_OPTION]);
      setSelectedTimetable("new");
      return;
    }

    const loadTimetableOptions = async () => {
      setLoadingState((current) => ({ ...current, timetables: true }));
      const payload = {
        academic_batch_id: selectedCurriculumId,
        semester_id: resolvedTermName,
        section_id: selectedSectionRequestValue,
      };
      console.log(
        "[TimetablePage] raw batch/sections API response request payload",
        payload,
      );
      const response = await timetableApi.getBatchSections(payload);

      const nextOptions = [NEW_TIMETABLE_OPTION];
      ((response.data as TimetableOptionItem[]) || []).forEach((item) => {
        if (!nextOptions.some((option) => option.value === item.value)) {
          nextOptions.push(item);
        }
      });
      setTimetables(nextOptions);
      setSelectedTimetable("new");
      setLoadingState((current) => ({ ...current, timetables: false }));
    };

    loadTimetableOptions();
  }, [resolvedTermName, selectedCurriculum, selectedSection, selectedTerm]);

  useEffect(() => {
    const loadScheduledClasses = async () => {
      const missingFilters = [
        !selectedCurriculum ? "curriculum" : null,
        !selectedTerm ? "term" : null,
        !selectedSectionValue ? "section" : null,
        !startDate ? "startDate" : null,
        !endDate ? "endDate" : null,
        !startTime ? "startTime" : null,
        !endTime ? "endTime" : null,
      ].filter(Boolean);

      if (missingFilters.length > 0) {
        console.log(
          "[TimetablePage] skipping scheduled classes fetch; missing required filters",
          {
            missingFilters,
            selectedCurriculum,
            selectedTerm,
            selectedSection,
            startDate,
            endDate,
            startTime,
            endTime,
          },
        );
        setIsPageLoading(false);
        setScheduledClasses([]);
        return;
      }

      if (selectedSection && !selectedSectionValue) {
        console.warn(
          "[TimetablePage] Blocking scheduled classes fetch because section selection is invalid.",
        );
        setIsPageLoading(false);
        return;
      }

      setIsPageLoading(true);
      console.log(
        "[TimetablePage] selected filters before scheduled classes fetch",
        {
          academic_batch_id: scheduledClassesQuery.academic_batch_id,
          crclm_term_id: scheduledClassesQuery.crclm_term_id,
          section: scheduledClassesQuery.section,
          startDate: scheduledClassesQuery.startDate,
          endDate: scheduledClassesQuery.endDate,
          selectedSectionId,
          selectedSectionLabel,
          finalSectionParam: scheduledClassesQuery.section,
          selectedCurriculum,
          selectedTerm,
          selectedSection,
        },
      );
      const response = await timetableApi.getScheduledClasses(
        scheduledClassesQuery,
      );
      const nextScheduledClasses = Array.isArray(response.data)
        ? response.data
        : [];
      console.log(
        "[TimetablePage] raw scheduled-classes response",
        nextScheduledClasses,
      );
      setScheduledClasses(nextScheduledClasses);
      setIsPageLoading(false);
    };

    loadScheduledClasses();
  }, [
    endDate,
    endTime,
    scheduledClassesQuery,
    selectedCurriculum,
    selectedSection,
    selectedSectionValue,
    selectedTerm,
    startDate,
    startTime,
  ]);

  const timeSlots = useMemo(
    () => (startTime && endTime ? createTimeSlots(startTime, endTime) : []),
    [endTime, startTime],
  );

  const filteredClasses = useMemo(() => {
    const selectedSectionFilter = String(
      selectedSectionLabel || selectedSection || "",
    )
      .trim()
      .toUpperCase();
    console.log("Selected section filter:", selectedSectionFilter, {
      selectedSection,
      selectedSectionLabel,
      selectedSectionId,
    });

    const filtered = scheduledClasses.filter((item) => {
      const itemSection = String(
        item?.section || item?.section_id || item?.sectionId || "",
      )
        .trim()
        .toUpperCase();
      console.log("Item section:", itemSection, { raw: item?.section });

      return !selectedSectionFilter || itemSection === selectedSectionFilter;
    });

    console.log("Filtered scheduled classes:", filtered);
    return filtered;
  }, [
    scheduledClasses,
    selectedSection,
    selectedSectionLabel,
    selectedSectionId,
  ]);

  const transformedGridData: any[] = useMemo(() => {
    const normalized = filteredClasses
      .map((item) => {
        const day = getDayNameForRecord(item);
        const timeLabel = normalizeCellTime(item);

        console.log("[TimetablePage] normalize class record", {
          id: item?.id,
          date: item?.date,
          section: item?.section,
          day,
          timeLabel,
        });

        if (!day || !timeLabel) {
          return null;
        }

        return {
          ...item,
          day,
          timeLabel,
          displayCode:
            item?.crs_code ||
            item?.course_code ||
            item?.course ||
            item?.course_name ||
            item?.subject ||
            item?.course_title ||
            "-",
        };
      })
      .filter(Boolean) as Array<
      any & { day: DayName; timeLabel: string; displayCode: string }
    >;

    console.log("[TimetablePage] normalized scheduled classes", normalized);
    return normalized;
  }, [filteredClasses]);

  useEffect(() => {
    console.log("[TimetablePage] transformed grid data", transformedGridData);
  }, [transformedGridData]);

  useEffect(() => {
    if (!isScheduleModalOpen) {
      return;
    }

    console.log("[TimetablePage] opening Schedule Class modal", {
      selectedCrclmId: selectedCurriculumId || null,
      academic_batch_id: selectedCurriculumId || null,
      selectedCrclmTermId: selectedTermRequestId || null,
      semester_id: selectedTermRequestId || null,
      resolvedSemesterValue: selectedSemesterId || resolvedTermName || null,
      selectedSectionId: selectedSectionId || null,
      section_id: selectedSectionId || null,
      selectedSectionLabel: selectedSectionLabel || null,
      selectedSectionName: selectedSectionLabel || null,
      selectedSectionObject: selectedSectionState,
    });
  }, [
    isScheduleModalOpen,
    resolvedTermName,
    selectedCurriculumId,
    selectedSectionId,
    selectedSectionLabel,
    selectedSectionState,
    selectedSemesterId,
    selectedTermRequestId,
  ]);

  const classesByCell = useMemo(() => {
    const cellMap = new Map<string, any[]>();

    if (!Array.isArray(transformedGridData)) {
      return cellMap;
    }

    transformedGridData.forEach((item: any) => {
      const classStart = parseTimeValue(
        String(item?.start_time || item?.startTime || "").slice(0, 5),
      );
      const classEnd = parseTimeValue(
        String(item?.end_time || item?.endTime || "").slice(0, 5),
      );

      if (classStart === null || classEnd === null || classEnd <= classStart) {
        const key = `${item.day}|${item.timeLabel}`;
        const existing = cellMap.get(key) || [];
        existing.push(item);
        cellMap.set(key, existing);
        return;
      }

      timeSlots.forEach((slot) => {
        const slotStart = parseTimeValue(slot);
        if (slotStart === null) {
          return;
        }

        const slotEnd = slotStart + 60;
        if (classStart < slotEnd && classEnd > slotStart) {
          const key = `${item.day}|${formatTimeToAMPM(slot)}`;
          const existing = cellMap.get(key) || [];
          existing.push(item);
          cellMap.set(key, existing);
        }
      });
    });

    cellMap.forEach((items, key) => {
      console.log("[TimetablePage] slot matched classes", {
        slot: key,
        count: items.length,
        items: items.map((item) => ({
          id: item?.id,
          timeLabel: item?.timeLabel,
          start_time: item?.start_time || item?.startTime,
          end_time: item?.end_time || item?.endTime,
        })),
      });
    });

    console.log(
      "[TimetablePage] final classesByCell map",
      Array.from(cellMap.entries()).map(([key, items]) => ({
        key,
        count: items.length,
      })),
    );
    console.log(
      "[TimetablePage] filtered/rendered classes count",
      transformedGridData.length,
    );
    return cellMap;
  }, [timeSlots, transformedGridData]);

  const selectedTimetableOption = timetables.find(
    (item) => item.value === selectedTimetable,
  );

  const handleScheduleSave = async (modalData: {
    courseTypeId: string;
    courseTypeLabel: string;
    courseId: string;
    courseLabel: string;
    days: Array<{
      name: DayName;
      selected: boolean;
      startTime: string;
      endTime: string;
    }>;
  }) => {
    if (
      !selectedCurriculumId ||
      !selectedTermRequestId ||
      !selectedSectionLabel ||
      !startDate ||
      !endDate
    ) {
      toast.error(
        "Curriculum, Term, Section, Start Date, and End Date are required.",
      );
      return;
    }

    console.log(
      "[TimetablePage] selected section object before save",
      selectedSectionState,
    );

    const numericSectionId = selectedSectionId;
    if (!numericSectionId) {
      toast.error("Please select a valid section with numeric section id.");
      return;
    }

    const crsId = getNumericId(modalData.courseId);
    if (!crsId) {
      toast.error("Please select a valid course.");
      return;
    }

    const payloadRowsBeforeFix = modalData.days.map((day) => ({
      day: day.name,
      plan_date: getFirstPlanDateForDay(startDate, endDate, day.name),
      academic_batch_id: selectedCurriculumId,
      semester_id: selectedTermRequestId,
      crs_id: crsId,
      section_id: selectedSection || "",
      start_time: day.startTime,
      end_time: day.endTime,
      created_by: createdBy,
    }));

    const payloadRows = modalData.days.map((day) => {
      const planDate = getFirstPlanDateForDay(startDate, endDate, day.name);
      return {
        day: day.name,
        plan_date: planDate,
        academic_batch_id: selectedCurriculumId,
        semester_id: selectedTermRequestId,
        crs_id: crsId,
        section_id: numericSectionId,
        start_time: day.startTime,
        end_time: day.endTime,
        created_by: createdBy,
      };
    });

    const invalidRow = payloadRows.find((row) => !row.plan_date);
    if (invalidRow) {
      toast.error(
        `No plan date found within the selected range for ${invalidRow.day}.`,
      );
      return;
    }

    console.log(
      "[TimetablePage] schedule-class payload before fix",
      payloadRowsBeforeFix,
    );
    console.log("[TimetablePage] final save payload", {
      method: "POST",
      url: "/api/v1/comman_function/schedule-class",
      payloadRows,
    });

    const result = await scheduleClassApi.saveSchedule(
      payloadRows.map(({ day, ...row }) => row),
    );
    console.log("[TimetablePage] schedule-class save result", result);

    if (result?.success) {
      toast.success("Scheduled classes saved.");
      setIsScheduleModalOpen(false);

      const refreshed = await timetableApi.getScheduledClasses(
        scheduledClassesQuery,
      );
      setScheduledClasses(Array.isArray(refreshed.data) ? refreshed.data : []);
      return;
    }

    if (result?.message) {
      toast.error(result.message);
      return;
    }

    toast.error("Failed to save scheduled classes.");
  };

  const handleOptionsAction = async (
    action: "import" | "export" | "copy" | "reset" | "delete",
  ) => {
    setIsOptionsOpen(false);

    if (action === "export") {
      const missingFilters: string[] = [];
      if (!selectedCurriculum) missingFilters.push("curriculum");
      if (!selectedTerm) missingFilters.push("term");
      if (!selectedSectionValue) missingFilters.push("section");
      if (!startDate) missingFilters.push("start date");
      if (!endDate) missingFilters.push("end date");

      if (missingFilters.length > 0) {
        console.warn(
          "[TimetablePage] Blocking export because required filters are missing.",
          {
            missingFilters,
            selectedCurriculum,
            selectedTerm,
            selectedSection,
            startDate,
            endDate,
          },
        );
        toast.error(
          `Select ${missingFilters.join(", ")} before exporting the timetable.`,
        );
        return;
      }

      const normalizedStartDate = formatDateForApi(startDate);
      const normalizedEndDate = formatDateForApi(endDate);
      if (!normalizedStartDate || !normalizedEndDate) {
        console.warn(
          "[TimetablePage] Blocking export because dates are invalid.",
          { startDate, endDate },
        );
        toast.error(
          "Start date and end date must be in YYYY-MM-DD or DD-MM-YYYY format.",
        );
        return;
      }

      const exportPayload = {
        academic_batch_id: selectedCurriculumId,
        crclm_term_id: selectedTermRequestId,
        section: sectionLabelForScheduledClasses,
        startDate: normalizedStartDate,
        endDate: normalizedEndDate,
      };

      console.log("[TimetablePage] Export timetable filters:", {
        academic_batch_id: selectedCurriculumId,
        crclm_term_id: selectedTermRequestId,
        section: sectionLabelForScheduledClasses,
        startDate: normalizedStartDate,
        endDate: normalizedEndDate,
      });
      console.log("Export timetable payload/query:", exportPayload);

      await timetableApi.exportTimetablePdf(exportPayload);
      return;
    }

    toast.info(
      "This option is shown to match the sir page and will be enabled when backend wiring is ready.",
    );
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={topGridStyle}>
          <Field
            label="Curriculum"
            value={selectedCurriculum}
            onChange={setSelectedCurriculum}
            options={curriculums}
            placeholder={
              loadingState.curriculums ? "Loading..." : "Select Curriculum"
            }
          />
          <Field
            label="Term"
            value={selectedTerm}
            onChange={setSelectedTerm}
            options={terms}
            placeholder={loadingState.terms ? "Loading..." : "Select Term"}
            disabled={!selectedCurriculum || loadingState.terms}
          />
          <Field
            label="Section"
            value={selectedSection}
            onChange={(value) => {
              setSelectedSection(value);
              syncSelectedSectionState(value, sections);
            }}
            options={sections}
            placeholder={
              loadingState.sections ? "Loading..." : "Select Section"
            }
            disabled={!selectedTerm || loadingState.sections}
          />
          <Field
            label="Timetable"
            value={selectedTimetable}
            onChange={setSelectedTimetable}
            options={timetables}
            placeholder={
              loadingState.timetables ? "Loading..." : "Select Timetable"
            }
            disabled={
              !selectedCurriculum || !selectedTerm || loadingState.timetables
            }
          />
          <DateField
            label="Start Date"
            value={startDate}
            onChange={setStartDate}
          />
          <DateField label="End Date" value={endDate} onChange={setEndDate} />
        </div>

        <div style={secondRowStyle}>
          <TimeField
            label="Start Time"
            value={startTime}
            onChange={setStartTime}
          />
          <TimeField label="End Time" value={endTime} onChange={setEndTime} />
          <Field
            label="Regular/Bypass Method"
            value={method}
            onChange={setMethod}
            options={[
              { value: "Regular", label: "Regular", raw: null },
              { value: "Bypass", label: "Bypass", raw: null },
            ]}
            placeholder="Select Method"
          />
        </div>

        <div style={actionsRowStyle}>
          <button
            type="button"
            style={primaryButtonStyle}
            onClick={() => setIsScheduleModalOpen(true)}
          >
            Schedule Class
          </button>

          <div style={optionsWrapperStyle}>
            <button
              type="button"
              style={secondaryButtonStyle}
              onClick={() => setIsOptionsOpen((current) => !current)}
            >
              Options
              <span style={caretStyle}>▼</span>
            </button>

            {isOptionsOpen && (
              <div style={dropdownStyle}>
                <OptionItem
                  label="Import Timetable"
                  disabled
                  onClick={() => handleOptionsAction("import")}
                />
                <OptionItem
                  label="Export Timetable"
                  disabled={!selectedCurriculum || !selectedTerm}
                  onClick={() => handleOptionsAction("export")}
                />
                <OptionItem
                  label="Copy Class Day"
                  disabled
                  onClick={() => handleOptionsAction("copy")}
                />
                <OptionItem
                  label="Reset Date"
                  disabled
                  onClick={() => handleOptionsAction("reset")}
                />
                <OptionItem
                  label="Delete"
                  disabled
                  onClick={() => handleOptionsAction("delete")}
                  danger
                />
              </div>
            )}
          </div>
        </div>

        <div style={gridShellStyle}>
          <div style={gridHeaderBarStyle}>
            <span>Timetable</span>
            <span style={gridMetaStyle}>
              {selectedTimetableOption?.label || "New Timetable"}
            </span>
          </div>

          <div style={tableScrollStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...headCellStyle, ...timeColumnStyle }}>Time</th>
                  {DAY_NAMES.map((day) => (
                    <th key={day} style={headCellStyle}>
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((slot) => (
                  <tr key={slot}>
                    <td style={{ ...bodyCellStyle, ...timeColumnStyle }}>
                      {formatTimeToAMPM(slot)}
                    </td>
                    {DAY_NAMES.map((day) => {
                      const timeLabel = formatTimeToAMPM(slot);
                      const lookupKey = `${day}|${timeLabel}`;
                      console.log("[TimetablePage] rendering cell lookup", {
                        lookupKey,
                        day,
                        timeLabel,
                      });
                      const cellItems = classesByCell.get(lookupKey) || [];
                      return (
                        <td key={`${day}-${slot}`} style={bodyCellStyle}>
                          {cellItems.length === 0 ? (
                            <div style={emptyCellStyle} />
                          ) : (
                            cellItems.map((item, index) => (
                              <div
                                key={`${day}-${slot}-${index}`}
                                style={classChipStyle}
                              >
                                <div style={classTitleStyle}>
                                  {item?.displayCode}
                                </div>
                                <div style={classSubtitleStyle}>
                                  {item?.course_type ||
                                    item?.courseType ||
                                    item?.faculty ||
                                    ""}
                                </div>
                                <div style={classTimeStyle}>
                                  {item?.timeLabel}
                                  {item?.end_time || item?.endTime
                                    ? ` - ${formatTimeRangeValue(item?.end_time || item?.endTime)}`
                                    : ""}
                                </div>
                              </div>
                            ))
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {!isPageLoading && timeSlots.length === 0 && (
                  <tr>
                    <td style={emptyStateCellStyle} colSpan={8}>
                      Choose a valid start and end time to render the timetable
                      grid.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {isPageLoading && (
            <div style={statusLineStyle}>Loading timetable...</div>
          )}
          {!isPageLoading && transformedGridData.length === 0 && (
            <div style={statusLineStyle}>
              No scheduled classes found for the current selection.
            </div>
          )}
        </div>
      </div>

      <ScheduleClassModal
        show={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onSave={handleScheduleSave}
        curriculumId={selectedCurriculumId ? String(selectedCurriculumId) : ""}
        curriculumLabel={selectedCurriculumLabel}
        termId={selectedTermRequestId ? String(selectedTermRequestId) : ""}
        termLabel={selectedTermLabel}
        semesterValue={selectedSemesterId || resolvedTermName || 0}
        sectionId={selectedSectionId ? String(selectedSectionId) : ""}
        sectionLabel={selectedSectionLabel}
        defaultStartTime={startTime}
        defaultEndTime={endTime}
      />
    </div>
  );
};

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: TimetableOptionItem[];
  placeholder: string;
  disabled?: boolean;
}> = ({ label, value, onChange, options, placeholder, disabled }) => (
  <div style={fieldWrapStyle}>
    <label style={labelStyle}>{label}</label>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      style={selectStyle(disabled)}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

const DateField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
}> = ({ label, value, onChange }) => (
  <div style={fieldWrapStyle}>
    <label style={labelStyle}>{label}</label>
    <input
      type="date"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      style={inputStyle}
    />
  </div>
);

const TimeField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
}> = ({ label, value, onChange }) => (
  <div style={fieldWrapStyle}>
    <label style={labelStyle}>{label}</label>
    <input
      type="time"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      style={inputStyle}
    />
  </div>
);

const OptionItem: React.FC<{
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}> = ({ label, onClick, disabled, danger }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    style={optionItemStyle(disabled, danger)}
  >
    {label}
  </button>
);

const createTimeSlots = (startValue: string, endValue: string) => {
  const startMinutes = parseTimeValue(startValue);
  const endMinutes = parseTimeValue(endValue);

  if (
    startMinutes === null ||
    endMinutes === null ||
    endMinutes <= startMinutes
  ) {
    return [];
  }

  const slots: string[] = [];
  for (let current = startMinutes; current < endMinutes; current += 60) {
    const hours = Math.floor(current / 60)
      .toString()
      .padStart(2, "0");
    const minutes = (current % 60).toString().padStart(2, "0");
    slots.push(`${hours}:${minutes}`);
  }
  return slots;
};

const parseTimeValue = (timeValue?: string) => {
  if (!timeValue || !timeValue.includes(":")) {
    return null;
  }

  const [hours, minutes] = timeValue.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
};

const normalizeDay = (value?: string): DayName | null => {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase().trim();
  return DAY_NAMES.find((day) => day.toLowerCase() === normalized) || null;
};

const getDayNameFromDate = (dateValue?: string): DayName | null => {
  if (!dateValue) {
    return null;
  }

  const [yearText, monthText, dayText] = dateValue.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if ([year, month, day].some((value) => Number.isNaN(value))) {
    return null;
  }

  const dayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const normalizedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
  return DAY_NAMES[normalizedIndex] || null;
};

const getDayNameForRecord = (item: any): DayName | null =>
  normalizeDay(item?.day || item?.day_name || item?.weekday) ||
  getDayNameFromDate(item?.date);

const normalizeCellTime = (item: any) => {
  const candidate =
    item?.start_time ||
    item?.startTime ||
    (typeof item?.time === "string" ? item.time.split("-")[0] : "");

  if (!candidate) {
    return "";
  }

  const normalizedValue = String(candidate).trim().slice(0, 5);
  return formatTimeToAMPM(normalizedValue);
};

const formatTimeToAMPM = (timeValue: string) => {
  const [hourText, minuteText] = timeValue.split(":");
  const hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour.toString().padStart(2, "0")}:${minuteText} ${suffix}`;
};

const formatTimeRangeValue = (timeValue?: string) => {
  if (!timeValue) {
    return "";
  }

  return formatTimeToAMPM(String(timeValue).trim().slice(0, 5));
};

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "20px",
  backgroundColor: "#eef3f8",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #cfd8e3",
  borderRadius: "3px",
  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.08)",
  padding: "18px",
};

const topGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: "14px",
};

const secondRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 240px))",
  gap: "14px",
  marginTop: "16px",
};

const actionsRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginTop: "18px",
  marginBottom: "18px",
};

const fieldWrapStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  minWidth: 0,
};

const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "#334155",
};

const inputStyle: React.CSSProperties = {
  height: "34px",
  border: "1px solid #c4cfdb",
  borderRadius: "2px",
  padding: "0 10px",
  fontSize: "13px",
  color: "#0f172a",
  backgroundColor: "#ffffff",
};

const selectStyle = (disabled?: boolean): React.CSSProperties => ({
  ...inputStyle,
  color: disabled ? "#94a3b8" : "#0f172a",
  backgroundColor: disabled ? "#f8fafc" : "#ffffff",
});

const primaryButtonStyle: React.CSSProperties = {
  height: "34px",
  padding: "0 16px",
  border: "1px solid #1d4ed8",
  borderRadius: "2px",
  backgroundColor: "#2563eb",
  color: "#ffffff",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: 600,
};

const secondaryButtonStyle: React.CSSProperties = {
  height: "34px",
  padding: "0 14px",
  border: "1px solid #94a3b8",
  borderRadius: "2px",
  backgroundColor: "#ffffff",
  color: "#334155",
  cursor: "pointer",
  fontSize: "13px",
};

const caretStyle: React.CSSProperties = {
  display: "inline-block",
  marginLeft: "8px",
  fontSize: "10px",
};

const optionsWrapperStyle: React.CSSProperties = {
  position: "relative",
};

const dropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: "38px",
  left: 0,
  width: "190px",
  backgroundColor: "#ffffff",
  border: "1px solid #cfd8e3",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.12)",
  zIndex: 20,
  padding: "6px 0",
};

const optionItemStyle = (
  disabled?: boolean,
  danger?: boolean,
): React.CSSProperties => ({
  width: "100%",
  textAlign: "left",
  border: "none",
  backgroundColor: "#ffffff",
  padding: "9px 12px",
  fontSize: "13px",
  color: disabled ? "#94a3b8" : danger ? "#b91c1c" : "#1f2937",
  cursor: disabled ? "not-allowed" : "pointer",
});

const gridShellStyle: React.CSSProperties = {
  border: "1px solid #cfd8e3",
  backgroundColor: "#ffffff",
};

const gridHeaderBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 12px",
  borderBottom: "1px solid #dbe4ee",
  backgroundColor: "#f8fafc",
  fontSize: "13px",
  fontWeight: 600,
  color: "#1e293b",
};

const gridMetaStyle: React.CSSProperties = {
  fontWeight: 500,
  color: "#64748b",
};

const tableScrollStyle: React.CSSProperties = {
  overflowX: "auto",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  tableLayout: "fixed",
};

const headCellStyle: React.CSSProperties = {
  borderBottom: "1px solid #dbe4ee",
  borderRight: "1px solid #e5edf5",
  padding: "10px 8px",
  backgroundColor: "#edf2f7",
  color: "#1e293b",
  fontSize: "12px",
  fontWeight: 700,
  textAlign: "center",
};

const bodyCellStyle: React.CSSProperties = {
  borderBottom: "1px solid #eef2f7",
  borderRight: "1px solid #eef2f7",
  padding: "8px",
  verticalAlign: "top",
  height: "88px",
  backgroundColor: "#ffffff",
};

const timeColumnStyle: React.CSSProperties = {
  width: "110px",
  minWidth: "110px",
  textAlign: "center",
  fontWeight: 600,
  color: "#334155",
};

const emptyCellStyle: React.CSSProperties = {
  minHeight: "64px",
};

const classChipStyle: React.CSSProperties = {
  border: "1px solid #d8e3f0",
  backgroundColor: "#f8fbff",
  borderRadius: "2px",
  padding: "8px",
  textAlign: "left",
  marginBottom: "6px",
};

const classTitleStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 700,
  color: "#1d4ed8",
  marginBottom: "4px",
  lineHeight: 1.35,
};

const classSubtitleStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "#475569",
  marginBottom: "4px",
};

const classTimeStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "#0f172a",
};

const statusLineStyle: React.CSSProperties = {
  padding: "12px",
  fontSize: "13px",
  color: "#64748b",
};

const emptyStateCellStyle: React.CSSProperties = {
  padding: "18px",
  textAlign: "center",
  color: "#64748b",
  fontSize: "13px",
};

export default TimetableListPage;
