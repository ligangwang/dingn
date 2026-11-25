import { readFile } from "node:fs/promises";

async function upload() {
  const key = process.env.DINGN_UPLOAD_KEY?.trim();
  if (!key) throw new Error("Set DINGN_UPLOAD_KEY in GitHub Actions secrets.");

  const manifest = new URL("../game.json", import.meta.url);
  const { id, version } = JSON.parse(await readFile(manifest, "utf8"));
  const archive = new URL(`../release/${id}-${version}.zip`, import.meta.url);
  const response = await fetch("https://dingn.com/api/developer/games/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/zip",
    },
    body: await readFile(archive),
    redirect: "error",
    signal: AbortSignal.timeout(60_000),
  });
  const result = await response.json().catch(() => null);

  if (response.status === 409 && result?.error === "version-exists") {
    console.log(`${id} ${version} is already uploaded.`);
    return;
  }
  if (!response.ok) {
    const code = /^[a-z][a-z0-9-]{0,49}$/.test(result?.error ?? "")
      ? ` (${result.error})`
      : "";
    throw new Error(`dingn upload failed with HTTP ${response.status}${code}.`);
  }
  console.log(`Uploaded ${id} ${version} for review.`);
}

try {
  await upload();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
