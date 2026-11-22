// The kingdom API (scripts/kingdom.mjs), which the kingdom's pages
// (kingdom/ui, given to them in src/components/kingdom.tsx) call.
import { api } from "./api";
import type { KingdomView } from "kingdom/ui";
export type { KingdomView } from "kingdom/ui";

export const fetchKingdom = () => api<KingdomView>("/api/kingdom/me");
export const buildInKingdom = (building: string, x?: number, y?: number) =>
  api<KingdomView & { paid: number }>("/api/kingdom/build", { building, x, y });
export const moveInKingdom = (from: [number, number], to: [number, number]) =>
  api<KingdomView>("/api/kingdom/move", { from, to });
