import React, { useEffect, useState } from "react";
import { useTopicService } from "../../../services/ems/topicService";

type Schedule = {
  schedule_id: number;
  topic_id: number;
  session_number: number;
  portion_to_be_covered?: string | null;
  conduction_date: string | null;
  actual_delivery_date: string | null;
};

type Instructor = {
  value: number;
  label: string;
};

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

interface EditTopicPageProps {
  topic: {
    topic_id: number;
    topic_title: string;
    topic_code: string;
    mapping_id?: number;
    instructor_id?: number;
    course_id?: number;
    section_id?: number;
    actual_delivery_date?: string;
  };
  academic_batch_id: number;
  semester_id: number;
  filters?: {
    course?: number;
    semester?: number;
    section?: number;
    academic_batch_id?: number;
  };
  close: () => void;
  refresh: () => void;
  updateTopicInTable?: (topicId: number, updates: Partial<TopicRow>) => void;
  addTopicToTable?: (newTopic: TopicRow) => void;
  tableData?: TopicRow[];
}

export default function EditTopicPage({ topic, academic_batch_id, semester_id, filters, close, refresh, updateTopicInTable, addTopicToTable, tableData }: EditTopicPageProps) {
  const topicService = useTopicService();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [showExtraClass, setShowExtraClass] = useState(false);
  const [showAddNewTopic, setShowAddNewTopic] = useState(false);
  const [showEditTopic, setShowEditTopic] = useState(false);
  const [extraClassData, setExtraClassData] = useState({
    date: "",
    startTime: "",
    endTime: "",
    notes: ""
  });
  const [newTopicData, setNewTopicData] = useState({
    topic_title: "",
    topic_code: "",
    topic_content: "",
    topic_hrs: "",
    num_of_sessions: 1,
    instructor_id: 0,
    delivery_date: ""
  });
  const [editTopicData, setEditTopicData] = useState({
    topic_title: "",
    delivery_date: "",
    instructor_id: 0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSchedules();
    loadInstructors();
    const instId = (topic as any).instructor_id;
    setEditTopicData({
      topic_title: topic.topic_title || "",
      delivery_date: (topic.actual_delivery_date || "").split("T")[0] || "",
      instructor_id: instId || 0
    });
  }, [topic.topic_id, topic.mapping_id]);

  const loadSchedules = async () => {
    try {
      const mapId = topic.mapping_id ?? (topic as any).inst_map_id;
      if (!mapId) {
        setSchedules([]);
        return;
      }
      const res: any = await topicService.getTopicSchedules({ mapping_id: mapId });
      const data = Array.isArray(res) ? res : [];
      setSchedules(data);
    } catch (error) {
      console.error("Error loading schedules", error);
      setSchedules([]);
    }
  };

  const loadInstructors = async () => {
    try {
      const res: any = await topicService.getInstructorList();
      const data = Array.isArray(res) ? res : (res?.data || []);
      setInstructors(data);
    } catch (error) {
      console.error("Error loading instructors", error);
    }
  };

  const updateSchedule = async (schedule_id: number, field: "conduction_date" | "actual_delivery_date", value: string) => {
    try {
      await topicService.updateSchedule(schedule_id, { [field]: value || undefined });
      loadSchedules();
    } catch (error) {
      console.error("Error updating schedule", error);
    }
  };

  const addSchedule = async () => {
    const mapId = topic.mapping_id ?? (topic as any).inst_map_id;
    if (!mapId) return;
    try {
      await topicService.addSchedule({
        mapping_id: mapId,
        session_number: schedules.length + 1,
        conduction_date: undefined
      });
      loadSchedules();
    } catch (error) {
      console.error("Error adding schedule", error);
    }
  };

  const addExtraClass = async () => {
    const mapId = topic.mapping_id ?? (topic as any).inst_map_id;
    
    if (!extraClassData.date || extraClassData.date.trim() === '') {
      alert('Please select a date');
      return;
    }
    
    try {
      if (mapId) {
        // If mapping exists, add extra class
        await topicService.addExtraClass({
          mapping_id: mapId,
          class_date: extraClassData.date,
          start_time: extraClassData.startTime || undefined,
          end_time: extraClassData.endTime || undefined,
          notes: extraClassData.notes
        });
        setShowExtraClass(false);
        setExtraClassData({ date: "", startTime: "", endTime: "", notes: "" });
        loadSchedules();
        alert("Extra class scheduled successfully!");
      } else {
        // If no mapping exists, import topic first then add extra class
        const courseId = topic.course_id || filters?.course;
        const semesterId = filters?.semester || semester_id;
        const sectionId = topic.section_id || filters?.section;
        const batchId = filters?.academic_batch_id || academic_batch_id;
        
        if (!courseId || !semesterId || !sectionId || !batchId) {
          alert("Unable to import topic. Please ensure course, semester, and section are selected.");
          return;
        }
        
        // Import the topic
        const response: any = await topicService.importCudosTopics({
          course_id: courseId,
          semester_id: semesterId,
          section_id: sectionId,
          topic_ids: [topic.topic_id],
          instructor_id: editTopicData.instructor_id || 1,
          academic_batch_id: batchId
        });
        
        // Get the new mapping_id
        const newMappingId = response?.data?.[0]?.mapping_id || response?.mapping_id;
        
        if (newMappingId) {
          // Now add extra class
          await topicService.addExtraClass({
            mapping_id: newMappingId,
            class_date: extraClassData.date,
            start_time: extraClassData.startTime || undefined,
            end_time: extraClassData.endTime || undefined,
            notes: extraClassData.notes
          });
          
          // Update table with new mapping
          if (updateTopicInTable) {
            updateTopicInTable(topic.topic_id, {
              mapping_id: newMappingId,
              is_imported: true
            });
          }
        }
        
        setShowExtraClass(false);
        setExtraClassData({ date: "", startTime: "", endTime: "", notes: "" });
        loadSchedules();
        alert("Extra class scheduled successfully!");
      }
    } catch (error) {
      console.error("Error adding extra class", error);
      alert("Error scheduling extra class");
    }
  };

  const saveEditedTopic = async () => {
    const mapId = topic.mapping_id || (topic as any).inst_map_id;
    
    if (!editTopicData.topic_title.trim()) {
      alert("Please enter topic title");
      return;
    }
    
    try {
      setLoading(true);
      
      // Update topic details in backend
      await topicService.updateTopic(topic.topic_id, {
        topic_title: editTopicData.topic_title,
        topic_code: topic.topic_code,
        course_id: topic.course_id || filters?.course,
        semester_id: filters?.semester || semester_id,
        academic_batch_id: filters?.academic_batch_id || academic_batch_id
      });
      
      // Update mapping with instructor if mapping exists or create mapping
      let finalMappingId = mapId;
      
      if (!mapId && editTopicData.instructor_id) {
        // Need to import first
        const courseId = topic.course_id || filters?.course;
        const semesterId = filters?.semester || semester_id;
        const sectionId = topic.section_id || filters?.section;
        const batchId = filters?.academic_batch_id || academic_batch_id;
        
        const response: any = await topicService.importCudosTopics({
          course_id: courseId || 1,
          semester_id: semesterId || 1,
          section_id: sectionId || 1,
          topic_ids: [topic.topic_id],
          instructor_id: editTopicData.instructor_id,
          academic_batch_id: batchId || 1
        });
        
        finalMappingId = response?.data?.[0]?.mapping_id || response?.mapping_id;
      } else if (mapId && editTopicData.instructor_id) {
        // Update existing mapping
        await topicService.updateMapping(mapId, { instructor_id: editTopicData.instructor_id });
      }
      
      // Update delivery date if schedules exist
      if (editTopicData.delivery_date) {
        if (schedules.length > 0) {
          await topicService.updateSchedule(schedules[0].schedule_id, {
            actual_delivery_date: editTopicData.delivery_date
          });
        } else if (finalMappingId) {
          // Create a schedule with delivery date
          await topicService.addSchedule({
            mapping_id: finalMappingId,
            session_number: 1,
            conduction_date: editTopicData.delivery_date
          });
        }
      }
      
      // Get instructor name
      const instructor = instructors.find(i => i.value === editTopicData.instructor_id);
      const instructorName = instructor ? instructor.label : "Not Assigned";
      
      // Update table directly without refresh to keep data
      if (updateTopicInTable) {
        updateTopicInTable(topic.topic_id, {
          topic_title: editTopicData.topic_title,
          instructor_id: editTopicData.instructor_id || undefined,
          instructor_name: instructorName,
          actual_delivery_date: editTopicData.delivery_date || undefined,
          mapping_id: finalMappingId
        });
      }
      
      alert("Topic updated successfully!");
      setShowEditTopic(false);
      loadSchedules();
      
    } catch (error: any) {
      console.error("Error updating topic", error);
      alert(error?.message || "Error updating topic");
    } finally {
      setLoading(false);
    }
  };

  const addNewTopic = async () => {
    if (loading) return;

    if (!newTopicData.topic_title || !newTopicData.topic_code || !newTopicData.instructor_id) {
      alert("Please fill all required fields");
      return;
    }
    
    const instructor = instructors.find(i => i.value === newTopicData.instructor_id);
    const instructorName = instructor ? instructor.label : "Assigned";
    
    try {
      setLoading(true);
      const payload = {
        academic_batch_id: Number(academic_batch_id),
        semester_id: Number(semester_id),
        course_id: Number(topic.course_id || 1),
        section_id: Number(topic.section_id || 1),
        topic_title: newTopicData.topic_title,
        topic_code: newTopicData.topic_code,
        topic_content: newTopicData.topic_content,
        topic_hrs: newTopicData.topic_hrs,
        num_of_sessions: Number(newTopicData.num_of_sessions),
        instructor_id: Number(newTopicData.instructor_id)
      };

      console.log("DEBUG: Sending addNewTopic payload:", payload);

      const response: any = await topicService.addNewTopic(payload);
      console.log("DEBUG: addNewTopic response:", response);
      
      if (response?.already_existed) {
        alert("ℹ️ This topic already exists and has been mapped.");
      } else {
        alert("✅ Topic added successfully!");
      }
      
      const mappingId = response?.mapping_id || response?.data?.mapping_id || Date.now();
      
      // Add to table directly without refresh
      if (addTopicToTable) {
        addTopicToTable({
          id: Date.now(),
          topic_id: response?.topic_id || Date.now(),
          topic_title: newTopicData.topic_title,
          topic_code: newTopicData.topic_code,
          topic_hrs: newTopicData.topic_hrs,
          num_of_sessions: newTopicData.num_of_sessions,
          course_id: topic.course_id || 1,
          section_id: topic.section_id || 1,
          instructor_id: newTopicData.instructor_id,
          instructor_name: instructorName,
          actual_delivery_date: newTopicData.delivery_date || undefined,
          mapping_id: mappingId,
          is_imported: true
        });
      }
      
      setShowAddNewTopic(false);
      setNewTopicData({
        topic_title: "",
        topic_code: "",
        topic_content: "",
        topic_hrs: "",
        num_of_sessions: 1,
        instructor_id: 0,
        delivery_date: ""
      });
      
      close();
    } catch (error: any) {
      console.error("Error adding new topic", error);
      alert(error?.message || "Error adding new topic");
    } finally {
      setLoading(false);
    }
  };

  const saveChanges = () => {
    close();
  };

  return (
    <div className="modal show d-block" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.5)', overflowY: 'auto' }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Edit Topic & Lesson Schedule</h5>
            <button type="button" className="btn-close" onClick={close}></button>
          </div>
          <div className="modal-body">
            <div className="alert alert-info mb-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="mb-1">{topic.topic_title}</h6>
                  <small className="text-muted">Code: {topic.topic_code}</small>
                </div>
                <button 
                  className="btn btn-sm btn-warning" 
                  onClick={() => setShowEditTopic(true)}
                >
                  Edit Topic Details
                </button>
              </div>
            </div>

            <div className="mb-3">
              <div className="d-flex gap-2 mb-3">
                <button className="btn btn-primary me-2" onClick={() => setShowAddNewTopic(true)}>
                  Add More
                </button>
                <button className="btn btn-secondary" onClick={() => setShowExtraClass(true)}>
                  Extra Class
                </button>
              </div>
              
              {schedules.length === 0 ? (
                <div className="alert alert-warning">
                  No lesson schedules found. Click "Add More" to create schedules.
                </div>
              ) : (
                <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table className="table table-bordered table-striped">
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: '80px' }}>Lecture No.</th>
                        <th>Portion to be covered per hour*</th>
                        <th>Planned Delivery Date*</th>
                        <th>Actual Delivery Date*</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedules.map((schedule) => (
                        <tr key={schedule.schedule_id}>
                          <td>{schedule.session_number}</td>
                          <td>
                            <input
                              type="text"
                              className="form-control"
                              value={schedule.portion_to_be_covered || ""}
                              placeholder="Portion to be covered"
                              readOnly
                            />
                          </td>
                          <td>
                            <input
                              type="date"
                              className="form-control"
                              value={(schedule.conduction_date || "").split("T")[0] || ""}
                              onChange={(e) => updateSchedule(schedule.schedule_id, "conduction_date", e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="date"
                              className="form-control"
                              value={(schedule.actual_delivery_date || "").split("T")[0] || ""}
                              onChange={(e) => updateSchedule(schedule.schedule_id, "actual_delivery_date", e.target.value)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-danger" onClick={close}>
              Cancel
            </button>
            <button className="btn btn-success" onClick={saveChanges}>
              Save
            </button>
          </div>
        </div>
      </div>

      {showEditTopic && (
        <div className="modal show d-block" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit Topic Details</h5>
                <button type="button" className="btn-close" onClick={() => setShowEditTopic(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Topic Title *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editTopicData.topic_title}
                    onChange={(e) => setEditTopicData({ ...editTopicData, topic_title: e.target.value })}
                    placeholder="Enter topic title"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Topic Code</label>
                  <input
                    type="text"
                    className="form-control"
                    value={topic.topic_code}
                    disabled
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Instructor</label>
                  <select
                    className="form-select"
                    value={editTopicData.instructor_id}
                    onChange={(e) => setEditTopicData({ ...editTopicData, instructor_id: Number(e.target.value) })}
                  >
                    <option value={0}>Select Instructor</option>
                    {instructors.map((inst) => (
                      <option key={inst.value} value={inst.value}>
                        {inst.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Delivery Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={editTopicData.delivery_date}
                    onChange={(e) => setEditTopicData({ ...editTopicData, delivery_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditTopic(false)}>
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={saveEditedTopic}
                  disabled={loading || !editTopicData.topic_title.trim()}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddNewTopic && (
        <div className="modal show d-block" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add New Topic</h5>
                <button type="button" className="btn-close" onClick={() => setShowAddNewTopic(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Topic Title *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newTopicData.topic_title}
                    onChange={(e) => setNewTopicData({ ...newTopicData, topic_title: e.target.value })}
                    placeholder="Enter topic title"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Topic Code *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newTopicData.topic_code}
                    onChange={(e) => setNewTopicData({ ...newTopicData, topic_code: e.target.value })}
                    placeholder="Enter topic code"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Topic Content</label>
                  <textarea
                    className="form-control"
                    value={newTopicData.topic_content}
                    onChange={(e) => setNewTopicData({ ...newTopicData, topic_content: e.target.value })}
                    rows={3}
                    placeholder="Enter topic content"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Topic Hours</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newTopicData.topic_hrs}
                    onChange={(e) => setNewTopicData({ ...newTopicData, topic_hrs: e.target.value })}
                    placeholder="Enter topic hours"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Number of Sessions</label>
                  <input
                    type="number"
                    className="form-control"
                    value={newTopicData.num_of_sessions}
                    onChange={(e) => setNewTopicData({ ...newTopicData, num_of_sessions: Number(e.target.value) })}
                    min={1}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Assign Instructor *</label>
                  <select
                    className="form-select"
                    value={newTopicData.instructor_id}
                    onChange={(e) => setNewTopicData({ ...newTopicData, instructor_id: Number(e.target.value) })}
                  >
                    <option value={0}>Select Instructor</option>
                    {instructors.map((inst) => (
                      <option key={inst.value} value={inst.value}>
                        {inst.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Delivery Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={newTopicData.delivery_date}
                    onChange={(e) => setNewTopicData({ ...newTopicData, delivery_date: e.target.value })}
                    placeholder="Select delivery date"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddNewTopic(false)}>
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={addNewTopic}
                  disabled={loading || !newTopicData.topic_title || !newTopicData.topic_code || !newTopicData.instructor_id}
                >
                  {loading ? 'Adding...' : 'Add Topic'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showExtraClass && (
        <div className="modal show d-block" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Extra Class</h5>
                <button type="button" className="btn-close" onClick={() => setShowExtraClass(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Class Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={extraClassData.date}
                    onChange={(e) => setExtraClassData({ ...extraClassData, date: e.target.value })}
                    placeholder="DD-MM-YYYY"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Start Time</label>
                  <input
                    type="time"
                    className="form-control"
                    value={extraClassData.startTime}
                    onChange={(e) => setExtraClassData({ ...extraClassData, startTime: e.target.value })}
                    placeholder="HH:MM"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">End Time</label>
                  <input
                    type="time"
                    className="form-control"
                    value={extraClassData.endTime}
                    onChange={(e) => setExtraClassData({ ...extraClassData, endTime: e.target.value })}
                    placeholder="HH:MM"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-control"
                    value={extraClassData.notes}
                    onChange={(e) => setExtraClassData({ ...extraClassData, notes: e.target.value })}
                    rows={2}
                    placeholder="Optional notes..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowExtraClass(false)}>
                  Close
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={addExtraClass}
                  disabled={!extraClassData.date}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}