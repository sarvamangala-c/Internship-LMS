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
    <div className="relative min-h-screen p-1">
      {/* Dynamic Mesh Background Layer */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-300/30 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-200/40 rounded-full blur-[140px] animate-pulse" style={{ animationDelay: "2s" }} />
        <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-amber-100/50 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "4s" }} />
      </div>

      <div className="relative z-10 space-y-6 max-w-[1600px] mx-auto p-4 lg:p-8">
        {/* Premium Header & Breadcrumbs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-br from-indigo-50/90 to-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-sm border border-indigo-100/50">
          <div>
            <div className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
              <span>Home</span>
              <span className="text-slate-300">/</span>
              <span>LMS</span>
              <span className="text-slate-300">/</span>
              <span className="text-indigo-600">Timetable</span>
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Academic Schedule</h1>
            <p className="text-slate-500 text-sm font-medium">Design and manage course sessions across sections.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsScheduleModalOpen(true)}
              className="flex items-center px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 transition-all active:scale-95"
            >
              <span className="mr-2 text-xl">+</span> Schedule Class
            </button>
            
            <div className="relative">
              <button
                onClick={() => setIsOptionsOpen((current) => !current)}
                className="flex items-center px-6 py-4 bg-white text-slate-700 border border-slate-200 rounded-2xl font-bold text-sm shadow-sm hover:bg-slate-50 transition-all active:scale-95"
              >
                Tools <span className="ml-2 text-[10px] opacity-40">▼</span>
              </button>
              {isOptionsOpen && (
                <div className="absolute right-0 mt-3 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
                  <OptionItem label="Import Schedule" disabled onClick={() => handleOptionsAction("import")} />
                  <OptionItem label="Export PDF" disabled={!selectedCurriculum || !selectedTerm} onClick={() => handleOptionsAction("export")} />
                  <OptionItem label="Clear Grid" disabled onClick={() => handleOptionsAction("reset")} danger />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Insight Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: "Weekly Volume", value: transformedGridData.length, icon: "⏳", color: "indigo", status: "Active" },
            { label: "Room Capacity", value: "85%", icon: "🏢", color: "emerald", status: "Optimal" },
            { label: "Conflict Status", value: "None", icon: "🛡️", color: "amber", status: "Verified" }
          ].map((stat, i) => (
            <div key={i} className="bg-white/70 backdrop-blur-xl p-6 rounded-[2rem] shadow-sm border border-white/50 relative overflow-hidden group hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500">
              <div className={`absolute top-0 left-0 w-1.5 h-full bg-${stat.color}-500/60`} />
              <div className="flex items-center justify-between mb-4 relative z-10">
                <span className="text-2xl p-2 bg-white rounded-xl shadow-inner">{stat.icon}</span>
                <span className={`text-[10px] font-black uppercase tracking-wider text-${stat.color}-600 bg-${stat.color}-50 px-2.5 py-1 rounded-lg`}>{stat.status}</span>
              </div>
              <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.25em] mb-1 relative z-10">{stat.label}</h3>
              <p className="text-3xl font-black text-slate-900 tracking-tighter relative z-10">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Control Center (Filters) */}
        <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-white/50 overflow-hidden">
          <div className="p-8 border-b border-slate-100 bg-slate-50/30">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Schedule Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Field
                label="Curriculum"
                value={selectedCurriculum}
                onChange={setSelectedCurriculum}
                options={curriculums}
                placeholder={loadingState.curriculums ? "Loading..." : "Select Curriculum"}
              />
              <Field
                label="Term / Semester"
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
                placeholder={loadingState.sections ? "Loading..." : "Select Section"}
                disabled={!selectedTerm || loadingState.sections}
              />
              <Field
                label="Active Timetable"
                value={selectedTimetable}
                onChange={setSelectedTimetable}
                options={timetables}
                placeholder={loadingState.timetables ? "Loading..." : "Select Timetable"}
                disabled={!selectedCurriculum || !selectedTerm || loadingState.timetables}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
              <DateField label="Period Start" value={startDate} onChange={setStartDate} />
              <DateField label="Period End" value={endDate} onChange={setEndDate} />
              <TimeField label="Shift Start" value={startTime} onChange={setStartTime} />
              <TimeField label="Shift End" value={endTime} onChange={setEndTime} />
            </div>
          </div>

          {/* Timetable Grid View */}
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-800 tracking-tight italic">
                {selectedTimetableOption?.label || "Live Schedule Grid"}
              </h3>
              <div className="px-4 py-1.5 bg-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500">
                {method} Mode
              </div>
            </div>

            <div className="overflow-x-auto rounded-3xl border border-slate-100 shadow-inner bg-slate-50/50 p-1">
              <table className="w-full border-collapse table-fixed min-w-[1000px]">
                <thead>
                  <tr>
                    <th className="w-32 bg-slate-800 text-white p-4 text-[10px] font-black uppercase tracking-widest rounded-tl-2xl">Time</th>
                    {DAY_NAMES.map((day, i) => (
                      <th key={day} className={`bg-slate-100/80 p-4 text-[10px] font-black uppercase tracking-widest text-slate-600 ${i === DAY_NAMES.length - 1 ? "rounded-tr-2xl" : "border-r border-white"}`}>
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {timeSlots.map((slot) => (
                    <tr key={slot} className="group hover:bg-white/50 transition-colors">
                      <td className="p-4 text-center font-black text-xs text-slate-400 bg-white/40 border-r border-slate-100">
                        {formatTimeToAMPM(slot)}
                      </td>
                      {DAY_NAMES.map((day) => {
                        const timeLabel = formatTimeToAMPM(slot);
                        const lookupKey = `${day}|${timeLabel}`;
                        const cellItems = classesByCell.get(lookupKey) || [];
                        return (
                          <td key={`${day}-${slot}`} className="p-2 h-32 vertical-top border-r border-slate-100/50 last:border-r-0">
                            {cellItems.length === 0 ? (
                              <div className="w-full h-full rounded-xl group-hover:bg-indigo-50/20 transition-all border border-transparent group-hover:border-dashed group-hover:border-indigo-100" />
                            ) : (
                              <div className="space-y-2">
                                {cellItems.map((item, index) => (
                                  <div key={index} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all group/chip relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                                    <div className="font-black text-[10px] text-indigo-600 uppercase tracking-tight mb-1">{item?.displayCode}</div>
                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate">
                                      {item?.course_type || item?.faculty || "No Instructor"}
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                      <span className="text-[8px] font-black text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                                        {item?.timeLabel}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {!isPageLoading && timeSlots.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-20 text-center">
                        <span className="text-4xl block mb-3 opacity-20">📅</span>
                        <p className="text-xs font-black uppercase tracking-widest text-slate-300 italic">
                          Define Shift Parameters to Initialize Grid
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {isPageLoading && <div className="p-8 text-center text-xs font-bold text-indigo-500 animate-pulse">Syncing Schedule with Cloud...</div>}
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
  <div className="flex flex-col gap-2 min-w-0">
    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{label}</label>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className={`h-14 px-4 rounded-2xl border transition-all appearance-none bg-white/50 backdrop-blur-md font-bold text-sm
        ${disabled ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed" : "border-slate-200 text-slate-700 hover:border-indigo-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"}`}
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
  <div className="flex flex-col gap-2 min-w-0">
    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{label}</label>
    <input
      type="date"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-14 px-4 rounded-2xl border border-slate-200 bg-white/50 backdrop-blur-md font-bold text-sm text-slate-700 hover:border-indigo-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
    />
  </div>
);

const TimeField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
}> = ({ label, value, onChange }) => (
  <div className="flex flex-col gap-2 min-w-0">
    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{label}</label>
    <input
      type="time"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-14 px-4 rounded-2xl border border-slate-200 bg-white/50 backdrop-blur-md font-bold text-sm text-slate-700 hover:border-indigo-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
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
    className={`w-full text-left px-4 py-3.5 rounded-xl font-bold text-xs transition-all
      ${disabled ? "text-slate-300 cursor-not-allowed" : danger ? "text-rose-600 hover:bg-rose-50" : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"}`}
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


export default TimetableListPage;
