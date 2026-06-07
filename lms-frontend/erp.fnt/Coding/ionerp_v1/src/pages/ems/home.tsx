import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Rectangle,
} from "recharts";
import { ApiEndpoint } from "../../utils/ApiEndpoint/emsapiEndpoint";
import { useAxios } from "../../hooks/useAxios";
import Tabs from "../../components/Tabs/Tabs";
import { FaCircle } from "react-icons/fa6";
import DataTable from "../../components/Table/DataTable";

export interface examEventInterface {
  result_year: string;
  event_type: string;
  result_year_dd: string;
  semester_start_date?: string;
  semester_end_date?: string;
}

export interface DashboardDataInterface {
  students_intake: StudentsIntake[];
  student_pass_percentage: StudentPassPercentage[];
  cgpa_report: any;
  result_analysis: Analysis[];
  todo_pre_exam: TodoPreExam[];
  todo_exam: TodoExam[];
  todo_post_exam: TodoPostExam[];
}

export interface StudentsIntake {
  dept_acronym: string;
  std_count: number;
}

export interface StudentPassPercentage {
  dept_acronym: string;
  dept_name: string;
  failed: number;
  passed: number;
  appeared: number;
  pass_per: number;
}

export interface Analysis {
  dept_acronym: string;
  department_id: number;
  cia: number;
  attendance: number;
  absentee: number;
  presentee: number;
  mal_practice: number;
  failed_students: number;
  "count(regno)": number;
  passed_students: number;
}

export interface TodoPreExam {
  academic_batch_id: number;
  academic_batch_code: string;
  cia: string;
  attendance: string;
  eligibility: string;
  registered: string;
  exam_time_table: any;
}

export interface TodoExam {
  academic_batch_id: number;
  academic_batch_code: string;
  hall_allocation: any;
  see_marks: string;
}

export interface TodoPostExam {
  academic_batch_id: number;
  academic_batch_code: string;
  grade_processing: string;
  reval_registration: string;
}

// Inside your render method or functional component
const renderLabAllocation = (allocation: string) => {
  let color;

  if (allocation === null) {
    color = "black"; // No data
  } else if (allocation === "red") {
    color = "red"; // Red allocation
  } else if (allocation === "green") {
    color = "green"; // Green allocation
  } else {
    color = "red"; // Default color if none of the above
  }

  return <FaCircle style={{ color }} />;
};

export const ExamColumnDefs = [
  {
    headerName: "Academic Batch",
    field: "academic_batch_code",
    sortable: false,
    filter: false,
    editable: false,
  },
  {
    headerName: "Lab Allocation",
    field: "lab_allocation",
    sortable: false,
    filter: false,
    editable: false,
    cellRenderer: (params: any) =>
      renderLabAllocation(params.data.lab_allocation), // Pass the string directly
  },
  {
    headerName: "Hall Allocation",
    field: "hall_allocation",
    sortable: false,
    filter: false,
    editable: false,
    cellRenderer: (params: any) =>
      renderLabAllocation(params.data.hall_allocation), // Pass the string directly
  },
  {
    headerName: "See Absentee",
    field: "see_absentee",
    sortable: false,
    filter: false,
    editable: false,
    cellRenderer: (params: any) =>
      renderLabAllocation(params.data.see_absentee), // Pass the string directly
  },
  {
    headerName: "SEE Marks",
    field: "see_marks",
    sortable: false,
    filter: false,
    editable: false,
    cellRenderer: (params: any) => renderLabAllocation(params.data.see_marks), // Pass the string directly
  },
];

export const PostExamColumnDefs = [
  {
    headerName: "Academic Batch",
    field: "academic_batch_code",
    sortable: false,
    filter: false,
    editable: false,
  },
  {
    headerName: "Grade Processing",
    field: "grade_processing",
    sortable: false,
    filter: false,
    editable: false,
    cellRenderer: (params: any) =>
      renderLabAllocation(params.data.grade_processing), // Pass the string directly
  },
  {
    headerName: "Result Declaration",
    field: "result_declaration",
    sortable: false,
    filter: false,
    editable: false,
    cellRenderer: (params: any) =>
      renderLabAllocation(params.data.result_declaration), // Pass the string directly
  },
  {
    headerName: "Revaluation Registration",
    field: "reval_registration",
    sortable: false,
    filter: false,
    editable: false,
    cellRenderer: (params: any) =>
      renderLabAllocation(params.data.reval_registration), // Pass the string directly
  },
  {
    headerName: "Revaluation Result",
    field: "revaluation_result",
    sortable: false,
    filter: false,
    editable: false,
    cellRenderer: (params: any) =>
      renderLabAllocation(params.data.revaluation_result), // Pass the string directly
  },
  {
    headerName: "Revaluation Grade",
    field: "revaluation_grade",
    sortable: false,
    filter: false,
    editable: false,
    cellRenderer: (params: any) =>
      renderLabAllocation(params.data.revaluation_grade), // Pass the string directly
  },
];

