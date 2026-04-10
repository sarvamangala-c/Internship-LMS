import React, { useState, useEffect } from 'react';
import { AttendanceManager, AttendanceReports } from '../../components/Attendance';
import { attendanceApi, AttendanceStats } from '../../api/attendanceApi';
import UIButton from '../../components/FormBuilder/fields/Button';
import { toast } from 'react-toastify';
import { 
  Users, 
  Calendar, 
  TrendingUp, 
  BookOpen, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  RefreshCw
} from 'lucide-react';

const ATTENDANCE_STORAGE_KEY = 'attendance_data';
const COURSES_STORAGE_KEY = 'courses_data';

interface Course {
  id: string;
  name: string;
  code: string;
  section: string;
  students: number;
}

interface Student {
  id: string;
  name: string;
  rollNumber: string;
  email: string;
}

const AttendanceManagementPage: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [showAttendanceManager, setShowAttendanceManager] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attendanceStats, setAttendanceStats] = useState<Record<string, AttendanceStats>>({});

  // Sample data
  const sampleCourses: Course[] = [
    { id: 'CS201', name: 'Data Structures', code: 'CS201', section: 'A', students: 45 },
    { id: 'CS202', name: 'Algorithms', code: 'CS202', section: 'B', students: 38 },
    { id: 'CS301', name: 'Database Systems', code: 'CS301', section: 'A', students: 42 },
    { id: 'CS302', name: 'Web Development', code: 'CS302', section: 'C', students: 35 }
  ];

  const sampleStudents: Student[] = [
    { id: '1', name: 'John Doe', rollNumber: 'CS2021001', email: 'john@university.edu' },
    { id: '2', name: 'Jane Smith', rollNumber: 'CS2021002', email: 'jane@university.edu' },
    { id: '3', name: 'Mike Johnson', rollNumber: 'CS2021003', email: 'mike@university.edu' },
    { id: '4', name: 'Sarah Williams', rollNumber: 'CS2021004', email: 'sarah@university.edu' },
    { id: '5', name: 'David Brown', rollNumber: 'CS2021005', email: 'david@university.edu' },
    { id: '6', name: 'Emily Davis', rollNumber: 'CS2021006', email: 'emily@university.edu' }
  ];

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      loadStudents();
      loadAttendanceStats();
    }
  }, [selectedCourse]);

  const loadCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try to load from localStorage first
      const savedCourses = localStorage.getItem(COURSES_STORAGE_KEY);
      if (savedCourses) {
        const parsedCourses = JSON.parse(savedCourses);
        setCourses(parsedCourses);
      } else {
        // Use sample data if no saved data
        setCourses(sampleCourses);
        // Save sample data to localStorage
        localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(sampleCourses));
      }
    } catch (err: any) {
      const errorMsg = 'Failed to load courses';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const saveCoursesToStorage = (courses: Course[]) => {
    try {
      localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(courses));
    } catch (error) {
      console.error('Error saving courses:', error);
    }
  };

  const loadStudents = async () => {
    if (!selectedCourse) return;
    
    try {
      setLoading(true);
      
      // In a real app, this would be an API call
      setStudents(sampleStudents);
    } catch (err: any) {
      const errorMsg = 'Failed to load students';
      toast.error(errorMsg);
      console.error('Students loading error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceStats = async () => {
    if (!selectedCourse) return;
    
    try {
      // Try to load from localStorage first
      const savedStats = localStorage.getItem(ATTENDANCE_STORAGE_KEY);
      if (savedStats) {
        const parsedStats = JSON.parse(savedStats);
        const courseStats = parsedStats[selectedCourse.id] || {};
        setAttendanceStats(courseStats);
      }
      
      // Also try to load from API (the attendanceApi already has localStorage fallback)
      const statsPromises = sampleStudents.map(async student => {
        const response = await attendanceApi.getStudentAttendanceStats(student.id, selectedCourse.id);
        return { studentId: student.id, stats: response.data as AttendanceStats };
      });
      
      const results = await Promise.all(statsPromises);
      const statsMap = results.reduce((acc, { studentId, stats }) => {
        acc[studentId] = stats as AttendanceStats;
        return acc;
      }, {} as Record<string, AttendanceStats>);
      
      setAttendanceStats(statsMap);
      
      // Save to localStorage
      const allStats = localStorage.getItem(ATTENDANCE_STORAGE_KEY) ? 
        JSON.parse(localStorage.getItem(ATTENDANCE_STORAGE_KEY)!) : {};
      allStats[selectedCourse.id] = statsMap;
      localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(allStats));
    } catch (err: any) {
      console.error('Stats loading error:', err);
      // Don't show error toast for stats as it's not critical
    }
  };

  const saveAttendanceStatsToStorage = (courseId: string, stats: Record<string, AttendanceStats>) => {
    try {
      const allStats = localStorage.getItem(ATTENDANCE_STORAGE_KEY) ? 
        JSON.parse(localStorage.getItem(ATTENDANCE_STORAGE_KEY)!) : {};
      allStats[courseId] = stats;
      localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(allStats));
    } catch (error) {
      console.error('Error saving attendance stats:', error);
    }
  };

  const handleRefresh = () => {
    if (selectedCourse) {
      loadStudents();
      loadAttendanceStats();
    }
    toast.success('Data refreshed');
  };

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600 bg-green-100';
    if (percentage >= 75) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getAttendanceIcon = (percentage: number) => {
    if (percentage >= 90) return <TrendingUp className="w-4 h-4" />;
    if (percentage >= 75) return <Clock className="w-4 h-4" />;
    return <AlertCircle className="w-4 h-4" />;
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              Attendance Management
            </h1>
            <p className="text-gray-600 mt-2">Track and manage student attendance</p>
          </div>
          <div className="flex gap-3">
            <UIButton
              onClick={handleRefresh}
              disabled={loading}
              className="bg-gray-500 hover:bg-gray-600 text-white"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </UIButton>
            <UIButton
              onClick={() => setShowReports(true)}
              disabled={!selectedCourse}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              View Reports
            </UIButton>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Course Selection */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Select Course</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {courses.map(course => (
            <div
              key={course.id}
              onClick={() => setSelectedCourse(course)}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                selectedCourse?.id === course.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                {selectedCourse?.id === course.id && (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                )}
              </div>
              <h3 className="font-semibold text-gray-900">{course.name}</h3>
              <p className="text-sm text-gray-600">{course.code} • Section {course.section}</p>
              <p className="text-sm text-gray-500 mt-1">{course.students} students</p>
            </div>
          ))}
        </div>
      </div>

      {selectedCourse && (
        <>
          {/* Course Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Students</p>
                  <p className="text-2xl font-bold text-gray-900">{students.length}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Attendance</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {students.length > 0 
                      ? (Object.values(attendanceStats).reduce((acc, stat) => acc + stat.attendancePercentage, 0) / students.length).toFixed(1)
                      : '0'}%
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Excellent</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {Object.values(attendanceStats).filter(stat => stat.attendancePercentage >= 90).length}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Needs Attention</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {Object.values(attendanceStats).filter(stat => stat.attendancePercentage < 75).length}
                  </p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">Quick Actions</h2>
              <UIButton
                onClick={() => setShowAttendanceManager(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Mark Attendance
              </UIButton>
            </div>
          </div>

          {/* Students List */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">Students Attendance</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Roll Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Classes
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Present
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Absent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Attendance %
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map(student => {
                    const stats = attendanceStats[student.id];
                    const attendancePercentage = stats?.attendancePercentage || 0;
                    
                    return (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                              <span className="text-xs font-medium text-gray-600">
                                {student.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{student.name}</div>
                              <div className="text-sm text-gray-500">{student.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {student.rollNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {stats?.totalClasses || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {stats?.presentCount || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {stats?.absentCount || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAttendanceColor(attendancePercentage)}`}>
                            {attendancePercentage.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm">
                            {getAttendanceIcon(attendancePercentage)}
                            <span className="ml-1">
                              {attendancePercentage >= 90 ? 'Excellent' : 
                               attendancePercentage >= 75 ? 'Good' : 'Needs Attention'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Empty State */}
      {!selectedCourse && (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <div className="bg-gray-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Users className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Course</h3>
          <p className="text-gray-600 mb-6">Choose a course from above to start managing attendance.</p>
        </div>
      )}

      {/* Modals */}
      {selectedCourse && (
        <>
          <AttendanceManager
            isOpen={showAttendanceManager}
            onClose={() => setShowAttendanceManager(false)}
            courseId={selectedCourse.id}
            courseName={selectedCourse.name}
            students={students}
          />
          
          <AttendanceReports
            isOpen={showReports}
            onClose={() => setShowReports(false)}
            courseId={selectedCourse.id}
            courseName={selectedCourse.name}
          />
        </>
      )}
    </div>
  );
};

export default AttendanceManagementPage;
