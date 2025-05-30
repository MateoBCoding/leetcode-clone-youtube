import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { firestore } from '@/firebase/firebase';

interface Props {
  name: string;
  uid: string;
  day: string | null;
  progress: string[];
  onClose: () => void;
}

interface Stat {
  problemId: string;
  executionCount: number;
  lastExecutionTime: number;
  totalExecutionTime: number;
  success: boolean;
  lastSubmittedAt: number;
  userId: string;
}

interface CourseDay {
  day: number;
  problems: string[];
}

export const StudentDrawer: React.FC<Props> = ({ name, uid, day, progress, onClose }) => {
  const [stats, setStats] = useState<Stat[]>([]);
  const [courseDays, setCourseDays] = useState<CourseDay[]>([]);
  const [dayStatsMap, setDayStatsMap] = useState<Record<number, Stat[]>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Obtener estadísticas del usuario
        const statsRef = collection(firestore, 'user_problem_stats');
        const statsQuery = query(statsRef, where('userId', '==', uid));
        const statsSnapshot = await getDocs(statsQuery);

        const statList: Stat[] = [];
        statsSnapshot.forEach((doc) => {
          const data = doc.data() as Stat;
          statList.push(data);
        });

        // Obtener los días del curso
        const courseSnapshot = await getDocs(collection(firestore, 'courses'));
        const courseDoc = courseSnapshot.docs[0];
        const courseData = courseDoc.data();
        const courseDaysData: CourseDay[] = courseData.days || [];

        // Agrupar estadísticas por día
        const map: Record<number, Stat[]> = {};
        for (const dayObj of courseDaysData) {
          map[dayObj.day] = statList.filter(stat => dayObj.problems.includes(stat.problemId));
        }

        setStats(statList);
        setCourseDays(courseDaysData);
        setDayStatsMap(map);
      } catch (error) {
        console.error("Error al obtener datos para el usuario:", uid, error);
      }
    };

    fetchData();
  }, [uid]);

  const filteredDays = day
    ? courseDays.filter(d => `D${d.day}` === day)
    : courseDays;

  return (
    <div className="relative bg-[#1e1e1e] text-white h-full p-4 overflow-y-auto">
      {/* Botón de cerrar */}
      <button
        onClick={onClose}
        className="absolute top-0 right-0 mt-2 mr-2 text-white hover:text-red-500 text-xl font-bold"
        title="Cerrar"
      >
        ✕
      </button>

      <h2 className="font-bold mb-4 text-lg pt-2 pr-6">Métricas de {name}</h2>

      <ul className="text-sm list-disc list-inside space-y-4">
        {filteredDays.map((dayObj) => {
          const statsForDay = dayStatsMap[dayObj.day] || [];

          return (
            <li key={dayObj.day}>
              <span className="font-semibold">{`D${dayObj.day}`}</span>: {progress[dayObj.day - 1] || 'Sin actividad'}
              <ul className="ml-4 list-disc text-xs mt-1 text-gray-300">
                {statsForDay.length > 0 ? (
                  statsForDay.map((stat) => (
                    <li key={stat.problemId} className="mb-2">
                      <div><span className="text-white">Ejercicio:</span> {stat.problemId}</div>
                      <div><span className="text-white">Ejecuciones:</span> {stat.executionCount}</div>
                      <div><span className="text-white">Tiempo último intento:</span> {stat.lastExecutionTime}s</div>
                      <div><span className="text-white">Tiempo total:</span> {stat.totalExecutionTime}s</div>
                      <div><span className="text-white">Éxito:</span> {stat.success ? 'Sí' : 'No'}</div>
                    </li>
                  ))
                ) : (
                  <li className="text-gray-500">Sin estadísticas</li>
                )}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
