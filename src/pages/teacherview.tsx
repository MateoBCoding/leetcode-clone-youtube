// pages/TeacherView.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  FaCheck,
  FaTimes,
  FaCopy,
  FaChevronUp,
  FaChevronDown,
  FaUpload,
} from 'react-icons/fa';
import { useRouter } from 'next/router';
import { useAuthState } from 'react-firebase-hooks/auth';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth as getAuthSecondary,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore';

import Topbar from '@/components/Topbar/Topbar';
import MetricsFilter, { Metric } from '@/components/MetricsFilter/MetricsFilter';
import AdminTabs, { AdminView } from '@/components/AdminTabs/AdminTabs';
import { StudentDrawer } from '../pages/studentdrawer';
import { BulkRegisterModal } from '@/components/BulkRegisterModal/BulkRegisterModal';
import { firestore, auth, firebaseConfig } from '@/firebase/firebase';

interface Student {
  id: string;
  name: string;
  email: string;
  progress: string[];          // ['✓', 'X', 'O', ...]
  teacherId: string;
  percentComplete: number;      // Porcentaje de días completados (0-100)
  attemptsAvg: number;          // Promedio de intentos
  timeAvg: number;              // Promedio de tiempo (segundos)
}

// Configuración de la app secundaria para registrar usuarios sin cerrar sesión
const secondaryApp =
  getApps().find((app) => app.name === 'Secondary') ||
  initializeApp(firebaseConfig, 'Secondary');
const secondaryAuth = getAuthSecondary(secondaryApp);

