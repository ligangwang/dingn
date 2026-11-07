import type { Metadata } from "next";
import { CrowdGame3D } from "@/components/crowd-game-3d";
import "../crowd/crowd.css";
import "./crowd-3d.css";
export const metadata: Metadata = {
  title: "Crowd Rush 3D · 人潮突击 3D",
  description:
    "Crowd Rush in 3D: grow your squad through number gates, blast crates and monsters, and take down the boss.",
};
export default function Crowd3DPage() {
  return <CrowdGame3D />;
}
