import React, { useState, useEffect, useRef } from 'react';
import { FaCheck, FaTimes, FaSignOutAlt, FaUserCircle, FaCopy } from 'react-icons/fa';
import { StudentDrawer } from '../pages/studentdrawer';
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
import { useRouter } from 'next/router';
import { useAuthState } from 'react-firebase-hooks/auth';
import { signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { getAuth as getAuthSecondary } from 'firebase/auth';
import { initializeApp, getApps } from 'firebase/app';
import { firestore, auth, firebaseConfig } from '@/firebase/firebase';
import { getDayIndexFromProblemId } from './studentdrawer';

// App secundaria para crear usuarios sin cerrar sesión principal
const secondaryApp = getApps().find(app => app.name === 'Secondary')
  || initializeApp(firebaseConfig, 'Secondary');
const secondaryAuth = getAuthSecondary(secondaryApp);

const days = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'];
type Metric = 'completion' | 'attempts' | 'time' | null;

function TeacherView() {
  const [expandedDays, setExpandedDays] = useState(days);
  const [selectedDayFilter, setSelectedDayFilter] = useState<string | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<Metric>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', documentId: '' });
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  const router = useRouter();
  const [user, loading] = useAuthState(auth);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Control de acceso del profesor
  useEffect(() => {
    const checkAccess = async () => {
      if (!user) return router.push('/auth');
      const userRef = doc(firestore, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      const role = userSnap.data()?.role?.toLowerCase();
      if (role !== 'profesor') router.push('/home');
    };
    if (!loading) checkAccess();
  }, [user, loading, router]);

  // Carga de estudiantes y estadísticas
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const usersSnapshot = await getDocs(collection(firestore, 'users'));
        const studentsData: any[] = [];

        for (const docSnap of usersSnapshot.docs) {
          const data = docSnap.data();
          if (data.role?.toLowerCase() !== 'estudiante') continue;

          const userId = docSnap.id;
          const name = data.displayName || data.name || 'Sin nombre';
          const email = data.email || '';
          const progress = Array(6).fill('');
          let totalAttempts = 0;
          let totalTime = 0;
          let successCount = 0;

          const statsSnapshot = await getDocs(
            query(collection(firestore, 'user_problem_stats'), where('userId', '==', userId))
          );

          statsSnapshot.docs.forEach((doc) => {
            const stat = doc.data();
            const dayIndex = getDayIndexFromProblemId(stat.problemId);
            if (dayIndex !== -1) {
              if (stat.success) {
                progress[dayIndex] = '✓';
                successCount++;
              } else if (progress[dayIndex] !== '✓') {
                progress[dayIndex] = 'X';
              }
              totalAttempts += stat.executionCount || 0;
              totalTime += stat.totalExecutionTime || 0;
            }
          });

          studentsData.push({
            id: userId,
            name,
            email,
            progress,
            completionRate: (successCount / 6) * 100,
            averageAttempts: statsSnapshot.size
              ? (totalAttempts / statsSnapshot.size).toFixed(1)
              : '0',
            averageTime: statsSnapshot.size
              ? (totalTime / statsSnapshot.size).toFixed(1)
              : '0',
          });
        }
        setStudents(studentsData);
      } catch (error) {
        console.error('Error cargando estudiantes:', error);
      }
    };
    fetchStudents();
  }, [generatedPassword]);

  // Cuando se abre el modal, enfocamos el input si no estamos en un iframe
  useEffect(() => {
    if (showModal && window.self === window.top) {
      nameInputRef.current?.focus();
    }
  }, [showModal]);

  const toggleMetric = (metric: Metric) => setSelectedMetric(prev => prev === metric ? null : metric);
  const generatePassword = () => Math.random().toString(36).slice(-8);

  const registerStudent = async () => {
    if (!formData.name || !formData.email || !formData.documentId) {
      alert('Todos los campos son obligatorios');
      return;
    }
    const password = generatePassword();
    try {
      // Crear cuenta en Auth sin cerrar sesión principal
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, formData.email, password);
      const studentUID = userCred.user.uid;
      // Guardar datos del estudiante en Firestore
      await setDoc(doc(firestore, 'users', studentUID), {
        uid: studentUID,
        email: formData.email,
        displayName: formData.name,
        documentId: formData.documentId,
        role: 'estudiante',
        teacherId: user?.uid || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        solvedProblems: [],
        likedProblems: [],
        dislikedProblems: [],
        starredProblems: [],
      });
      // Agregar estudiante al array del profesor
      await updateDoc(doc(firestore, 'users', user!.uid), {
        students: arrayUnion(studentUID),
      });
      // Mostrar contraseña y cerrar modal
      setGeneratedPassword(password);
      setShowModal(false);
      setFormData({ name: '', email: '', documentId: '' });
      navigator.clipboard.writeText(password);
    } catch (err) {
      console.error(err);
      alert('Error al registrar estudiante');
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#1e1e1e] text-white">
      <div className="flex-1 overflow-y-auto">
        {/* Topbar y botones de acción */}
        <div className="bg-green-600 px-6 py-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold">Cursos</h2>
            <h1 className="text-2xl font-bold text-center flex-1">Seguimiento de Progreso Estudiantil</h1>
            <div className="flex items-center gap-4">
              <button onClick={() => setShowModal(true)} className="px-3 py-1 bg-white text-green-700 rounded font-semibold">+ Registrar Estudiante</button>
              <FaUserCircle className="text-3xl text-white" />
              <button onClick={() => signOut(auth)} className="text-white hover:text-gray-300 transition" title="Cerrar sesión"><FaSignOutAlt className="text-2xl" /></button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <button className={`border p-4 text-center font-medium ${selectedMetric === 'completion' ? 'bg-white text-green-600 font-bold' : ''}`} onClick={() => toggleMetric('completion')}>📊 % de estudiantes completo</button>
            <button className={`border p-4 text-center font-medium ${selectedMetric === 'attempts' ? 'bg-white text-green-600 font-bold' : ''}`} onClick={() => toggleMetric('attempts')}>🔁 Promedio de intentos</button>
            <button className={`border p-4 text-center font-medium ${selectedMetric === 'time' ? 'bg-white text-green-600 font-bold' : ''}`} onClick={() => toggleMetric('time')}>⏱️ Tiempo promedio</button>
          </div>
        </div>
        {/* Filtros de días */}
        <div className="px-6 py-4 bg-[#1e1e1e]">
          <div className="flex items-center gap-2 overflow-x-auto mb-4">
            {expandedDays.map((day, idx) => (
              <button key={idx} onClick={() => setSelectedDayFilter(day === selectedDayFilter ? null : day)} className={`border px-4 py-2 rounded hover:bg-green-700 ${selectedDayFilter === day ? 'bg-white text-green-600 font-bold' : 'border-white text-white'}`}>{day}</button>
            ))}
          </div>
        </div>
        {/* Tabla de estudiantes */}
        <div className="grid grid-cols-[200px_repeat(auto-fill,minmax(60px,1fr))] border border-white">
          <div className="p-2 font-bold border border-white bg-[#2a2a2a]">Nombre</div>
          {(selectedMetric === null ? (selectedDayFilter ? [selectedDayFilter] : expandedDays) : [selectedMetric]).map((col, idx) => (
            <div key={idx} className="p-2 font-bold border border-white text-center bg-[#2a2a2a]">{selectedMetric ? (selectedMetric === 'completion' ? 'Completado' : selectedMetric === 'attempts' ? 'Promedio Intentos' : 'Promedio Tiempo') : col}</div>
          ))}
        </div>
        {students.map(student => (
          <div key={student.id} className="grid grid-cols-[200px_repeat(auto-fill,minmax(60px,1fr))] border border-white">
            <div className="p-2 border border-white cursor-pointer hover:bg-[#333] bg-[#1e1e1e]" onClick={() => setSelectedStudent(student)}>{student.name}</div>
            {(selectedMetric === null ? (selectedDayFilter ? [selectedDayFilter] : expandedDays) : [selectedMetric]).map((col, idx) => {
              if (selectedMetric) {
                return <div key={idx} className="p-2 border border-white text-center">{selectedMetric === 'completion' ? `${student.completionRate.toFixed(0)}%` : selectedMetric === 'attempts' ? student.averageAttempts : `${student.averageTime}s`}</div>;
              }
              const i = expandedDays.indexOf(col as string);
              const val = student.progress[i];
              let cellClass = 'p-2 border border-white text-center';
              if (selectedDayFilter === col) cellClass += ' bg-green-700';
              if (val === '○') cellClass += ' bg-yellow-600';
              if (!val) cellClass += ' bg-[#2a2a2a]';
              return <div key={idx} className={cellClass}>{val === '✓' ? <FaCheck className="text-green-400 inline" /> : val === 'X' ? <FaTimes className="text-red-400 inline" /> : <span className="text-gray-400 text-sm">–</span>}</div>;
            })}
          </div>
        ))}
        {students.length === 0 && <div className="mt-4 text-center text-gray-400">No hay estudiantes registrados.</div>}
      </div>
      {/* Drawer de estudiante */}
      {selectedStudent && <div className="w-[320px] border-l bg-[#1e1e1e] text-white shadow-md p-4 overflow-y-auto"><StudentDrawer name={selectedStudent.name} uid={selectedStudent.id} day={selectedDayFilter} progress={selectedStudent.progress} onClose={() => setSelectedStudent(null)} /></div>}
      {/* Modal Registrar Estudiante */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white text-black rounded p-6 w-96 space-y-4">    
            <h2 className="text-lg font-bold mb-4">Registrar Estudiante</h2>
            <input ref={nameInputRef} autoFocus={false} type="text" placeholder="Nombre completo" className="w-full p-2 border" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            <input type="email" placeholder="Correo electrónico" className="w-full p-2 border" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
            <input type="text" placeholder="Cédula" className="w-full p-2 border" value={formData.documentId} onChange={e => setFormData({ ...formData, documentId: e.target.value })} />
            {generatedPassword && (
              <div className="bg-green-100 text-green-800 p-2 rounded text-sm flex items-center justify-between">
                Contraseña asignada: <span className="font-mono">{generatedPassword}</span>
                <button onClick={() => navigator.clipboard.writeText(generatedPassword)} title="Copiar contraseña"><FaCopy className="ml-2" /></button>
              </div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-300 rounded">Cancelar</button>
              <button onClick={registerStudent} className="px-4 py-2 bg-green-600 text-white rounded">Registrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeacherView;
