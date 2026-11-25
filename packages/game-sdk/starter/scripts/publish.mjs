import { readFile } from "node:fs/promises";

const uploadKey = process.env.DINGN_UPLOAD_KEY?.trim();
const reviewKey = process.env.DINGN_REVIEW_KEY?.trim();
if (!uploadKey) {
  console.error(
    "Set DINGN_UPLOAD_KEY in GitHub Actions secrets before publishing.",
  );
  process.exit(1);
}

const manifestUrl = new URL("../game.json", import.meta.url);
const { id, version, category } = JSON.parse(
  await readFile(manifestUrl, "utf8"),
);
const archive = new URL(`../release/${id}-${version}.zip`, import.meta.url);

async function post(path, key, body, contentType = "application/json") {
  const response = await fetch(new URL(path, "https://dingn.com"), {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": contentType },
    body,
    redirect: "error",
    signal: AbortSignal.timeout(60_000),
  });
  return { response, result: await response.json().catch(() => null) };
}

function requireSuccess(operation, response, result) {
  if (response.ok) return;
  const reason = /^[a-z][a-z0-9-]{0,49}$/.test(result?.error ?? "")
    ? ` (${result.error})`
    : "";
  throw new Error(
    `dingn ${operation} failed with HTTP ${response.status}${reason}.`,
  );
}

function isOlderVersion(candidate, live) {
  if (!live) return false;
  const candidateParts = candidate.split(".").map(Number);
  const liveParts = live.split(".").map(Number);
  const firstDifference = candidateParts.findIndex(
    (part, index) => part !== liveParts[index],
  );
  return (
    firstDifference !== -1 &&
    candidateParts[firstDifference] < liveParts[firstDifference]
  );
}

async function publish() {
  const upload = await post(
    "/api/developer/games/upload",
    uploadKey,
    await readFile(archive),
    "application/zip",
  );
  const alreadyUploaded =
    upload.response.status === 409 && upload.result?.error === "version-exists";
  if (!alreadyUploaded)
    requireSuccess("upload", upload.response, upload.result);
  console.log(
    alreadyUploaded
      ? `${id} ${version} is already uploaded.`
      : `Uploaded ${id} ${version}.`,
  );

  if (!reviewKey) {
    console.log(
      "::warning::Set DINGN_REVIEW_KEY in the repository’s Actions secrets for automatic approval.",
    );
    return;
  }

  // A rerun after an interrupted review can resume with the existing upload.
  let game = upload.result?.game;
  if (alreadyUploaded) {
    const { response, result } = await post(
      "/api/admin/games",
      reviewKey,
      "{}",
    );
    requireSuccess("review lookup", response, result);
    game = result?.games?.find((entry) => entry.id === id);
  }
  const release = game?.versions?.find((entry) => entry.version === version);
  if (game?.id !== id || !release)
    throw new Error(`dingn did not return ${id} ${version} for review.`);
  if (game.live === version) {
    console.log(`${id} ${version} is already live.`);
    return;
  }
  if (release.rejected)
    throw new Error(
      `${id} ${version} was sent back by a reviewer. Upload a new version.`,
    );
  if (
    release.reviewed ||
    game.beta !== version ||
    isOlderVersion(version, game.live)
  ) {
    console.log(
      `Skipped approval for ${id} ${version} because it was superseded.`,
    );
    return;
  }

  const { response, result } = await post(
    "/api/admin/games/update",
    reviewKey,
    JSON.stringify({
      id,
      action: "set-live",
      version,
    }),
  );
  requireSuccess("approval", response, result);
  if (result?.game?.id !== id || result.game.live !== version) {
    throw new Error(`dingn did not confirm that ${id} ${version} is live.`);
  }
  console.log(`Published ${id} ${version} at https://dingn.com/play/${id}/`);
  if (result.game.status === "listed" && result.game.category === category) {
    console.log(`Listed under ${category} at https://dingn.com/${category}/`);
  } else {
    console.log(
      `::warning::dingn did not confirm a ${category} catalog listing for ${id}.`,
    );
  }
}

try {
  await publish();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
