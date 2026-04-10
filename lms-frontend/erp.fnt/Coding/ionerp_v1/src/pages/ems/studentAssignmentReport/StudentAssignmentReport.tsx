import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { useTopicService } from "../../../services/ems/topicService";
import { useStudentAssignmentReportService } from "../../../services/ems/studentAssignmentReportService";
import DataTable from "../../../components/Table/DataTable";

interface StudentReportRow {
  id: number;
  student_usn: string;
  student_name: string;
  secured_marks: number;
}

const StudentAssignmentReport = () => {
  const topicService = useTopicService();
  const studentService = useStudentAssignmentReportService();

  const [filters, setFilters] = useState({
    curriculum: "",
    semester: "",
    course: "",
    section: "",
    assignment: ""
  });
  
  const [dropdownOptions, setDropdownOptions] = useState({
    curriculumOptions: [],
    semesterOptions: [],
    courseOptions: [],
    sectionOptions: [],
    assignmentOptions: []
  });

  const [tableData, setTableData] = useState<StudentReportRow[]>([]);
  const [loading, setLoading] = useState(false);

  // 1. Load Curriculum & Semester (no dependencies)
  useEffect(() => {
    topicService.getCurriculumList().then((res: any) => {
      const dataArray = Array.isArray(res) ? res : res?.data || [];
      const options = dataArray.map((item: any) => ({
        value: item.value || item.id || item.academic_batch_id || "",
        label: item.label || item.name || item.academic_batch_name || `Batch ${item.id}`,
      }));
      setDropdownOptions((prev: any) => ({ ...prev, curriculumOptions: options }));
    }).catch(console.error);

    topicService.getSemesterList().then((res: any) => {
      const dataArray = Array.isArray(res) ? res : res?.data || [];
      const options = dataArray.map((item: any) => ({
        value: item.value || item.id || item.semester_id || "",
        label: item.label || item.name || item.semester_name || `Semester ${item.id}`,
      }));
      setDropdownOptions((prev: any) => ({ ...prev, semesterOptions: options }));
    }).catch(console.error);
  }, []);

  // 2. Load Courses (curriculum + semester)
  useEffect(() => {
    if (filters.curriculum && filters.semester) {
      topicService.getCourseList({
        curriculum_id: Number(filters.curriculum),
        semester_id: Number(filters.semester)
      }).then((res: any) => {
        const dataArray = Array.isArray(res) ? res : (res?.data || res?.courses || []);
        const options = dataArray.map((item: any) => ({
          value: item.value || item.course_id || item.crs_id || "",
          label: item.label || item.course_name || item.crs_title || `Course ${item.id}`,
        }));
        setDropdownOptions((prev: any) => ({ ...prev, courseOptions: options }));
      }).catch(console.error);
    } else {
      setDropdownOptions((prev: any) => ({ ...prev, courseOptions: [] }));
    }
  }, [filters.curriculum, filters.semester]);

  // 3. Load Sections (semester + optional curriculum/course)
  useEffect(() => {
    if (filters.semester) {
      const payload: any = { semester_id: Number(filters.semester) };
      if (filters.curriculum) payload.academic_batch_id = Number(filters.curriculum);
      if (filters.course) payload.course_id = Number(filters.course);

      topicService.getSectionList(payload).then((res: any) => {
        const dataArray = Array.isArray(res) ? res : (res?.data || res?.sections || []);
        const options = dataArray.map((item: any) => ({
          value: item.value || item.id || item.section_id || "",
          label: item.label || item.section || item.section_name || `Section ${item.id}`,
        }));
        setDropdownOptions((prev: any) => ({ ...prev, sectionOptions: options }));
      }).catch(console.error);
    } else {
      setDropdownOptions((prev: any) => ({ ...prev, sectionOptions: [] }));
    }
  }, [filters.semester, filters.curriculum, filters.course]);

  // 4. Load Assignments (EXACT backend: course_id, semester_id, academic_batch_id)
  useEffect(() => {
    if (filters.course && filters.semester && filters.curriculum) {
      console.log("🔄 LOADING ASSIGNMENTS:", {
        course_id: Number(filters.course),
        semester_id: Number(filters.semester),
        academic_batch_id: Number(filters.curriculum)
      });
      
      console.log("🚀 CALLING getAssignments with:", {
        course_id: Number(filters.course),
        semester_id: Number(filters.semester),
        academic_batch_id: Number(filters.curriculum),
        section: filters.section
      });
      
      studentService.getAssignments(
        Number(filters.course),
        Number(filters.semester),
        Number(filters.curriculum) // academic_batch_id
      ).then((serviceResponse: any) => {
        console.log("✅ Service getAssignments RETURNED:", serviceResponse);
        console.log("📊 Service response type:", Array.isArray(serviceResponse), serviceResponse.length || 0);
        setDropdownOptions((prev: any) => { 
          const options = serviceResponse || [];
          console.log("📋 SETTING ASSIGNMENT OPTIONS:", options, options.length);
          return { ...prev, assignmentOptions: options }; 
        });
      }).catch((error: any) => {
        console.error("❌ Assignment service error:", error);
        setDropdownOptions((prev: any) => ({ ...prev, assignmentOptions: [] }));
      });
    } else {
      console.log("⏳ Skipping assignments - missing:", { course: !!filters.course, semester: !!filters.semester, curriculum: !!filters.curriculum });
      setDropdownOptions((prev: any) => ({ ...prev, assignmentOptions: [] }));
    }
  }, [filters.course, filters.semester, filters.curriculum, filters.section]); // Added section dep

  // 5. Load Report
  useEffect(() => {
    if (filters.assignment) {
      setLoading(true);
      studentService.getStudentReport(Number(filters.assignment)).then((response: any) => {
        console.log("✅ STUDENT REPORT:", response);
        const data = response?.data || response || [];
        const mappedData: StudentReportRow[] = data.map((row: any, index: number) => ({
          id: index + 1,
          student_usn: row.student_usn || "",
          student_name: row.student_name || row.student_usn || "N/A",
          secured_marks: Number(row.secured_marks || 0)
        }));
        setTableData(mappedData);
        setLoading(false);
      }).catch((error: any) => {
        console.error("❌ REPORT ERROR:", error);
        setTableData([]);
        setLoading(false);
      });
    } else {
      setTableData([]);
    }
  }, [filters.assignment]);

  // Export function - EXACT user example
  const exportXLS = async () => {
    if (tableData.length === 0) {
      alert("No data available for export");
      return;
    }

    const formattedData = tableData.map((r: StudentReportRow) => ({
      USN: r.student_usn,
      "Student Name": r.student_name,
      Marks: r.secured_marks
    }));

    const ws = XLSX.utils.json_to_sheet(formattedData);

    XLSX.utils.sheet_add_aoa(
      ws,
      [[`Date of Export Report : ${new Date().toLocaleDateString()}`]],
      { origin: "A1" }
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Assignment Report");

    XLSX.writeFile(wb, "Student_Assignment_Report.xlsx");
  };

  const handleFilterChange = (field: keyof typeof filters, value: string) => {
    setFilters(prev => {
      const updatedFilters = { ...prev, [field]: value };
      if (field === "curriculum" || field === "semester") {
        updatedFilters.course = "";
        updatedFilters.section = "";
        updatedFilters.assignment = "";
      } else if (field === "course") {
        updatedFilters.section = "";
        updatedFilters.assignment = "";
      } else if (field === "section") {
        updatedFilters.assignment = "";
      }
      return updatedFilters;
    });
  };

  const columnDefs = [
    { headerName: "Sl No", valueGetter: (params: any) => params.node.rowIndex + 1, width: 70 },
    { headerName: "Student USN", field: "student_usn", flex: 1 },
    { headerName: "Student Name", field: "student_name", flex: 1 },
    { headerName: "Marks", field: "secured_marks", width: 120 }
  ];

  return (
    <div className="p-6">
      <div className="bg-[#1f4e5f] text-white px-4 py-2 rounded-t-md font-semibold">
        Student Assignment Report
      </div>
      
      <div className="border p-4 bg-white rounded-b-md">
        <div className="grid grid-cols-5 gap-4 items-end mb-6">
          {["curriculum", "semester", "course", "section", "assignment"].map(field => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1 capitalize">{field} *</label>
              <select 
                className="w-full border rounded px-2 py-2"
                value={filters[field as keyof typeof filters]}
                onChange={(e) => handleFilterChange(field as keyof typeof filters, e.target.value)}
              >
                <option value="">Select {field}</option>
                {(dropdownOptions[`${field}Options` as keyof typeof dropdownOptions] || []).map((option: any, idx: number) => (
                  <option key={idx} value={option.value.toString()}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <div>
            <button 
              style={{
                marginLeft: 10,
                backgroundColor: "green",
                color: "white",
                border: "none",
                padding: "8px 15px",
                borderRadius: 4,
                cursor: "pointer"
              }}
              onClick={exportXLS}
            >
              Export XLS
            </button>
          </div>
        </div>
        
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2">Loading report...</p>
          </div>
        ) : tableData.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
            <p className="text-lg text-gray-500 mb-2">No Data Found</p>
            <p className="text-sm text-gray-400">Please select all dropdowns including Assignment</p>
          </div>
        ) : (
          <DataTable 
            columnDefs={columnDefs}
            rowData={tableData} 
            pagination 
            pageSize={10}
          />
        )}
      </div>
    </div>
  );
};

export default StudentAssignmentReport;