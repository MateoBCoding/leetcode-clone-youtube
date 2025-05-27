import React, { useState, useEffect } from 'react';
import { FaCheck, FaTimes } from 'react-icons/fa';
import { StudentDrawer } from '../pages/studentdrawer';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { firestore } from '@/firebase/firebase';
import { getDayIndexFromProblemId } from './studentdrawer';

const days = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'];
type Metric = 'completion' | 'attempts' | 'time' | null;

function TeacherView() {
  const [expandedDays, setExpandedDays] = useState(days);
  const [selectedDayFilter, setSelectedDayFilter] = useState<string | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<Metric>(null);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const usersSnapshot = await getDocs(collection(firestore, 'users'));
        const studentsData: any[] = [];

        for (const doc of usersSnapshot.docs) {
          const data = doc.data();
          const role = data.role?.toLowerCase();
          if (role === 'admin' || role === 'profesor') continue;

          const userId = doc.id;
          const name = data.name || data.displayName || 'Sin nombre';
          const email = data.email || '';
          const progress = Array(6).fill('');
          let totalAttempts = 0;
          let totalTime = 0;
          let successCount = 0;

          const statsSnapshot = await getDocs(
            query(collection(firestore, 'user_problem_stats'), where('userId', '==', userId))
          );
          const stats = statsSnapshot.docs.map(doc => doc.data());

          stats.forEach((stat: any) => {
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
            averageAttempts: stats.length ? (totalAttempts / stats.length).toFixed(1) : '0',
            averageTime: stats.length ? (totalTime / stats.length).toFixed(1) : '0',
          });
        }

        setStudents(studentsData);
      } catch (error) {
        console.error('Error cargando estudiantes:', error);
      }
    };

    fetchStudents();
  }, []);

  const toggleMetric = (metric: Metric) => {
    setSelectedMetric(prev => (prev === metric ? null : metric));
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#1e1e1e] text-white">
      <div className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <div className="bg-green-600 px-6 py-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold">Cursos</h2>
            <h1 className="text-2xl font-bold text-center flex-1">Seguimiento de Progreso Estudiantil</h1>
            <button className="border border-white text-white px-4 py-2 rounded hover:bg-green-700">Filtros</button>
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
          {/* Botones de filtro por día */}
          <div className="px-6 py-4 bg-[#1e1e1e]">
            <div className="flex items-center gap-2 overflow-x-auto mb-4">
              {expandedDays.map((day, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedDayFilter(day === selectedDayFilter ? null : day)}
                  className={`border px-4 py-2 rounded hover:bg-green-700 ${
                    selectedDayFilter === day ? 'bg-white text-green-600 font-bold' : 'border-white text-white'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

        {/* Encabezado */}
        <div className="grid grid-cols-[200px_repeat(auto-fill,minmax(60px,1fr))] border border-white">
          <div className="p-2 font-bold border border-white bg-[#2a2a2a]">Nombre</div>
          {selectedMetric === null &&
            (selectedDayFilter ? [selectedDayFilter] : expandedDays).map((day, idx) => (
              <div key={idx} className="p-2 font-bold border border-white text-center bg-[#2a2a2a]">
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

        {/* Filas estudiantes */}
        {students.map((student) => (
          <div key={student.id} className="grid grid-cols-[200px_repeat(auto-fill,minmax(60px,1fr))] border border-white">
            <div
              className="p-2 border border-white cursor-pointer hover:bg-[#333] bg-[#1e1e1e]"
              onClick={() => setSelectedStudent(student)}
            >
              {student.name}
            </div>

            {selectedMetric === null &&
              (selectedDayFilter ? [selectedDayFilter] : expandedDays).map((_, dayIdx) => {
                const index = expandedDays.indexOf(_);
                const val = student.progress[index];
                let cellClass = 'p-2 border border-white text-center';
                if (selectedDayFilter === _) cellClass += ' bg-green-700';
                if (val === '○') cellClass += ' bg-yellow-600';
                if (!val) cellClass += ' bg-[#2a2a2a]';

                return (
                  <div key={dayIdx} className={cellClass}>
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
                <div className="text-xs text-center mt-1">{student.completionRate.toFixed(0)}%</div>
              </div>
            )}
            {selectedMetric === 'attempts' && (
              <div className="p-2 border border-white text-center">{student.averageAttempts}</div>
            )}
            {selectedMetric === 'time' && (
              <div className="p-2 border border-white text-center">{student.averageTime}s</div>
            )}
          </div>
        ))}

        {students.length === 0 && (
          <div className="mt-4 text-center text-gray-400">No hay estudiantes registrados.</div>
        )}
      </div>

      {/* Drawer */}
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
    </div>
  );
}

export default TeacherView;
