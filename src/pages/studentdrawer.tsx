import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { firestore } from '@/firebase/firebase';

interface Props {
  name: string;
  day: string | null;
  progress: string[];
}

interface Stat {
  problemId: string;
  executionCount: number;
  lastExecutionTime: number;
  totalExecutionTime: number;
  success: boolean;
  lastSubmittedAt: number;
}

export const StudentDrawer: React.FC<Props> = ({ name, day, progress }) => {
  const [stats, setStats] = useState<Stat[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      const usersRef = collection(firestore, 'user_problem_stats');
      const q = query(usersRef, where('userId', '==', name)); // name debe ser uid
      const querySnapshot = await getDocs(q);

      const statList: Stat[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as Stat;
        statList.push(data);
      });

      setStats(statList);
    };

    fetchStats();
  }, [name]);

  const filtered = day
    ? [{ day, status: progress[parseInt(day.slice(1)) - 1] }]
    : progress.map((status, i) => ({ day: `D${i + 1}`, status }));

  return (
    <div className="w-64 p-4 border rounded bg-white shadow-md">
      <h2 className="font-bold mb-2">Métricas de {name}</h2>
      <ul className="text-sm list-disc list-inside space-y-1">
        {filtered.map((entry) => {
          const stat = stats[parseInt(entry.day.slice(1)) - 1];
          return (
            <li key={entry.day}>
              {entry.day}: {entry.status || 'Sin actividad'}
              <ul className="ml-4 list-disc text-xs">
                {stat ? (
                  <>
                    <li>Ejecuciones: {stat.executionCount}</li>
                    <li>Tiempo último intento: {stat.lastExecutionTime}s</li>
                    <li>Tiempo total: {stat.totalExecutionTime}s</li>
                    <li>Éxito: {stat.success ? 'Sí' : 'No'}</li>
                  </>
                ) : (
                  <li>Sin estadísticas</li>
                )}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
};