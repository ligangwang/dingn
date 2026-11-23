// The preset avatars a player can pick, shared by the website
// (src/lib/models.ts, src/components/avatar.tsx) and the server, which draws
// them in the pages it fills (scripts/game-seo.mjs).
export const avatarPresets = /** @type {const} */ ([
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
]);
