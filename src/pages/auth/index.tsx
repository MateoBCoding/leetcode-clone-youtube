import { authModalState } from "@/atoms/authModalAtom";
import AuthModal from "@/components/Modals/AuthModal";
import Navbar from "@/components/Navbar/Navbar";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, firestore } from "@/firebase/firebase";
import { useRecoilValue } from "recoil";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import { doc, getDoc } from "firebase/firestore";

const AuthPage: React.FC = () => {
  const authModal = useRecoilValue(authModalState);
  const [user, loading] = useAuthState(auth);
  const [pageLoading, setPageLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
     const redirectBasedOnRole = async () => {
       if (user) {
         const userRef = doc(firestore, "users", user.uid);
         const userSnap = await getDoc(userRef);
         const role = userSnap.data()?.role?.toLowerCase();

        if (role === "profesor" || role === "admin"){
          router.push("/teacherview");
        } else if (role === "estudiante") {
          router.push("/home/studentview");
        } else {
          router.push("/auth");
       }
       } else if (!loading && !user) {
         setPageLoading(false);
       }
     };

     redirectBasedOnRole();
   }, [user, loading]);

  if (pageLoading) return null;

  return (
    <div className="bg-gradient-to-b from-green-600 to-white h-screen relative">
      <div className="max-w-7xl mx-auto">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-5rem)] pointer-events-none select-none">
          <Image src="/hero.png" alt="Hero img" width={700} height={700} />
        </div>
        {authModal.isOpen && <AuthModal />}
      </div>
    </div>
  );
};

export default AuthPage;
