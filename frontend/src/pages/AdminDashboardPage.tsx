import { useEffect, useState } from "react";
import {
  fetchAllStudents,
  fetchAllCourses,
  fetchStudentCourses,
  assignCourse,
  removeCourse,
  adminLogout,
  getAdminToken,
} from "../services/api";

interface Student {
  id: number;
  username: string;
  email: string;
}

interface Course {
  id: number;
  title: string;
}

export default function AdminDashboardPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [assignedCourses, setAssignedCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!getAdminToken()) {
      window.location.href = "/";
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [s, c] = await Promise.all([fetchAllStudents(), fetchAllCourses()]);
      setStudents(s);
      setAllCourses(c);
    } catch {
      setMessage("Veri yüklenemedi");
    }
  };

  const selectStudent = async (student: Student) => {
    setSelectedStudent(student);
    setMessage("");
    try {
      const courses = await fetchStudentCourses(student.id);
      setAssignedCourses(courses);
    } catch {
      setAssignedCourses([]);
    }
  };

  const handleAssign = async (courseId: number) => {
    if (!selectedStudent) return;
    setLoading(true);
    try {
      await assignCourse(selectedStudent.id, courseId);
      const courses = await fetchStudentCourses(selectedStudent.id);
      setAssignedCourses(courses);
      setMessage("Kurs atandı ✓");
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (courseId: number) => {
    if (!selectedStudent) return;
    setLoading(true);
    try {
      await removeCourse(selectedStudent.id, courseId);
      const courses = await fetchStudentCourses(selectedStudent.id);
      setAssignedCourses(courses);
      setMessage("Kurs kaldırıldı ✓");
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    adminLogout();
    window.location.href = "/";
  };

  const isAssigned = (courseId: number) =>
    assignedCourses.some((c) => c.id === courseId);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>🛡 Admin Paneli</h1>
        <button style={styles.logoutBtn} onClick={handleLogout}>
          Çıkış Yap
        </button>
      </div>

      <div style={styles.body}>
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>Öğrenciler</h3>
          {students.length === 0 && (
            <p style={styles.empty}>Kayıtlı öğrenci yok</p>
          )}
          {students.map((s) => (
            <div
              key={s.id}
              style={{
                ...styles.listItem,
                ...(selectedStudent?.id === s.id ? styles.listItemActive : {}),
              }}
              onClick={() => selectStudent(s)}
            >
              <span style={styles.studentName}>{s.username}</span>
              <span style={styles.studentEmail}>{s.email}</span>
            </div>
          ))}
        </div>

        <div style={styles.panel}>
          {!selectedStudent ? (
            <div style={styles.placeholder}>
              <p>← Sol taraftan bir öğrenci seç</p>
            </div>
          ) : (
            <>
              <h3 style={styles.panelTitle}>
                {selectedStudent.username} — Kurs Atamaları
              </h3>
              {message && <p style={styles.message}>{message}</p>}
              {allCourses.length === 0 && (
                <p style={styles.empty}>Kurs bulunamadı</p>
              )}
              {allCourses.map((course) => {
                const assigned = isAssigned(course.id);
                return (
                  <div key={course.id} style={styles.courseRow}>
                    <span style={styles.courseTitle}>{course.title}</span>
                    <button
                      style={{
                        ...styles.actionBtn,
                        background: assigned ? "#ef4444" : "#22c55e",
                      }}
                      onClick={() =>
                        assigned ? handleRemove(course.id) : handleAssign(course.id)
                      }
                      disabled={loading}
                    >
                      {assigned ? "Kaldır" : "Ata"}
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
  studentName: {
    fontWeight: 600,
    fontSize: "0.95rem",
  },
  studentEmail: {
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
  },
  courseTitle: {
    fontSize: "0.9rem",
    fontWeight: 500,
  },
  actionBtn: {
    padding: "0.4rem 0.9rem",
    borderRadius: "6px",
    border: "none",
    color: "white",
    cursor: "pointer",
    fontSize: "0.825rem",
    fontWeight: 600,
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
    color: "#a3e635",
    fontSize: "0.875rem",
    padding: "0.5rem",
    background: "#1a2e05",
    borderRadius: "6px",
  },
};