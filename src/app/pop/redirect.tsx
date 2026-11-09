"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/locale";
export function PopRedirect() {
  const router = useRouter();
  const { href } = useLocale();
  const crowd = href("/crowd/");
  useEffect(() => {
    router.replace(crowd);
  }, [router, crowd]);
  return (
    <main style={{ padding: 32, textAlign: "center" }}>
      <p>
        <Link href={crowd}>Crowd Rush</Link>
      </p>
    </main>
  );
}
