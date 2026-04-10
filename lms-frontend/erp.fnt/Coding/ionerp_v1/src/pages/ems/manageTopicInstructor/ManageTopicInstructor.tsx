import React, { useMemo, useState, useEffect, useCallback } from "react";
import DataTable from "../../../components/Table/DataTable";
import { useTopicService } from "../../../services/ems/topicService";
import EditTopicPage from "./EditTopicPage";
import AssignInstructorModal from "./AssignInstructorModal";
import { SquarePen, Trash2 } from "lucide-react";

interface DropdownOption {
  value: number | string;
  label: string;
  [key: string]: any;
}

interface TopicRow {
  id: number;
  mapping_id?: number;
  topic_id: number;
  crs_id?: number;
  course_id?: number;
  topic_title: string;
  topic_code: string;
  topic_hrs: string;
  num_of_sessions: number;
  section_id?: number;
  instructor_id?: number;
  instructor_name?: string;
  lesson_schedule?: string;
  conduction_date?: string;
  actual_delivery_date?: string;
  marks_expt?: number;
  is_imported?: boolean;
}

interface DropdownState {
  curriculumOptions: DropdownOption[];
  semesterOptions: DropdownOption[];
  courseOptions: DropdownOption[];
  sectionOptions: DropdownOption[];
}

