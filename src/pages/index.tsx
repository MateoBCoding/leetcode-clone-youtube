// pages/index.tsx
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function RedirectToLogin() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/auth");
  }, [router]);

  return null;
}
