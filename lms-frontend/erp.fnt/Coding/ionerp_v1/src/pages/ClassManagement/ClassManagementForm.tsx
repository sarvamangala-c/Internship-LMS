import React, { useState, useEffect } from 'react';
import UIButton from '../../components/FormBuilder/fields/Button';
import Calendar from '../../components/Calendar/Calendar';
import StudentList from '../../components/StudentList/StudentList';
import { 
  courses, 
  sections, 
  topicsByCourse, 
  getCourseNameById,
  curriculums,
  terms,
  students,
  getCurriculumNameById,
  getTermNameById
} from '../../constants/scheduleConstants';
import { validateScheduleClass, hasValidationErrors } from '../../schemas/scheduleClassSchema';
import { toast } from 'react-toastify';

interface ClassManagementFormProps {
  onClose: () => void;
  onSave: (classData: any) => void;
}

const ClassManagementForm: React.FC<ClassManagementFormProps> = ({ onClose, onSave }) => {
  const [formData, setFormData] = useState({
    curriculumId: '1',
    termId: '1',
    courseTypeId: '1',
    courseId: '101',
    sectionId: '201',
    topicId: '301',
    classDate: '',
    startTime: '',
    endTime: '',
    location: '',
    curriculum: '',
    term: '',
    course: '',
    section: '',
    topic: ''
  });

  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [availableTopics, setAvailableTopics] = useState(topicsByCourse[101] || []);

  useEffect(() => {
    const curriculumName = getCurriculumNameById(Number(formData.curriculumId));
    setFormData(prev => ({ ...prev, curriculum: curriculumName }));
  }, [formData.curriculumId]);

  useEffect(() => {
    const termName = getTermNameById(Number(formData.termId));
    setFormData(prev => ({ ...prev, term: termName }));
  }, [formData.termId]);

  useEffect(() => {
    const courseName = getCourseNameById(Number(formData.courseId));
    setFormData(prev => ({ ...prev, course: courseName }));

    const topics = topicsByCourse[Number(formData.courseId) as keyof typeof topicsByCourse] || [];
    setAvailableTopics(topics);

    if (topics.length > 0) {
      setFormData(prev => ({
        ...prev,
        topicId: topics[0].id.toString(),
        topic: topics[0].name
      }));
    }
  }, [formData.courseId]);

  useEffect(() => {
    const section = sections.find(s => s.id === Number(formData.sectionId));
    if (section) {
      setFormData(prev => ({ ...prev, section: section.name }));
    }
  }, [formData.sectionId]);

  useEffect(() => {
    const topic = availableTopics.find(t => t.id === Number(formData.topicId));
    if (topic) {
      setFormData(prev => ({ ...prev, topic: topic.name }));
    }
  }, [formData.topicId, availableTopics]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleDateChange = (date: string) => {
    setFormData(prev => ({
      ...prev,
      classDate: date
    }));
    if (errors.classDate) {
      setErrors(prev => ({ ...prev, classDate: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validateScheduleClass(formData);

    if (hasValidationErrors(validationErrors)) {
      setErrors(validationErrors);
      toast.error('Please fix the validation errors');
      return;
    }

    setErrors({});

    const time = `${formData.startTime} - ${formData.endTime}`;
    const selectedStudentData = students.filter(student => selectedStudents.includes(student.id));

    const classData = {
      curriculum: formData.curriculum,
      term: formData.term,
      date: formData.classDate,
      time,
      courseType: formData.courseTypeId === '1' ? 'Theory' : 'Practical',
      course: formData.course,
      section: formData.section,
      topic: formData.topic,
      location: formData.location,
      students: selectedStudentData
    };

    onSave(classData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-6">Class Management</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Curriculum and Term */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Curriculum
                </label>
                <select
                  name="curriculumId"
                  value={formData.curriculumId}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.curriculumId ? 'border-red-500' : 'border-gray-300'
                    }`}
                >
                  {curriculums.map(curriculum => (
                    <option key={curriculum.id} value={curriculum.id}>
                      {curriculum.name}
                    </option>
                  ))}
                </select>
                {errors.curriculumId && (
                  <p className="text-red-500 text-xs mt-1">{errors.curriculumId}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Term
                </label>
                <select
                  name="termId"
                  value={formData.termId}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.termId ? 'border-red-500' : 'border-gray-300'
                    }`}
                >
                  {terms.map(term => (
                    <option key={term.id} value={term.id}>
                      {term.name}
                    </option>
                  ))}
                </select>
                {errors.termId && (
                  <p className="text-red-500 text-xs mt-1">{errors.termId}</p>
                )}
              </div>
            </div>

            {/* Calendar and Class Timings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Calendar
                selectedDate={formData.classDate}
                onDateChange={handleDateChange}
                className={errors.classDate ? 'border-red-500' : ''}
              />
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.startTime ? 'border-red-500' : 'border-gray-300'
                    }`}
                  required
                />
                {errors.startTime && (
                  <p className="text-red-500 text-xs mt-1">{errors.startTime}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.endTime ? 'border-red-500' : 'border-gray-300'
                    }`}
                  required
                />
                {errors.endTime && (
                  <p className="text-red-500 text-xs mt-1">{errors.endTime}</p>
                )}
              </div>
            </div>

            {/* Course Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Course Type
                </label>
                <select
                  name="courseTypeId"
                  value={formData.courseTypeId}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.courseTypeId ? 'border-red-500' : 'border-gray-300'
                    }`}
                >
                  <option value="1">Theory</option>
                  <option value="2">Practical</option>
                </select>
                {errors.courseTypeId && (
                  <p className="text-red-500 text-xs mt-1">{errors.courseTypeId}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Course
                </label>
                <select
                  name="courseId"
                  value={formData.courseId}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.courseId ? 'border-red-500' : 'border-gray-300'
                    }`}
                >
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
                {errors.courseId && (
                  <p className="text-red-500 text-xs mt-1">{errors.courseId}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Section
                </label>
                <select
                  name="sectionId"
                  value={formData.sectionId}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.sectionId ? 'border-red-500' : 'border-gray-300'
                    }`}
                >
                  {sections.map(section => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
                {errors.sectionId && (
                  <p className="text-red-500 text-xs mt-1">{errors.sectionId}</p>
                )}
              </div>
            </div>

            {/* Topic and Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Topic
                </label>
                <select
                  name="topicId"
                  value={formData.topicId}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.topicId ? 'border-red-500' : 'border-gray-300'
                    }`}
                >
                  {availableTopics.map(topic => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
                    </option>
                  ))}
                </select>
                {errors.topicId && (
                  <p className="text-red-500 text-xs mt-1">{errors.topicId}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Classroom / Location
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="e.g., Room 201, Online"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Student List */}
            <StudentList
              students={students}
              selectedStudents={selectedStudents}
              onStudentSelectionChange={setSelectedStudents}
            />

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <UIButton
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg"
              >
                Cancel
              </UIButton>
              <UIButton
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                Save Class
              </UIButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ClassManagementForm;
