import type { Metadata } from "next";
import { WarmUp } from "@/components/warm-up";
export const metadata: Metadata = { title: "Memory Ladder · 记忆阶梯" };
export default function MemoryLadderPage() {
  return (
    <div className="container mind-page">
      <WarmUp />
    </div>
  );
}
