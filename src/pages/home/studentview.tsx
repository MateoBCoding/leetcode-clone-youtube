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
  // En lugar de Day[] aquí guardaremos el arreglo convertido desde el objeto de Firestore
  daysArr: Day[];
}

export default function StudentView() {
  const [loadingProblems, setLoadingProblems] = useState(true);
  const [problems, setProblems] = useState<DBProblem[]>([]);
  const [solvedProblems, setSolvedProblems] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Ahora `course` tendrá la forma { id: string, title: string, daysArr: Day[] }
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

        // ─── a) “days” viene como un objeto/map, no como un arreglo ────────
        //     Ejemplo: { "0": { day: 1, problems: [...] }, "1": { day: 2, problems: [...] }, … }
        const daysObj = (courseData.days as Record<string, Day>) || {};

        // ─── b) Convertir ese objeto a arreglo con Object.values() ─────────
        const daysArr: Day[] = Object.values(daysObj);

        // ─── c) (Opcional) ordenar por “day” para asegurarnos que esté en orden ─
        daysArr.sort((a, b) => a.day - b.day);

        // ─── d) Finalmente guardarlo en estado junto al id y title ─────────
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

  // ─── 3) Función que decide si un día está desbloqueado ─────────────────────
  const isDayUnlocked = (dayIndex: number): boolean => {
    if (!course || !course.daysArr || dayIndex === 0) return true;
    const prevDay = course.daysArr[dayIndex - 1];
    if (!prevDay || !Array.isArray(prevDay.problems)) return false;
    // Solo desbloquear si todos los problemas de prevDay están en solvedProblems
    return prevDay.problems.every((pid) => solvedProblems.includes(pid));
  };

  // ─── 4) Filtrar la lista de problemas a mostrar según el día seleccionado ──
  const filteredProblems: DBProblem[] =
  selectedDay != null && course
    ? (
        course.daysArr
          .find((d) => d.day === selectedDay)
          ?.problems
          .map((pid) => problems.find((p) => p.id === pid))
          .filter((p): p is DBProblem => !!p)
      ) ?? []  // <-- si todo es undefined, devuelve []
    : [];


  // ─── 5) Si la página no ha terminado de montar o aún no sabemos el rol, no mostrar nada ──
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
        {/*
          Antes hacías: {course?.days.map(...)} 
          Ahora debes iterar sobre course.daysArr (que SÍ es un array).
        */}
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

      {/*
        ─── 7) Si ya seleccionó un día y está desbloqueado, mostrar la tabla ──────
        Verificamos isDayUnlocked(selectedDay - 1) porque para ver los problemas
        del “Día N” debemos comprobar que “Día N-1” esté completado.
      */}
      {selectedDay !== null &&
        isDayUnlocked(selectedDay - 1) &&
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
                    <th
                      scope="col"
                      className="px-1 py-3 w-0 font-medium"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 w-0 font-medium"
                    >
                      Title
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 w-0 font-medium"
                    >
                      Difficulty
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 w-0 font-medium"
                    >
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
