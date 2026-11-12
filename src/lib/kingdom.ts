// The kingdom API (scripts/kingdom.mjs). The rules are in src/data/kingdom.mjs.
import { api } from "./api";
import type { StageId } from "@/data/kingdom.mjs";

export type KingdomView = {
  level: number;
  xp: number;
  floor: number;
  next: number;
  /** The furthest stage the account level opens, or null below level 2. */
  stage: StageId | null;
  size: number;
  hall: StageId;
  tiles: Record<string, string>;
  coins: number;
};

export const fetchKingdom = () => api<KingdomView>("/api/kingdom/me");
export const buildInKingdom = (building: string, x?: number, y?: number) =>
  api<KingdomView & { paid: number }>("/api/kingdom/build", { building, x, y });
export const moveInKingdom = (from: [number, number], to: [number, number]) =>
  api<KingdomView>("/api/kingdom/move", { from, to });
