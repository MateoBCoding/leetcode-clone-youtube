// src/pages/courses/[courseId]/edit.tsx
import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";

import Sidebar from "@/components/Sidebar/Sidebar";
import Topbar from "@/components/Topbar/Topbar";

import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "react-beautiful-dnd";

import { firestore } from "@/firebase/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
} from "firebase/firestore";

type DayData = {
  day: number;
  problems: string[];
};

const CourseEditor: React.FC = () => {
  const router = useRouter();
  const { courseId } = router.query as { courseId: string };

  // ─── 1) Estado de los días y ejercicios disponibles ─────────────────────────
  const [days, setDays] = useState<DayData[]>([]);
  const [available, setAvailable] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // ─── 2) Efecto para cargar datos del curso y problemas ───────────────────────
  useEffect(() => {
    if (!courseId) return;

    const fetchData = async () => {
      try {
        // 2a) Traer documento de Firestore: /courses/{courseId}
        const courseRef = doc(firestore, "courses", courseId);
        const courseSnap = await getDoc(courseRef);

        if (!courseSnap.exists()) {
          console.error("🛑 Curso no encontrado en Firestore");
          setLoading(false);
          return;
        }

        const courseData = courseSnap.data();
        const daysMap = courseData.days || {};

        // Convertir map → arreglo ordenado
        // Supongamos que daysMap tiene la forma { "0": { day: 1, problems: [...] }, "1": { day: 2, problems: [...] }, … }
        const daysArray: DayData[] = Object.entries(daysMap)
          .map(([_, value]) => ({
            day: (value as any).day as number,
            problems: (value as any).problems as string[],
          }))
          .sort((a, b) => a.day - b.day);

        setDays(daysArray);

        // 2b) Obtener todos los IDs de ejercicios de /problems
        const problemsSnap = await getDocs(collection(firestore, "problems"));
        const allProblems = problemsSnap.docs.map((d) => d.id);

        // 2c) Calcular "disponibles": todos menos los asignados a algún día
        const assigned = daysArray.flatMap((d) => d.problems);
        const availableList = allProblems.filter((p) => !assigned.includes(p));

        setAvailable(availableList);
      } catch (error) {
        console.error("🛑 Error al cargar datos del curso:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  // ─── 3) onDragEnd: mover entre listas y días ─────────────────────────────────
  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;

    // Si no hay destino (por ejemplo, soltaste fuera de cualquier droppable), no hacer nada
    if (!destination) return;

    console.log("➡️ onDragEnd result:", {
      draggableId,
      sourceDroppable: source.droppableId,
      sourceIndex: source.index,
      destDroppable: destination.droppableId,
      destIndex: destination.index,
    });

    const srcDroppable = source.droppableId; // "available" o "day-0", "day-1", ...
    const dstDroppable = destination.droppableId;

    // ── A) Reordenamiento dentro de “available”
    if (srcDroppable === "available" && dstDroppable === "available") {
      const newAvailable = Array.from(available);
      // 1) Remover en source.index
      newAvailable.splice(source.index, 1);
      // 2) Insertar en destination.index
      newAvailable.splice(destination.index, 0, draggableId);

      console.log("🔄 Reordenando dentro de available:", newAvailable);
      setAvailable(newAvailable);
      return;
    }

    // ── B) Reordenamiento dentro de un mismo “day-X”
    if (
      srcDroppable.startsWith("day-") &&
      dstDroppable === srcDroppable
    ) {
      const dayIndex = parseInt(srcDroppable.split("-")[1], 10);
      const newDays = [...days];
      const problemasDelDia = Array.from(newDays[dayIndex].problems);

      // 1) Remover del array del día origen
      problemasDelDia.splice(source.index, 1);
      // 2) Insertar en el mismo array, en destIndex
      problemasDelDia.splice(destination.index, 0, draggableId);

      newDays[dayIndex] = {
        ...newDays[dayIndex],
        problems: problemasDelDia,
      };

      console.log(`🔄 Reordenando dentro de día-${dayIndex}:`, newDays[dayIndex].problems);
      setDays(newDays);
      return;
    }

    // ── C) Mover “available” → “day-N”
    if (srcDroppable === "available" && dstDroppable.startsWith("day-")) {
      const destDayIndex = parseInt(dstDroppable.split("-")[1], 10);

      // 1) Quitar de available
      const newAvailable = Array.from(available);
      newAvailable.splice(source.index, 1);

      // 2) Agregar a newDays[destDayIndex].problems en destIndex
      const newDays = [...days];
      newDays[destDayIndex].problems.splice(destination.index, 0, draggableId);

      console.log(`📥 Moviendo ${draggableId} de available a día-${destDayIndex}`);
      setAvailable(newAvailable);
      setDays(newDays);
      return;
    }

    // ── D) Mover “day-N” → “available”
    if (srcDroppable.startsWith("day-") && dstDroppable === "available") {
      const sourceDayIndex = parseInt(srcDroppable.split("-")[1], 10);

      // 1) Remover de día origen
      const newDays = [...days];
      newDays[sourceDayIndex].problems.splice(source.index, 1);

      // 2) Insertar en available
      const newAvailable = Array.from(available);
      newAvailable.splice(destination.index, 0, draggableId);

      console.log(`📤 Moviendo ${draggableId} de día-${sourceDayIndex} a available`);
      setDays(newDays);
      setAvailable(newAvailable);
      return;
    }

    // ── E) Mover “day-A” → “day-B” (entre dos días distintos)
    if (
      srcDroppable.startsWith("day-") &&
      dstDroppable.startsWith("day-") &&
      srcDroppable !== dstDroppable
    ) {
      const srcDayIndex = parseInt(srcDroppable.split("-")[1], 10);
      const dstDayIndex = parseInt(dstDroppable.split("-")[1], 10);

      const newDays = [...days];
      // 1) Remover de día origen
      newDays[srcDayIndex].problems.splice(source.index, 1);
      // 2) Insertar en día destino en destIndex
      newDays[dstDayIndex].problems.splice(destination.index, 0, draggableId);

      console.log(`↔️ Moviendo ${draggableId} de día-${srcDayIndex} a día-${dstDayIndex}`);
      setDays(newDays);
      return;
    }

    // ── F) Cualquier otro caso: no hacer nada
    console.warn("❓ Caso no contemplado en onDragEnd:", { srcDroppable, dstDroppable });
  };

  // ─── 4) Guardar cambios en Firestore ────────────────────────────────────────
  const saveChanges = async () => {
    if (!courseId) return;
    try {
      // Reconstruir map “days” para Firestore
      const daysMap: Record<string, any> = {};
      days.forEach((d, idx) => {
        daysMap[idx] = { day: d.day, problems: d.problems };
      });

      const courseRef = doc(firestore, "courses", courseId);
      await updateDoc(courseRef, { days: daysMap });
      alert("✅ Cambios guardados correctamente");
    } catch (error) {
      console.error("🛑 Error al guardar cambios:", error);
      alert("❌ Hubo un error al guardar cambios.");
    }
  };

  // ─── 5) Mostrar “Cargando…” ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen bg-[#1e1e1e] text-white">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Topbar />
          <main className="flex-1 flex items-center justify-center">
            <span className="text-gray-400">Cargando datos del curso…</span>
          </main>
        </div>
      </div>
    );
  }

  // ─── 6) Renderizar UI con Drag & Drop ───────────────────────────────────────
  return (
    <div className="flex h-screen bg-[#1e1e1e] text-white">
      {/* Sidebar (izquierda) */}
      <Sidebar />

      {/* Contenedor principal */}
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="flex-1 p-6 overflow-auto">
          <h1 className="text-2xl font-bold mb-6">Editor de Curso</h1>

          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex space-x-6">
              {/* ─── Panel Izquierdo: “Ejercicios Disponibles” ─────────────── */}
              <div className="w-1/4 bg-[#2a2a2a] border border-gray-700 p-4 rounded-lg">
                <h2 className="font-semibold mb-2 text-white">
                  Ejercicios Disponibles
                </h2>
                <div
                  className="bg-[#1e1e1e] p-2 rounded overflow-y-auto"
                  style={{ maxHeight: 600 }}
                >
                  <Droppable droppableId="available">
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                      >
                        {available.map((prob, index) => (
                          <Draggable
                            key={prob}
                            draggableId={prob}
                            index={index}
                          >
                            {(prov) => (
                              <div
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                {...prov.dragHandleProps}
                                style={{
                                  padding: 8,
                                  marginBottom: 4,
                                  backgroundColor: "#28a745",
                                  color: "white",
                                  borderRadius: 4,
                                  // IMPORTANTE: aplicar siempre la style que venga de prov.draggableProps.style
                                  ...prov.draggableProps.style,
                                }}
                              >
                                {prob}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              </div>

              {/* ─── Panel Derecho: Grilla de “Día 1”, “Día 2”, … ───────────── */}
              <div className="flex-1">
                <div className="grid grid-cols-3 gap-4">
                  {days.map((dayData, idx) => (
                    <div
                      key={idx}
                      className="
                        bg-[#2a2a2a]
                        border
                        border-gray-700
                        rounded-lg
                        flex flex-col
                        p-4
                      "
                    >
                      <h3 className="font-semibold text-lg mb-2 text-white">
                        Día {dayData.day}
                      </h3>
                      <Droppable droppableId={`day-${idx}`}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            style={{
                              minHeight: 150,
                              maxHeight: 500,
                              overflowY: "auto",
                              backgroundColor: "#1e1e1e",
                              padding: 4,
                              borderRadius: 4,
                              borderTop: "2px solid #444",
                            }}
                          >
                            {dayData.problems.map((prob, index) => (
                              <Draggable
                                key={prob}
                                draggableId={prob}
                                index={index}
                              >
                                {(prov) => (
                                  <div
                                    ref={prov.innerRef}
                                    {...prov.draggableProps}
                                    {...prov.dragHandleProps}
                                    style={{
                                      padding: 8,
                                      marginBottom: 4,
                                      backgroundColor: "#ffc107",
                                      color: "#1e1e1e",
                                      borderRadius: 4,
                                      ...prov.draggableProps.style,
                                    }}
                                  >
                                    {prob}
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  ))}
                </div>

                {/* ─── Botón “Guardar Cambios” ─────────────────────────────── */}
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={saveChanges}
                    className="
                      px-6
                      py-2
                      bg-blue-600
                      hover:bg-blue-700
                      text-white
                      rounded
                      transition-colors
                    "
                  >
                    Guardar Cambios
                  </button>
                </div>
              </div>
            </div>
          </DragDropContext>
        </main>
      </div>
    </div>
  );
};

export default CourseEditor;
