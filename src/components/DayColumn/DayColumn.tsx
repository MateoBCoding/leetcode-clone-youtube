// Aquí puedes guardarlo como un componente separado, por ejemplo en src/components/DayColumn.tsx
import React from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import SortableItem from "@/components/SortableItem"; // Asumiremos que SortableItem ya está definido

interface DayColumnProps {
  containerId: string;
  dayNumber: number;
  problemasDelDia: string[];
}

const DayColumn: React.FC<DayColumnProps> = ({
  containerId,
  dayNumber,
  problemasDelDia,
}) => {
  // ── useDroppable se llama siempre en el mismo orden, para cada DayColumn.
  const { setNodeRef: setDroppableRef } = useDroppable({
    id: containerId,
    data: { containerId },
  });

  return (
    <div
      key={containerId}
      className="w-60 bg-[#2a2a2a] border border-gray-700 rounded-lg flex flex-col p-4"
      style={{ minHeight: 200 }}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-lg text-white">
          Día {dayNumber}
        </h3>
        {/* Aquí podrías añadir un botón de “Eliminar día” */}
      </div>

      <div
        ref={setDroppableRef}
        className="flex-1 overflow-y-auto bg-[#1e1e1e] rounded"
        style={{
          padding: 4,
          borderTop: "2px solid #444",
          minHeight: 100,
        }}
      >
        <SortableContext
          id={containerId}
          items={problemasDelDia}
          strategy={rectSortingStrategy}
        >
          {problemasDelDia.map((probId) => (
            <SortableItem
              key={probId}
              id={probId}
              containerId={containerId}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
};

export default DayColumn;
