import React, { useEffect, useState } from "react";
import { useTopicService } from "../../../services/ems/topicService";

type Topic = {
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
};

interface AssignInstructorModalProps {
  filters: {
    curriculum: number;
    semester: number;
    course: number;
    section: number;
  };
  close: () => void;
  refresh: () => void;
  topics: Topic[];
  updateTopicInTable?: (topicId: number, updates: Partial<Topic>) => void;
  addTopicToTable?: (newTopic: Topic) => void;
}

export default function AssignInstructorModal({ filters, close, refresh, topics: allTopics, updateTopicInTable, addTopicToTable }: AssignInstructorModalProps) {
  console.log("DEBUG: AssignInstructorModal rendered with filters:", filters, "topics from parent:", allTopics);
  const topicService = useTopicService();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingTopics, setImportingTopics] = useState(false);

  const isValidFilters = filters.course && filters.semester && filters.section && filters.curriculum;

  useEffect(() => {
    if (isValidFilters) {
      loadCudosTopics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isValidFilters]);

  const loadCudosTopics = async () => {
    try {
      setLoading(true);
      
      const allTopicsRes: any = await topicService.getCudosTopics({
        academic_batch_id: filters.curriculum,
        course_id: filters.course,
        semester_id: filters.semester,
        section_id: filters.section
      });
      
      console.log("DEBUG: All topics response:", allTopicsRes);
      const allTopicsArray = Array.isArray(allTopicsRes) ? allTopicsRes : (allTopicsRes?.data || []);
      
      if (allTopicsArray.length > 0) {
        setTopics(allTopicsArray as Topic[]);
      } else {
        setTopics(allTopics);
      }
    } catch (error) {
      console.error("Error loading topics", error);
      setTopics(allTopics);
    } finally {
      setLoading(false);
    }
  };

  const importTopics = async () => {
    try {
      setImportingTopics(true);
      
      const response: any = await topicService.importTopic({
        academic_batch_id: filters.curriculum,
        course_id: filters.course,
        semester_id: filters.semester,
        section_id: filters.section,
        created_by: 1 // TODO: Get from user context
      });
      
      // Use backend response message directly
      alert(response.message);
      
      // Refresh and close on successful import
      if (response.success) {
        refresh();
        close();
      }
    } catch (error) {
      console.error("Error importing topics", error);
      alert("Error importing topics");
    } finally {
      setImportingTopics(false);
    }
  };

  return (
    <div className="modal show d-block" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.5)', overflowY: 'auto' }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              Import Topics
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={close}
            ></button>
          </div>

          <div className="modal-body">
            {!isValidFilters && (
              <div className="alert alert-warning">
                Please select all required filters (Curriculum, Semester, Course, Section) from the main page before importing topics.
              </div>
            )}

            {isValidFilters && loading && (
              <div className="text-center py-4">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-2">Loading topics...</p>
              </div>
            )}

            {!loading && topics.length === 0 && (
              <div className="alert alert-info">
                No topics available for import. All topics may have already been imported.
              </div>
            )}

            {!loading && topics.length > 0 && (
              <>
                <div className="alert alert-info mb-3">
                  <strong>Instructions:</strong> Click "Import Topics" to import all topics shown in the table. Only new topics will be imported - already imported topics will be skipped.
                </div>
                
                <div className="table-responsive">
                  <table className="table table-bordered table-striped table-hover">
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: '50px' }}>Sl.No</th>
                        <th>Topic Title</th>
                        <th>Topic Code</th>
                        <th>Hours</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topics.map((topic, index) => (
                        <tr key={topic.topic_id}>
                          <td>{index + 1}</td>
                          <td>{topic.topic_title}</td>
                          <td>{topic.topic_code}</td>
                          <td>{topic.topic_hrs || topic.num_of_sessions || "-"} hrs</td>
                          <td>
                            {topic.mapping_id ? (
                              <span className="badge bg-success">Already Imported</span>
                            ) : (
                              <span className="badge bg-warning">Ready to Import</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={close}
            >
              Close
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={importTopics}
              disabled={importingTopics || !isValidFilters}
            >
              {importingTopics ? 'Importing...' : 'Import Topics'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}