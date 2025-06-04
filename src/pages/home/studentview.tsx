// src/pages/StudentView.tsx

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

  // Redirigir a /teacherview si el usuario es profesor
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

  // Cargar todos los problemas, los resueltos, y la información del curso
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

        const daysObj = (courseData.days as Record<string, Day>) || {};
        const daysArr: Day[] = Object.values(daysObj);
        daysArr.sort((a, b) => a.day - b.day);

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

  // Función para determinar si el día está desbloqueado
  const isDayUnlocked = (dayIndex: number): boolean => {
    if (!course) return false;
    if (dayIndex === 0) return true;

    let prevIndex = dayIndex - 1;
    while (prevIndex >= 0 && course.daysArr[prevIndex].problems.length === 0) {
      prevIndex--;
    }

    if (prevIndex < 0) {
      return true;
    }

    const prevDay = course.daysArr[prevIndex];
    return prevDay.problems.every((pid) => solvedProblems.includes(pid));
  };

  // Índice dentro de daysArr para el día seleccionado
  const selectedIndex =
    selectedDay !== null && course
      ? course.daysArr.findIndex((d) => d.day === selectedDay)
      : -1;

  // Filtrar los problemas para el día seleccionado
  const filteredProblems: DBProblem[] =
    selectedIndex >= 0 && course
      ? course.daysArr[selectedIndex].problems
          .map((pid) => problems.find((p) => p.id === pid))
          .filter((p): p is DBProblem => !!p)
      : [];

  if (!hasMounted || loading) return null;

  // Agrupar los días en semanas de 7 días cada una
  const weekMap: Record<number, Day[]> = {};
  if (course) {
    course.daysArr.forEach((dayObj) => {
      const weekIndex = Math.floor((dayObj.day - 1) / 7);
      if (!weekMap[weekIndex]) {
        weekMap[weekIndex] = [];
      }
      weekMap[weekIndex].push(dayObj);
    });
  }

  return (
    <main className="bg-dark-layer-2 min-h-screen relative">
      <Topbar />

      <h1 className="text-2xl text-center text-gray-700 dark:text-gray-400 font-medium uppercase mt-10 mb-5">
        Rutina de Ejercicios de Programación
      </h1>

      {/*
        Recorremos cada semana (clave numérica en weekMap) en orden creciente.
        Cada sección es un flex en columna centrado, de modo que el texto "Semana X"
        queda centrado sobre los círculos de los días.
      */}
      <div className="space-y-8 pt-6 w-full">
        {Object.keys(weekMap)
          .map((wk) => parseInt(wk, 10))
          .sort((a, b) => a - b)
          .map((weekIndex) => (
            <section key={weekIndex} className="flex flex-col items-center">
              <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-400 text-center mb-4">
                Semana {weekIndex + 1}
              </h2>
              <div className="flex justify-center flex-wrap gap-4">
                {weekMap[weekIndex].map((dayObj) => {
                  const realIndex = course?.daysArr.findIndex(
                    (d) => d.day === dayObj.day
                  )!;
                  const unlocked = isDayUnlocked(realIndex);

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
            </section>
          ))}
      </div>

      {/*
        Si hay un día seleccionado, está desbloqueado y tiene problemas,
        se muestra la tabla con los problemas filtrados para ese día.
      */}
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

const LoadingSkeleton = () => (
  <div className="flex items-center space-x-12 mt-4 px-6">
    <div className="w-6 h-6 shrink-0 rounded-full bg-dark-layer-1"></div>
    <div className="h-4 sm:w-52 w-32 rounded-full bg-dark-layer-1"></div>
    <div className="h-4 sm:w-52 w-32 rounded-full bg-dark-layer-1"></div>
    <div className="h-4 sm:w-52 w-32 rounded-full bg-dark-layer-1"></div>
    <span className="sr-only">Loading...</span>
  </div>
);
