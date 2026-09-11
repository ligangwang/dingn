export type CardSide = "OneSide" | "TwoSides";
export type Profile = { userName: string; cardSide: CardSide };
export type NumberEntry = {
  number: string;
  words: string[];
  favorite: string | null;
};
export type WordEntry = {
  word: string;
  ipa: string;
  language: string;
  number: string;
  definitions: Record<string, string[]>;
};
export const defaultProfile: Profile = { userName: "", cardSide: "OneSide" };
export function profileFromData(data: Record<string, unknown> = {}): Profile {
  return {
    userName: typeof data.user_name === "string" ? data.user_name : "",
    cardSide: data.card_side === "TwoSides" ? "TwoSides" : "OneSide",
  };
}
export function numberFromData(
  id: string,
  data: Record<string, unknown>,
): NumberEntry {
  return {
    number: String(data.number ?? id),
    words: Array.isArray(data.words) ? data.words.map(String) : [],
    favorite:
      typeof data.most_favorite_word === "string"
        ? data.most_favorite_word
        : null,
  };
}
export function wordFromData(
  id: string,
  data: Record<string, unknown>,
): WordEntry {
  const definitions: Record<string, string[]> = {};
  if (data.pos && typeof data.pos === "object")
    for (const [key, value] of Object.entries(data.pos))
      definitions[key] = Array.isArray(value)
        ? value.map(String)
        : [String(value)];
  return {
    word: String(data.word ?? id),
    ipa: String(data.ipa ?? ""),
    language: String(data["ipa-lang"] ?? ""),
    number: String(data.number ?? ""),
    definitions,
  };
}
export function favoriteRecord(uid: string, number: string, word: string) {
  if (!uid || !/^\d{1,4}$/.test(number) || !word.trim())
    throw new Error("Invalid favorite");
  return { id: `${uid}-${number}`, data: { uid, number, favoriteWord: word } };
}
export function profileRecord(profile: Profile) {
  return {
    user_name: profile.userName.trim().slice(0, 80),
    card_side: profile.cardSide,
  };
}
export const soundGuide = [
  "s, z",
  "t, d",
  "n",
  "m",
  "r",
  "l",
  "tʃ, dʒ, ʃ, ʒ",
  "k, ɡ",
  "f, v",
  "p, b",
];
const suits = [
  { id: "C", symbol: "♣", name: "clubs", number: "7" },
  { id: "D", symbol: "♦", name: "diamonds", number: "1" },
  { id: "H", symbol: "♥", name: "hearts", number: "4" },
  { id: "S", symbol: "♠", name: "spades", number: "0" },
];
const ranks = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
];
const faces: Record<string, string> = { J: "67", Q: "72", K: "77", A: "0" };
export const deck = suits.flatMap((suit) =>
  ranks.map((rank) => ({
    id: suit.id + rank,
    rank,
    symbol: suit.symbol,
    name: `${rank} of ${suit.name}`,
    number: suit.number + (faces[rank] ?? rank),
    red: suit.id === "D" || suit.id === "H",
  })),
);
export function shuffle<T>(items: readonly T[], random = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
export function safeDestination(value: string | null) {
  return [
    "/word/",
    "/number/",
    "/card/",
    "/account/",
    "/",
    "/admin/feedback/",
  ].includes(value ?? "")
    ? value!
    : "/";
}
export function friendlyError(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  if (code.includes("popup-closed") || code.includes("cancelled-popup"))
    return "Sign-in was cancelled. You can try again when you’re ready.";
  if (code.includes("popup-blocked"))
    return "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.";
  if (code.includes("unauthorized-domain"))
    return "Sign-in is not enabled for this preview address yet. Please use dingn.com or contact support.";
  if (code.includes("permission-denied"))
    return "Your account does not have access to this data. Please contact support.";
  if (code.includes("network") || code.includes("unavailable"))
    return "We couldn’t connect. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}
