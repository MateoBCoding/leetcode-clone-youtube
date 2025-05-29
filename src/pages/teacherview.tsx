import React, { useState, useEffect } from 'react';
import { FaCheck, FaTimes, FaSignOutAlt, FaUserCircle } from 'react-icons/fa';
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
import { firestore, auth } from '@/firebase/firebase';
import { useRouter } from 'next/router';
import {
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { getDayIndexFromProblemId } from './studentdrawer';

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

          statsSnapshot.docs.map(doc => doc.data()).forEach((stat: any) => {
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

  const toggleMetric = (metric: Metric) => {
    setSelectedMetric(prev => (prev === metric ? null : metric));
  };

  const generatePassword = (): string => {
    return Math.random().toString(36).slice(-8);
  };

  const registerStudent = async () => {
    if (!formData.name || !formData.email || !formData.documentId) {
      alert('Todos los campos son obligatorios');
      return;
    }

    const password = generatePassword();
    const currentUser = auth.currentUser;

    try {
      const methodsCheck = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: formData.email, continueUri: 'http://localhost' }),
        }
      );
      const result = await methodsCheck.json();
      if (result.registered) {
        alert('Ya existe una cuenta con ese correo.');
        return;
      }

      const userCred = await createUserWithEmailAndPassword(auth, formData.email, password);
      const studentUID = userCred.user.uid;

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

      await updateDoc(doc(firestore, 'users', user!.uid), {
        students: arrayUnion(studentUID),
      });

      await signInWithEmailAndPassword(
        auth,
        currentUser!.email!,
        localStorage.getItem('profesorPassword')!
      );

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
        <div className="bg-green-600 px-6 py-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold">Cursos</h2>
            <h1 className="text-2xl font-bold text-center flex-1">Seguimiento de Progreso Estudiantil</h1>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowModal(true)}
                className="px-3 py-1 bg-white text-green-700 rounded font-semibold"
              >
                + Registrar Estudiante
              </button>
              <FaUserCircle className="text-3xl text-white" />
              <button
                onClick={() => signOut(auth)}
                className="text-white hover:text-gray-300 transition"
                title="Cerrar sesión"
              >
                <FaSignOutAlt className="text-2xl" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <button
              className={`border p-4 text-center font-medium ${
                selectedMetric === 'completion' ? 'bg-white text-green-600 font-bold' : ''
              }`}
              onClick={() => toggleMetric('completion')}
            >
              📊 % de estudiantes completo
            </button>
            <button
              className={`border p-4 text-center font-medium ${
                selectedMetric === 'attempts' ? 'bg-white text-green-600 font-bold' : ''
              }`}
              onClick={() => toggleMetric('attempts')}
            >
              🔁 Promedio de intentos
            </button>
            <button
              className={`border p-4 text-center font-medium ${
                selectedMetric === 'time' ? 'bg-white text-green-600 font-bold' : ''
              }`}
              onClick={() => toggleMetric('time')}
            >
              ⏱️ Tiempo promedio
            </button>
          </div>
        </div>

        <div className="px-6 py-4 bg-[#1e1e1e]">
          <div className="flex items-center gap-2 overflow-x-auto mb-4">
            {expandedDays.map((day, index) => (
              <button
                key={index}
                onClick={() =>
                  setSelectedDayFilter(day === selectedDayFilter ? null : day)
                }
                className={`border px-4 py-2 rounded hover:bg-green-700 ${
                  selectedDayFilter === day
                    ? 'bg-white text-green-600 font-bold'
                    : 'border-white text-white'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[200px_repeat(auto-fill,minmax(60px,1fr))] border border-white">
          <div className="p-2 font-bold border border-white bg-[#2a2a2a]">Nombre</div>
          {selectedMetric === null &&
            (selectedDayFilter ? [selectedDayFilter] : expandedDays).map((day, idx) => (
              <div
                key={idx}
                className="p-2 font-bold border border-white text-center bg-[#2a2a2a]"
              >
                {day}
              </div>
            ))}
          {selectedMetric !== null && (
            <div className="p-2 font-bold border border-white text-center bg-[#2a2a2a]">
              {selectedMetric === 'completion'
                ? 'Completado'
                : selectedMetric === 'attempts'
                ? 'Promedio Intentos'
                : 'Promedio Tiempo'}
            </div>
          )}
        </div>

        {students.map((student) => (
          <div
            key={student.id}
            className="grid grid-cols-[200px_repeat(auto-fill,minmax(60px,1fr))] border border-white"
          >
            <div
              className="p-2 border border-white cursor-pointer hover:bg-[#333] bg-[#1e1e1e]"
              onClick={() => setSelectedStudent(student)}
            >
              {student.name}
            </div>
            {selectedMetric === null &&
              (selectedDayFilter ? [selectedDayFilter] : expandedDays).map((_, idx) => {
                const index = expandedDays.indexOf(_);
                const val = student.progress[index];
                let cellClass = 'p-2 border border-white text-center';
                if (selectedDayFilter === _) cellClass += ' bg-green-700';
                if (val === '○') cellClass += ' bg-yellow-600';
                if (!val) cellClass += ' bg-[#2a2a2a]';
                return (
                  <div key={idx} className={cellClass}>
                    {val === '✓' ? (
                      <FaCheck className="text-green-400 inline" />
                    ) : val === 'X' ? (
                      <FaTimes className="text-red-400 inline" />
                    ) : (
                      <span className="text-gray-400 text-sm">–</span>
                    )}
                  </div>
                );
              })}
            {selectedMetric === 'completion' && (
              <div className="p-2 border border-white">
                <div className="w-full bg-gray-700 rounded h-5">
                  <div
                    className="bg-green-400 h-5 rounded"
                    style={{ width: `${student.completionRate}%` }}
                  />
                </div>
                <div className="text-xs text-center mt-1">
                  {student.completionRate.toFixed(0)}%
                </div>
              </div>
            )}
            {selectedMetric === 'attempts' && (
              <div className="p-2 border border-white text-center">
                {student.averageAttempts}
              </div>
            )}
            {selectedMetric === 'time' && (
              <div className="p-2 border border-white text-center">
                {student.averageTime}s
              </div>
            )}
          </div>
        ))}

        {students.length === 0 && (
          <div className="mt-4 text-center text-gray-400">No hay estudiantes registrados.</div>
        )}
      </div>

      {selectedStudent && (
        <div className="w-[320px] border-l bg-[#1e1e1e] text-white shadow-md p-4 overflow-y-auto">
          <StudentDrawer
            name={selectedStudent.name}
            uid={selectedStudent.id}
            day={selectedDayFilter}
            progress={selectedStudent.progress}
            onClose={() => setSelectedStudent(null)}
          />
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white text-black rounded p-6 w-96 space-y-4">
            <h2 className="text-lg font-bold mb-4">Registrar Estudiante</h2>
            <input
              type="text"
              placeholder="Nombre completo"
              className="w-full p-2 border"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
            <input
              type="email"
              placeholder="Correo electrónico"
              className="w-full p-2 border"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
            <input
              type="text"
              placeholder="Cédula"
              className="w-full p-2 border"
              value={formData.documentId}
              onChange={(e) =>
                setFormData({ ...formData, documentId: e.target.value })
              }
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-300 rounded"
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
    </div>
  );
}

export default TeacherView;
