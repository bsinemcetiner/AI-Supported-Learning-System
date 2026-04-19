import { useEffect, useState } from "react";
import {
  fetchAllStudents,
  fetchAllTeachers,
  fetchAllCourses,
  fetchStudentCourses,
  assignCourse,
  removeCourse,
  adminLogout,
  getAdminToken,
} from "../services/api";

interface Person {
  id: number;
  username: string;
  full_name: string;
}

interface Course {
  id: string;
  title: string;
  teacher: string;
}

interface Props {
  onLogout: () => void;
}

type ActiveTab = "students" | "teachers";

export default function AdminDashboardPage({ onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("students");
  const [students, setStudents] = useState<Person[]>([]);
  const [teachers, setTeachers] = useState<Person[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Person | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<Person | null>(null);
  const [assignedCourses, setAssignedCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!getAdminToken()) {
      onLogout();
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [s, t, c] = await Promise.all([
        fetchAllStudents(),
        fetchAllTeachers(),
        fetchAllCourses(),
      ]);
      setStudents(s);
      setTeachers(t);
      setAllCourses(c);
    } catch {
      setMessage("Failed to load data.");
    }
  };

  const selectStudent = async (student: Person) => {
    setSelectedStudent(student);
    setMessage("");
    try {
      const courses = await fetchStudentCourses(student.id);
      setAssignedCourses(courses);
    } catch {
      setAssignedCourses([]);
    }
  };

  const selectTeacher = (teacher: Person) => {
    setSelectedTeacher(teacher);
    setMessage("");
  };

  const handleAssign = async (courseId: string) => {
    if (!selectedStudent) return;
    setLoading(true);
    try {
      await assignCourse(selectedStudent.id, courseId);
      const courses = await fetchStudentCourses(selectedStudent.id);
      setAssignedCourses(courses);
      setMessage("Course assigned successfully ✓");
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (courseId: string) => {
    if (!selectedStudent) return;
    setLoading(true);
    try {
      await removeCourse(selectedStudent.id, courseId);
      const courses = await fetchStudentCourses(selectedStudent.id);
      setAssignedCourses(courses);
      setMessage("Course removed successfully ✓");
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    adminLogout();
    onLogout();
  };

  const isAssigned = (courseId: string) =>
    assignedCourses.some((c) => c.id === courseId);

  // Teacher'ın kursları
  const teacherCourses = selectedTeacher
    ? allCourses.filter((c) => c.teacher === selectedTeacher.username)
    : [];

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>🛡 Admin Panel</h1>
        <button style={styles.logoutBtn} onClick={handleLogout}>
          Sign Out
        </button>
      </div>

      <div style={styles.body}>
        {/* Left Panel */}
        <div style={styles.panel}>
          <div style={styles.tabBar}>
            <button
              style={{ ...styles.tabBtn, ...(activeTab === "students" ? styles.tabBtnActive : {}) }}
              onClick={() => {
                setActiveTab("students");
                setSelectedTeacher(null);
                setMessage("");
              }}
            >
              🎓 Students ({students.length})
            </button>
            <button
              style={{ ...styles.tabBtn, ...(activeTab === "teachers" ? styles.tabBtnActive : {}) }}
              onClick={() => {
                setActiveTab("teachers");
                setSelectedStudent(null);
                setMessage("");
              }}
            >
              🏫 Teachers ({teachers.length})
            </button>
          </div>

          {activeTab === "students" && (
            <>
              {students.length === 0 && <p style={styles.empty}>No students found</p>}
              {students.map((s) => (
                <div
                  key={s.id}
                  style={{
                    ...styles.listItem,
                    ...(selectedStudent?.id === s.id ? styles.listItemActive : {}),
                  }}
                  onClick={() => selectStudent(s)}
                >
                  <span style={styles.personName}>{s.username}</span>
                  <span style={styles.personSub}>{s.full_name}</span>
                </div>
              ))}
            </>
          )}

          {activeTab === "teachers" && (
            <>
              {teachers.length === 0 && <p style={styles.empty}>No teachers found</p>}
              {teachers.map((t) => (
                <div
                  key={t.id}
                  style={{
                    ...styles.listItem,
                    ...(selectedTeacher?.id === t.id ? styles.listItemActive : {}),
                  }}
                  onClick={() => selectTeacher(t)}
                >
                  <span style={styles.personName}>{t.username}</span>
                  <span style={styles.personSub}>{t.full_name}</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Right Panel */}
        <div style={styles.panel}>
          {activeTab === "teachers" ? (
            !selectedTeacher ? (
              <div style={styles.placeholder}>
                <p>← Select a teacher to view their courses</p>
              </div>
            ) : (
              <>
                <h3 style={styles.panelTitle}>
                  🏫 {selectedTeacher.username} — Courses
                </h3>
                {teacherCourses.length === 0 ? (
                  <p style={styles.empty}>This teacher has no courses yet</p>
                ) : (
                  teacherCourses.map((course) => (
                    <div key={course.id} style={styles.courseRow}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span style={styles.courseTitle}>{course.title}</span>
                        <span style={styles.courseTeacher}>👤 {course.teacher}</span>
                      </div>
                    </div>
                  ))
                )}
              </>
            )
          ) : !selectedStudent ? (
            <div style={styles.placeholder}>
              <p>← Select a student from the left panel</p>
            </div>
          ) : (
            <>
              <h3 style={styles.panelTitle}>
                🎓 {selectedStudent.username} — Course Assignments
              </h3>
              {message && (
                <p style={{
                  ...styles.message,
                  background: message.includes("✓") ? "#1a2e05" : "#2d1515",
                  color: message.includes("✓") ? "#a3e635" : "#f87171",
                }}>
                  {message}
                </p>
              )}
              {allCourses.length === 0 && (
                <p style={styles.empty}>No courses found</p>
              )}
              {allCourses.map((course) => {
                const assigned = isAssigned(course.id);
                return (
                  <div key={course.id} style={{
                    ...styles.courseRow,
                    ...(assigned ? { borderColor: "#6366f1", background: "#0f0f1a" } : {}),
                  }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <span style={styles.courseTitle}>{course.title}</span>
                      <span style={styles.courseTeacher}>👤 {course.teacher}</span>
                    </div>
                    <button
                      style={{
                        ...styles.actionBtn,
                        background: assigned ? "#ef4444" : "#22c55e",
                        opacity: loading ? 0.6 : 1,
                      }}
                      onClick={() =>
                        assigned ? handleRemove(course.id) : handleAssign(course.id)
                      }
                      disabled={loading}
                    >
                      {assigned ? "Remove" : "Assign"}
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0f172a",
    color: "#f1f5f9",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1rem 2rem",
    background: "#1e293b",
    borderBottom: "1px solid #334155",
  },
  headerTitle: {
    fontSize: "1.25rem",
    fontWeight: 700,
    color: "#a5b4fc",
  },
  logoutBtn: {
    padding: "0.5rem 1.25rem",
    borderRadius: "8px",
    background: "#ef4444",
    color: "white",
    border: "none",
    cursor: "pointer",
    fontSize: "0.875rem",
  },
  body: {
    display: "flex",
    flex: 1,
    gap: "1.5rem",
    padding: "1.5rem 2rem",
  },
  panel: {
    flex: 1,
    background: "#1e293b",
    borderRadius: "12px",
    padding: "1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    overflowY: "auto",
    maxHeight: "calc(100vh - 120px)",
  },
  tabBar: {
    display: "flex",
    gap: "0.5rem",
    marginBottom: "0.5rem",
  },
  tabBtn: {
    flex: 1,
    padding: "0.5rem",
    borderRadius: "8px",
    border: "1px solid #334155",
    background: "#0f172a",
    color: "#64748b",
    cursor: "pointer",
    fontSize: "0.8rem",
    fontWeight: 600,
  },
  tabBtnActive: {
    background: "#1e1b4b",
    border: "1px solid #6366f1",
    color: "#a5b4fc",
  },
  panelTitle: {
    fontSize: "1rem",
    fontWeight: 700,
    color: "#94a3b8",
    marginBottom: "0.5rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  listItem: {
    display: "flex",
    flexDirection: "column",
    padding: "0.75rem 1rem",
    borderRadius: "8px",
    cursor: "pointer",
    border: "1px solid #334155",
    background: "#0f172a",
    transition: "all 0.15s",
  },
  listItemActive: {
    border: "1px solid #6366f1",
    background: "#1e1b4b",
  },
  personName: {
    fontWeight: 600,
    fontSize: "0.95rem",
  },
  personSub: {
    fontSize: "0.75rem",
    color: "#64748b",
    marginTop: "2px",
  },
  courseRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.75rem 1rem",
    borderRadius: "8px",
    background: "#0f172a",
    border: "1px solid #334155",
    transition: "all 0.15s",
  },
  courseTitle: {
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "#f1f5f9",
  },
  courseTeacher: {
    fontSize: "0.75rem",
    color: "#64748b",
  },
  actionBtn: {
    padding: "0.4rem 0.9rem",
    borderRadius: "6px",
    border: "none",
    color: "white",
    cursor: "pointer",
    fontSize: "0.825rem",
    fontWeight: 600,
    minWidth: "75px",
    transition: "opacity 0.15s",
  },
  placeholder: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#475569",
    fontSize: "1rem",
  },
  empty: {
    color: "#475569",
    fontSize: "0.875rem",
  },
  message: {
    fontSize: "0.875rem",
    padding: "0.5rem 0.75rem",
    borderRadius: "6px",
  },
};