import ProblemsTable from "@/components/ProblemsTable/ProblemsTable";
import Topbar from "@/components/Topbar/Topbar";
import useHasMounted from "@/hooks/useHasMounted";
import { useEffect, useState } from "react";
import { DBProblem } from "@/utils/types/problem";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { firestore, auth } from "@/firebase/firebase";
import { useAuthState } from "react-firebase-hooks/auth";

export default function Home() {
  const [loadingProblems, setLoadingProblems] = useState(true);
  const [problems, setProblems] = useState<DBProblem[]>([]);
  const [solvedProblems, setSolvedProblems] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [youtubePlayer, setYoutubePlayer] = useState({ isOpen: false, videoId: "" });
  const hasMounted = useHasMounted();
  const [user] = useAuthState(auth);

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
        const userDoc = await getDocs(collection(firestore, "users"));
        const userData = userDoc.docs.find((doc) => doc.id === user.uid);
        if (userData) {
          setSolvedProblems(userData.data().solvedProblems || []);
        }
      }
    };

    fetchProblems();
    fetchSolvedProblems();
  }, [user]);

  const categories = Array.from(new Set(problems.map((p) => p.category)));

  const handleCategoryClick = (category: string) => {
    if (selectedCategory === category) {
      setSelectedCategory(null); // Colapsar
    } else {
      setSelectedCategory(category);
    }
  };

  const filteredProblems = selectedCategory
    ? problems.filter((p) => p.category === selectedCategory)
    : problems;

  if (!hasMounted) return null;

  return (
    <>
      <main className='bg-dark-layer-2 min-h-screen'>
        <Topbar />
        <h1 className='text-2xl text-center text-gray-700 dark:text-gray-400 font-medium uppercase mt-10 mb-5'>
          &ldquo; Lista de Problemas &rdquo; 👇
        </h1>

        {/* Circulos de Categorías */}
        <div className="flex justify-center flex-wrap gap-4 my-8">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryClick(cat)}
              className={`w-24 h-24 rounded-full flex items-center justify-center font-bold transition ${
                selectedCategory === cat ? "bg-blue-700 text-white" : "bg-dark-layer-1 text-gray-400 hover:bg-blue-500 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Tabla de problemas */}
        <div className='relative overflow-x-auto mx-auto px-6 pb-10'>
          {loadingProblems && (
            <div className='max-w-[1200px] mx-auto sm:w-7/12 w-full animate-pulse'>
              {[...Array(10)].map((_, idx) => (
                <LoadingSkeleton key={idx} />
              ))}
            </div>
          )}
          <table className='text-sm text-left text-gray-500 dark:text-gray-400 sm:w-7/12 w-full max-w-[1200px] mx-auto'>
			{!loadingProblems && selectedCategory && (
				<>
				<thead className='text-xs text-gray-700 uppercase dark:text-gray-400 border-b'>
					<tr>
					<th scope='col' className='px-1 py-3 w-0 font-medium'>Status</th>
					<th scope='col' className='px-6 py-3 w-0 font-medium'>Title</th>
					<th scope='col' className='px-6 py-3 w-0 font-medium'>Difficulty</th>
					<th scope='col' className='px-6 py-3 w-0 font-medium'>Category</th>
					</tr>
				</thead>

				<ProblemsTable
					problems={filteredProblems}
					solvedProblems={solvedProblems}					
				/>
				</>
			)}
			</table>
        </div>
      </main>
    </>
  );
}

const LoadingSkeleton = () => {
  return (
    <div className='flex items-center space-x-12 mt-4 px-6'>
      <div className='w-6 h-6 shrink-0 rounded-full bg-dark-layer-1'></div>
      <div className='h-4 sm:w-52 w-32 rounded-full bg-dark-layer-1'></div>
      <div className='h-4 sm:w-52 w-32 rounded-full bg-dark-layer-1'></div>
      <div className='h-4 sm:w-52 w-32 rounded-full bg-dark-layer-1'></div>
      <span className='sr-only'>Loading...</span>
    </div>
  );
};
