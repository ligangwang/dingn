export type Title = { en: string; zh: string };
export type StageId =
  "camp" | "village" | "town" | "city" | "kingdom" | "capital";
export type Stage = { id: StageId; level: number; size: number; title: Title };
export type BuildingDef = {
  id: string;
  stage: StageId;
  coins: number;
  max: number;
  title: Title;
};
export type Kingdom = {
  hall: StageId;
  tiles: Record<string, string>;
  granted: StageId[];
};
export const STAGES: Stage[];
export const STAGE_IDS: StageId[];
export const MIN_LEVEL: number;
export const BADGE_XP: Record<"bronze" | "silver" | "gold" | "diamond", number>;
export const BUILDINGS: BuildingDef[];
export const HALL_TITLES: Record<StageId, Title>;
export const OLD_HALL_COINS: Record<Exclude<StageId, "camp">, number>;
export const STARTERS: Record<StageId, [string, number, number][]>;
export function settle(kingdom: Kingdom, level: number): Kingdom;
export function hallRefund(doc: unknown): number;
export function building(id: string): BuildingDef | null;
export function stageFor(level: number): Stage | null;
export function landBounds(size: number): { lo: number; hi: number };
export function onLand(size: number, x: number, y: number): boolean;
export function tileKey(x: number, y: number): string;
export const HALL_RADIUS: number;
export function isHallTile(x: number, y: number): boolean;
export function kingdomOf(doc: unknown): Kingdom;
export class KingdomError extends Error {
  code: string;
  status: number;
}
export function build(
  kingdom: Kingdom,
  request: { id: string; x?: number; y?: number },
  level: number,
  coins: number,
): { kingdom: Kingdom; coins: number };
export function move(
  kingdom: Kingdom,
  request: { from: [number, number]; to: [number, number] },
  level: number,
): Kingdom;
