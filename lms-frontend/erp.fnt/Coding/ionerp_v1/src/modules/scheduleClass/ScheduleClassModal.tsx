import React, { useState, useEffect } from "react";
import { courseTypes, courses, sections, topics } from "./mockData";

interface ScheduleClassModalProps {
  open: boolean;
  onClose: () => void;
  refreshData: () => void;
  onSave?: (data: any) => void;
}

const ScheduleClassModal: React.FC<ScheduleClassModalProps> = ({ 
  open, 
  onClose, 
  refreshData,
  onSave 
}) => {
  const [formData, setFormData] = useState({
    courseTypeId: "1",
    courseId: "101",
    sectionId: "201",
    topicId: "301",
    classDate: "",
    startTime: "",
    endTime: ""
  });

  const [availableTopics, setAvailableTopics] = useState(topics.filter(t => t.courseId === 101));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Update available topics when course changes
    const courseId = parseInt(formData.courseId);
    const filteredTopics = topics.filter(t => t.courseId === courseId);
    setAvailableTopics(filteredTopics);
    
    // Reset topic to first available
    if (filteredTopics.length > 0) {
      setFormData(prev => ({ ...prev, topicId: filteredTopics[0].id.toString() }));
    }
  }, [formData.courseId]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.courseTypeId) newErrors.courseTypeId = "Course type is required";
    if (!formData.courseId) newErrors.courseId = "Course is required";
    if (!formData.sectionId) newErrors.sectionId = "Section is required";
    if (!formData.topicId) newErrors.topicId = "Topic is required";
    if (!formData.classDate) newErrors.classDate = "Date is required";
    if (!formData.startTime) newErrors.startTime = "Start time is required";
    if (!formData.endTime) newErrors.endTime = "End time is required";
    else if (formData.startTime && formData.endTime <= formData.startTime) {
      newErrors.endTime = "End time must be after start time";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    if (onSave) {
      onSave(formData);
    }
    
    // Reset form
    setFormData({
      courseTypeId: "1",
      courseId: "101",
      sectionId: "201",
      topicId: "301",
      classDate: "",
      startTime: "",
      endTime: ""
    });
    
    setErrors({});
    onClose();
    refreshData();
  };

  if (!open) return null;

  return (
    <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Schedule New Class</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="row mb-3">
                <div className="col-md-6">
                  <label className="form-label">Course Type</label>
                  <select
                    name="courseTypeId"
                    value={formData.courseTypeId}
                    onChange={handleChange}
                    className={`form-select ${errors.courseTypeId ? 'is-invalid' : ''}`}
                  >
                    {courseTypes.map(ct => (
                      <option key={ct.id} value={ct.id}>{ct.name}</option>
                    ))}
                  </select>
                  {errors.courseTypeId && <div className="invalid-feedback">{errors.courseTypeId}</div>}
                </div>
                <div className="col-md-6">
                  <label className="form-label">Course</label>
                  <select
                    name="courseId"
                    value={formData.courseId}
                    onChange={handleChange}
                    className={`form-select ${errors.courseId ? 'is-invalid' : ''}`}
                  >
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>{course.name}</option>
                    ))}
                  </select>
                  {errors.courseId && <div className="invalid-feedback">{errors.courseId}</div>}
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-6">
                  <label className="form-label">Section</label>
                  <select
                    name="sectionId"
                    value={formData.sectionId}
                    onChange={handleChange}
                    className={`form-select ${errors.sectionId ? 'is-invalid' : ''}`}
                  >
                    {sections.map(section => (
                      <option key={section.id} value={section.id}>{section.name}</option>
                    ))}
                  </select>
                  {errors.sectionId && <div className="invalid-feedback">{errors.sectionId}</div>}
                </div>
                <div className="col-md-6">
                  <label className="form-label">Topic</label>
                  <select
                    name="topicId"
                    value={formData.topicId}
                    onChange={handleChange}
                    className={`form-select ${errors.topicId ? 'is-invalid' : ''}`}
                  >
                    {availableTopics.map(topic => (
                      <option key={topic.id} value={topic.id}>{topic.name}</option>
                    ))}
                  </select>
                  {errors.topicId && <div className="invalid-feedback">{errors.topicId}</div>}
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-4">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    name="classDate"
                    value={formData.classDate}
                    onChange={handleChange}
                    className={`form-control ${errors.classDate ? 'is-invalid' : ''}`}
                  />
                  {errors.classDate && <div className="invalid-feedback">{errors.classDate}</div>}
                </div>
                <div className="col-md-4">
                  <label className="form-label">Start Time</label>
                  <input
                    type="time"
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleChange}
                    className={`form-control ${errors.startTime ? 'is-invalid' : ''}`}
                  />
                  {errors.startTime && <div className="invalid-feedback">{errors.startTime}</div>}
                </div>
                <div className="col-md-4">
                  <label className="form-label">End Time</label>
                  <input
                    type="time"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleChange}
                    className={`form-control ${errors.endTime ? 'is-invalid' : ''}`}
                  />
                  {errors.endTime && <div className="invalid-feedback">{errors.endTime}</div>}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Schedule Class
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ScheduleClassModal;
