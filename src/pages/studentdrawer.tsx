interface Props {
  name: string;
  day: string | null;
  progress: string[];
}

export const StudentDrawer: React.FC<Props> = ({ name, day, progress }) => {
  const filtered = day ? [{ day, status: progress[parseInt(day.slice(1)) - 1] }] : 
    progress.map((status, i) => ({ day: `D${i + 1}`, status }));
    {/*estadisticas en proceso? */}
  return (
    <div className="w-64 p-4 border rounded bg-white shadow-md">
      <h2 className="font-bold mb-2">Métricas de {name}</h2>
      <ul className="text-sm list-disc list-inside space-y-1">
        {filtered.map((entry) => (
          <li key={entry.day}>
            {entry.day}: {entry.status || 'Sin actividad'}
          </li>
        ))}
      </ul>
    </div>
  );
};
