import type { Metadata } from "next";
import { CrowdGame } from "@/components/crowd-game";
import "./crowd.css";
export const metadata: Metadata = {
  title: "Crowd Rush · 人潮突击",
  description:
    "Grow your squad through number gates, blast crates and rival squads, and take down the boss at the end of every level.",
};
export default function CrowdPage() {
  return <CrowdGame />;
}
