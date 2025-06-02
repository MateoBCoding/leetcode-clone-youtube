// src/components/SortableItem.tsx
import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SortableItemProps {
  /** 
   * ID único de este ejercicio (por ejemplo: "two-sum", "group-anagrams", etc.).
   * También será el `draggableId` que usa @dnd-kit internamente. 
   */
  id: string;

  /**
   * Contenedor al que pertenece, p.ej. "available" o "day-2". 
   * Lo usamos para colorear distinto cada tarjeta y para el data.current.containerId.
   */
  containerId: string;
}

/**
 * SortableItem: cada “tarjeta” de ejercicio que se puede arrastrar.
 * Usa useSortable({ id, data: { containerId } }) para integrarse con @dnd-kit/sortable.
 */
const SortableItem: React.FC<SortableItemProps> = ({ id, containerId }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    /**
     * id: string único para identificar este draggable.
     * data: le pasamos un objeto con containerId para saber de cuál lista viene.
     */
    id,
    data: { containerId },
  });

  // Convertimos el transform y transition que devuelve el hook a CSS
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    padding: "8px",
    marginBottom: "4px",
    borderRadius: "4px",
    backgroundColor: containerId === "available" ? "#28a745" : "#28a745",
    color: containerId === "available" ? "white" : "#1e1e1e",
    cursor: "grab",
    /* Si transform o transition no están vacíos, aplicarlos */
    ...(transform || transition
      ? { transform: CSS.Transform.toString(transform!), transition }
      : {}),
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {id}
    </div>
  );
};

export default SortableItem;
