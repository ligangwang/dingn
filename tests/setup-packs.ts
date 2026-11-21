// Every language pack, as the language layouts (src/app/[lang]/layout.tsx)
// hand each page its own, so components render in any language in tests.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { registerPack } from "../src/lib/i18n";

const dir = path.resolve("locales");
for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const pack = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
  registerPack(pack.lang, pack.strings);
}
