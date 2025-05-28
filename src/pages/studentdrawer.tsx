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
}

export const StudentDrawer: React.FC<Props> = ({ name, uid, day, progress, onClose }) => {
  const [stats, setStats] = useState<Stat[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const usersRef = collection(firestore, 'user_problem_stats');
        const q = query(usersRef, where('userId', '==', uid));
        const querySnapshot = await getDocs(q);

        const statList: Stat[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data() as Stat;
          statList.push(data);
        });

        setStats(statList);
      } catch (error) {
        console.error("Error al obtener stats para el usuario:", uid, error);
      }
    };

    fetchStats();
  }, [uid]);

  const filtered = day
    ? [{ day, status: progress[parseInt(day.slice(1)) - 1] }]
    : progress.map((status, i) => ({ day: `D${i + 1}`, status }));

  return (
    <div className="relative bg-[#1e1e1e] text-white h-full p-4">
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
        {filtered.map((entry) => {
          const dayIndex = parseInt(entry.day.slice(1)) - 1;
          const statsForDay = stats.filter((s) => getDayIndexFromProblemId(s.problemId) === dayIndex);

          return (
            <li key={entry.day}>
              <span className="font-semibold">{entry.day}</span>: {entry.status || 'Sin actividad'}
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

export const getDayIndexFromProblemId = (pid: string): number => {
  const dayProblemMap: Record<string, number> = {
    'two-sum': 0,
    'reverse-string': 1,
    'fizzbuzz': 2,
    'valid-parentheses': 3,
    'merge-sorted-array': 4,
    'palindrome-number': 5,
    'max-subarray': 3,
  };

  return dayProblemMap[pid] ?? -1;
};