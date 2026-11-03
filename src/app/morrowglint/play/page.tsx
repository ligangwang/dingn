import type { Metadata } from "next";
import { MorrowglintGame } from "@/components/morrowglint-game";
import "./play.css";
export const metadata: Metadata = {
  title: "Morrowglint — The First Light",
  description:
    "Play the first Morrowglint 3D prototype: clear the shadows, recall the runes, and rescue a light companion.",
};
export default function PlayPage() {
  return <MorrowglintGame />;
}
