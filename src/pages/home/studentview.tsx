import ProblemsTable from "@/components/ProblemsTable/ProblemsTable";
import Topbar from "@/components/Topbar/Topbar";
import useHasMounted from "@/hooks/useHasMounted";
import { useEffect, useState } from "react";
import { DBProblem } from "@/utils/types/problem";
import { collection, getDocs, orderBy, query, doc, getDoc } from "firebase/firestore";
import { firestore, auth } from "@/firebase/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { useRouter } from "next/router";
import { FaBars, FaChalkboardTeacher } from "react-icons/fa";

interface Day {
  day: number;
  problems: string[];
}

interface Course {
  id: string;
  title: string;
  days: Day[];
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
  }, [user, loading]);

  useEffect(() => {
    const fetchProblems = async () => {
      const q = query(collection(firestore, "problems"), orderBy("order", "asc"));
      const querySnapshot = await getDocs(q);
      const tmp: DBProblem[] = [];
      querySnapshot.forEach((doc) => {
        tmp.push({ id: doc.id, ...doc.data() } as DBProblem);
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
        const courseData = courseDocs.docs[0].data();
        setCourse({ id: courseDocs.docs[0].id, ...courseData } as Course);
      }
    };

    fetchProblems();
    fetchSolvedProblems();
    fetchCourse();
  }, [user]);

  const isDayUnlocked = (dayIndex: number): boolean => {
    if (!course || !course.days || dayIndex === 0) return true;
    const prevDay = course.days[dayIndex - 1];
    if (!prevDay || !Array.isArray(prevDay.problems)) return false;
    return prevDay.problems.every((pid) => solvedProblems.includes(pid));
  };

  const filteredProblems =
    selectedDay != null
      ? course?.days
          .find((d) => d.day === selectedDay)
          ?.problems.map((pid) => problems.find((p) => p.id === pid))
          .filter(Boolean) as DBProblem[]
      : [];

  if (!hasMounted || loading) return null;

  return (
    <main className="bg-dark-layer-2 min-h-screen relative">
      <Topbar />

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full bg-[#1e1e1e] text-white shadow-lg z-40 transition-all duration-300 flex flex-col items-center ${
          sidebarOpen ? "w-56" : "w-14"
        }`}
      >
        <button
          className="mt-4 text-white text-2xl"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <FaBars />
        </button>

        {sidebarOpen && (
          <div className="mt-10 w-full px-4">
            <h2 className="text-lg font-semibold mb-6">Menú</h2>
            <button
              onClick={() => router.push("/teacherview")}
              className="flex items-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
            >
              <FaChalkboardTeacher />
              Vista de Profesor
            </button>
          </div>
        )}
      </div>

      {/* Título */}
      <h1 className="text-2xl text-center text-gray-700 dark:text-gray-400 font-medium uppercase mt-10 mb-5">
        &ldquo; Rutina de Programación &rdquo; 👇
      </h1>

      {/* Días */}
      <div className="flex justify-center flex-wrap gap-4 my-8">
        {course?.days.map((dayObj, index) => {
          const unlocked = isDayUnlocked(index);
          return (
            <div
              key={dayObj.day}
              onClick={() => unlocked && setSelectedDay(dayObj.day)}
              className={`w-24 h-24 rounded-full flex items-center justify-center font-bold transition text-center
              ${
                unlocked
                  ? "bg-green-600 text-white cursor-pointer hover:scale-105"
                  : "bg-gray-500 text-gray-300 cursor-not-allowed"
              }`}
            >
              Día {dayObj.day}
            </div>
          );
        })}
      </div>

      {/* Tabla */}
      {selectedDay && isDayUnlocked(selectedDay - 1) && (
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
                  <th scope="col" className="px-1 py-3 w-0 font-medium">Status</th>
                  <th scope="col" className="px-6 py-3 w-0 font-medium">Title</th>
                  <th scope="col" className="px-6 py-3 w-0 font-medium">Difficulty</th>
                  <th scope="col" className="px-6 py-3 w-0 font-medium">Category</th>
                </tr>
              </thead>
              <ProblemsTable problems={filteredProblems} solvedProblems={solvedProblems} />
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
