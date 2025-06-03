import { auth, firestore } from "@/firebase/firebase";
import {
  doc,
  getDoc,
  getDocs,
  query,
  where,
  collection,
} from "firebase/firestore";
import Link from "next/link";
import React, { useEffect, useState, useRef } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import Logout from "../Buttons/Logout";
import { useSetRecoilState } from "recoil";
import { authModalState } from "@/atoms/authModalAtom";
import Image from "next/image";

import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { BsList } from "react-icons/bs";
import { useRouter } from "next/router";

type TopbarProps = {
  problemPage?: boolean;
};

const Topbar: React.FC<TopbarProps> = ({ problemPage = false }) => {
  const [user] = useAuthState(auth);
  const setAuthModalState = useSetRecoilState(authModalState);
  const router = useRouter();

  const [userRole, setUserRole] = useState<string | null>(null);
  const [totalPoints, setTotalPoints] = useState<number>(0);
  const [loadingPoints, setLoadingPoints] = useState<boolean>(false);

  const prevUserRef = useRef<typeof user>(user);

  useEffect(() => {
    if (!user) {
      setUserRole(null);
      return;
    }

    (async () => {
      try {
        const userSnap = await getDoc(doc(firestore, "users", user.uid));
        const roleFromDB = userSnap.data()?.role?.toLowerCase() || null;
        setUserRole(roleFromDB);
      } catch (err) {
        console.error("Error obteniendo rol de usuario:", err);
        setUserRole(null);
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!user || userRole !== "estudiante") {
      setTotalPoints(0);
      setLoadingPoints(false);
      return;
    }

    setLoadingPoints(true);
    (async () => {
      try {
        const statsRef = collection(firestore, "user_problem_stats");
        const q = query(statsRef, where("userId", "==", user.uid));
        const querySnap = await getDocs(q);

        let sum = 0;
        querySnap.forEach((docSnap) => {
          const data = docSnap.data();
          if (typeof data.points === "number") {
            sum += data.points;
          }
        });
        setTotalPoints(sum);
      } catch (err) {
        console.error("Error consultando puntos totales:", err);
        setTotalPoints(0);
      } finally {
        setLoadingPoints(false);
      }
    })();
  }, [user, userRole]);


  useEffect(() => {
    const prevUser = prevUserRef.current;


    if (prevUser && !user) {
      router.push("/auth"); 
    }

    prevUserRef.current = user;
  }, [user, router]);

  return (
    <nav className="relative flex h-[50px] w-full shrink-0 items-center px-5 bg-green-600 text-white">
      <div className="flex w-full items-center justify-between">
        <Link href="/" className="h-[22px] flex-1" />

        {problemPage && (
          <div className="flex items-center gap-4 flex-1 justify-center">
            <Link
              href="/home/studentview"
              className="flex items-center gap-2 font-medium text-white cursor-pointer select-none"
            >
              <BsList size={18} />
              <span>Problem List</span>
            </Link>
          </div>
        )}

        <div className="flex items-center space-x-4 flex-1 justify-end">
          {!user && (
            <Link
              href="/auth"
              onClick={() =>
                setAuthModalState((prev) => ({
                  ...prev,
                  isOpen: true,
                  type: "login",
                }))
              }
            >
              <button className="bg-white text-green-600 py-1 px-2 rounded font-medium cursor-pointer">
                Sign In
              </button>
            </Link>
          )}

          {user && (
            <>
              {userRole === "estudiante" && (
                <div className="flex flex-col items-end">
                  <span className="text-sm font-medium">
                    {loadingPoints ? "..." : `${totalPoints} Puntos`}
                  </span>
                  <span className="text-xs text-white/70">Totales</span>
                </div>
              )}

              <div className="cursor-pointer group relative">
                <Image
                  src="/avatar.png"
                  alt="Avatar"
                  width={30}
                  height={30}
                  className="rounded-full"
                />
                <div
                  className="
                    absolute
                    top-10
                    left-2/4
                    -translate-x-2/4
                    bg-white
                    text-green-600
                    p-2
                    rounded
                    shadow-lg
                    z-40
                    group-hover:scale-100
                    scale-0
                    transition-all
                    duration-300
                    ease-in-out
                  "
                >
                  <p className="text-sm">{user.email}</p>
                </div>
              </div>

              <Logout />
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Topbar;
