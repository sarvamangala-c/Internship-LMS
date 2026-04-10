import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useManageQuizService } from '../../../services/ems/manageQuizService';
import type { QuizDetails, QuizStudent } from '../../../types/ems/quiz';

export default function ManageStudentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const service = useManageQuizService();
  
  const [quizDetails, setQuizDetails] = useState<QuizDetails | null>(null);
  const [students, setStudents] = useState<QuizStudent[]>([]);
  const [selectedStudents, setSelectedStudents] = useState(new Set<number>());
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const details = await service.getQuizDetails(Number(id));
      const studentList = await service.getStudents(Number(id));
      setQuizDetails(details);
      setStudents(studentList);
      // Pre-select students who are already mapped
      setSelectedStudents(new Set(studentList.map((s: QuizStudent) => s.ssd_id)));
    } catch (error) {
      console.error("Failed to load students:", error);
    } finally {
      setLoading(false);
    }
  }, [id, service]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedStudents(new Set(students.map((s: QuizStudent) => s.ssd_id)));
    } else {
      setSelectedStudents(new Set());
    }
  };

  const toggleStudent = (ssd_id: number) => {
    const next = new Set(selectedStudents);
    if (next.has(ssd_id)) next.delete(ssd_id);
    else next.add(ssd_id);
    setSelectedStudents(next);
  };

  const handleSave = async () => {
    try {
      await service.shareQuiz(Number(id), { created_by: 1 }); // Backend handles the actual sharing logic based on sections
      alert("Students shared successfully!");
      navigate('/ems/manageQuiz');
    } catch (error) {
      console.error("Failed to save students:", error);
      alert("Failed to share quiz with students.");
    }
  };

  const filteredStudents = students.filter((s: QuizStudent) => 
    (s.student_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.student_usn || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-6 flex justify-center items-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1f4e5f]"></div></div>;
  if (!quizDetails) return <div className="p-6">Quiz not found</div>;

  const { quiz } = quizDetails;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col max-w-6xl mx-auto">
        <div className="bg-[#1f4e5f] text-white px-6 py-3 flex justify-between items-center">
          <h1 className="text-lg font-semibold">Manage Student Information</h1>
          <button onClick={() => navigate('/ems/manageQuiz')} className="text-white/80 hover:text-white">✕</button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {/* Quiz Info Header */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-y-4 gap-x-8 mb-8 text-sm border-b pb-6 bg-gray-50 p-4 rounded-lg">
            <div>
              <p className="text-gray-500 mb-1">Academic Batch:</p>
              <p className="font-semibold">{quiz.academic_batch_id}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Semester:</p>
              <p className="font-semibold">{quiz.semester_id}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Course:</p>
              <p className="font-semibold">{quiz.crs_id}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Quiz Title:</p>
              <p className="font-semibold">{quiz.quiz_title}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Quiz Info:</p>
              <p className="font-semibold">{quiz.quiz_title}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Duration:</p>
              <p className="font-semibold">{quiz.duration} Mins.</p>
            </div>
          </div>

          {/* Search */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-700">Mapped Students ({students.length})</h3>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search by USN or Student Name"
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-80 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Students Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input 
                      type="checkbox" 
                      onChange={toggleSelectAll}
                      checked={selectedStudents.size === students.length && students.length > 0}
                    />
                  </th>
                  <th className="px-4 py-3">USN</th>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3 text-center">Answer Count</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map(student => (
                    <tr key={student.ssd_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <input 
                          type="checkbox" 
                          checked={selectedStudents.has(student.ssd_id)}
                          onChange={() => toggleStudent(student.ssd_id)}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium">{student.student_usn}</td>
                      <td className="px-4 py-3">{student.student_name || 'N/A'}</td>
                      <td className="px-4 py-3 text-center">{student.answer_count}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${student.answer_count > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {student.answer_count > 0 ? 'Attempted' : 'Not Attempted'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No students found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
          <button 
            onClick={handleSave}
            className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition-colors font-medium"
          >
            Share Quiz
          </button>
          <button 
            onClick={() => navigate('/ems/manageQuiz')}
            className="bg-white border border-gray-300 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-50 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

