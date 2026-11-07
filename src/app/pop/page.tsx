import type { Metadata } from "next";
import { PopGame } from "@/components/pop-game";
import "./pop.css";
export const metadata: Metadata = {
  title: "Bubble Calm · 解压泡泡纸",
  description:
    "A calm, endless sheet of bubble wrap: press, swipe and pop with crisp sounds and sparkles. No timer, no score.",
};
export default function PopPage() {
  return <PopGame />;
}
