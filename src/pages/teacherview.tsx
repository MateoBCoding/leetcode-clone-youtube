import React, { useState, useEffect } from 'react';
import { FaCheck, FaTimes } from 'react-icons/fa';
import { StudentDrawer } from '../pages/studentdrawer';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { firestore } from '@/firebase/firebase';

const days = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'];

const getDayIndexFromProblemId = (pid: string): number => {
  const dayProblemMap: Record<string, number> = {
    'two-sum': 0,
    'reverse-string': 1,
    'fizzbuzz': 2,
    'valid-parentheses': 3,
    'merge-sorted-array': 4,
    'palindrome-number': 5,
  };
  return dayProblemMap[pid] ?? -1;
};

function TeacherView() {
  const [expandedDays, setExpandedDays] = useState(days);
  const [hoveredStudent, setHoveredStudent] = useState<string | null>(null);
  const [selectedDayFilter, setSelectedDayFilter] = useState<string | null>(null);
  const [students, setStudents] = useState<any[]>([]);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const usersSnapshot = await getDocs(collection(firestore, 'users'));
        const studentsData: any[] = [];

        for (const doc of usersSnapshot.docs) {
          const data = doc.data();
          const userId = doc.id;
          const name = data.name || data.displayName || 'Sin nombre';
          const email = data.email || '';
          const solved = (data.solvedProblems ?? []) as string[];

          const progress = Array(6).fill('');
          solved.forEach(pid => {
            const dayIndex = getDayIndexFromProblemId(pid);
            if (dayIndex !== -1) progress[dayIndex] = '✓';
          });

          const statsSnapshot = await getDocs(
            query(collection(firestore, 'user_problem_stats'), where('userId', '==', userId))
          );
          const stats = statsSnapshot.docs.map(doc => doc.data());

          studentsData.push({ id: userId, name, email, progress, stats });
        }

        console.log('🎓 Estudiantes cargados:', studentsData);
        setStudents(studentsData);
      } catch (error) {
        console.error('Error cargando estudiantes:', error);
      }
    };

    fetchStudents();
  }, []);

  return (
    <div className="p-6 w-full h-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold">Cursos</h2>
        <h1 className="text-2xl font-bold text-center flex-1">Seguimiento de Progreso Estudiantil</h1>
        <button className="border px-4 py-2 rounded hover:bg-gray-200">Filtros</button>
      </div>

      {/* Métricas generales */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="border p-4 text-center font-medium">📊 % de estudiantes completo</div>
        <div className="border p-4 text-center font-medium">🔁 Promedio de intentos</div>
        <div className="border p-4 text-center font-medium">⏱️ Tiempo promedio</div>
      </div>

      {/* Barra de días */}
      <div className="flex items-center gap-2 overflow-x-auto mb-4">
        {expandedDays.map((day, index) => (
          <button
            key={index}
            onClick={() => setSelectedDayFilter(day === selectedDayFilter ? null : day)}
            className={`border px-4 py-2 rounded hover:bg-gray-100 ${
              selectedDayFilter === day ? 'bg-blue-500 text-white' : ''
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      {/* Grilla - Encabezado */}
      <div className="grid grid-cols-[200px_repeat(auto-fill,minmax(60px,1fr))] border">
        <div className="p-2 font-bold border">Nombre</div>
        {(selectedDayFilter ? [selectedDayFilter] : expandedDays).map((day, idx) => (
          <div key={idx} className="p-2 font-bold border text-center">{day}</div>
        ))}
      </div>

      {/* Grilla - Filas por estudiante */}
      {students.map((student) => (
        <div
          key={student.id}
          className="grid grid-cols-[200px_repeat(auto-fill,minmax(60px,1fr))] border"
        >
          <div
            className="p-2 border cursor-pointer hover:bg-gray-100 relative"
            onMouseEnter={() => setHoveredStudent(student.id)}
            onMouseLeave={() => setHoveredStudent(null)}
          >
            {student.name}
            {hoveredStudent === student.id && (
              <StudentDrawer
                key={`${student.id}-${selectedDayFilter ?? 'all'}`}
                name={student.id}
                day={selectedDayFilter}
                progress={student.progress}
              />
            )}
          </div>

          {(selectedDayFilter ? [selectedDayFilter] : expandedDays).map((_, dayIdx) => {
            const index = expandedDays.indexOf(_);
            const val = student.progress[index];

            let cellClass = 'p-2 border text-center';
            if (selectedDayFilter === _) cellClass += ' bg-gray-100';
            if (val === '○') cellClass += ' bg-yellow-100';
            if (!val) cellClass += ' bg-gray-50';

            return (
              <div key={dayIdx} className={cellClass}>
                {val === '✓' ? (
                  <FaCheck className="text-green-500 inline" />
                ) : val === 'X' ? (
                  <FaTimes className="text-red-500 inline" />
                ) : (
                  <span className="text-gray-400 text-sm">–</span>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {students.length === 0 && (
        <div className="mt-4 text-center text-gray-500">No hay estudiantes registrados.</div>
      )}

      {/* Sección de nombres al final */}
      <div className="mt-10 border-t pt-4">
        <h3 className="text-lg font-semibold mb-2">👤 Usuarios detectados:</h3>
        <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
          {students.map((student) => (
            <li key={student.id}>{student.name}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default TeacherView;
