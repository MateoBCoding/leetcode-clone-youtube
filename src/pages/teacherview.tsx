import React, { useState, useEffect, useRef } from 'react';
import { FaCheck, FaTimes, FaSignOutAlt, FaUserCircle, FaCopy } from 'react-icons/fa';
import { StudentDrawer } from '../pages/studentdrawer';
import {collection,getDocs,query,where,doc,getDoc,setDoc,updateDoc,arrayUnion,} from 'firebase/firestore';
import { useRouter } from 'next/router';
import { useAuthState } from 'react-firebase-hooks/auth';
import { signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { getAuth as getAuthSecondary } from 'firebase/auth';
import { initializeApp, getApps } from 'firebase/app';
import { firestore, auth, firebaseConfig } from '@/firebase/firebase';
//import { getDayIndexFromProblemId } from './studentdrawer';


// App secundaria para crear usuarios sin cerrar sesión principal
const secondaryApp = getApps().find(app => app.name === 'Secondary')
  || initializeApp(firebaseConfig, 'Secondary');
const secondaryAuth = getAuthSecondary(secondaryApp);






type Metric = 'completion' | 'attempts' | 'time' | null;

function TeacherView() {
  const [problemDescription, setProblemDescription] = useState('');
  const [expectedOutput, setExpectedOutput] = useState('');
  const [selectedDayFilter, setSelectedDayFilter] = useState<string | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<Metric>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', documentId: '' });
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  // Estados adicionales
  const [showCreateProblemForm, setShowCreateProblemForm] = useState(false);
  const router = useRouter();
  const [user, loading] = useAuthState(auth);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [showExerciseForm, setShowExerciseForm] = useState(false);
  const [starterCode, setStarterCode] = useState('');
  const [starterFunctionName, setStarterFunctionName] = useState('');
  const [constraints, setConstraints] = useState('');
  const [exampleInput, setExampleInput] = useState('');
  const [exampleOutput, setExampleOutput] = useState('');
  const [exampleExplanation, setExampleExplanation] = useState('');
  const [days, setDays] = useState<string[]>([]);
  const [expandedDays, setExpandedDays] = useState<string[]>([]);

  useEffect(() => {
  const fetchDays = async () => {
    const courseSnapshot = await getDocs(collection(firestore, 'courses'));
    const courseDoc = courseSnapshot.docs[0];

    if (courseDoc.exists()) {
      const data = courseDoc.data();
      const dynamicDays = (data.days || [])
        .sort((a: any, b: any) => a.day - b.day)
        .map((d: any) => `D${d.day}`);
      setDays(dynamicDays);
      setExpandedDays(dynamicDays);
    }
  };
  fetchDays();
  }, []);



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
        const courseSnapshot = await getDocs(collection(firestore, 'courses'));
        const courseDoc = courseSnapshot.docs[0];
        const courseData = courseDoc?.data();

        const studentsData: any[] = [];

        for (const docSnap of usersSnapshot.docs) {
          const data = docSnap.data();
          if (data.role?.toLowerCase() !== 'estudiante') continue;

          const userId = docSnap.id;
          const name = data.displayName || data.name || 'Sin nombre';
          const email = data.email || '';
          let totalAttempts = 0;
          let totalTime = 0;
          let successCount = 0;

          const statsSnapshot = await getDocs(
            query(
              collection(firestore, 'user_problem_stats'),
              where('userId', '==', userId)
            )
          );

          const statsByDay: Record<number, boolean[]> = {};

          statsSnapshot.docs.forEach((doc) => {
            const stat = doc.data();
            const problemId = stat.problemId;

            const dayIndex = days.findIndex((d) => {
              const dayNumber = parseInt(d.replace('D', ''));
              return courseData?.days?.some(
                (day: any) => day.day === dayNumber && day.problems.includes(problemId)
              );
            });

            if (dayIndex !== -1) {
              if (!statsByDay[dayIndex]) statsByDay[dayIndex] = [];
              statsByDay[dayIndex].push(stat.success);
              totalAttempts += stat.executionCount || 0;
              totalTime += stat.totalExecutionTime || 0;
              if (stat.success) successCount++;
            }
          });

          const progress = days.map((_, idx) => {
            const statuses = statsByDay[idx] || [];
            if (statuses.length === 0) return '';
            const allTrue = statuses.every(Boolean);
            const allFalse = statuses.every((s) => s === false);
            if (allTrue) return '✓';
            if (allFalse) return 'X';
            return 'O';
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
    if (days.length > 0) {
      fetchStudents();
    }
  }, [generatedPassword, days]);




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
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, formData.email, password);
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

      setGeneratedPassword(password);
      setShowModal(false);
      setFormData({ name: '', email: '', documentId: '' });
      navigator.clipboard.writeText(password);
    } catch (err) {
      console.error(err);
      alert('Error al registrar estudiante');
    }
  };

    const [problemId, setProblemId] = useState('');
    const [problemTitle, setProblemTitle] = useState('');
    const [problemDifficulty, setProblemDifficulty] = useState('Easy');
    const [problemDay, setProblemDay] = useState('1');
    const [loadingProblemCreate, setLoadingProblemCreate] = useState(false);

  const handleCreateProblem = async () => {
    if (
      !problemId ||
      !problemTitle ||
      !problemDescription ||
      !expectedOutput ||
      !problemDifficulty ||
      !problemDay
    ) {
      return alert('Todos los campos son requeridos');
    }

  setLoadingProblemCreate(true);
  try {
    // 1. Guardar el nuevo problema en la colección "problems"
    const problemRef = doc(firestore, 'problems', problemId);
    await setDoc(problemRef, {
      id: problemId,
      title: problemTitle,
      difficulty: problemDifficulty,
      category: 'Array',
      starterCode,
      starterFunctionName,
      problemStatement: problemDescription,
      constraints,
      testCases: [
        {
          input: exampleInput,
          output: exampleOutput,
        },
      ],
      examples: [
        {
          id: 1,
          inputText: exampleInput,
          outputText: exampleOutput,
          explanation: exampleExplanation,
        },
      ],
      order: 0,
      link: '',
      videoId: '',
    });
        
    const courseSnapshot = await getDocs(collection(firestore, 'courses'));
    const courseDoc = courseSnapshot.docs[0]; // primer curso que encuentra

    if (courseDoc.exists()) {
      const data = courseDoc.data();
      const courseRef = courseDoc.ref;
      const updatedDays = [...(data.days || [])];
      const parsedDay = parseInt(problemDay);

      // Buscar si ya existe un objeto con day === parsedDay
      let dayObj = updatedDays.find((d) => d.day === parsedDay);

      if (!dayObj) {
        // Si no existe, lo creamos
        dayObj = { day: parsedDay, problems: [problemId] };
        updatedDays.push(dayObj);
      } else {
        // Si existe, evitar duplicados
        if (!dayObj.problems.includes(problemId)) {
          dayObj.problems.push(problemId);
        }
      }
      console.log("Día asignado:", parsedDay);
      console.log("ID del problema:", problemId);
      console.log("Días actualizados:", JSON.stringify(updatedDays, null, 2));

      await updateDoc(courseRef, { days: updatedDays });
    }
        

    alert('✅ Problema creado y asignado correctamente');
    setProblemId('');
    setProblemTitle('');
    setProblemDescription('');
    setExpectedOutput('');
    setStarterCode('');
    setStarterFunctionName('');
    setConstraints('');
    setExampleInput('');
    setExampleOutput('');
    setExampleExplanation('');
  } catch (err) {
    console.error(err);
    alert('❌ Error al guardar el ejercicio');
  } finally {
    setLoadingProblemCreate(false);
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
            <button
              onClick={() => setShowModal(true)}
              className="px-3 py-1 bg-white text-green-700 rounded font-semibold"
            >
              + Registrar Estudiante
            </button> {/*boton usuario*/}
            <div className="relative group">
              <FaUserCircle className="text-3xl text-white cursor-pointer" />
              {user?.email && (
                <div className="absolute top-10 left-1/2 -translate-x-1/2 px-3 py-1 bg-gray-800 text-white text-sm rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                  {user.email}
                </div>
              )}
            </div>



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
            className={`border p-4 text-center font-medium ${selectedMetric === 'completion' ? 'bg-white text-green-600 font-bold' : ''}`}
            onClick={() => toggleMetric('completion')}
          >
            📊 % de estudiantes completo
          </button>
          <button
            className={`border p-4 text-center font-medium ${selectedMetric === 'attempts' ? 'bg-white text-green-600 font-bold' : ''}`}
            onClick={() => toggleMetric('attempts')}
          >
            🔁 Promedio de intentos
          </button>
          <button
            className={`border p-4 text-center font-medium ${selectedMetric === 'time' ? 'bg-white text-green-600 font-bold' : ''}`}
            onClick={() => toggleMetric('time')}
          >
            ⏱️ Tiempo promedio
          </button>
        </div>
      </div>

      {/* Filtros de días */}
      <div className="px-6 py-4 bg-[#1e1e1e]">
        <div className="flex items-center gap-2 overflow-x-auto mb-4">
          {expandedDays.map((day, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedDayFilter(day === selectedDayFilter ? null : day)}
              className={`border px-4 py-2 rounded hover:bg-green-700 ${selectedDayFilter === day ? 'bg-white text-green-600 font-bold' : 'border-white text-white'}`}
            >
              {day}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowExerciseForm(!showExerciseForm)}
          className="mt-2 px-4 py-2 bg-white text-green-700 font-semibold rounded"
        >
          {showExerciseForm ? '✖ Ocultar formulario' : '➕ Crear nuevo ejercicio'}
        </button>
      </div>

      {/* Formulario Condicional */}
      {showExerciseForm && (
        <div className="bg-dark-fill-2 text-white p-4 rounded-xl max-w-xl mx-6 mb-6 border border-green-700">
          <h3 className="text-lg font-bold mb-4">Crear nuevo ejercicio</h3>

          <input
            className="w-full p-2 mb-2 rounded text-black"
            placeholder="ID del ejercicio (ej. two-sum)"
            value={problemId}
            onChange={(e) => setProblemId(e.target.value)}
          />

          <input
            className="w-full p-2 mb-2 rounded text-black"
            placeholder="Título del ejercicio"
            value={problemTitle}
            onChange={(e) => setProblemTitle(e.target.value)}
          />

          <textarea
            className="w-full p-2 mb-2 rounded text-black"
            placeholder="Descripción del ejercicio (explicación del enunciado)"
            value={problemDescription}
            onChange={(e) => setProblemDescription(e.target.value)}
            rows={4}
          />

          <input
            className="w-full p-2 mb-2 rounded text-black"
            placeholder="Respuesta esperada por consola (output)"
            value={expectedOutput}
            onChange={(e) => setExpectedOutput(e.target.value)}
          />

          <textarea
            className="w-full p-2 mb-2 rounded text-black"
            placeholder="Código base del estudiante"
            value={starterCode}
            onChange={(e) => setStarterCode(e.target.value)}
            rows={3}
          />

          <input
            className="w-full p-2 mb-2 rounded text-black"
            placeholder="Nombre de la función (ej. function twoSum("
            value={starterFunctionName}
            onChange={(e) => setStarterFunctionName(e.target.value)}
          />

          <textarea
            className="w-full p-2 mb-2 rounded text-black"
            placeholder="Restricciones del ejercicio (en HTML opcional)"
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
            rows={2}
          />

          <h4 className="mt-2 font-semibold text-sm mb-1">Ejemplo</h4>
          <input
            className="w-full p-2 mb-1 rounded text-black"
            placeholder="Input del ejemplo"
            value={exampleInput}
            onChange={(e) => setExampleInput(e.target.value)}
          />
          <input
            className="w-full p-2 mb-1 rounded text-black"
            placeholder="Output del ejemplo"
            value={exampleOutput}
            onChange={(e) => setExampleOutput(e.target.value)}
          />
          <input
            className="w-full p-2 mb-4 rounded text-black"
            placeholder="Explicación del ejemplo"
            value={exampleExplanation}
            onChange={(e) => setExampleExplanation(e.target.value)}
          />
          <select
            className="w-full p-2 mb-2 rounded text-black"
            value={problemDifficulty}
            onChange={(e) => setProblemDifficulty(e.target.value)}
          >
            <option value="Easy">Fácil</option>
            <option value="Medium">Media</option>  
            <option value="Hard">Difícil</option>
          </select>


          <select
            className="w-full p-2 mb-4 rounded text-black"
            value={problemDay}
            onChange={(e) => setProblemDay(e.target.value)}
          >
            {[1, 2, 3, 4, 5, 6].map((d) => (
              <option key={d} value={d.toString()}>{`Día ${d}`}</option>

            ))}
          </select>

          <button
            onClick={handleCreateProblem}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            disabled={loadingProblemCreate}
          >
            {loadingProblemCreate ? 'Guardando...' : 'Guardar ejercicio'}
          </button>
        </div>
      )}


      {/* Tabla de estudiantes */}
      <div
        className="grid border border-white"
        style={{
          gridTemplateColumns: selectedMetric
            ? '200px 1fr'
            : selectedDayFilter
            ? '200px 100px'
            : `200px repeat(${expandedDays.length}, 60px)`,
        }}
      >
        <div className="p-2 font-bold border border-white bg-[#2a2a2a]">Nombre</div>
        {(selectedMetric === null ? (selectedDayFilter ? [selectedDayFilter] : expandedDays) : [selectedMetric]).map((col, idx) => (
          <div
            key={idx}
            className="p-2 font-bold border border-white text-center bg-[#2a2a2a] truncate"
            title={
              selectedMetric
                ? selectedMetric === 'completion'
                  ? 'Completado'
                  : selectedMetric === 'attempts'
                  ? 'Promedio Intentos'
                  : 'Promedio Tiempo'
                : col
            }
          >
            {selectedMetric
              ? selectedMetric === 'completion'
                ? 'Completado'
                : selectedMetric === 'attempts'
                ? 'Promedio Intentos'
                : 'Promedio Tiempo'
              : col}
          </div>
        ))}
      </div>

      {students.map(student => (
        <div
          key={student.id}
          className="grid border border-white"
          style={{
            gridTemplateColumns: selectedMetric
              ? '200px 1fr'
              : selectedDayFilter
              ? '200px 100px'
              : `200px repeat(${expandedDays.length}, 60px)`,
          }}
        >
          <div
            className="p-2 border border-white cursor-pointer hover:bg-[#333] bg-[#1e1e1e]"
            onClick={() => setSelectedStudent(student)}
          >
            {student.name}
          </div>
          {(selectedMetric === null ? (selectedDayFilter ? [selectedDayFilter] : expandedDays) : [selectedMetric]).map((col, idx) => {
            if (selectedMetric) {
              return (
                <div
                  key={idx}
                  className="p-2 border border-white text-center truncate"
                >
                  {selectedMetric === 'completion'
                    ? `${student.completionRate.toFixed(0)}%`
                    : selectedMetric === 'attempts'
                    ? student.averageAttempts
                    : `${student.averageTime}s`}
                </div>
              );
            }

            const i = expandedDays.indexOf(col as string);
            const val = student.progress[i];
            let cellClass = 'p-2 border border-white text-center';
            if (selectedDayFilter === col) cellClass += ' bg-green-700';
            if (!val) cellClass += ' bg-[#2a2a2a]';
            return (
              <div key={idx} className={cellClass}>
                {val === '✓' && <FaCheck className="text-green-400 inline" />}
                {val === 'X' && <FaTimes className="text-red-400 inline" />}
                {!val && <span className="text-gray-400 text-sm">–</span>}
              </div>
            );
          })}
        </div>
      ))}

      {students.length === 0 && (
        <div className="mt-4 text-center text-gray-400">
          No hay estudiantes registrados.
        </div>
      )}



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