export const PreExamColumnDefs = [
  {
    headerName: "Academic Batch",
    field: "academic_batch_code",
    sortable: false,
    filter: false,
    editable: false,
  },
  {
    headerName: "CIA",
    field: "cia",
    sortable: false,
    filter: false,
    editable: false,
    cellRenderer: (params: any) => renderLabAllocation(params.data.cia), // Pass the string directly
  },
  {
    headerName: "Attendance",
    field: "attendance",
    sortable: false,
    filter: false,
    editable: false,
    cellRenderer: (params: any) => renderLabAllocation(params.data.attendance), // Pass the string directly
  },
  {
    headerName: "Eligibility",
    field: "eligibility",
    sortable: false,
    filter: false,
    editable: false,
    cellRenderer: (params: any) => renderLabAllocation(params.data.eligibility), // Pass the string directly
  },
  {
    headerName: "Exam Time Table",
    field: "exam_time_table",
    sortable: false,
    filter: false,
    editable: false,
    cellRenderer: (params: any) =>
      renderLabAllocation(params.data.exam_time_table), // Pass the string directly
  },
  {
    headerName: "Exam Registration",
    field: "registered",
    sortable: false,
    filter: false,
    editable: false,
    cellRenderer: (params: any) => renderLabAllocation(params.data.registered), // Pass the string directly
  },
  {
    headerName: "Hall Ticket",
    field: "hall_ticket",
    sortable: false,
    filter: false,
    editable: false,
    cellRenderer: (params: any) => renderLabAllocation(params.data.hall_ticket), // Pass the string directly
  },
];

const Analysiss: React.FC<{ result: DashboardDataInterface }> = ({
  result,
}) => {
  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];
  const cgpaComparisonData = [
    { name: "0 - 2", value: 1 },
    { name: "2 - 4", value: 0 },
    { name: "4 - 6", value: 2 },
    { name: "6 - 8", value: 0 },
    { name: "8 - 10", value: 2 },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ChartCard title="Students Intake">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={result.students_intake}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dept_acronym" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="std_count" fill="#85c0e4" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Students Pass Percentage">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={result.student_pass_percentage}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dept_name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="pass_per" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Comparison of #CGPA across Departments">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={cgpaComparisonData}
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
            >
              {cgpaComparisonData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Result Analysis">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            width={500}
            height={300}
            data={result.result_analysis}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="1 1" />
            <XAxis dataKey="dept_acronym" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar
              dataKey="cia"
              fill="#ffb85f"
              activeBar={<Rectangle fill="gold" stroke="purple" />}
            />
            <Bar
              dataKey="attendance"
              fill="#e45641e6"
              activeBar={<Rectangle fill="gold" stroke="purple" />}
            />
            <Bar
              dataKey="absentee"
              fill="#00bfbae6"
              activeBar={<Rectangle fill="gold" stroke="purple" />}
            />
            <Bar
              dataKey="presentee"
              fill="#00aaa0"
              activeBar={<Rectangle fill="pink" stroke="blue" />}
            />
            <Bar
              dataKey="mal_practice"
              fill="#82ca9d"
              activeBar={<Rectangle fill="gold" stroke="purple" />}
            />
            <Bar
              dataKey="passed_students"
              fill="#7b8d8e"
              activeBar={<Rectangle fill="gray" stroke="purple" />}
            />
            <Bar
              dataKey="failed_students"
              fill="#e45641e6"
              activeBar={<Rectangle fill="red" stroke="purple" />}
            />
          </BarChart>
          {/* <BarChart data={result.result_analysis}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="dept_acronym" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="std_count" fill="#85c0e4" />
          </BarChart> */}
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
};

const ChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg dark:shadow-gray-700 my-3">
    <div className="p-5">
      <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100 mb-4">
        {title}
      </h3>
      {children}
    </div>
  </div>
);

const ToDoList: React.FC<{ result: DashboardDataInterface }> = ({ result }) => {
  const [showData, setShowData] = useState<string>("Pre-Exam");

  return (
    <div className="">
      <div className="mt-4 max-w-lg">
        <label
          htmlFor="todoType"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Select To Do
        </label>
        <select
          className="
            w-full 
            px-3 
            py-2 
            border 
            rounded-md 
            shadow-sm 
            focus:outline-none 
            focus:ring-2 
            transition 
            duration-300
            appearance-none
            border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800
            text-gray-900 dark:text-gray-100
            sm:text-sm
          "
          value={showData}
          onChange={(e) => setShowData(e.target.value)}
        >
          <option value="Pre-Exam">Pre-Exam</option>
          <option value="Exam">Exam</option>
          <option value="Post-Exam">Post-Exam</option>
        </select>
      </div>

      <DataTable
        columnDefs={
          showData === "Pre-Exam"
            ? PreExamColumnDefs
            : showData === "Exam"
              ? ExamColumnDefs
              : PostExamColumnDefs
        }
        rowData={
          showData === "Pre-Exam"
            ? result.todo_pre_exam
            : showData === "Exam"
              ? result.todo_exam
              : result.todo_post_exam
        }
        headerFilter={false}
        pageSize={20}
      />
    </div>
  );
};

