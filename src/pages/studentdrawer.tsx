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

      <ul className="text-sm list-disc list-inside space-y-3">
        {filtered.map((entry) => {
          const stat = stats.find(
            (s) =>
              s.problemId &&
              entry.day.includes((getDayIndexFromProblemId(s.problemId) + 1).toString())
          );

          return (
            <li key={entry.day}>
              <span className="font-semibold">{entry.day}</span>: {entry.status || 'Sin actividad'}
              <ul className="ml-4 list-disc text-xs mt-1 text-gray-300">
                {stat ? (
                  <>
                    <li>Ejecuciones: {stat.executionCount}</li>
                    <li>Tiempo último intento: {stat.lastExecutionTime}s</li>
                    <li>Tiempo total: {stat.totalExecutionTime}s</li>
                    <li>Éxito: {stat.success ? 'Sí' : 'No'}</li>
                  </>
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
  };

  return dayProblemMap[pid] ?? -1;
};