export default function TeacherView() {
  const router = useRouter();
  const [user, loading] = useAuthState(auth);
  const [userRole, setUserRole] = useState<string | null>(null);

  // ------------------------------
  // Datos principales
  // ------------------------------
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [expandedTeachers, setExpandedTeachers] = useState<string[]>([]);

  // ------------------------------
  // Filtrado / Vistas
  // ------------------------------
  const [adminView, setAdminView] = useState<AdminView>('students');
  const [selectedMetric, setSelectedMetric] = useState<Metric>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Nuevo estado: texto de búsqueda para filtrar por nombre
  const [searchText, setSearchText] = useState('');

  // ---------------------------------------------------
  // Estados para el Modal de “Registrar Usuario”
  // ---------------------------------------------------
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    documentId: '',
    role: 'estudiante' as 'estudiante' | 'profesor' | 'admin',
  });
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  // ---------------------------------------------------
  // NUEVO ESTADO: controlar si se muestra el modal de Carga Masiva
  // ---------------------------------------------------
  const [showBulkModal, setShowBulkModal] = useState(false);

  // ---------------------------------------------------
  // Estados para el Modal de “Registrar Ejercicio”
  // ---------------------------------------------------
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [targetDay, setTargetDay] = useState<number>(1);
  const [exerciseData, setExerciseData] = useState({
    id: '',
    title: '',
    problemStatement: '',
    outputText: '',
    starterCode: '',
    starterFunctionName: '',
    constraints: '',
    examples: [{ input: '', output: '', explanation: '' }],
    difficulty: 'Easy',
    category: '',
    inputText: '',
    order: 0,
    link: '',
    videoId: '',
  });

  // ---------------------------------------------------
  // 1) CONTROL DE ACCESO Y ROL
  // ---------------------------------------------------
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/auth');
      return;
    }
    (async () => {
      const snap = await getDoc(doc(firestore, 'users', user.uid));
      const role = snap.data()?.role?.toLowerCase() || null;
      setUserRole(role);
      if (role !== 'profesor' && role !== 'admin') {
        await router.replace('/auth');
      }
    })();
  }, [user, loading, router]);

  // ---------------------------------------------------
  // 2) CARGA DE ESTUDIANTES Y PROGRESO + CÁLCULO MÉTRICAS
  // ---------------------------------------------------
  useEffect(() => {
    if (!user || !userRole) return;
    (async () => {
      // 2.1) Obtener definición de “days” desde Firestore (courses)
      const courseSnap = await getDocs(collection(firestore, 'courses'));
      const daysArr: any[] = (
        courseSnap.docs[0]?.data().days || []
      ).sort((a: { day: number }, b: { day: number }) => a.day - b.day);
      const totalDays = daysArr.length;

      // 2.2) Obtener lista “linked” de estudiantes (si el usuario es profesor)
      const mySnap = await getDoc(doc(firestore, 'users', user!.uid));
      const linked: string[] = mySnap.data()?.students || [];

      // 2.3) Recuperar todos los usuarios cuya role = 'estudiante'
      const usersSnap = await getDocs(collection(firestore, 'users'));
      const listado: Student[] = [];

      for (const d of usersSnap.docs) {
        const data = d.data();
        if (data.role !== 'estudiante') continue;
        if (userRole === 'profesor' && !linked.includes(d.id)) continue;

        // 2.4) Para cada estudiante, consultar user_problem_stats
        const statsSnap = await getDocs(
          query(
            collection(firestore, 'user_problem_stats'),
            where('userId', '==', d.id)
          )
        );

        // Acumular intentos y tiempo
        let sumAttempts = 0;
        let sumTime = 0;
        let countStats = statsSnap.docs.length;

        // Construir arreglo para calcular progress por día
        const statsByDay: Record<number, boolean[]> = {};
        statsSnap.docs.forEach((statDoc) => {
          const stat = statDoc.data();
          sumAttempts += stat.attempts || 0;
          sumTime += stat.timeSpent || 0;

          // Calcular índice de día según day.problems
          const idx = daysArr.findIndex((day) =>
            Array.isArray(day.problems) && day.problems.includes(stat.problemId)
          );
          if (idx < 0) return;
          statsByDay[idx] ||= [];
          statsByDay[idx].push(stat.success);
        });

        // 2.5) Calcular “progress” por día
        const progress = daysArr.map((_, i) => {
          const arr = statsByDay[i] || [];
          if (!arr.length) return '';
          if (arr.every(Boolean)) return '✓';
          if (arr.every((v) => !v)) return 'X';
          return 'O';
        });

        // 2.6) Calcular métricas por estudiante
        const completedDays = progress.filter((v) => v === '✓').length;
        const percentComplete = totalDays
          ? Math.round((completedDays / totalDays) * 100)
          : 0;
        const attemptsAvg = countStats ? sumAttempts / countStats : 0;
        const timeAvg = countStats ? sumTime / countStats : 0;

        listado.push({
          id: d.id,
          name: data.displayName || 'Sin nombre',
          email: data.email || '',
          progress,
          teacherId: data.teacherId || '',
          percentComplete,
          attemptsAvg,
          timeAvg,
        });
      }

      setStudents(listado);
    })();
  }, [userRole, user]);

  // ------------------------------
  // Funciones auxiliares
  // ------------------------------
  const isAdmin = userRole === 'admin';
  const canRegister = userRole === 'profesor' || isAdmin;
  const toggleMetric = (m: Metric) =>
    setSelectedMetric((prev) => (prev === m ? null : m));
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

  // ---------------------------------------------------
  // 3) FUNCIONES DE REGISTRO DE USUARIO “UNO A UNO”
  // ---------------------------------------------------
  const generatePassword = () => Math.random().toString(36).slice(-8);
  const registerStudent = async () => {
    if (
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.documentId.trim()
    ) {
      alert('Todos los campos son obligatorios');
      return;
    }
    const password = generatePassword();
    try {
      // Crear usuario con el rol seleccionado
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        formData.email,
        password
      );
      const uid = cred.user.uid;
      await setDoc(doc(firestore, 'users', uid), {
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
      // Si el nuevo rol es 'estudiante', agregar al array “students” del profesor actual
      if (formData.role === 'estudiante') {
        await updateDoc(doc(firestore, 'users', user!.uid), {
          students: arrayUnion(uid),
        });
      }
      setGeneratedPassword(password);
      setRegistrationSuccess(true);
      navigator.clipboard.writeText(password);
      setFormData({ name: '', email: '', documentId: '', role: 'estudiante' });
    } catch (e) {
      console.error(e);
      alert('Error al registrar usuario');
      setRegistrationSuccess(false);
    }
  };

  // ---------------------------------------------------
  // 4) FUNCIONES DE REGISTRO DE EJERCICIO
  // ---------------------------------------------------
  const registerExercise = async () => {
    if (
      !exerciseData.id.trim() ||
      !exerciseData.title.trim() ||
      !exerciseData.problemStatement.trim() ||
      !exerciseData.outputText.trim()
    ) {
      alert('Todos los campos obligatorios deben estar llenos.');
      return;
    }

    try {
      // 1. Guardar el ejercicio en la colección "problems"
      const exerciseRef = doc(firestore, 'problems', exerciseData.id);
      await setDoc(exerciseRef, {
        ...exerciseData,
        examples: exerciseData.examples,
      });

      // 2. Obtener el curso (se asume que solo hay uno)
      const courseSnap = await getDocs(collection(firestore, 'courses'));
      if (courseSnap.empty) {
        alert('No existe documento de curso en Firestore');
        return;
      }

      const courseDoc = courseSnap.docs[0];
      const courseRef = courseDoc.ref;
      const courseData = courseDoc.data();
      const currentDays = courseData.days || [];

      // 3. Verificar si el día ya existe
      const dayIndex = currentDays.findIndex((d: any) => d.day === targetDay);
      if (dayIndex >= 0) {
        if (!currentDays[dayIndex].problems.includes(exerciseData.id)) {
          currentDays[dayIndex].problems.push(exerciseData.id);
        }
      } else {
        currentDays.push({
          day: targetDay,
          problems: [exerciseData.id],
        });
      }

      // 4. Actualizar el documento del curso
      await updateDoc(courseRef, { days: currentDays });

      // 5. Limpiar estado y cerrar modal
      setExerciseData({
        id: '',
        title: '',
        problemStatement: '',
        outputText: '',
        starterCode: '',
        starterFunctionName: '',
        constraints: '',
        examples: [{ input: '', output: '', explanation: '' }],
        difficulty: 'Easy',
        category: '',
        inputText: '',
        order: 0,
        link: '',
        videoId: '',
      });
      setTargetDay(1);
      setShowExerciseModal(false);
      alert('Ejercicio registrado exitosamente');
    } catch (error) {
      console.error('Error al registrar ejercicio:', error);
      alert('Hubo un error al registrar el ejercicio.');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-white">
      {/* ====================== */}
      {/*     Topbar Global      */}
      {/* ====================== */}
      <Topbar />

      <main className="flex-1 p-6 overflow-auto space-y-6">
        {/* ====================== */}
        {/*   CARD DE FILTROS      */}
        {/* ====================== */}
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
              {/* Selector de Métricas */}
              <MetricsFilter selectedMetric={selectedMetric} onToggle={toggleMetric} />

              {/* Pestañas Admin (solo si es admin) */}
              {isAdmin && <AdminTabs adminView={adminView} onChange={setAdminView} />}
            </div>
          )}
        </div>

        {/* ====================== */}
        {/*  CARD DE TABLA        */}
        {/* ====================== */}
        <div className="bg-[#2a2a2a] border border-gray-700 rounded-lg p-4 overflow-auto space-y-6">
          {/* ====================== */}
          {/*  Barra de búsqueda + Botones  */}
          {/* ====================== */}
          <div className="flex items-center justify-between">
            <input
              type="text"
              placeholder="Buscar usuario..."
              className="w-1/2 p-2 rounded bg-[#1e1e1e] border border-gray-600 text-white focus:outline-none"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <div className="flex space-x-2">
              {/* Botón para registrar uno a uno */}
              {canRegister && (
                <button
                  onClick={() => setShowModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  Registrar Usuario
                </button>
              )}
              {/* Botón para registrar ejercicio */}
              {canRegister && (
                <button
                  onClick={() => setShowExerciseModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Registrar Ejercicio
                </button>
              )}
              {/* Botón para carga masiva */}
              {canRegister && (
                <button
                  onClick={() => setShowBulkModal(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors flex items-center gap-1"
                >
                  <FaUpload />
                  Carga masiva
                </button>
              )}
            </div>
          </div>

          {/* ======================================================= */}
          {/*   Si no hay métrica activa → mostrar GRID por días      */}
          {/* ======================================================= */}
          {selectedMetric === null && (
            <>
              {(!isAdmin || adminView === 'students') && (
                <>
                  <div
                    className="grid border border-gray-700"
                    style={{
                      gridTemplateColumns: `200px repeat(${
                        filteredByName[0]?.progress.length || 0
                      }, 60px)`,
                    }}
                  >
                    <div className="p-2 font-bold border border-gray-700 bg-[#1e1e1e]">
                      Nombre
                    </div>
                    {filteredByName[0]?.progress.map((_, i) => (
                      <div
                        key={i}
                        className="p-2 font-bold border border-gray-700 text-center bg-[#1e1e1e]"
                      >
                        D{i + 1}
                      </div>
                    ))}
                  </div>
                  {filteredByName.map((s) => (
                    <div
                      key={s.id}
                      className="grid border border-gray-700"
                      style={{
                        gridTemplateColumns: `200px repeat(${s.progress.length}, 60px)`,
                      }}
                    >
                      <div
                        className="p-2 border border-gray-700 cursor-pointer hover:bg-[#333333] bg-[#1e1e1e]"
                        onClick={() => setSelectedStudent(s)}
                      >
                        {s.name}
                      </div>
                      {s.progress.map((v, j) => (
                        <div
                          key={j}
                          className="p-2 border border-gray-700 text-center bg-[#1e1e1e]"
                        >
                          {v === '✓' ? (
                            <FaCheck className="text-green-400 inline" />
                          ) : v === 'X' ? (
                            <FaTimes className="text-red-400 inline" />
                          ) : v === 'O' ? (
                            <span className="text-yellow-400">O</span>
                          ) : (
                            <span className="text-gray-500">–</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                  {filteredByName.length === 0 && (
                    <div className="mt-4 text-center text-gray-500">
                      No hay usuarios que coincidan.
                    </div>
                  )}
                </>
              )}

              {isAdmin && adminView === 'teachers' && (
                <div className="space-y-4">
                  {Object.entries(byTeacher).map(([tid, group]) => {
                    const groupFiltered = group.filter((s) =>
                      s.name
                        .toLowerCase()
                        .includes(searchText.toLowerCase().trim())
                    );
                    return (
                      <div
                        key={tid}
                        className="border border-gray-700 rounded-lg overflow-hidden"
                      >
                        <div
                          className="p-3 bg-[#1e1e1e] cursor-pointer flex justify-between items-center"
                          onClick={() => toggleTeacher(tid)}
                        >
                          <span>Profesor: {tid}</span>
                          <span>{expandedTeachers.includes(tid) ? '▾' : '▸'}</span>
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

          {/* ======================================================= */}
          {/*   Si hay métrica activa → mostrar TABLA de métricas     */}
          {/* ======================================================= */}
          {selectedMetric === 'completion' && (
            <div>
              <div className="grid grid-cols-2 border border-gray-700">
                <div className="p-2 font-bold border border-gray-700 bg-[#1e1e1e]">
                  Nombre
                </div>
                <div className="p-2 font-bold border border-gray-700 bg-[#1e1e1e] text-center">
                  % Completos
                </div>
              </div>
              {filteredByName.map((s) => (
                <div
                  key={s.id}
                  className="grid grid-cols-2 border border-gray-700"
                >
                  <div
                    className="p-2 border border-gray-700 cursor-pointer hover:bg-[#333333] bg-[#1e1e1e]"
                    onClick={() => setSelectedStudent(s)}
                  >
                    {s.name}
                  </div>
                  <div className="p-2 border border-gray-700 text-center bg-[#1e1e1e]">
                    {s.percentComplete}%
                  </div>
                </div>
              ))}
              {filteredByName.length === 0 && (
                <div className="mt-4 text-center text-gray-500">
                  No hay usuarios que coincidan.
                </div>
              )}
            </div>
          )}

          {selectedMetric === 'attempts' && (
            <div>
              <div className="grid grid-cols-2 border border-gray-700">
                <div className="p-2 font-bold border border-gray-700 bg-[#1e1e1e]">
                  Nombre
                </div>
                <div className="p-2 font-bold border border-gray-700 bg-[#1e1e1e] text-center">
                  Intentos Promedio
                </div>
              </div>
              {filteredByName.map((s) => (
                <div
                  key={s.id}
                  className="grid grid-cols-2 border border-gray-700"
                >
                  <div
                    className="p-2 border border-gray-700 cursor-pointer hover:bg-[#333333] bg-[#1e1e1e]"
                    onClick={() => setSelectedStudent(s)}
                  >
                    {s.name}
                  </div>
                  <div className="p-2 border border-gray-700 text-center bg-[#1e1e1e]">
                    {s.attemptsAvg.toFixed(2)}
                  </div>
                </div>
              ))}
              {filteredByName.length === 0 && (
                <div className="mt-4 text-center text-gray-500">
                  No hay usuarios que coincidan.
                </div>
              )}
            </div>
          )}

          {selectedMetric === 'time' && (
            <div>
              <div className="grid grid-cols-2 border border-gray-700">
                <div className="p-2 font-bold border border-gray-700 bg-[#1e1e1e]">
                  Nombre
                </div>
                <div className="p-2 font-bold border border-gray-700 bg-[#1e1e1e] text-center">
                  Tiempo Promedio (s)
                </div>
              </div>
              {filteredByName.map((s) => (
                <div
                  key={s.id}
                  className="grid grid-cols-2 border border-gray-700"
                >
                  <div
                    className="p-2 border border-gray-700 cursor-pointer hover:bg-[#333333] bg-[#1e1e1e]"
                    onClick={() => setSelectedStudent(s)}
                  >
                    {s.name}
                  </div>
                  <div className="p-2 border border-gray-700 text-center bg-[#1e1e1e]">
                    {s.timeAvg.toFixed(2)}
                  </div>
                </div>
              ))}
              {filteredByName.length === 0 && (
                <div className="mt-4 text-center text-gray-500">
                  No hay usuarios que coincidan.
                </div>
              )}
            </div>
          )}
        </div>

        {/* ====================== */}
        {/*    Drawer de detalles  */}
        {/* ====================== */}
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

        {/* ====================== */}
        {/*    Modal de registro   */}
        {/* ====================== */}
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

              {/* Selector de rol: solo se muestra si el usuario es admin */}
              {isAdmin && (
                <select
                  className="w-full p-2 border border-gray-400 rounded"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as 'estudiante' | 'profesor' | 'admin',
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
                      onClick={() =>
                        navigator.clipboard.writeText(generatedPassword!)
                      }
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

        {/* ====================== */}
        {/*  Modal de Carga Masiva  */}
        {/* ====================== */}
        {showBulkModal && user && (
          <BulkRegisterModal
            onClose={() => setShowBulkModal(false)}
            currentTeacherUid={user.uid}
          />
        )}

        {/* ====================== */}
        {/*  Modal: Registrar Ejercicio   */}
        {/* ====================== */}
        {showExerciseModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg text-black p-6 w-[600px] space-y-4 max-h-[90vh] overflow-auto">
              <h2 className="text-lg font-bold mb-4">Registrar Ejercicio</h2>

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
                    setExerciseData({
                      ...exerciseData,
                      problemStatement: e.target.value,
                    })
                  }
                />

                <label className="font-semibold">
                  Respuesta esperada (outputText)
                </label>
                <textarea
                  className="w-full p-2 border"
                  rows={2}
                  required
                  value={exerciseData.outputText}
                  onChange={(e) =>
                    setExerciseData({
                      ...exerciseData,
                      outputText: e.target.value,
                    })
                  }
                />

                <label className="font-semibold">Código base</label>
                <textarea
                  className="w-full p-2 border"
                  rows={3}
                  value={exerciseData.starterCode}
                  onChange={(e) =>
                    setExerciseData({
                      ...exerciseData,
                      starterCode: e.target.value,
                    })
                  }
                />

                <label className="font-semibold">Nombre de la función</label>
                <input
                  type="text"
                  className="w-full p-2 border"
                  value={exerciseData.starterFunctionName}
                  onChange={(e) =>
                    setExerciseData({
                      ...exerciseData,
                      starterFunctionName: e.target.value,
                    })
                  }
                />

                <label className="font-semibold">Restricciones (HTML)</label>
                <textarea
                  className="w-full p-2 border"
                  rows={2}
                  value={exerciseData.constraints}
                  onChange={(e) =>
                    setExerciseData({
                      ...exerciseData,
                      constraints: e.target.value,
                    })
                  }
                />

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="font-semibold">Dificultad</label>
                    <input
                      type="text"
                      className="w-full p-2 border"
                      value={exerciseData.difficulty}
                      onChange={(e) =>
                        setExerciseData({
                          ...exerciseData,
                          difficulty: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="flex-1">
                    <label className="font-semibold">Categoría</label>
                    <input
                      type="text"
                      className="w-full p-2 border"
                      value={exerciseData.category}
                      onChange={(e) =>
                        setExerciseData({
                          ...exerciseData,
                          category: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <label className="font-semibold">Input del ejemplo</label>
                <input
                  type="text"
                  className="w-full p-2 border"
                  value={exerciseData.examples[0].input}
                  onChange={(e) => {
                    const updated = [...exerciseData.examples];
                    updated[0].input = e.target.value;
                    setExerciseData({
                      ...exerciseData,
                      examples: updated,
                      inputText: e.target.value,
                    });
                  }}
                />

                <label className="font-semibold">Output del ejemplo</label>
                <input
                  type="text"
                  className="w-full p-2 border"
                  value={exerciseData.examples[0].output}
                  onChange={(e) => {
                    const updated = [...exerciseData.examples];
                    updated[0].output = e.target.value;
                    setExerciseData({ ...exerciseData, examples: updated });
                  }}
                />

                <label className="font-semibold">Explicación del ejemplo</label>
                <textarea
                  className="w-full p-2 border"
                  rows={2}
                  value={exerciseData.examples[0].explanation}
                  onChange={(e) => {
                    const updated = [...exerciseData.examples];
                    updated[0].explanation = e.target.value;
                    setExerciseData({ ...exerciseData, examples: updated });
                  }}
                />

                <label className="font-semibold">Día al que pertenece (1...)</label>
                <input
                  type="number"
                  className="w-full p-2 border"
                  value={targetDay}
                  onChange={(e) => setTargetDay(Number(e.target.value))}
                />
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
  );
}
