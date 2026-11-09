"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Text } from "@/components/locale";
export function PopRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/crowd/");
  }, [router]);
  return (
    <main style={{ padding: 32, textAlign: "center" }}>
      <p>
        <Link href="/crowd/">
          <Text>Crowd Rush</Text>
        </Link>
      </p>
    </main>
  );
}
