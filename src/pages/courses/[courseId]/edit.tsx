import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Sidebar from "@/components/Sidebar/Sidebar";
import Topbar from "@/components/Topbar/Topbar";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import DayColumn from "@/components/DayColumn/DayColumn";
import SortableItem from "@/components/SortableItem";
import { firestore } from "@/firebase/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import { toast } from "react-toastify";


type ItemsMap = Record<string, string[]>;

const CourseEditor: React.FC = () => {
  const router = useRouter();
  const { courseId } = router.query as { courseId: string };

  const [items, setItems] = useState<ItemsMap>({});
  const [containers, setContainers] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!courseId) return;

    const fetchData = async () => {
      try {
        const courseRef = doc(firestore, "courses", courseId);
        const courseSnap = await getDoc(courseRef);

        if (!courseSnap.exists()) {
          console.error("🛑 Curso no encontrado en Firestore");
          setLoading(false);
          return;
        }

        const courseData = courseSnap.data();
        const daysMap = (courseData.days as Record<string, any>) || {};

        const daysArray: Array<{ day: number; problems: string[] }> = Object.entries(daysMap)
          .map(([_, value]) => ({
            day: (value as any).day as number,
            problems: (value as any).problems as string[],
          }))
          .sort((a, b) => a.day - b.day);

        const problemsSnap = await getDocs(collection(firestore, "problems"));
        const allProblemIds = problemsSnap.docs.map((d) => d.id);

        const assignedIds = daysArray.flatMap((d) => d.problems);
        const availableList = allProblemIds.filter((pid) => !assignedIds.includes(pid));

        const newItems: ItemsMap = {};
        newItems["available"] = availableList;
        daysArray.forEach((d, idx) => {
          newItems[`day-${idx}`] = d.problems;
        });

        const newContainers: string[] = ["available", ...daysArray.map((_, idx) => `day-${idx}`)];

        setItems(newItems);
        setContainers(newContainers);
      } catch (error) {
        console.error("🛑 Error al cargar datos del curso:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [courseId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const sourceContainer = active.data.current?.containerId as string;
    const destinationContainer = over.data.current?.containerId as string;
    if (!sourceContainer || !destinationContainer) return;

    if (sourceContainer === destinationContainer) {
      const oldIndex = items[sourceContainer].indexOf(active.id as string);
      const newIndex = items[destinationContainer].indexOf(over.id as string);
      if (oldIndex < 0 || newIndex < 0) return;
      if (oldIndex !== newIndex) {
        setItems((prev) => ({
          ...prev,
          [sourceContainer]: arrayMove(prev[sourceContainer], oldIndex, newIndex),
        }));
      }
      return;
    }

    const sourceItems = Array.from(items[sourceContainer]);
    const indexInSource = sourceItems.indexOf(active.id as string);
    if (indexInSource < 0) return;
    sourceItems.splice(indexInSource, 1);

    const destItems = Array.from(items[destinationContainer]);
    const indexInDest = destItems.indexOf(over.id as string);
    const insertionIndex = indexInDest < 0 ? destItems.length : indexInDest;
    destItems.splice(insertionIndex, 0, active.id as string);

    setItems((prev) => ({
      ...prev,
      [sourceContainer]: sourceItems,
      [destinationContainer]: destItems,
    }));
  };

  const addDay = () => {
    const dayKeys = containers.filter((c) => c.startsWith("day-"));
    const nextIndex = dayKeys.length; 
    const newKey = `day-${nextIndex}`;

    setItems((prev) => ({
      ...prev,
      [newKey]: [], 
    }));

    setContainers((prev) => [...prev, newKey]);
  };

  const saveChanges = async () => {
    if (!courseId) return;
    try {
      const daysMap: Record<string, any> = {};

      Object.keys(items)
        .filter((key) => key.startsWith("day-"))
        .forEach((key) => {
          const idx = Number(key.split("-")[1]);
          daysMap[idx] = {
            day: idx + 1,
            problems: items[key],
          };
        });

      const courseRef = doc(firestore, "courses", courseId);
      await updateDoc(courseRef, { days: daysMap });
      toast.success("✅ Cambios guardados correctamente", {
                      position: "top-center",
                      autoClose: 3000,
                      theme: "dark",
            });
    } catch (error) {
      toast.error("❌ Hubo un error al guardar cambios.", {
                      position: "top-center",
                      autoClose: 3000,
                      theme: "dark",
            });
      console.error("🛑 Error al guardar cambios:", error);
    }
  };

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

  const dayContainers = containers.filter((c) => c.startsWith("day-"));

  return (
    <div className="flex h-screen bg-[#1e1e1e] text-white">
      {/* Sidebar */}
      <Sidebar />

      {/* Contenedor principal */}
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="flex-1 p-6 overflow-auto">
          <h1 className="text-2xl font-bold mb-4">Editor de Curso</h1>

          {/* Botón “Agregar Día” */}
          <div className="mb-4">
            <button
              onClick={addDay}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
            >
              + Agregar Día
            </button>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <div className="flex space-x-6">
              {/* ─── “Ejercicios Disponibles” ───────────────────────────── */}
              <div className="w-1/4 bg-[#2a2a2a] border border-gray-700 p-4 rounded-lg flex-shrink-0">
                <h2 className="font-semibold mb-2 text-white">
                  Ejercicios Disponibles
                </h2>
                <div
                  className="bg-[#1e1e1e] p-2 rounded overflow-y-auto"
                  style={{ maxHeight: 600 }}
                >
                  <SortableContext
                    id="available"
                    items={items["available"] || []}
                    strategy={rectSortingStrategy}
                  >
                    {(items["available"] || []).map((probId) => (
                      <SortableItem
                        key={probId}
                        id={probId}
                        containerId="available"
                      />
                    ))}
                  </SortableContext>
                </div>
              </div>

              {/* ─── CONTENEDORES DE DÍAS (FLEX CON WRAP) ──────────────────── */}
              <div className="flex-1">
                <div className="flex flex-wrap gap-4">
                  {dayContainers.map((containerId) => {
                    const idx = Number(containerId.split("-")[1]);
                    const dayNumber = idx + 1;
                    const problemasDelDia = items[containerId] || [];
                    return (
                      <DayColumn
                        key={containerId}
                        containerId={containerId}
                        dayNumber={dayNumber}
                        problemasDelDia={problemasDelDia}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ─── Botón “Guardar Cambios” ─────────────────────────────── */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={saveChanges}
                className="
                  px-6
                  py-2
                  bg-green-600
                  hover:bg-green-700
                  text-white
                  rounded
                  transition-colors
                "
              >
                Guardar Cambios
              </button>
            </div>
          </DndContext>
        </main>
      </div>
    </div>
  );
};

export default CourseEditor;
