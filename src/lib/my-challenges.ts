// The challenge links made in this browser, so a player who opens their own
// link sees it as their own score to beat, even when not signed in (for a
// signed-in player dingn also knows it from their account). Kept in this
// browser only, newest last, at most MAX_KEPT.
const KEY = "dingn.challenges.mine.v1";
export const MAX_KEPT = 100;

function read(): string[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list)
      ? list.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

/** Notes a challenge link made here. */
export function rememberChallenge(id: string) {
  try {
    const list = read().filter((other) => other !== id);
    list.push(id);
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_KEPT)));
  } catch {
    // Storage blocked or full: the link just reads as a friend's.
  }
}

/** Whether the challenge `id` was made in this browser. */
export const madeHere = (id: string) => read().includes(id);