const ManageTopicInstructor: React.FC = () => {
  const topicService = useTopicService();

  const [filters, setFilters] = useState({
    curriculum: "",
    semester: "",
    course: "",
    section: ""
  });

  const [dropdownOptions, setDropdownOptions] = useState<DropdownState>({
    curriculumOptions: [],
    semesterOptions: [],
    courseOptions: [],
    sectionOptions: []
  });

  const [tableData, setTableData] = useState<TopicRow[]>([]);
  const [editingTopic, setEditingTopic] = useState<TopicRow | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    topicService.getCurriculumList().then((res: any) => {
      const dataArray = Array.isArray(res) ? res : (res?.data || []);
      if (Array.isArray(dataArray)) {
        const options = dataArray.map((item: any) => ({
          value: item.value || item.id || item.academic_batch_id || item.batch_id,
          label: item.label || item.name || item.academic_batch_name || item.batch_name || item.academic_batch_code || `Batch ${item.academic_batch_id || item.id}`,
        }));
        setDropdownOptions(prev => ({ ...prev, curriculumOptions: options }));
      }
    }).catch((error) => console.error("Error loading curriculum:", error));

    topicService.getSemesterList().then((res: any) => {
      const dataArray = Array.isArray(res) ? res : (res?.data || []);
      if (Array.isArray(dataArray)) {
        const options = dataArray.map((item: any) => ({
          value: item.value || item.id || item.semester_id || item.sem_id,
          label: item.label || item.name || item.semester_name || `Semester ${item.semester || item.semester_id || item.id}`,
        }));
        setDropdownOptions(prev => ({ ...prev, semesterOptions: options }));
      }
    }).catch((error) => console.error("Error loading semester:", error));
  }, []);

  useEffect(() => {
    if (filters.curriculum && filters.semester) {
      topicService.getCourseList({
        curriculum_id: Number(filters.curriculum),
        semester_id: Number(filters.semester)
      }).then((res: any) => {
        const dataArray = Array.isArray(res) ? res : (res?.data || res?.courses || []);
        if (Array.isArray(dataArray)) {
          const options = dataArray.map((item: any) => ({
            value: item.value || item.course_id || item.crs_id || item.id,
            label: item.label || item.course_name || item.crs_title || item.title || `Course ${item.course_id || item.id}`,
          }));
          setDropdownOptions(prev => ({ ...prev, courseOptions: options }));
        }
      });
    } else {
      setDropdownOptions(prev => ({ ...prev, courseOptions: [] }));
    }
  }, [filters.curriculum, filters.semester]);

  useEffect(() => {
    if (filters.semester) {
      const payload: any = { semester_id: Number(filters.semester) };
      if (filters.curriculum) payload.academic_batch_id = Number(filters.curriculum);
      if (filters.course) payload.course_id = Number(filters.course);

      topicService.getSectionList(payload).then((res: any) => {
        const dataArray = Array.isArray(res) ? res : (res?.data || res?.sections || []);
        if (Array.isArray(dataArray)) {
          const options = dataArray.map((item: any) => ({
            value: item.value || item.id || item.section_id,
            label: item.label || item.section || item.section_name || `Section ${item.id || item.section_id}`,
          }));
          setDropdownOptions(prev => ({ ...prev, sectionOptions: options }));
        }
      });
    } else {
      setDropdownOptions(prev => ({ ...prev, sectionOptions: [] }));
    }
  }, [filters.semester, filters.curriculum, filters.course]);

  const loadTopics = useCallback(async () => {
    const courseId = Number(filters.course);
    const semesterId = Number(filters.semester);
    const sectionId = Number(filters.section);

    if (!courseId || !semesterId || !sectionId || isNaN(courseId) || isNaN(semesterId) || isNaN(sectionId)) {
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        course_id: courseId,
        semester_id: semesterId,
        section_id: sectionId,
      };

      const res: any = await topicService.getTopicList(payload);
      const dataArray = Array.isArray(res) ? res : (res?.data || []);

      if (Array.isArray(dataArray) && dataArray.length > 0) {
        const mappedData = dataArray.map((item: any, idx: number) => ({
          id: idx + 1,
          mapping_id: item.mapping_id || item.inst_map_id || item.map_id,
          topic_id: item.topic_id,
          crs_id: item.crs_id || item.course_id,
          course_id: item.course_id || item.crs_id || courseId,
          topic_title: item.topic_title || item.topic_name || item.title,
          topic_code: item.topic_code || item.code,
          topic_hrs: String(item.topic_hrs ?? item.topic_hours ?? ""),
          num_of_sessions: Number(item.num_of_sessions ?? item.no_of_sessions ?? 0),
          section_id: item.section_id || sectionId,
          instructor_id: item.instructor_id,
          instructor_name: item.instructor_name || item.instructor || item.faculty_name || "Not Assigned",
          lesson_schedule: item.lesson_schedule || item.portion_to_be_covered_per_hour || item.portion_to_be_covered || item.portion || "",
          conduction_date: item.conduction_date,
          actual_delivery_date: item.actual_delivery_date || item.delivery_date,
          marks_expt: item.marks_expt,
          is_imported: item.is_imported || false,
        }));
        setTableData(mappedData);
      } else {
        setTableData([]);
      }
    } catch (error) {
      console.error("Failed to load topics", error);
      setTableData([]);
    } finally {
      setLoading(false);
    }
  }, [filters.course, filters.semester, filters.section, topicService]);

  useEffect(() => {
    const courseId = Number(filters.course);
    const semesterId = Number(filters.semester);
    const sectionId = Number(filters.section);

    if (courseId && semesterId && sectionId && !isNaN(courseId) && !isNaN(semesterId) && !isNaN(sectionId)) {
      loadTopics();
    }
  }, [filters.course, filters.semester, filters.section]);

  const updateTopicInTable = useCallback((topicId: number, updates: Partial<TopicRow>) => {
    setTableData(prev => prev.map(t =>
      t.topic_id === topicId ? { ...t, ...updates } : t
    ));
  }, []);

  const addTopicToTable = useCallback((newTopic: TopicRow) => {
    setTableData(prev => {
      const exists = prev.some(t => t.topic_id === newTopic.topic_id);
      if (exists) {
        return prev.map(t => t.topic_id === newTopic.topic_id ? { ...t, ...newTopic } : t);
      }
      return [...prev, newTopic];
    });
  }, []);

  const handleImportTopics = () => {
    if (!filters.curriculum || !filters.course || !filters.semester || !filters.section) {
      alert("Please select Curriculum, Semester, Course and Section first");
      return;
    }
    setShowAssignModal(true);
  };

  const handleEdit = (topic: TopicRow) => {
    if (topic && topic.topic_id) {
      setEditingTopic(topic);
    }
  };

  const handleDelete = async (topic: TopicRow) => {
    if (!topic?.topic_id) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete topic "${topic.topic_title}" ?`
    );

    if (!confirmDelete) return;

    try {
      await topicService.deleteTopic(topic.topic_id);

      // remove from UI instantly
      setTableData(prev =>
        prev.filter(t => t.topic_id !== topic.topic_id)
      );

      alert("✅ Topic deleted successfully");
    } catch (error) {
      console.error("Delete failed", error);
      alert("❌ Failed to delete topic");
    }
  };

  const columnDefs = useMemo(() => [
    { headerName: "Sl No", valueGetter: (p: any) => p.node.rowIndex + 1, width: 70 },
    { headerName: "Topic Title", field: "topic_title", flex: 1, minWidth: 200 },
    { headerName: "Lesson Schedule", field: "lesson_schedule", flex: 1, minWidth: 250 },
    { headerName: "Delivery Date", field: "actual_delivery_date", width: 130 },
    {
      headerName: "Handled By",
      field: "instructor_name",
      width: 150,
      valueGetter: (p: any) => p.data.instructor_name || "Not Assigned"
    },
    {
      headerName: "Actions",
      width: 110,
      cellRenderer: (p: any) => {
        return (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px"
            }}
          >
            <SquarePen
              size={18}
              color="#17439c"
              style={{ cursor: "pointer" }}
              onClick={() => handleEdit(p.data)}
            />

            <Trash2
              size={18}
              color="#d11a2a"
              style={{ cursor: "pointer" }}
              onClick={() => handleDelete(p.data)}
            />
          </div>
        );
      }
    },
  ], []);

  return (
    <div className="p-6">
      <div className="bg-[#1f4e5f] text-white px-4 py-2 rounded-t-md font-semibold">
        Manage Topic Instructor
      </div>

      <div className="border p-4 bg-white rounded-b-md">
        <div className="grid grid-cols-5 gap-4 items-end mb-6">
          {["curriculum", "semester", "course", "section"].map(field => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1 capitalize">{field} *</label>
              <select
                className="w-full border rounded px-2 py-2"
                value={filters[field as keyof typeof filters]}
                onChange={(e) => {
                  const val = e.target.value;
                  setFilters(prev => {
                    const updated = { ...prev, [field]: val };
                    if (field === "curriculum" || field === "semester") {
                      updated.course = "";
                      updated.section = "";
                    }
                    if (field === "course") updated.section = "";
                    return updated;
                  });
                }}
              >
                <option value="">Select {field}</option>
                {dropdownOptions[`${field}Options` as keyof typeof dropdownOptions]?.map((o: DropdownOption) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          ))}
          <button
            onClick={handleImportTopics}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition"
            disabled={!filters.course || !filters.semester || !filters.section}
          >
            Import Topics
          </button>
        </div>

        {loading ? (
          <div className="text-center py-4">
            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            Loading topics...
          </div>
        ) : (
          <DataTable columnDefs={columnDefs} rowData={tableData} pagination pageSize={10} />
        )}
      </div>

      {editingTopic && (
        <EditTopicPage
          topic={editingTopic}
          academic_batch_id={Number(filters.curriculum) || 0}
          semester_id={Number(filters.semester) || 0}
          filters={{
            course: Number(filters.course) || undefined,
            semester: Number(filters.semester) || undefined,
            section: Number(filters.section) || undefined,
            academic_batch_id: Number(filters.curriculum) || undefined
          }}
          close={() => setEditingTopic(null)}
          refresh={loadTopics}
          updateTopicInTable={updateTopicInTable}
          addTopicToTable={addTopicToTable}
          tableData={tableData}
        />
      )}

      {showAssignModal && (
        <AssignInstructorModal
          filters={{
            curriculum: Number(filters.curriculum),
            semester: Number(filters.semester),
            course: Number(filters.course),
            section: Number(filters.section),
          }}
          topics={tableData}
          close={() => setShowAssignModal(false)}
          refresh={loadTopics}
          updateTopicInTable={updateTopicInTable}
          addTopicToTable={addTopicToTable}
        />
      )}
    </div>
  );
};

export default ManageTopicInstructor;