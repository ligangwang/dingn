"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "./locale";
export function LegacyRoutes() {
  const router = useRouter();
  const { href } = useLocale();
  useEffect(() => {
    const path = window.location.hash.slice(1).replace(/\/$/, "");
    if (["/word", "/number", "/card", "/signin", "/account"].includes(path))
      router.replace(href(path + "/"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);
  return null;
}
