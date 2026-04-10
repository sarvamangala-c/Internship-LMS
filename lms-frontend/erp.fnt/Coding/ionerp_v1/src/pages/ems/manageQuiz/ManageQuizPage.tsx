import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Users, Eye } from 'lucide-react';
import { useManageQuizService } from '../../../services/ems/manageQuizService';
import FixedAddQuizPage from './FixedAddQuizPage';

interface Option { value: string; label: string; }
interface Quiz {
  quiz_id: number; quiz_title: string; academic_batch_id: number; semester_id: number;
  crs_id: number; quiz_date?: string; quiz_time?: string; duration?: string; status: number;
}

export default function ManageQuizPage() {
  const service = useManageQuizService();

  const [curriculums, setCurriculums] = useState<Option[]>([]);
  const [terms, setTerms] = useState<Option[]>([]);
  const [courses, setCourses] = useState<Option[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);

  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showEntries, setShowEntries] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [loadingTerm, setLoadingTerm] = useState(false);
  const [loadingCourse, setLoadingCourse] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Quiz Questions modal
  const [questionsModal, setQuestionsModal] = useState<{ quiz: Quiz; data: any } | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Add-question form state
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [aqText, setAqText] = useState('');
  const [aqType, setAqType] = useState(1); // 1=MCQ, 2=True/False, 3=Short Answer
  const [aqMarks, setAqMarks] = useState('');
  const [aqOptions, setAqOptions] = useState([{ value: '', is_answer: 0 }, { value: '', is_answer: 0 }, { value: '', is_answer: 0 }, { value: '', is_answer: 0 }]);
  const [submittingQ, setSubmittingQ] = useState(false);

  // View Students modal
  const [studentsModal, setStudentsModal] = useState<{ quiz: Quiz; students: any[] } | null>(null);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Load curriculums on mount
  useEffect(() => {
    setLoadingBatch(true);
    const doneA = () => setLoadingBatch(false);
    service.getCurriculums()
      .then((data: any) => { setCurriculums(Array.isArray(data) ? data : []); doneA(); }, doneA);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load terms when batch changes
  useEffect(() => {
    if (!selectedBatch) { setTerms([]); setSelectedTerm(''); setCourses([]); setSelectedCourse(''); return; }
    setLoadingTerm(true);
    const doneB = () => setLoadingTerm(false);
    service.getSemesters()
      .then((data: any) => { setTerms(Array.isArray(data) ? data : []); setSelectedTerm(''); setCourses([]); setSelectedCourse(''); doneB(); }, doneB);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatch]);

  // Load courses when term changes
  useEffect(() => {
    if (!selectedBatch || !selectedTerm) { setCourses([]); setSelectedCourse(''); return; }
    setLoadingCourse(true);
    const doneC = () => setLoadingCourse(false);
    service.getCourses(Number(selectedBatch))
      .then((data: any) => { setCourses(Array.isArray(data) ? data : []); setSelectedCourse(''); doneC(); }, doneC);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatch, selectedTerm]);

  // Load quizzes when course changes
  useEffect(() => {
    if (!selectedCourse || !selectedBatch || !selectedTerm) { setQuizzes([]); return; }
    setLoading(true);
    const doneD = () => setLoading(false);
    service.getQuizList({ academic_batch_id: Number(selectedBatch), semester_id: Number(selectedTerm), crs_id: Number(selectedCourse) })
      .then((data: any) => { setQuizzes(Array.isArray(data) ? data : []); doneD(); }, doneD);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourse]);

  const handleDelete = async (quizId: number) => {
    if (!window.confirm('Are you sure you want to delete this quiz?')) return;
    try { await service.deleteQuiz(quizId); setQuizzes(prev => prev.filter(q => q.quiz_id !== quizId)); }
    catch { alert('Failed to delete quiz'); }
  };

  const openQuestions = async (quiz: Quiz) => {
    setQuestionsModal({ quiz, data: null });
    setLoadingQuestions(true);
    try {
      const data = await service.getQuizDetails(quiz.quiz_id);
      setQuestionsModal({ quiz, data });
    } catch { setQuestionsModal({ quiz, data: null }); }
    finally { setLoadingQuestions(false); }
  };

  const openStudents = async (quiz: Quiz) => {
    setStudentsModal({ quiz, students: [] });
    setLoadingStudents(true);
    try {
      const data = await service.getStudents(quiz.quiz_id);
      const arr = Array.isArray(data) ? data : (data?.items ?? []);
      setStudentsModal({ quiz, students: arr });
    } catch { setStudentsModal({ quiz, students: [] }); }
    finally { setLoadingStudents(false); }
  };

  const refreshQuestions = async (quiz: Quiz) => {
    setLoadingQuestions(true);
    try {
      const data = await service.getQuizDetails(quiz.quiz_id);
      setQuestionsModal({ quiz, data });
    } catch {}
    finally { setLoadingQuestions(false); }
  };

  const addQuestion = async () => {
    if (!questionsModal) return;
    if (!aqText.trim()) { alert('Question text is required'); return; }
    const authState = (window as any).__AUTH_STATE__ || JSON.parse(localStorage.getItem('auth_state') || '{}');
    const userId = authState?.user_id ?? authState?.id ?? 1;
    const payload: any = {
      question: aqText.trim(),
      question_type: aqType,
      marks: aqMarks ? Number(aqMarks) : null,
      created_by: userId,
      options: aqType === 1 ? aqOptions.filter(o => o.value.trim()).map(o => ({ option_value: o.value.trim(), is_answer: o.is_answer })) : [],
      clo_ids: [],
      bloom_ids: [],
    };
    setSubmittingQ(true);
    try {
      const res: any = await (await import('../../../utils/api')).default
        .post(`/api/v1/manage-quiz/${questionsModal.quiz.quiz_id}/question`, payload);
      if (res.data?.status === false) { alert(res.data?.message || 'Failed to add question'); return; }
      alert('Question added successfully!');
      setAqText(''); setAqMarks(''); setAqType(1);
      setAqOptions([{ value: '', is_answer: 0 }, { value: '', is_answer: 0 }, { value: '', is_answer: 0 }, { value: '', is_answer: 0 }]);
      setShowAddQuestion(false);
      await refreshQuestions(questionsModal.quiz);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to add question');
    } finally { setSubmittingQ(false); }
  };

  const filteredQuizzes = quizzes.filter(q => q.quiz_title.toLowerCase().includes(searchTerm.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filteredQuizzes.length / showEntries));
  const pageData = filteredQuizzes.slice((currentPage - 1) * showEntries, currentPage * showEntries);
  const start = filteredQuizzes.length === 0 ? 0 : (currentPage - 1) * showEntries + 1;
  const end = Math.min(currentPage * showEntries, filteredQuizzes.length);

  const getStatusBadge = (status: number) => status === 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
  const getStatusText = (status: number) => status === 1 ? 'Active' : 'Closed';

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-[#1f3a4f] text-white px-4 py-2.5">
          <h1 className="text-sm font-semibold">Manage Quiz</h1>
        </div>

        <div className="p-4">
          {/* Filter Row */}
          <div className="grid grid-cols-4 gap-4 mb-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Curriculum <span className="text-red-500">*</span></label>
              <select
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 bg-white"
                value={selectedBatch}
                onChange={e => { setSelectedBatch(e.target.value); setCurrentPage(1); }}
                disabled={loadingBatch}
              >
                <option value="">{loadingBatch ? 'Loading...' : 'Select Curriculum'}</option>
                {curriculums.map(c => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Term <span className="text-red-500">*</span></label>
              <select
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 bg-white"
                value={selectedTerm}
                onChange={e => { setSelectedTerm(e.target.value); setCurrentPage(1); }}
                disabled={!selectedBatch || loadingTerm}
              >
                <option value="">{loadingTerm ? 'Loading...' : 'Select Term'}</option>
                {terms.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Course <span className="text-red-500">*</span></label>
              <select
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 bg-white"
                value={selectedCourse}
                onChange={e => { setSelectedCourse(e.target.value); setCurrentPage(1); }}
                disabled={!selectedTerm || loadingCourse}
              >
                <option value="">{loadingCourse ? 'Loading...' : 'Select Course'}</option>
                {courses.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  if (!selectedBatch || !selectedTerm || !selectedCourse) { alert('Please select Curriculum, Term and Course first'); return; }
                  setShowAddModal(true);
                }}
                className="bg-[#1a73e8] text-white px-4 py-1.5 rounded flex items-center gap-1.5 text-sm hover:bg-blue-700 whitespace-nowrap"
              >
                <Plus size={15} /> Add Quiz ⊞
              </button>
            </div>
          </div>

          {/* Table Controls */}
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Show</span>
              <select
                className="border border-gray-300 rounded px-2 py-1 text-sm"
                value={showEntries}
                onChange={e => { setShowEntries(Number(e.target.value)); setCurrentPage(1); }}
              >
                {[10, 25, 50, 100].map(n => <option key={n}>{n}</option>)}
              </select>
              <span>entries</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Search:</span>
              <input
                type="text"
                className="border border-gray-300 rounded px-2 py-1 text-sm w-48 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-gray-200 rounded">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#d6dde3] text-gray-700">
                <tr>
                  <th className="px-3 py-2 w-8"><input type="checkbox" /></th>
                  <th className="px-3 py-2">Sl No. ⇅</th>
                  <th className="px-3 py-2">Quiz Name (Total Marks) ⇅</th>
                  <th className="px-3 py-2">Section(s) ⇅</th>
                  <th className="px-3 py-2">Topic(s) ⇅</th>
                  <th className="px-3 py-2">Quiz Date ⇅</th>
                  <th className="px-3 py-2">Start Time ⇅</th>
                  <th className="px-3 py-2 whitespace-nowrap">Duration in Hrs ⇅</th>
                  <th className="px-3 py-2">Quiz Questions</th>
                  <th className="px-3 py-2">View Students</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={12} className="px-4 py-10 text-center text-gray-400">Loading...</td></tr>
                ) : pageData.length > 0 ? pageData.map((quiz, idx) => (
                  <tr key={quiz.quiz_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2"><input type="checkbox" /></td>
                    <td className="px-3 py-2">{(currentPage - 1) * showEntries + idx + 1}</td>
                    <td className="px-3 py-2 text-blue-600 font-medium">{quiz.quiz_title} ({quiz.duration || 'N/A'} mins)</td>
                    <td className="px-3 py-2 text-center text-xs">—</td>
                    <td className="px-3 py-2 text-xs">—</td>
                    <td className="px-3 py-2 text-xs">{quiz.quiz_date || '—'}</td>
                    <td className="px-3 py-2 text-xs">{quiz.quiz_time || '—'}</td>
                    <td className="px-3 py-2 text-xs">{(Number(quiz.duration || 0) / 60).toFixed(1)}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => openQuestions(quiz)} className="text-blue-600 hover:text-blue-800">
                        <Eye size={15} />
                      </button>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => openStudents(quiz)} className="text-green-600 hover:text-green-700">
                        <Users size={16} />
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => handleDelete(quiz.quiz_id)} className="text-red-500 hover:text-red-600">
                        <Trash2 size={15} />
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getStatusBadge(quiz.status)}`}>{getStatusText(quiz.status)}</span>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-400 text-sm">No data available in table</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center mt-3 text-sm text-gray-600">
            <span>Showing {start} to {end} of {filteredQuizzes.length} entries</span>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-40 hover:bg-gray-50"
              >Previous</button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-40 hover:bg-gray-50"
              >Next</button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Quiz Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-auto">
            <FixedAddQuizPage
              initialBatchId={Number(selectedBatch)}
              initialSemesterId={Number(selectedTerm)}
              initialCourseId={Number(selectedCourse)}
              onSuccess={() => {
                setShowAddModal(false);
                service.getQuizList({ academic_batch_id: Number(selectedBatch), semester_id: Number(selectedTerm), crs_id: Number(selectedCourse) })
                  .then(data => setQuizzes(Array.isArray(data) ? data : []));
              }}
              onCancel={() => setShowAddModal(false)}
            />
          </div>
        </div>
      )}

      {/* ── Quiz Questions Modal ── */}
      {questionsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-6">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl mx-4 my-auto">
            <div className="bg-[#1f3a4f] text-white px-5 py-3 rounded-t-lg flex justify-between items-center">
              <span className="font-semibold text-sm">Quiz Questions — {questionsModal.quiz.quiz_title}</span>
              <button onClick={() => setQuestionsModal(null)} className="text-white text-2xl font-light">&times;</button>
            </div>
            <div className="p-5">
              {loadingQuestions ? (
                <p className="text-center py-10 text-gray-400">Loading questions...</p>
              ) : questionsModal.data ? (
                <div className="space-y-4">
                  {/* Quiz info */}
                  <div className="grid grid-cols-3 gap-3 text-xs border border-gray-200 rounded p-3 bg-gray-50">
                    {[
                      { label: 'Title', value: questionsModal.data.quiz_title || questionsModal.quiz.quiz_title },
                      { label: 'Date', value: questionsModal.data.quiz_date || '—' },
                      { label: 'Time', value: questionsModal.data.quiz_time || '—' },
                      { label: 'Duration', value: questionsModal.data.duration ? `${questionsModal.data.duration} mins` : '—' },
                      { label: 'Status', value: questionsModal.data.status === 1 ? 'Active' : 'Closed' },
                      { label: 'Total Questions', value: questionsModal.data.questions?.length ?? (questionsModal.data.total_questions ?? '—') },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <span className="text-gray-500 block">{label}</span>
                        <span className="font-medium text-gray-800">{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Questions list */}
                  {Array.isArray(questionsModal.data.questions) && questionsModal.data.questions.length > 0 ? (
                    <div className="border border-gray-200 rounded overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-[#d6dde3] text-gray-700">
                          <tr>
                            <th className="px-3 py-2 w-8">#</th>
                            <th className="px-3 py-2 text-left">Question</th>
                            <th className="px-3 py-2 w-20">Marks</th>
                            <th className="px-3 py-2 w-24">Type</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {questionsModal.data.questions.map((q: any, i: number) => (
                            <tr key={q.question_id ?? i} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-center">{i + 1}</td>
                              <td className="px-3 py-2">{q.question_text || q.question || '—'}</td>
                              <td className="px-3 py-2 text-center">{q.marks ?? q.max_marks ?? '—'}</td>
                              <td className="px-3 py-2">{q.question_type || q.type || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400 text-sm">No questions added to this quiz yet.</div>
                  )}
                </div>
              ) : (
                <p className="text-center py-10 text-gray-400">No data available for this quiz.</p>
              )}
            </div>
            {/* Add Question form */}
            <div className="border-t">
              {!showAddQuestion ? (
                <div className="px-5 py-3 flex justify-between items-center">
                  <button
                    onClick={() => setShowAddQuestion(true)}
                    className="flex items-center gap-1.5 text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded font-medium"
                  >
                    <Plus size={14} /> Add Question
                  </button>
                  <button onClick={() => { setQuestionsModal(null); setShowAddQuestion(false); }}
                    className="px-5 py-1.5 text-sm border border-gray-300 rounded text-gray-600 hover:bg-gray-50">Close</button>
                </div>
              ) : (
                <div className="p-5 bg-gray-50 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700">Add New Question</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-gray-600 block mb-1">Question Text *</label>
                      <textarea rows={2} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm resize-none focus:outline-none"
                        value={aqText} onChange={e => setAqText(e.target.value)} placeholder="Enter question..." />
                    </div>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Question Type</label>
                        <select className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white focus:outline-none"
                          value={aqType} onChange={e => setAqType(Number(e.target.value))}>
                          <option value={1}>MCQ</option>
                          <option value={2}>True / False</option>
                          <option value={3}>Short Answer</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Marks</label>
                        <input type="number" min={1} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none"
                          value={aqMarks} onChange={e => setAqMarks(e.target.value)} placeholder="e.g. 2" />
                      </div>
                    </div>
                  </div>

                  {/* MCQ Options */}
                  {aqType === 1 && (
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Options (tick correct answer)</label>
                      <div className="space-y-1.5">
                        {aqOptions.map((opt, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <input type="radio" name="aq_correct" checked={opt.is_answer === 1}
                              onChange={() => setAqOptions(prev => prev.map((o, j) => ({ ...o, is_answer: j === i ? 1 : 0 })))}
                              className="accent-green-600" />
                            <input type="text" className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none"
                              placeholder={`Option ${i + 1}`} value={opt.value}
                              onChange={e => setAqOptions(prev => prev.map((o, j) => j === i ? { ...o, value: e.target.value } : o))} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* True/False options auto-built */}
                  {aqType === 2 && (
                    <div className="flex gap-4 text-sm">
                      {['True', 'False'].map((label, i) => (
                        <label key={label} className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" name="tf_correct" className="accent-green-600"
                            checked={aqOptions[i]?.is_answer === 1}
                            onChange={() => setAqOptions([
                              { value: 'True', is_answer: i === 0 ? 1 : 0 },
                              { value: 'False', is_answer: i === 1 ? 1 : 0 },
                              { value: '', is_answer: 0 }, { value: '', is_answer: 0 }
                            ])} />
                          {label}
                        </label>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <button onClick={() => setShowAddQuestion(false)}
                      className="px-4 py-1.5 text-sm border border-gray-300 rounded text-gray-600 hover:bg-gray-100">Cancel</button>
                    <button onClick={addQuestion} disabled={submittingQ}
                      className="px-4 py-1.5 text-sm bg-[#1f3a4f] hover:bg-[#17404e] text-white rounded disabled:opacity-50">
                      {submittingQ ? 'Saving...' : 'Save Question'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── View Students Modal ── */}
      {studentsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-6">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl mx-4 my-auto">
            <div className="bg-[#1f3a4f] text-white px-5 py-3 rounded-t-lg flex justify-between items-center">
              <span className="font-semibold text-sm">View Students — {studentsModal.quiz.quiz_title}</span>
              <button onClick={() => setStudentsModal(null)} className="text-white text-2xl font-light">&times;</button>
            </div>
            <div className="p-5">
              {loadingStudents ? (
                <p className="text-center py-10 text-gray-400">Loading students...</p>
              ) : studentsModal.students.length > 0 ? (
                <div className="border border-gray-200 rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-[#d6dde3] text-gray-700">
                      <tr>
                        <th className="px-3 py-2 w-8">#</th>
                        <th className="px-3 py-2 text-left">USN</th>
                        <th className="px-3 py-2 text-left">Student Name</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Score</th>
                        <th className="px-3 py-2">Submitted At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {studentsModal.students.map((s: any, i: number) => (
                        <tr key={s.student_id ?? i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-center">{i + 1}</td>
                          <td className="px-3 py-2">{s.usno || s.usn || '—'}</td>
                          <td className="px-3 py-2">{s.full_name || s.name || `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || '—'}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              s.status === 'submitted' || s.is_submitted ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {s.status || (s.is_submitted ? 'Submitted' : 'Pending')}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">{s.score ?? s.marks_obtained ?? '—'}</td>
                          <td className="px-3 py-2 text-center">{s.submitted_at ? new Date(s.submitted_at).toLocaleString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center py-10 text-gray-400 text-sm">No students assigned to this quiz yet.</p>
              )}
            </div>
            <div className="px-5 py-3 border-t flex justify-end">
              <button onClick={() => setStudentsModal(null)}
                className="px-5 py-1.5 text-sm border border-gray-300 rounded text-gray-600 hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}