const Home: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [dashboardData, setDashboardData] =
    useState<DashboardDataInterface | null>(null);
  const [examEvent, setExamEvent] = useState<string>("");
  const { responseData, customApiCall } = useAxios<
    { show_all: number },
    examEventInterface[]
  >(ApiEndpoint.fetch_result_year_options, {
    method: "post",
    loader: true,
    payload: { show_all: 1 },
    shouldFetch: false,
  });

  // Memoize the API call function
  const callDashboardApi = useCallback(
    async (examEvent: string) => {
      if (!examEvent) return;
      const response = await customApiCall(
        ApiEndpoint.dashboard_info_all_data,
        "post",
        { result_year: examEvent },
        false,
      );
      if (response) {
        setDashboardData(response as DashboardDataInterface);
      }
    },
    [customApiCall],
  );

  // Effect for initializing the dashboard
  useEffect(() => {
    if (responseData?.length) {
      const initialEvent = responseData[0].result_year_dd;
      setExamEvent(initialEvent);
      callDashboardApi(initialEvent);
    }
  }, [responseData]);

  // Handle select change
  const handleExamEventChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newExamEvent = e.target.value;
      setExamEvent(newExamEvent);
      callDashboardApi(newExamEvent);
    },
    [callDashboardApi],
  );

  const tabItems = useMemo(
    () => [
      {
        label: "Analysis",
        content: dashboardData && <Analysiss result={dashboardData} />,
      },
      {
        label: "To Do",
        content: dashboardData && <ToDoList result={dashboardData} />,
      },
    ],
    [dashboardData],
  );

  return (
    <div className="space-y-6">
      {/* Integrated Header with Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Ion Dashboard</h1>
          <p className="text-slate-500 text-sm font-medium">Monitoring and managing active education cycles.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative w-full sm:w-64">
            <select
              className="w-full pl-4 pr-10 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none bg-slate-50/50 text-slate-800 text-sm font-bold cursor-pointer"
              value={examEvent}
              onChange={handleExamEventChange}
            >
              <option value="">Select Exam Event</option>
              {responseData?.map((item, index) => (
                <option key={index} value={item.result_year_dd}>{item.result_year_dd}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
          <div className="hidden sm:block h-8 w-[1px] bg-slate-100" />
          <div className="flex items-center space-x-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest bg-slate-50 px-4 py-2.5 rounded-xl">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Students', value: '1,284', change: '+12%', icon: '👥', color: 'indigo' },
          { label: 'Active Exams', value: '8', change: 'Running', icon: '📝', color: 'emerald' },
          { label: 'Pending Results', value: '24', change: 'Action Required', icon: '📊', color: 'amber' }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-1.5 h-full bg-${stat.color}-500 opacity-50`} />
            <div className="flex items-center justify-between mb-4">
              <span className={`text-2xl p-2 bg-${stat.color}-50 rounded-xl`}>{stat.icon}</span>
              <span className={`text-[10px] font-black uppercase tracking-wider text-${stat.color}-600 bg-${stat.color}-50 px-2.5 py-1 rounded-lg`}>{stat.change}</span>
            </div>
            <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">{stat.label}</h3>
            <p className="text-3xl font-black text-slate-900 tracking-tighter">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Related Data Section: Live System Pulse */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Upcoming Deadlines</h2>
            <span className="text-[10px] text-indigo-600 font-bold uppercase">View Calendar</span>
          </div>
          <div className="space-y-4">
            {[
              { title: 'SEE Registration Ends', date: 'May 20, 2026', time: '11:59 PM', priority: 'High' },
              { title: 'CIA Marks Entry', date: 'May 18, 2026', time: '05:00 PM', priority: 'Medium' }
            ].map((task, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50 group hover:border-indigo-100 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className={`w-2 h-2 rounded-full ${task.priority === 'High' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <div>
                    <h4 className="text-sm font-bold text-slate-700">{task.title}</h4>
                    <p className="text-[11px] text-slate-400 font-medium">{task.date} • {task.time}</p>
                  </div>
                </div>
                <button className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-black uppercase text-indigo-600">Action</button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Recent Activity</h2>
            <span className="text-[10px] text-slate-400 font-bold uppercase">All Logs</span>
          </div>
          <div className="space-y-4">
            {[
              { action: 'Evaluation Finalized', target: 'Batch 2024-A', user: 'Dr. Sarah Smith', time: '2h ago' },
              { action: 'Exam Scheduled', target: 'CS-402 Final', user: 'Admin Panel', time: '5h ago' }
            ].map((log, i) => (
              <div key={i} className="flex items-center space-x-4 p-3 hover:bg-slate-50 rounded-xl transition-colors">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs">✨</div>
                <div>
                  <h4 className="text-sm font-bold text-slate-700">{log.action} <span className="text-indigo-600">@{log.target}</span></h4>
                  <p className="text-[11px] text-slate-400 font-medium">{log.user} • {log.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-4">
        <Tabs
          items={tabItems}
          onSelectTab={setActiveIndex}
          activeTab={activeIndex}
        />
      </div>
    </div>
  );
};

export default Home;
