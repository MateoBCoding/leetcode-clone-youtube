// src/pages/home/studentview.tsx

import ProblemsTable from "@/components/ProblemsTable/ProblemsTable";
import Topbar from "@/components/Topbar/Topbar";
import useHasMounted from "@/hooks/useHasMounted";
import { useEffect, useState } from "react";
import { DBProblem } from "@/utils/types/problem";
import {
  collection,
  getDocs,
  orderBy,
  query,
  doc,
  getDoc,
} from "firebase/firestore";
import { firestore, auth } from "@/firebase/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { useRouter } from "next/router";

interface Day {
  day: number;
  problems: string[];
}

interface Course {
  id: string;
  title: string;
  // daysArr es un arreglo ordenado de objetos { day, problems }
  daysArr: Day[];
}

export default function StudentView() {
  const [loadingProblems, setLoadingProblems] = useState(true);
  const [problems, setProblems] = useState<DBProblem[]>([]);
  const [solvedProblems, setSolvedProblems] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [course, setCourse] = useState<Course | null>(null);

  const hasMounted = useHasMounted();
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

  // ─── 1) Si el usuario es profesor, redirige a /teacherview ────────────────
  useEffect(() => {
    if (!loading && user) {
      const fetchRoleAndRedirect = async () => {
        const userRef = doc(firestore, "users", user.uid);
        const userSnap = await getDoc(userRef);
        const role = userSnap.data()?.role?.toLowerCase();
        if (role === "profesor") {
          router.push("/teacherview");
        }
      };
      fetchRoleAndRedirect();
    }
  }, [user, loading, router]);

  // ─── 2) Cargar problemas, problemas resueltos y datos del curso ────────────
  useEffect(() => {
    const fetchProblems = async () => {
      const q = query(
        collection(firestore, "problems"),
        orderBy("order", "asc")
      );
      const querySnapshot = await getDocs(q);
      const tmp: DBProblem[] = [];
      querySnapshot.forEach((docSnap) => {
        tmp.push({ id: docSnap.id, ...docSnap.data() } as DBProblem);
      });
      setProblems(tmp);
      setLoadingProblems(false);
    };

    const fetchSolvedProblems = async () => {
      if (user) {
        const userRef = doc(firestore, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setSolvedProblems(userSnap.data().solvedProblems || []);
        }
      }
    };

    const fetchCourse = async () => {
      const courseDocs = await getDocs(collection(firestore, "courses"));
      if (!courseDocs.empty) {
        const docSnap = courseDocs.docs[0];
        const courseData = docSnap.data();

        // a) “days” viene como un objeto/map, no como un arreglo
        const daysObj = (courseData.days as Record<string, Day>) || {};

        // b) Convertir ese objeto a arreglo con Object.values()
        const daysArr: Day[] = Object.values(daysObj);

        // c) Ordenar por “day” para asegurarnos el orden
        daysArr.sort((a, b) => a.day - b.day);

        // d) Guardarlo en estado
        setCourse({
          id: docSnap.id,
          title: courseData.title,
          daysArr,
        });
      }
    };

    fetchProblems();
    fetchSolvedProblems();
    fetchCourse();
  }, [user]);

  // ─── 3) Función que decide si un día (por índice en daysArr) está desbloqueado ───
  //     Ignora los días que no tienen ejercicios (daysArr[i].problems.length === 0) y
  //     busca hacia atrás el primer día con ejercicios para comprobar si está completado.
  const isDayUnlocked = (dayIndex: number): boolean => {
    if (!course) return false;
    // El primer día (índice 0) siempre está desbloqueado.
    if (dayIndex === 0) return true;

    // Buscar hacia atrás el primer día anterior que sí tenga ejercicios (problems.length > 0)
    let prevIndex = dayIndex - 1;
    while (prevIndex >= 0 && course.daysArr[prevIndex].problems.length === 0) {
      prevIndex--;
    }

    // Si no encontramos un día anterior con problemas, entonces lo desbloqueamos (nada que completar antes)
    if (prevIndex < 0) {
      return true;
    }

    // Si sí existe un día con ejercicios, comprobar que todos sus problemas estén resueltos
    const prevDay = course.daysArr[prevIndex];
    return prevDay.problems.every((pid) => solvedProblems.includes(pid));
  };

  // ─── 4) Filtrar la lista de problemas a mostrar según el día seleccionado ─────
  // Encontramos primero el índice de `selectedDay` en `course.daysArr`.
  const selectedIndex =
    selectedDay !== null && course
      ? course.daysArr.findIndex((d) => d.day === selectedDay)
      : -1;

  const filteredProblems: DBProblem[] =
    selectedIndex >= 0 && course
      ? course.daysArr[selectedIndex].problems
          .map((pid) => problems.find((p) => p.id === pid))
          .filter((p): p is DBProblem => !!p)
      : [];

  // ─── 5) Si la página no ha terminado de montar o aún no sabemos el rol, no mostrar nada ───
  if (!hasMounted || loading) return null;

  return (
    <main className="bg-dark-layer-2 min-h-screen relative">
      <Topbar />

      {/* ─── Título ──────────────────────────────────────────────────────────────── */}
      <h1 className="text-2xl text-center text-gray-700 dark:text-gray-400 font-medium uppercase mt-10 mb-5">
        &ldquo; Rutina de Programación &rdquo; 👇
      </h1>

      {/* ─── 6) Mostrar los indicadores de cada día ─────────────────────────────── */}
      <div className="flex justify-center flex-wrap gap-4 my-8">
        {course?.daysArr.map((dayObj, index) => {
          const unlocked = isDayUnlocked(index);

          return (
            <div
              key={dayObj.day}
              onClick={() =>
                unlocked ? setSelectedDay(dayObj.day) : undefined
              }
              className={`
                w-24 h-24 rounded-full flex items-center justify-center font-bold transition text-center
                ${
                  unlocked
                    ? "bg-green-600 text-white cursor-pointer hover:scale-105"
                    : "bg-gray-500 text-gray-300 cursor-not-allowed"
                }
              `}
            >
              Día {dayObj.day}
            </div>
          );
        })}
      </div>

      {/* ─── 7) Mostrar la tabla de problemas sólo si:
             a) Ya hay un día seleccionado (selectedIndex >= 0).
             b) Ese día está desbloqueado (isDayUnlocked(selectedIndex)).
             c) Y tiene al menos 1 problema en filteredProblems */}      
      {selectedIndex >= 0 &&
        isDayUnlocked(selectedIndex) &&
        filteredProblems.length > 0 && (
          <div className="relative overflow-x-auto mx-auto px-6 pb-10">
            {loadingProblems ? (
              <div className="max-w-[1200px] mx-auto sm:w-7/12 w-full animate-pulse">
                {[...Array(10)].map((_, idx) => (
                  <LoadingSkeleton key={idx} />
                ))}
              </div>
            ) : (
              <table className="text-sm text-left text-gray-500 dark:text-gray-400 sm:w-7/12 w-full max-w-[1200px] mx-auto">
                <thead className="text-xs text-gray-700 uppercase dark:text-gray-400 border-b">
                  <tr>
                    <th scope="col" className="px-1 py-3 w-0 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 w-0 font-medium">
                      Title
                    </th>
                    <th scope="col" className="px-6 py-3 w-0 font-medium">
                      Difficulty
                    </th>
                    <th scope="col" className="px-6 py-3 w-0 font-medium">
                      Category
                    </th>
                  </tr>
                </thead>
                <ProblemsTable
                  problems={filteredProblems}
                  solvedProblems={solvedProblems}
                />
              </table>
            )}
          </div>
        )}
    </main>
  );
}

// ─── Componente auxiliar para mostrar “skeleton loading” ────────────────────
const LoadingSkeleton = () => (
  <div className="flex items-center space-x-12 mt-4 px-6">
    <div className="w-6 h-6 shrink-0 rounded-full bg-dark-layer-1"></div>
    <div className="h-4 sm:w-52 w-32 rounded-full bg-dark-layer-1"></div>
    <div className="h-4 sm:w-52 w-32 rounded-full bg-dark-layer-1"></div>
    <div className="h-4 sm:w-52 w-32 rounded-full bg-dark-layer-1"></div>
    <span className="sr-only">Loading...</span>
  </div>
);
