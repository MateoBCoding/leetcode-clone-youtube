import { useEffect, useState } from "react";
import { firestore } from "@/firebase/firebase";
import { collection, getDocs } from "firebase/firestore";

export type Course = {
  id: string;
  title: string;
  description: string;
  category: string;
  days: {
    day: number;
    problems: string[]; 
  }[];
};

export default function useCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      const snapshot = await getDocs(collection(firestore, "courses"));
      const data: Course[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Course));
      setCourses(data);
      setLoading(false);
    };

    fetchCourses();
  }, []);

  return { courses, loading };
}
