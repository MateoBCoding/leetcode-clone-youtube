import React, { useState } from 'react';
import { FaCheck, FaTimes, FaCircle, FaChevronDown } from 'react-icons/fa';
import { StudentDrawer } from '../pages/studentdrawer'; // ajusta esta ruta si es necesario

const days = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'];
const initialStudents = [
  { name: 'Juan Pérez', progress: ['✓', '', '', '✓', '○', ''] },  
  { name: 'María López', progress: ['', '', '', '', 'X', '○'] },
  { name: 'Pedro Gómez', progress: ['', '', 'X', '', '', ''] },
];
{/* como relacionar chulos y cruzes o circulos a los ejercicios? como manipular la comparacion, nombrado supongo sera por funcion aparte , no? */ }
const courses = ['Curso A', 'Curso B', 'Curso C'];

function TeacherView() {
  const [selectedCourse, setSelectedCourse] = useState(courses[0]);
  const [expandedDays, setExpandedDays] = useState(days);
  const [hoveredStudent, setHoveredStudent] = useState<string | null>(null);
  const [selectedDayFilter, setSelectedDayFilter] = useState<string | null>(null);

  return (
    <div className="p-6 w-full h-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-4 items-center">
          <label className="text-lg font-semibold">Curso:</label>
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="border px-3 py-1 rounded"
          > {/* cursos tambien supongo se filtran aparte con los datos del profesor.. no? */ }
            {courses.map((course) => (
              <option key={course}>{course}</option>
            ))}
            </select>
            </div>
             <h1 className="text-2xl font-bold text-center flex-1">Seguimiento de Progreso Estudiantil</h1>
              <button className="border px-4 py-2 rounded hover:bg-gray-200">Filtros</button>
            </div>

      {/* Métricas generales */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="border p-4 text-center font-medium">📊 % de estudiantes completo</div>
        <div className="border p-4 text-center font-medium">🔁 Promedio de intentos</div>
        <div className="border p-4 text-center font-medium">⏱️ Tiempo promedio</div>  {/*aun sin uso por no saber como conectaras esta madre*/ }
      </div>

      {/* Barra de días seleccion*/}
      {/*filtro requiere arreglo por saber como calibraras notas*/}
      <div className="flex items-center gap-2 overflow-x-auto mb-4">
          {expandedDays.map((day, index) => (
         <button
           key={index}
            onClick={() => setSelectedDayFilter(day === selectedDayFilter ? null : day)} 
           className={`border px-4 py-2 rounded hover:bg-gray-100
             ${
              selectedDayFilter === day ? 'bg-blue-500 text-white' : ''
             }`       
              }
             >
          {day}
        </button>
           )
           )
           }
  <button
    onClick={() => setExpandedDays([...expandedDays, `D${expandedDays.length + 1}`])}
    className="border px-2 py-2 rounded hover:bg-gray-100"
  >
    <FaChevronDown />
  </button>
</div>


{/* Grilla - Encabezado */}
{/*hecho toda esta madre en teoria funciona bien */}
<div className="grid grid-cols-[200px_repeat(auto-fill,minmax(60px,1fr))] border">
  <div className="p-2 font-bold border">Nombre</div>
  {(selectedDayFilter
    ? [selectedDayFilter]
    : expandedDays
  ).map((day, idx) => (
    <div key={idx} className="p-2 font-bold border text-center">{day}</div>
  ))}
</div>

{/* Grilla - Filas por estudiante */}
{initialStudents.map((student) => (
  <div
    key={student.name}
    className="grid grid-cols-[200px_repeat(auto-fill,minmax(60px,1fr))] border"
  >
    <div
      className="p-2 border cursor-pointer hover:bg-gray-100 relative"
      onMouseEnter={() => setHoveredStudent(student.name)}
      onMouseLeave={() => setHoveredStudent(null)}
    >
      {student.name}
      {hoveredStudent === student.name && (
        <StudentDrawer
         key={`${student.name}-${selectedDayFilter ?? 'all'}`}
          name={student.name}
           day={selectedDayFilter}
            progress={student.progress}
          />
      )}
    </div>

    {(selectedDayFilter
      ? [selectedDayFilter]
      : expandedDays
    ).map((_, dayIdx) => {
      const index = expandedDays.indexOf(_);
      const val = student.progress[index];
      return (
        <div key={dayIdx} className="p-2 border text-center">
          {val === '✓' ? (
            <FaCheck className="text-green-500 inline" />
          ) : val === 'X' ? (
            <FaTimes className="text-red-500 inline" />
          ) : val === '○' ? (
            <FaCircle className="text-yellow-500 inline" />
          ) : (
            ''
          )}
        </div>
      );
    })}
  </div>
))}


    </div>
  );
}

export default TeacherView;
