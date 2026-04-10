import React, { useState } from 'react';
import ClassManagementForm from './ClassManagementForm';
import UIButton from '../../components/FormBuilder/fields/Button';

interface ScheduledClass {
  id: string;
  curriculum: string;
  term: string;
  date: string;
  time: string;
  courseType: string;
  course: string;
  section: string;
  topic: string;
  location: string;
  students: Array<{
    id: number;
    name: string;
    email: string;
    rollNumber: string;
  }>;
}

const ClassManagementPage: React.FC = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [scheduledClasses, setScheduledClasses] = useState<ScheduledClass[]>([]);

  const handleOpenForm = () => {
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
  };

  const handleSaveClass = (classData: any) => {
    const newClass: ScheduledClass = {
      id: Date.now().toString(),
      ...classData
    };
    
    setScheduledClasses(prev => [...prev, newClass]);
    setIsFormOpen(false);
    
    // Here you would typically make an API call to save the class
    console.log('Class saved:', newClass);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Class Management</h1>
          <UIButton
            onClick={handleOpenForm}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
          >
            Schedule New Class
          </UIButton>
        </div>

        {/* Scheduled Classes List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Scheduled Classes</h2>
          </div>
          
          {scheduledClasses.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-500">No classes scheduled yet.</p>
              <p className="text-sm text-gray-400 mt-2">Click "Schedule New Class" to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {scheduledClasses.map((classItem) => (
                <div key={classItem.id} className="px-6 py-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{classItem.course}</p>
                          <p className="text-sm text-gray-500">{classItem.section} • {classItem.courseType}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-900">{classItem.date}</p>
                          <p className="text-sm text-gray-500">{classItem.time}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-900">{classItem.location}</p>
                          <p className="text-sm text-gray-500">{classItem.students.length} students</p>
                        </div>
                      </div>
                      <div className="mt-2">
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Topic:</span> {classItem.topic}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {classItem.curriculum} • {classItem.term}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isFormOpen && (
        <ClassManagementForm
          onClose={handleCloseForm}
          onSave={handleSaveClass}
        />
      )}
    </div>
  );
};

export default ClassManagementPage;
