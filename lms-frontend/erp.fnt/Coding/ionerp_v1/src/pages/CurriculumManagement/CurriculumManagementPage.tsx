import React, { useState, useEffect } from 'react';
import { CurriculumManager } from '../../components/CurriculumManager';
import UIButton from '../../components/FormBuilder/fields/Button';
import { BookOpen, Plus, Trash2, Edit } from 'lucide-react';

const CURRICULUM_STORAGE_KEY = 'curriculum_data';

const CurriculumManagementPage: React.FC = () => {
  const [showCurriculumManager, setShowCurriculumManager] = useState(false);
  const [savedCurriculums, setSavedCurriculums] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSavedCurriculums();
  }, []);

  const loadSavedCurriculums = () => {
    try {
      setLoading(true);
      const savedData = localStorage.getItem(CURRICULUM_STORAGE_KEY);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        setSavedCurriculums(parsedData);
      }
    } catch (error) {
      console.error('Error loading saved curriculums:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCurriculum = (data: any) => {
    console.log('Saving curriculum:', data);
    // Data is already saved to localStorage in the CurriculumManager component
    loadSavedCurriculums(); // Refresh the list
  };

  const handleDeleteCurriculum = (id: number) => {
    if (window.confirm('Are you sure you want to delete this curriculum?')) {
      try {
        const updatedCurriculums = savedCurriculums.filter(curr => curr.id !== id);
        localStorage.setItem(CURRICULUM_STORAGE_KEY, JSON.stringify(updatedCurriculums));
        setSavedCurriculums(updatedCurriculums);
      } catch (error) {
        console.error('Error deleting curriculum:', error);
      }
    }
  };

  const handleEditCurriculum = (curriculum: any) => {
    // For now, just show the manager. In a real app, you'd populate the form with existing data
    setShowCurriculumManager(true);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-blue-600" />
              Curriculum Management
            </h1>
            <p className="text-gray-600 mt-2">Manage curriculum, courses, and student assignments</p>
          </div>
          <UIButton
            onClick={() => setShowCurriculumManager(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Curriculum
          </UIButton>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Curriculums</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{savedCurriculums.length}</p>
            </div>
            <div className="bg-blue-100 rounded-full p-3">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Courses</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">12</p>
            </div>
            <div className="bg-green-100 rounded-full p-3">
              <BookOpen className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Students</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">248</p>
            </div>
            <div className="bg-purple-100 rounded-full p-3">
              <BookOpen className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Class Sections</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">16</p>
            </div>
            <div className="bg-orange-100 rounded-full p-3">
              <BookOpen className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Saved Curriculums List */}
      {savedCurriculums.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Recently Created Curriculums</h2>
          <div className="space-y-3">
            {savedCurriculums.map((curriculum, index) => (
              <div key={curriculum.id} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-gray-900">Curriculum #{index + 1}</h3>
                    <div className="mt-2 text-sm text-gray-600 space-y-1">
                      <p>Course: {curriculum.course}</p>
                      <p>Section: {curriculum.section}</p>
                      <p>Term: {curriculum.term}</p>
                      <p>Students: {curriculum.students?.length || 0} enrolled</p>
                      <p>Schedule: {curriculum.classTimings?.daysOfWeek?.join(', ') || 'N/A'}</p>
                      <p>Created: {curriculum.createdAt ? new Date(curriculum.createdAt).toLocaleDateString() : 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <UIButton 
                      onClick={() => handleEditCurriculum(curriculum)}
                      className="bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm px-3 py-1"
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </UIButton>
                    <UIButton 
                      onClick={() => handleDeleteCurriculum(curriculum.id)}
                      className="bg-red-100 hover:bg-red-200 text-red-700 text-sm px-3 py-1"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </UIButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {savedCurriculums.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <div className="bg-gray-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Curriculums Created</h3>
          <p className="text-gray-600 mb-6">Get started by creating your first curriculum using the button above.</p>
          <UIButton
            onClick={() => setShowCurriculumManager(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
          >
            Create Your First Curriculum
          </UIButton>
        </div>
      )}

      {/* Curriculum Manager Modal */}
      <CurriculumManager
        isOpen={showCurriculumManager}
        onClose={() => setShowCurriculumManager(false)}
        onSave={handleSaveCurriculum}
      />
    </div>
  );
};

export default CurriculumManagementPage;
