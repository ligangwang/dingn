import { localePath, stripLocale, type Locale } from "./i18n";
export type CardSide = "OneSide" | "TwoSides";
export type Profile = { userName: string; cardSide: CardSide; avatar: string };
/** Preset avatars a player can pick. "" means the default (sign-in photo, else initials). */
export const avatarPresets = [
  { id: "fox", emoji: "🦊", color: "#ff9f43" },
  { id: "panda", emoji: "🐼", color: "#dfe6e9" },
  { id: "tiger", emoji: "🐯", color: "#fdcb6e" },
  { id: "frog", emoji: "🐸", color: "#55efc4" },
  { id: "octopus", emoji: "🐙", color: "#fd79a8" },
  { id: "owl", emoji: "🦉", color: "#a29bfe" },
  { id: "koala", emoji: "🐨", color: "#81ecec" },
  { id: "monkey", emoji: "🐵", color: "#e17055" },
  { id: "unicorn", emoji: "🦄", color: "#f8a5c2" },
  { id: "dragon", emoji: "🐲", color: "#00b894" },
  { id: "robot", emoji: "🤖", color: "#74b9ff" },
  { id: "rocket", emoji: "🚀", color: "#6c5ce7" },
] as const;
export const avatarChoices = [
  "",
  "initials",
  ...avatarPresets.map((a) => a.id),
];
function avatarFromData(value: unknown) {
  return typeof value === "string" && avatarChoices.includes(value)
    ? value
    : "";
}
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
export const defaultProfile: Profile = {
  userName: "",
  cardSide: "OneSide",
  avatar: "",
};
export function profileFromData(data: Record<string, unknown> = {}): Profile {
  return {
    userName: typeof data.user_name === "string" ? data.user_name : "",
    cardSide: data.card_side === "TwoSides" ? "TwoSides" : "OneSide",
    avatar: avatarFromData(data.avatar),
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
    avatar: avatarFromData(profile.avatar),
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
export function safeDestination(value: string | null, locale: Locale = "en") {
  return [
    "/memory-ladder/",
    "/word/",
    "/number/",
    "/card/",
    "/account/",
    "/",
    "/admin/feedback/",
    "/logic/",
    "/decisions/",
    "/crowd/",
  ].includes(stripLocale(value ?? ""))
    ? value!
    : localePath("/", locale);
}
export function friendlyError(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  if (code.includes("invalid-credential") || code.includes("sign-in-required"))
    return "Check your email and password, then try signing in again.";
  if (code.includes("email-already-in-use"))
    return "Unable to create this account. Try signing in instead.";
  if (code.includes("weak-password"))
    return "Choose a stronger password with at least 8 characters.";
  if (code.includes("too-many-requests"))
    return "Too many attempts. Please wait a minute and try again.";
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
