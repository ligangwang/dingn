"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function LegacyRoutes() {
  const router = useRouter();
  useEffect(() => {
    const path = window.location.hash.slice(1).replace(/\/$/, "");
    if (["/word", "/number", "/card", "/signin", "/account"].includes(path))
      router.replace(path + "/");
  }, [router]);
  return null;
}
