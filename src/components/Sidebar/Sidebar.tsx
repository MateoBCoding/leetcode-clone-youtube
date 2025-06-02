// src/components/Sidebar/Sidebar.tsx
import React, { useState, useEffect } from "react";
import { FaBars, FaChalkboardTeacher, FaEdit } from "react-icons/fa";
import { useRouter } from "next/router";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, firestore } from "@/firebase/firebase";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";

const Sidebar: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  // 1) Estado y hook de autenticación
  const [user, loadingAuth] = useAuthState(auth);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingRole, setLoadingRole] = useState(true);

  // 2) Estado para almacenar el único courseId existente (asumimos que solo hay 1)
  const [courseId, setCourseId] = useState<string>("");
  const [loadingCourse, setLoadingCourse] = useState(true);

  // ─── 3) Obtener rol del usuario (solo si hay user) ─────────────────────────
  useEffect(() => {
    if (loadingAuth) return;
    if (!user) {
      setIsAdmin(false);
      setLoadingRole(false);
      return;
    }

    const fetchUserRole = async () => {
      try {
        const userRef = doc(firestore, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data() as { role?: string };
          setIsAdmin(data.role === "admin");
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error("Error al obtener rol de usuario:", err);
        setIsAdmin(false);
      } finally {
        setLoadingRole(false);
      }
    };

    fetchUserRole();
  }, [user, loadingAuth]);

  // ─── 4) Obtener el único courseId de la colección “courses” ────────────────
  useEffect(() => {
    const fetchOnlyCourse = async () => {
      try {
        const coursesCollection = collection(firestore, "courses");
        const snapshot = await getDocs(coursesCollection);
        if (snapshot.size === 1) {
          // Si EXACTAMENTE hay 1 documento, lo tomamos
          const docSnap = snapshot.docs[0];
          setCourseId(docSnap.id);
        } else {
          // Si hay 0 o >1, dejamos courseId = ""
          setCourseId("");
          console.warn(
            `Se esperaría un solo curso, pero hay ${snapshot.size}.`
          );
        }
      } catch (err) {
        console.error("Error al leer colección courses:", err);
        setCourseId("");
      } finally {
        setLoadingCourse(false);
      }
    };

    fetchOnlyCourse();
  }, []); // Se llama solo una vez al montar

  // ─── 5) Handler para ir al Editor de Cursos ─────────────────────────────────
  const goToCourseEditor = () => {
    if (!courseId) return;
    router.push(`/courses/${courseId}/edit`);
  };

  // ─── 6) Mientras carga info de auth, rol o courseId, mostrar “Cargando…” ──
  if (loadingAuth || loadingRole || loadingCourse) {
    return (
      <div
        className={`
          h-full 
          bg-[#1e1e1e] 
          text-white 
          shadow-lg 
          transition-all duration-300 
          flex flex-col items-center
          ${sidebarOpen ? "w-56" : "w-14"}
        `}
      >
        <button
          className="mt-4 text-white text-2xl"
          onClick={() => setSidebarOpen((prev) => !prev)}
        >
          <FaBars />
        </button>
        <div className="mt-6 text-sm">Cargando...</div>
      </div>
    );
  }

  return (
    <div
      className={`
        h-full 
        bg-[#1e1e1e] 
        text-white 
        shadow-lg 
        transition-all duration-300 
        flex flex-col items-center
        ${sidebarOpen ? "w-56" : "w-14"}
      `}
    >
      {/* ─── Botón para abrir/cerrar Sidebar ─────────────────────────────────── */}
      <button
        className="mt-4 text-white text-2xl"
        onClick={() => setSidebarOpen((prev) => !prev)}
      >
        <FaBars />
      </button>

      {/* ─── Botón de “Vista de Profesor” (siempre visible) ──────────────────── */}
      <div className="mt-10 w-full px-4 flex justify-center">
        <button
          onClick={() => router.push("/teacherview")}
          className={`
            flex items-center gap-2 
            bg-green-600 hover:bg-green-700 
            text-white px-3 py-2 rounded 
            transition-all
            ${sidebarOpen ? "w-full justify-start" : "w-12 justify-center"}
          `}
          title="Vista de Profesor"
        >
          <FaChalkboardTeacher />
          {sidebarOpen && (
            <span className="whitespace-nowrap">Vista de Profesor</span>
          )}
        </button>
      </div>

      {/* ─── Botón de “Editor de Cursos” (solo si es Admin Y existe courseId) ── */}
      {isAdmin && courseId && (
        <div className="mt-4 w-full px-4 flex justify-center">
          <button
            onClick={goToCourseEditor}
            className={`
              flex items-center gap-2 
              bg-blue-600 hover:bg-blue-700 
              text-white px-3 py-2 rounded 
              transition-all
              ${sidebarOpen ? "w-full justify-start" : "w-12 justify-center"}
            `}
            title="Editor de Cursos"
          >
            <FaEdit />
            {sidebarOpen && (
              <span className="whitespace-nowrap">Editor de Cursos</span>
            )}
          </button>
        </div>
      )}

      {/* ───── Coloca aquí otros botones que desees mostrar a todos ───────────── */}

      <div className="mt-auto mb-4 text-xs text-gray-400">
        {sidebarOpen ? "© MiApp 2025" : ""}
      </div>
    </div>
  );
};

export default Sidebar;
