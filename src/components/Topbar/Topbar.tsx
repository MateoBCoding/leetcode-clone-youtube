// src/components/Topbar/Topbar.tsx

import { auth } from "@/firebase/firebase";
import Link from "next/link";
import React from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import Logout from "../Buttons/Logout";
import { useSetRecoilState } from "recoil";
import { authModalState } from "@/atoms/authModalAtom";
import Image from "next/image";

// IMPORTS AÑADIDOS PARA LOS ÍCONOS Y ROUTER
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { BsList } from "react-icons/bs";
import { useRouter } from "next/router";

type TopbarProps = {
  /** 
   * Si estás en una página de problemas y quieres mostrar 
   * las flechas y “Problem List”, envía `problemPage={true}`.
   */
  problemPage?: boolean;
};

const Topbar: React.FC<TopbarProps> = ({ problemPage = false }) => {
  const [user] = useAuthState(auth);
  const setAuthModalState = useSetRecoilState(authModalState);
  const router = useRouter();

  return (
    <nav className="relative flex h-[50px] w-full shrink-0 items-center px-5 bg-green-600 text-white">
      <div className="flex w-full items-center justify-between">
        {/* Espacio izquierdo, podría ir el logo o link a Home */}
        <Link href="/" className="h-[22px] flex-1">
          {/* Si quisieras un logo aquí, pásalo como imagen */}
        </Link>

        {/* ------------------------------------------------------------- */}
        {/* BLOQUE CENTRO: “Problem List” */}
        {/* ------------------------------------------------------------- */}
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

        {/* ------------------------------------------------------------- */}
        {/* BLOQUE DERECHO: Sign in / Avatar / Logout                    */}
        {/* ------------------------------------------------------------- */}
        <div className="flex items-center space-x-4 flex-1 justify-end">
          {!user && (
            <Link
              href="/auth"
              onClick={() =>
                setAuthModalState((prev) => ({ ...prev, isOpen: true, type: "login" }))
              }
            >
              <button className="bg-white text-green-600 py-1 px-2 rounded font-medium cursor-pointer">
                Sign In
              </button>
            </Link>
          )}

          {user && (
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
          )}

          {user && <Logout />}
        </div>
      </div>
    </nav>
  );
};

export default Topbar;
