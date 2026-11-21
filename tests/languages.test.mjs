// Language packs (locales/*.json) and how dingn uses them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  checkPack,
  generated,
  localeList,
  readPacks,
} from "../scripts/build-locales.mjs";
import {
  localeFromPath,
  localePath,
  matchLocale,
  stripLocale,
  translate,
} from "../scripts/i18n.mjs";
import {
  localizedRedirect,
  retiredRedirect,
} from "../scripts/locale-redirect.mjs";
import { publicGame, validateManifest } from "../scripts/game-registry.mjs";

const packs = readPacks("locales");

test("every pack is well formed and the language list matches the packs", () => {
  assert.deepEqual(packs.map((p) => p.lang).sort(), [
    "es",
    "id",
    "ja",
    "ko",
    "pt-BR",
    "zh-CN",
  ]);
  // The committed list is what build-locales writes from the packs.
  assert.equal(
    readFileSync("src/data/locales.gen.mjs", "utf8"),
    generated(localeList(packs)),
    "Run node scripts/build-locales.mjs",
  );
});

test("every pack has all the text the Chinese one has", () => {
  const reference = Object.keys(packs.find((p) => p.lang === "zh-CN").strings);
  for (const pack of packs) {
    const missing = reference.filter((k) => !Object.hasOwn(pack.strings, k));
    assert.deepEqual(missing.slice(0, 10), [], `${pack.lang} lacks text`);
  }
});

test("a pack with problems says what to fix", () => {
  const problems = checkPack(
    {
      name: "",
      lang: "spanish",
      path: "es",
      strings: { "Level {0}": "Nivel", Play: " " },
    },
    "bad.json",
  );
  assert.equal(problems.length, 5, problems.join("\n"));
  assert.match(problems.join("\n"), /placeholders differ: Level \{0\}/);
});

test("pages map between languages by their prefix", () => {
  assert.equal(localeFromPath("/es/casual/"), "es");
  assert.equal(localeFromPath("/pt/"), "pt-BR");
  assert.equal(localeFromPath("/zh"), "zh-CN");
  assert.equal(localeFromPath("/casual/"), "en");
  assert.equal(localeFromPath("/estate/"), "en");
  assert.equal(stripLocale("/ja/play/gemsurge/"), "/play/gemsurge/");
  assert.equal(stripLocale("/ko"), "/");
  assert.equal(localePath("/es/casual/", "ko"), "/ko/casual/");
  assert.equal(localePath("/zh/", "en"), "/");
  assert.equal(localePath("https://x.com/", "es"), "https://x.com/");
});

test("a browser's languages pick the closest one dingn speaks", () => {
  assert.equal(matchLocale("pt-PT,pt;q=0.9,en;q=0.8"), "pt-BR");
  assert.equal(matchLocale(["es-MX", "en"]), "es");
  assert.equal(matchLocale("zh-TW"), "zh-CN");
  assert.equal(matchLocale("fr-FR,de"), "en");
  assert.equal(matchLocale(""), "en");
});

test("text is translated by its pack, and English stays as it is", () => {
  assert.equal(translate("Sign in", "es"), "Iniciar sesión");
  assert.equal(translate("Sign in", "en"), "Sign in");
  // Patterns carry numbers and names.
  assert.match(translate("Level 12", "ja"), /12/);
  // Text no pack has stays English.
  assert.equal(
    translate("Not translated anywhere", "ko"),
    "Not translated anywhere",
  );
});

test("old links move to the right language", () => {
  assert.equal(localizedRedirect("/casual/?lang=es-MX"), "/es/casual/");
  assert.equal(localizedRedirect("/ja/casual/?lang=en"), "/casual/");
  assert.equal(localizedRedirect("/en/puzzle/"), "/puzzle/");
  assert.equal(retiredRedirect("/ko/word/"), "/ko/play/memory/#word");
  assert.equal(retiredRedirect("/es/logic/"), "/es/");
  assert.equal(localizedRedirect("/es/casual/"), null);
});

test("a game lists its languages and may title itself in each", () => {
  const m = validateManifest({
    id: "skyhop",
    version: "1.0.0",
    title: { en: "Sky Hop", zh: "跳跳云", es: "Salto al cielo" },
    description: { en: "Hop", "pt-BR": "Pule" },
    languages: ["en", "zh-CN", "es"],
  });
  assert.equal(m.title.es, "Salto al cielo");
  assert.equal(m.description["pt-BR"], "Pule");
  assert.deepEqual(m.languages, ["en", "zh-CN", "es"]);
  for (const bad of [
    { languages: ["es"] },
    { languages: ["en", "en"] },
    { languages: ["en", "Spanish"] },
    { languages: "en" },
    { title: { en: "a", zh: "b", Spanish: "c" } },
  ])
    assert.throws(
      () =>
        validateManifest({
          id: "skyhop",
          version: "1.0.0",
          title: { en: "a", zh: "b" },
          ...bad,
        }),
      /game.json is invalid/,
      JSON.stringify(bad),
    );
  // Games that list none speak English and Chinese.
  const record = {
    id: "skyhop",
    status: "listed",
    live: "1.0.0",
    versions: {
      "1.0.0": {
        ...validateManifest({
          id: "skyhop",
          version: "1.0.0",
          title: { en: "a", zh: "b" },
        }),
        publishedAt: "2026-11-01T00:00:00Z",
        reviewedAt: "2026-11-01T00:00:00Z",
      },
    },
  };
  assert.deepEqual(publicGame(record, "").languages, ["en", "zh-CN"]);
});
