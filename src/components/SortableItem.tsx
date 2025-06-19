import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SortableItemProps {
  id: string;
  containerId: string;
}


const SortableItem: React.FC<SortableItemProps> = ({ id, containerId }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id,
    data: { containerId },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    padding: "8px",
    marginBottom: "4px",
    borderRadius: "4px",
    backgroundColor: containerId === "available" ? "#28a745" : "#28a745",
    color: containerId === "available" ? "white" : "#1e1e1e",
    cursor: "grab",
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
