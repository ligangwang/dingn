// The player page's calls about a game: counting a play and reporting a
// problem (scripts/game-stats.mjs, scripts/game-reports.mjs).
import { api } from "./api";

export const REPORT_REASONS = [
  "broken",
  "offensive",
  "unsafe",
  "copyright",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export async function reportGame(report: {
  id: string;
  version: string;
  reason: ReportReason;
  details: string;
}) {
  await api("/api/game-reports", report);
}

/** Counts one play of a game. Never fails the page. */
export function countPlay(id: string, version: string) {
  void api("/api/game-plays", { id, version }).catch(() => {});
}
