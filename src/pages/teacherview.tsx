import React, { useState, useEffect, useRef } from "react";
import { FaCheck, FaTimes, FaCopy, FaChevronUp, FaChevronDown, FaUpload } from "react-icons/fa";
import { useRouter } from "next/router";
import { useAuthState } from "react-firebase-hooks/auth";
import { initializeApp, getApps } from "firebase/app";
import { getAuth as getAuthSecondary, createUserWithEmailAndPassword } from "firebase/auth";
import { collection, getDocs, query, where, doc, getDoc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import Topbar from "@/components/Topbar/Topbar";
import Sidebar from "@/components/Sidebar/Sidebar";
import MetricsFilter, { Metric } from "@/components/MetricsFilter/MetricsFilter";
import { StudentDrawer } from "../components/StudentDrawer/studentdrawer";
import { BulkRegisterModal } from "@/components/BulkRegisterModal/BulkRegisterModal";
import { firestore, auth, firebaseConfig } from "@/firebase/firebase";
import StudentRankingChart from "@/components/TeacherView/StudentRankingChart";
import { toast } from "react-toastify";


export type AdminView = "students" | "teachers";

interface Student {
  id: string;
  name: string;
  email: string;
  progress: string[];
  teacherId: string;
  percentComplete: number;
  attemptsAvg: number;
  timeAvg: number;
  totalPoints: number;
}

const secondaryApp = getApps().find((app) => app.name === "Secondary") || initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = getAuthSecondary(secondaryApp);

export default function TeacherView() {
  const router = useRouter();
  const [user, loading] = useAuthState(auth);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [expandedTeachers, setExpandedTeachers] = useState<string[]>([]);
  const [adminView, setAdminView] = useState<AdminView>("students");
  const [selectedMetric, setSelectedMetric] = useState<Metric>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    documentId: "",
    role: "estudiante" as "estudiante" | "profesor" | "admin",
  });
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [targetDay, setTargetDay] = useState<number>(1);
  const [exerciseData, setExerciseData] = useState({
    id: "",
    title: "",
    problemStatement: "",
    outputText: "",
    starterCode: "",
    starterFunctionName: "",
    constraints: "",
    examples: [{ input: "", output: "", explanation: "" }],
    testCases: [{ input: "", output: "" }],
    difficulty: "Easy",
    category: "",
    inputText: "",
    order: 1,
    link: "",
    videoId: "",
  });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth");
      return;
    }
    (async () => {
      const snap = await getDoc(doc(firestore, "users", user.uid));
      const role = snap.data()?.role?.toLowerCase() || null;
      setUserRole(role);
      if (role !== "profesor" && role !== "admin") {
        await router.replace("/auth");
      }
    })();
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || !userRole) return;
    (async () => {
      const courseSnap = await getDocs(collection(firestore, "courses"));
      const daysObj = (courseSnap.docs[0]?.data().days as Record<string, any>) || {};
      const daysArr: { day: number; problems: string[] }[] = Object.values(daysObj);
      daysArr.sort((a, b) => a.day - b.day);
      const totalDays = daysArr.length;
      const mySnap = await getDoc(doc(firestore, "users", user!.uid));
      const linked: string[] = mySnap.data()?.students || [];
      const usersSnap = await getDocs(collection(firestore, "users"));
      const listado: Student[] = [];
      for (const d of usersSnap.docs) {
        const data = d.data();
        if (data.role !== "estudiante") continue;
        if (userRole === "profesor" && !linked.includes(d.id)) continue;
        const statsSnap = await getDocs(
          query(
            collection(firestore, "user_problem_stats"),
            where("userId", "==", d.id)
          )
        );
        let sumAttempts = 0;
        let sumTime = 0;
        let sumPoints = 0;
        const statsByDay: Record<number, boolean[]> = {};
        statsSnap.docs.forEach((statDoc) => {
          const stat = statDoc.data() as any;
          const attemptsField = stat.executionCount ?? 0;
          const timeField = stat.totalExecutionTime ?? 0;
          const pointsField = stat.points ?? 0;
          sumAttempts += attemptsField;
          sumTime += timeField;
          sumPoints += pointsField;
          const idx = daysArr.findIndex((day) =>
            Array.isArray(day.problems) && day.problems.includes(stat.problemId)
          );
          if (idx < 0) return;
          statsByDay[idx] ||= [];
          statsByDay[idx].push(stat.success);
        });
        const progress = daysArr.map((_, i) => {
          const arr = statsByDay[i] || [];
          if (!arr.length) return "";
          if (arr.every(Boolean)) return "✓";
          if (arr.every((v) => !v)) return "X";
          return "O";
        });
        const completedDays = progress.filter((v) => v === "✓").length;
        const percentComplete = totalDays
          ? Math.round((completedDays / totalDays) * 100)
          : 0;
        const countStats = statsSnap.docs.length;
        const attemptsAvg = countStats ? sumAttempts / countStats : 0;
        const timeAvg = countStats ? sumTime / countStats : 0;
        listado.push({
          id: d.id,
          name: data.displayName || "Sin nombre",
          email: data.email || "",
          progress,
          teacherId: data.teacherId || "",
          percentComplete,
          attemptsAvg,
          timeAvg,
          totalPoints: sumPoints,
        });
      }
      setStudents(listado);
    })();
  }, [userRole, user]);

  const isAdmin = userRole === "admin";
  const canRegister = userRole === "profesor" || isAdmin;
  const toggleMetric = (m: Metric) => setSelectedMetric((prev) => (prev === m ? null : m));
  const toggleTeacher = (tid: string) =>
    setExpandedTeachers((prev) =>
      prev.includes(tid) ? prev.filter((x) => x !== tid) : [...prev, tid]
    );

  const byTeacher = students.reduce<Record<string, Student[]>>((acc, s) => {
    (acc[s.teacherId] ||= []).push(s);
    return acc;
  }, {});

  const filteredByName = students.filter((s) =>
    s.name.toLowerCase().includes(searchText.toLowerCase().trim())
  );

  const generatePassword = () => Math.random().toString(36).slice(-8);
  const registerStudent = async () => {
    if (!formData.name.trim() || !formData.email.trim() || !formData.documentId.trim()) {
      alert("Todos los campos son obligatorios");
      return;
    }
    const password = generatePassword();
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, formData.email, password);
      const uid = cred.user.uid;
      await setDoc(doc(firestore, "users", uid), {
        uid,
        email: formData.email,
        displayName: formData.name,
        documentId: formData.documentId,
        role: formData.role,
        teacherId: user!.uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        solvedProblems: [],
        likedProblems: [],
        dislikedProblems: [],
        starredProblems: [],
        students: [],
      });
      if (formData.role === "estudiante") {
        await updateDoc(doc(firestore, "users", user!.uid), {
          students: arrayUnion(uid),
        });
      }
      setGeneratedPassword(password);
      setRegistrationSuccess(true);
      navigator.clipboard.writeText(password);
      setFormData({ name: "", email: "", documentId: "", role: "estudiante" });
    } catch (e) {
      console.error(e);
      alert("Error al registrar usuario");
      setRegistrationSuccess(false);
    }
  };

  const registerExercise = async () => {
    if (
      !exerciseData.id.trim() ||
      !exerciseData.title.trim() ||
      !exerciseData.problemStatement.trim() ||
      !exerciseData.outputText.trim()
    ) {
      alert("Todos los campos obligatorios deben estar llenos.");
      return;
    }
    try {
      const formattedExamples = exerciseData.examples.map((ex, idx) => ({
        id: idx + 1,
        inputText: ex.input,
        outputText: ex.output,
        explanation: ex.explanation,
      }));
      const formattedTestCases = exerciseData.testCases.map((tc) => ({
        input: tc.input,
        output: tc.output,
      }));
      const exerciseFinal = {
        id: exerciseData.id,
        title: `${exerciseData.order}. ${exerciseData.title}`,
        problemStatement: exerciseData.problemStatement,
        starterCode: exerciseData.starterCode,
        starterFunctionName: exerciseData.starterFunctionName,
        constraints: exerciseData.constraints,
        difficulty: exerciseData.difficulty,
        category: exerciseData.category,
        examples: formattedExamples,
        testCases: formattedTestCases,
        link: exerciseData.link,
        videoId: exerciseData.videoId,
        order: exerciseData.order,
      };
      const exerciseRef = doc(firestore, "problems", exerciseData.id);
      await setDoc(exerciseRef, exerciseFinal);
      const courseSnap = await getDocs(collection(firestore, "courses"));
      if (courseSnap.empty) {
        alert("No existe documento de curso en Firestore");
        return;
      }
      const courseDoc = courseSnap.docs[0];
      const courseRef = courseDoc.ref;
      const courseData = courseDoc.data();
      const daysObj = (courseData.days as Record<string, { day: number; problems: string[] }>) || {};
      const daysArr: { day: number; problems: string[] }[] = Object.values(daysObj);
      daysArr.sort((a, b) => a.day - b.day);
      const existingIndex = daysArr.findIndex((d) => d.day === targetDay);
      if (existingIndex >= 0) {
        const problemasDeEseDia = daysArr[existingIndex].problems;
        if (!problemasDeEseDia.includes(exerciseData.id)) {
          problemasDeEseDia.push(exerciseData.id);
        }
      } else {
        daysArr.push({
          day: targetDay,
          problems: [exerciseData.id],
        });
      }
      daysArr.sort((a, b) => a.day - b.day);
      const updatedDaysObj: Record<string, { day: number; problems: string[] }> = {};
      daysArr.forEach((d, idx) => {
        updatedDaysObj[idx] = {
          day: d.day,
          problems: d.problems,
        };
      });
      await updateDoc(courseRef, { days: updatedDaysObj });
      setExerciseData({
        id: "",
        title: "",
        problemStatement: "",
        outputText: "",
        starterCode: "",
        starterFunctionName: "",
        constraints: "",
        examples: [{ input: "", output: "", explanation: "" }],
        testCases: [{ input: "", output: "" }],
        difficulty: "Easy",
        category: "",
        inputText: "",
        order: exerciseData.order + 1,
        link: "",
        videoId: "",
      });
      setTargetDay(1);
      setShowExerciseModal(false);
      toast.success("Ejercicio Registrado con exito", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
      });
    } catch (error) {
      console.error("Error al registrar ejercicio:", error);
       toast.error("Error al registrar ejercicio", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
      });
    }
  };

  return (
    <div className="flex h-screen bg-[#1e1e1e] text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="flex-1 p-6 overflow-auto space-y-6">
          <div className="bg-[#2a2a2a] border border-gray-700 rounded-lg">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
              <h2 className="text-lg font-semibold">Filtros</h2>
              <button
                onClick={() => setFiltersOpen((open) => !open)}
                className="h-8 w-28 flex items-center justify-center bg-[#333333] hover:bg-[#444444] rounded"
              >
                {filtersOpen ? (
                  <>
                    <FaChevronUp className="mr-2" /> Ocultar
                  </>
                ) : (
                  <>
                    <FaChevronDown className="mr-2" /> Filtros
                  </>
                )}
              </button>
            </div>
            {filtersOpen && (
              <div className="p-4 space-y-4">
                <MetricsFilter selectedMetric={selectedMetric} onToggle={toggleMetric} />
              </div>
            )}
          </div>
          <div className="bg-[#2a2a2a] border border-gray-700 rounded-lg p-4 overflow-auto space-y-6">
            <div className="flex items-center justify-between">
              <input
                type="text"
                placeholder="Buscar usuario..."
                className="w-1/2 p-2 rounded bg-[#1e1e1e] border border-gray-600 text-white focus:outline-none"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              <div className="flex space-x-2">
                {canRegister && (
                  <button
                    onClick={() => setShowModal(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    Registrar Usuario
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => setShowExerciseModal(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    Registrar Ejercicio
                  </button>
                )}
                {canRegister && (
                  <button
                    onClick={() => setShowBulkModal(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-1"
                  >
                    <FaUpload />
                    Carga masiva
                  </button>
                )}
              </div>
            </div>
            {selectedMetric === null && (
              <>
                {(!isAdmin || adminView === "students") && (
                  <div className="overflow-auto">
                    <table className="min-w-full border-collapse">
                      <thead>
                        <tr className="bg-[#1e1e1e]">
                          <th className="p-2 border border-gray-700 sticky left-0 bg-[#1e1e1e]">
                            Nombre
                          </th>
                          {filteredByName[0]?.progress.map((_, i) => (
                            <th key={i} className="p-2 border border-gray-700 text-center">
                              D{i + 1}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredByName.map((s, rowIndex) => (
                          <tr
                            key={s.id}
                            className={`${
                              rowIndex % 2 === 0 ? "bg-[#2a2a2a]" : "bg-[#252525]"
                            } hover:bg-[#333333] cursor-pointer`}
                            onClick={() => setSelectedStudent(s)}
                          >
                            <td className="p-2 border border-gray-700 sticky left-0 bg-inherit">
                              {s.name}
                            </td>
                            {s.progress.map((v, j) => (
                              <td key={j} className="p-2 border border-gray-700 text-center">
                                {v === "✓" ? (
                                  <FaCheck className="text-green-400 inline" />
                                ) : v === "X" ? (
                                  <FaTimes className="text-red-400 inline" />
                                ) : v === "O" ? (
                                  <span className="text-yellow-400">O</span>
                                ) : (
                                  <span className="text-gray-500">–</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {filteredByName.length === 0 && (
                          <tr>
                            <td
                              colSpan={(filteredByName[0]?.progress.length || 0) + 1}
                              className="p-4 text-center text-gray-500"
                            >
                              No hay usuarios que coincidan.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
                {isAdmin && adminView === "teachers" && (
                  <div className="space-y-4">
                    {Object.entries(byTeacher).map(([tid, group]) => {
                      const groupFiltered = group.filter((s) =>
                        s.name.toLowerCase().includes(searchText.toLowerCase().trim())
                      );
                      return (
                        <div key={tid} className="border border-gray-700 rounded-lg overflow-hidden">
                          <div
                            className="p-3 bg-[#1e1e1e] cursor-pointer flex justify-between items-center"
                            onClick={() => toggleTeacher(tid)}
                          >
                            <span>Profesor: {tid}</span>
                            <span>{expandedTeachers.includes(tid) ? "▾" : "▸"}</span>
                          </div>
                          {expandedTeachers.includes(tid) && (
                            <div className="p-2 bg-[#2a2a2a]">
                              {groupFiltered.map((s) => (
                                <div
                                  key={s.id}
                                  className="p-2 border-b border-gray-700 cursor-pointer hover:bg-[#333333]"
                                  onClick={() => setSelectedStudent(s)}
                                >
                                  {s.name} – {s.email}
                                </div>
                              ))}
                              {groupFiltered.length === 0 && (
                                <div className="p-2 text-gray-500">
                                  No hay usuarios bajo este profesor que coincidan.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            {selectedMetric === "completion" && (
              <div>
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-[#1e1e1e]">
                      <th className="p-2 border border-gray-700">Nombre</th>
                      <th className="p-2 border border-gray-700 text-center">% Completos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredByName.map((s, idx) => (
                      <tr
                        key={s.id}
                        className={`${
                          idx % 2 === 0 ? "bg-[#2a2a2a]" : "bg-[#252525]"
                        } hover:bg-[#333333] cursor-pointer`}
                        onClick={() => setSelectedStudent(s)}
                      >
                        <td className="p-2 border border-gray-700">{s.name}</td>
                        <td className="p-2 border border-gray-700 text-center">{s.percentComplete}%</td>
                      </tr>
                    ))}
                    {filteredByName.length === 0 && (
                      <tr>
                        <td colSpan={2} className="p-4 text-center text-gray-500">
                          No hay usuarios que coincidan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {selectedMetric === "attempts" && (
              <div>
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-[#1e1e1e]">
                      <th className="p-2 border border-gray-700">Nombre</th>
                      <th className="p-2 border border-gray-700 text-center">Intentos Promedio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredByName.map((s, idx) => (
                      <tr
                        key={s.id}
                        className={`${
                          idx % 2 === 0 ? "bg-[#2a2a2a]" : "bg-[#252525]"
                        } hover:bg-[#333333] cursor-pointer`}
                        onClick={() => setSelectedStudent(s)}
                      >
                        <td className="p-2 border border-gray-700">{s.name}</td>
                        <td className="p-2 border border-gray-700 text-center">{s.attemptsAvg.toFixed(2)}</td>
                      </tr>
                    ))}
                    {filteredByName.length === 0 && (
                      <tr>
                        <td colSpan={2} className="p-4 text-center text-gray-500">
                          No hay usuarios que coincidan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {selectedMetric === "time" && (
              <div>
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-[#1e1e1e]">
                      <th className="p-2 border border-gray-700">Nombre</th>
                      <th className="p-2 border border-gray-700 text-center">Tiempo Promedio (s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredByName.map((s, idx) => (
                      <tr
                        key={s.id}
                        className={`${
                          idx % 2 === 0 ? "bg-[#2a2a2a]" : "bg-[#252525]"
                        } hover:bg-[#333333] cursor-pointer`}
                        onClick={() => setSelectedStudent(s)}
                      >
                        <td className="p-2 border border-gray-700">{s.name}</td>
                        <td className="p-2 border border-gray-700 text-center">{s.timeAvg.toFixed(2)}</td>
                      </tr>
                    ))}
                    {filteredByName.length === 0 && (
                      <tr>
                        <td colSpan={2} className="p-4 text-center text-gray-500">
                          No hay usuarios que coincidan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {selectedMetric === "points" && (
              <div className="w-full">
                <h3 className="text-lg font-semibold mb-4 text-white">Ranking por Puntos</h3>
                <StudentRankingChart
                  data={filteredByName.map((s) => ({
                    name: s.name,
                    totalPoints: s.totalPoints,
                  }))}
                />
              </div>
            )}
            {isAdmin && (
              <div className="mt-4 flex items-center">
                <label className="mr-2 font-medium">Ver:</label>
                <select
                  value={adminView}
                  onChange={(e) => setAdminView(e.target.value as AdminView)}
                  className="p-2 rounded bg-[#1e1e1e] border border-gray-600 text-white focus:outline-none"
                >
                  <option value="students">Por estudiantes</option>
                  <option value="teachers">Por profesores</option>
                </select>
              </div>
            )}
          </div>
          {selectedStudent && (
            <div className="fixed inset-y-0 right-0 w-80 bg-[#2a2a2a] border-l border-gray-700 p-4 overflow-auto">
              <StudentDrawer
                name={selectedStudent.name}
                uid={selectedStudent.id}
                progress={selectedStudent.progress}
                onClose={() => setSelectedStudent(null)}
                day={null}
              />
            </div>
          )}
          {showModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg text-black p-6 w-96 space-y-4">
                <h2 className="text-lg font-bold mb-4">Registrar Usuario</h2>
                <input
                  ref={nameInputRef}
                  type="text"
                  placeholder="Nombre completo"
                  className="w-full p-2 border border-gray-400 rounded"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
                <input
                  type="email"
                  placeholder="Correo electrónico"
                  className="w-full p-2 border border-gray-400 rounded"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
                <input
                  type="text"
                  placeholder="Cédula"
                  className="w-full p-2 border border-gray-400 rounded"
                  value={formData.documentId}
                  onChange={(e) =>
                    setFormData({ ...formData, documentId: e.target.value })
                  }
                />
                {isAdmin && (
                  <select
                    className="w-full p-2 border border-gray-400 rounded"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        role: e.target.value as "estudiante" | "profesor" | "admin",
                      })
                    }
                  >
                    <option value="estudiante">Estudiante</option>
                    <option value="profesor">Profesor</option>
                    <option value="admin">Admin</option>
                  </select>
                )}
                {registrationSuccess && generatedPassword && (
                  <div className="bg-green-100 text-green-800 p-3 rounded text-sm space-y-2">
                    <div className="font-bold">¡Usuario registrado! Datos:</div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono">{formData.email}</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(formData.email)}
                        title="Copiar correo"
                      >
                        <FaCopy className="ml-2 cursor-pointer hover:text-green-700" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono">{generatedPassword}</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(generatedPassword!)}
                        title="Copiar contraseña"
                      >
                        <FaCopy className="ml-2 cursor-pointer hover:text-green-700" />
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-gray-300 text-black rounded"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={registerStudent}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    Registrar
                  </button>
                </div>
              </div>
            </div>
          )}
          {showBulkModal && user && (
            <BulkRegisterModal onClose={() => setShowBulkModal(false)} currentTeacherUid={user.uid} />
          )}
          {showExerciseModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg text-black p-6 w-[600px] space-y-4 max-h-[90vh] overflow-auto">
                <h2 className="text-lg font-bold mb-4">Registrar Ejercicio</h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="font-semibold">ID del ejercicio</label>
                    <input
                      type="text"
                      className="w-full p-2 border"
                      required
                      value={exerciseData.id}
                      onChange={(e) =>
                        setExerciseData({ ...exerciseData, id: e.target.value })
                      }
                    />
                    <label className="font-semibold">Título</label>
                    <input
                      type="text"
                      className="w-full p-2 border"
                      required
                      value={exerciseData.title}
                      onChange={(e) =>
                        setExerciseData({ ...exerciseData, title: e.target.value })
                      }
                    />
                    <label className="font-semibold">Enunciado del problema</label>
                    <textarea
                      className="w-full p-2 border"
                      rows={3}
                      required
                      value={exerciseData.problemStatement}
                      onChange={(e) =>
                        setExerciseData({ ...exerciseData, problemStatement: e.target.value })
                      }
                    />
                    <label className="font-semibold">Respuesta esperada (outputText)</label>
                    <textarea
                      className="w-full p-2 border"
                      rows={2}
                      required
                      value={exerciseData.outputText}
                      onChange={(e) =>
                        setExerciseData({ ...exerciseData, outputText: e.target.value })
                      }
                    />
                    <label className="font-semibold">Código base</label>
                    <textarea
                      className="w-full p-2 border"
                      rows={3}
                      value={exerciseData.starterCode}
                      onChange={(e) =>
                        setExerciseData({ ...exerciseData, starterCode: e.target.value })
                      }
                    />
                    <label className="font-semibold">Nombre de la función</label>
                    <input
                      type="text"
                      className="w-full p-2 border"
                      value={exerciseData.starterFunctionName}
                      onChange={(e) =>
                        setExerciseData({ ...exerciseData, starterFunctionName: e.target.value })
                      }
                    />
                    <label className="font-semibold">Restricciones (HTML)</label>
                    <textarea
                      className="w-full p-2 border"
                      rows={2}
                      value={exerciseData.constraints}
                      onChange={(e) =>
                        setExerciseData({ ...exerciseData, constraints: e.target.value })
                      }
                    />
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="font-semibold">Dificultad</label>
                        <select
                          className="w-full p-2 border"
                          value={exerciseData.difficulty}
                          onChange={(e) =>
                            setExerciseData({ ...exerciseData, difficulty: e.target.value })
                          }
                        >
                          <option value="Easy">Easy</option>
                          <option value="Medium">Medium</option>
                          <option value="Hard">Hard</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="font-semibold">Categoría</label>
                        <input
                          type="text"
                          className="w-full p-2 border"
                          value={exerciseData.category}
                          onChange={(e) =>
                            setExerciseData({ ...exerciseData, category: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <label className="font-semibold">Día al que pertenece</label>
                    <select
                      className="w-full p-2 border"
                      value={targetDay}
                      onChange={(e) => setTargetDay(Number(e.target.value))}
                    >
                      {Array.from({ length: 21 }, (_, i) => i + 1).map((day) => (
                        <option key={day} value={day}>
                          Día {day}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="font-semibold">Examples (con explicación)</label>
                    {exerciseData.examples.map((ex, index) => (
                      <div key={index} className="border p-3 rounded space-y-2 bg-gray-50">
                        <div className="flex justify-between items-center">
                          <h4 className="font-semibold">Example #{index + 1}</h4>
                          {exerciseData.examples.length > 1 && (
                            <button
                              className="text-red-600 text-sm"
                              onClick={() => {
                                const updated = [...exerciseData.examples];
                                updated.splice(index, 1);
                                setExerciseData({ ...exerciseData, examples: updated });
                              }}
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                        <div>
                          <label className="text-sm">Input</label>
                          <input
                            type="text"
                            className="w-full p-2 border"
                            value={ex.input}
                            onChange={(e) => {
                              const updated = [...exerciseData.examples];
                              updated[index].input = e.target.value;
                              setExerciseData({
                                ...exerciseData,
                                examples: updated,
                                inputText: updated[0].input,
                              });
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-sm">Output</label>
                          <input
                            type="text"
                            className="w-full p-2 border"
                            value={ex.output}
                            onChange={(e) => {
                              const updated = [...exerciseData.examples];
                              updated[index].output = e.target.value;
                              setExerciseData({ ...exerciseData, examples: updated });
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-sm">Explicación</label>
                          <textarea
                            className="w-full p-2 border"
                            rows={2}
                            value={ex.explanation}
                            onChange={(e) => {
                              const updated = [...exerciseData.examples];
                              updated[index].explanation = e.target.value;
                              setExerciseData({ ...exerciseData, examples: updated });
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-end">
                      <button
                        className="px-3 py-1 mt-2 bg-black text-white rounded"
                        onClick={() =>
                          setExerciseData({
                            ...exerciseData,
                            examples: [...exerciseData.examples, { input: "", output: "", explanation: "" }],
                          })
                        }
                      >
                        + Add Example
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="font-semibold">Test Cases (solo input/output)</label>
                    {exerciseData.testCases.map((tc, idx) => (
                      <div key={idx} className="border p-3 rounded space-y-2 bg-gray-50">
                        <div className="flex justify-between items-center">
                          <h4 className="font-semibold">Test Case #{idx + 1}</h4>
                          {exerciseData.testCases.length > 1 && (
                            <button
                              className="text-red-600 text-sm"
                              onClick={() => {
                                const updated = [...exerciseData.testCases];
                                updated.splice(idx, 1);
                                setExerciseData({ ...exerciseData, testCases: updated });
                              }}
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                        <div>
                          <label className="text-sm">Input</label>
                          <input
                            type="text"
                            className="w-full p-2 border"
                            value={tc.input}
                            onChange={(e) => {
                              const updated = [...exerciseData.testCases];
                              updated[idx].input = e.target.value;
                              setExerciseData({ ...exerciseData, testCases: updated });
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-sm">Output</label>
                          <input
                            type="text"
                            className="w-full p-2 border"
                            value={tc.output}
                            onChange={(e) => {
                              const updated = [...exerciseData.testCases];
                              updated[idx].output = e.target.value;
                              setExerciseData({ ...exerciseData, testCases: updated });
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-end">
                      <button
                        className="px-3 py-1 mt-2 bg-black text-white rounded"
                        onClick={() =>
                          setExerciseData({
                            ...exerciseData,
                            testCases: [...exerciseData.testCases, { input: "", output: "" }],
                          })
                        }
                      >
                        + Add Test Case
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => setShowExerciseModal(false)}
                    className="px-4 py-2 bg-gray-300 text-black rounded"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={registerExercise}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Registrar Ejercicio
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
