// pages/TeacherView.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  FaCheck,
  FaTimes,
  FaCopy,
  FaChevronUp,
  FaChevronDown
} from 'react-icons/fa';
import { useRouter } from 'next/router';
import { useAuthState } from 'react-firebase-hooks/auth';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth as getAuthSecondary,
  createUserWithEmailAndPassword
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
  arrayUnion
} from 'firebase/firestore';

import Topbar from '@/components/Topbar/Topbar';
import MetricsFilter, { Metric } from '@/components/MetricsFilter/MetricsFilter';
import AdminTabs, { AdminView } from '@/components/AdminTabs/AdminTabs';
import { StudentDrawer } from '../pages/studentdrawer';
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

const secondaryApp =
  getApps().find(app => app.name === 'Secondary') ||
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
  // Estados para el Modal de “Registrar Estudiante”
  // ---------------------------------------------------
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    documentId: ''
  });
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(
    null
  );
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

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
    if (!userRole) return;
    (async () => {
      // 2.1) Obtener definición de “days” desde Firestore (courses)
      const courseSnap = await getDocs(collection(firestore, 'courses'));
      const daysArr: any[] = (
        courseSnap.docs[0]?.data().days || []
      ).sort((a, b) => a.day - b.day);
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
        statsSnap.docs.forEach(statDoc => {
          const stat = statDoc.data();
          // Suponemos que stat.attempts y stat.timeSpent existen
          sumAttempts += stat.attempts || 0;
          sumTime += stat.timeSpent || 0;

          // Calcular índice de día según day.problems
          const idx = daysArr.findIndex(day =>
            Array.isArray(day.problems) &&
            day.problems.includes(stat.problemId)
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
          if (arr.every(v => !v)) return 'X';
          return 'O';
        });

        // 2.6) Calcular métricas por estudiante
        const completedDays = progress.filter(v => v === '✓').length;
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
          timeAvg
        });
      }

      setStudents(listado);
    })();
  }, [userRole, user]);

  // ------------------------------
  //  Funciones auxiliares
  // ------------------------------
  const isAdmin = userRole === 'admin';
  const toggleMetric = (m: Metric) =>
    setSelectedMetric(prev => (prev === m ? null : m));
  const toggleTeacher = (tid: string) =>
    setExpandedTeachers(prev =>
      prev.includes(tid) ? prev.filter(x => x !== tid) : [...prev, tid]
    );

  // Agrupar estudiantes por teacherId (para vista admin “Por profesores”)
  const byTeacher = students.reduce<Record<string, Student[]>>((acc, s) => {
    (acc[s.teacherId] ||= []).push(s);
    return acc;
  }, {});

  // ---------------------------------------------------
  // 3) FUNCIONES DE REGISTRO DE ESTUDIANTE
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
        role: 'estudiante',
        teacherId: user!.uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        solvedProblems: [],
        likedProblems: [],
        dislikedProblems: [],
        starredProblems: []
      });
      // Agregar student al array “students” del profesor actual
      await updateDoc(doc(firestore, 'users', user!.uid), {
        students: arrayUnion(uid)
      });
      setGeneratedPassword(password);
      setRegistrationSuccess(true);
      navigator.clipboard.writeText(password);
      setFormData({ name: '', email: '', documentId: '' });
    } catch (e) {
      console.error(e);
      alert('Error al registrar estudiante');
      setRegistrationSuccess(false);
    }
  };

  // ---------------------------------------------------
  // 4) FILTRADO “EN MEMORIA” POR searchText
  // ---------------------------------------------------
  const filteredByName = students.filter(s =>
    s.name.toLowerCase().includes(searchText.toLowerCase().trim())
  );

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-white">
      {/* ====================== */}
      {/*     Topbar Global      */}
      {/* ====================== */}
      <Topbar />

      <main className="flex-1 p-6 overflow-auto">
        <h1 className="text-2xl font-bold mb-6">
          Seguimiento de Progreso Estudiantil
        </h1>

        <div className="space-y-6">
          {/* ====================== */}
          {/*     CARD DE FILTROS     */}
          {/* ====================== */}
          <div className="bg-[#2a2a2a] border border-gray-700 rounded-lg">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
              <h2 className="text-lg font-semibold">Filtros</h2>
              <button
                onClick={() => setFiltersOpen(open => !open)}
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
                {/* 4.1) Input de búsqueda por nombre */}
                <input
                  type="text"
                  placeholder="Buscar estudiante..."
                  className="w-full p-2 rounded bg-[#1e1e1e] border border-gray-600 text-white focus:outline-none"
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                />

                {/* 4.2) Selector de Métricas */}
                <MetricsFilter
                  selectedMetric={selectedMetric}
                  onToggle={toggleMetric}
                />

                {/* 4.3) Pestañas Admin (solo si es admin) */}
                {isAdmin && (
                  <AdminTabs adminView={adminView} onChange={setAdminView} />
                )}
              </div>
            )}
          </div>

          {/* ====================== */}
          {/*     CARD DE TABLA      */}
          {/* ====================== */}
          <div className="bg-[#2a2a2a] border border-gray-700 rounded-lg p-4 overflow-auto">
            {/* ---------------------------------------------------- */}
            {/* Si no hay métrica activa → mostrar GRID por días  */}
            {/* ---------------------------------------------------- */}
            {selectedMetric === null && (
              <>
                {(!isAdmin || adminView === 'students') && (
                  <>
                    <div
                      className="grid border border-gray-700"
                      style={{
                        gridTemplateColumns: `200px repeat(${
                          filteredByName[0]?.progress.length || 0
                        }, 60px)`
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
                    {filteredByName.map(s => (
                      <div
                        key={s.id}
                        className="grid border border-gray-700"
                        style={{
                          gridTemplateColumns: `200px repeat(${
                            s.progress.length
                          }, 60px)`
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
                        No hay estudiantes que coincidan.
                      </div>
                    )}
                  </>
                )}

                {isAdmin && adminView === 'teachers' && (
                  <div className="space-y-4">
                    {Object.entries(byTeacher).map(([tid, group]) => {
                      const groupFiltered = group.filter(s =>
                        s.name.toLowerCase().includes(searchText.toLowerCase().trim())
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
                            <span>
                              {expandedTeachers.includes(tid) ? '▾' : '▸'}
                            </span>
                          </div>
                          {expandedTeachers.includes(tid) && (
                            <div className="p-2 bg-[#2a2a2a]">
                              {groupFiltered.map(s => (
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
                                  No hay estudiantes bajo este profesor que coincidan.
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

            {/* ---------------------------------------------------- */}
            {/* Si hay métrica activa → mostrar TABLA de métricas  */}
            {/* ---------------------------------------------------- */}
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
                    No hay estudiantes que coincidan.
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
                    No hay estudiantes que coincidan.
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
                    No hay estudiantes que coincidan.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ====================== */}
        {/*    Drawer de detalles   */}
        {/* ====================== */}
        {selectedStudent && (
          <div className="fixed inset-y-0 right-0 w-80 bg-[#2a2a2a] border-l border-gray-700 p-4 overflow-auto">
            <StudentDrawer
              name={selectedStudent.name}
              uid={selectedStudent.id}
              progress={selectedStudent.progress}
              onClose={() => setSelectedStudent(null)}
            />
          </div>
        )}

        {/* ====================== */}
        {/*    Modal de registro     */}
        {/* ====================== */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[#2a2a2a] rounded-lg p-6 w-96 space-y-4">
              <h2 className="text-lg font-bold text-white">
                Registrar Estudiante
              </h2>
              <input
                ref={nameInputRef}
                type="text"
                placeholder="Nombre completo"
                className="w-full p-2 border border-gray-600 rounded bg-[#1e1e1e] text-white"
                value={formData.name}
                onChange={e =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
              <input
                type="email"
                placeholder="Correo electrónico"
                className="w-full p-2 border border-gray-600 rounded bg-[#1e1e1e] text-white"
                value={formData.email}
                onChange={e =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
              <input
                type="text"
                placeholder="Cédula"
                className="w-full p-2 border border-gray-600 rounded bg-[#1e1e1e] text-white"
                value={formData.documentId}
                onChange={e =>
                  setFormData({ ...formData, documentId: e.target.value })
                }
              />
              {registrationSuccess && generatedPassword && (
                <div className="bg-green-700 text-white p-3 rounded space-y-2 text-sm">
                  <div className="font-semibold">¡Estudiante registrado!</div>
                  <div className="flex justify-between">
                    <span className="font-mono">{formData.email}</span>
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(formData.email)
                      }
                      title="Copiar correo"
                    >
                      <FaCopy className="text-white" />
                    </button>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono">{generatedPassword}</span>
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(generatedPassword)
                      }
                      title="Copiar contraseña"
                    >
                      <FaCopy className="text-white" />
                    </button>
                  </div>
                </div>
              )}
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded"
                >
                  Cancelar
                </button>
                <button
                  onClick={registerStudent}
                  className="px-4 py-2 bg-green-600 text-white rounded"
                >
                  Registrar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
