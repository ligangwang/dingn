// The friend's challenge this browser arrived through, so that when the
// visitor makes a new dingn account and opens a game, they and the friend
// who challenged them both get coins (scripts/referrals.mjs). The first
// challenge a browser arrives through counts. The state moves from "pending"
// (not yet claimed) to "joined" (paid; the friend gets more if the visitor
// comes back another day) to "done".
import { api } from "@/lib/api";
import { madeHere } from "@/lib/my-challenges";

const KEY = "dingn.referral.v1";
type State = "pending" | "joined" | "done";
type Saved = { challenge: string; state: State };
export type ReferralResult = {
  state: "joined" | "returned" | "waiting" | "none";
  coins?: number;
};

function read(): Saved | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return saved && typeof saved.challenge === "string" ? saved : null;
  } catch {
    return null;
  }
}
function write(saved: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // Storage blocked: no referral coins from this browser.
  }
}

/** Notes the challenge a visitor arrived through, unless one is noted or it is their own. */
export function noteArrival(challenge: string) {
  if (read() || madeHere(challenge)) return;
  write({ challenge, state: "pending" });
}

/** Whether this browser still has a referral to claim or follow up. */
export const referralOpen = () => {
  const saved = read();
  return !!saved && saved.state !== "done";
};

/**
 * Asks dingn to pay for the noted referral, for a signed-in player. Returns
 * dingn's answer, or null when there is nothing to claim or it failed.
 */
export async function claimReferral(): Promise<ReferralResult | null> {
  const saved = read();
  if (!saved || saved.state === "done") return null;
  let result: ReferralResult;
  try {
    result = await api<ReferralResult>("/api/referrals", {
      challenge: saved.challenge,
    });
  } catch {
    return null;
  }
  const state: State =
    result.state === "joined" ||
    (result.state === "waiting" && saved.state === "pending")
      ? "joined"
      : result.state === "waiting"
        ? saved.state
        : "done";
  write({ ...saved, state });
  return result;
}
