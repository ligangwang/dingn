"use client";
// /developers/games/: where developers sign up (accepting the developer
// agreement) and upload their games. An upload becomes the game's beta, a
// preview that goes live once an admin makes it live on /admin/games/
// (scripts/developer-games.mjs).
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "./locale";
import { useSession } from "./session";
import {
  createUploadKey,
  joinDevelopers,
  listMyGames,
  listUploadKeys,
  revokeUploadKey,
  uploadGame,
  type DeveloperGame,
  type UploadKey,
  type MyGames as MyGamesResult,
  type UploadResult,
} from "@/lib/developer-games";

const PROBLEMS: Record<string, string> = {
  "too-large":
    "The zip is too big. A game can be up to 20 MB zipped and 50 MB unzipped.",
  "too-many-files": "The zip has too many files. A game can have up to 1,000.",
  "invalid-zip":
    "That file is not a zip dingn can read. Make a new zip and try again.",
  "unsupported-zip":
    "That file is not a zip dingn can read. Make a new zip and try again.",
  encrypted: "The zip has a password. Upload it without one.",
  "no-manifest":
    "The zip has no game.json. Put game.json and index.html at the top of the zip.",
  "invalid-manifest": "game.json needs fixing:",
  "bad-file": "These file names cannot be served (hidden or unsafe):",
  "unsupported-type": "These kinds of files are not allowed:",
  "missing-entry": "The zip does not have the entry page named in game.json:",
  "not-your-game":
    "Another game already uses this id. Choose a different id in game.json.",
  "version-exists":
    "This version is already uploaded. Raise version in game.json and zip it again.",
  "upload-in-progress":
    "An upload of this version is still running. Try again in a few minutes.",
  "developer-required": "Your account cannot upload games yet.",
  "too-many-games":
    "You have reached the limit of 10 games. Ask us if you need more.",
  "upload-limit":
    "You have reached today's limit of 20 uploads. Try again tomorrow.",
  "game-removed": "dingn took this game down, so it cannot be updated.",
};

export function DeveloperGames() {
  const { t, href } = useLocale();
  const { user, ready } = useSession();
  if (!ready)
    return (
      <div className="container dev-page">
        <p role="status">{t("Checking access…")}</p>
      </div>
    );
  if (!user)
    return (
      <div className="container dev-page">
        <p className="eyebrow">{t("FOR GAME DEVELOPERS")}</p>
        <h1>{t("My games")}</h1>
        <p>{t("Sign in to upload your games to dingn.")}</p>
        <Link
          className="button"
          href={`${href("/signin/")}?next=${encodeURIComponent(href("/developers/games/"))}`}
        >
          {t("Sign in")}
        </Link>
      </div>
    );
  return <MyGames key={user.uid} />;
}

function MyGames() {
  const { t, href, locale } = useLocale();
  const [state, setState] = useState<
    | { status: "loading" | "error" }
    | { status: "join"; result: MyGamesResult }
    | { status: "ready"; games: DeveloperGame[] }
  >({ status: "loading" });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState<UploadResult | null>(null);

  function load() {
    listMyGames()
      .then((result) =>
        setState(
          result.developer
            ? { status: "ready", games: result.games }
            : { status: "join", result },
        ),
      )
      .catch(() => setState({ status: "error" }));
  }
  useEffect(load, []);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setUploading(true);
    setProblem("");
    setDone(null);
    try {
      const result = await uploadGame(file);
      setDone(result);
      setState((current) =>
        current.status === "ready"
          ? {
              status: "ready",
              games: [
                ...current.games.filter((g) => g.id !== result.game.id),
                result.game,
              ].sort((a, b) => a.id.localeCompare(b.id)),
            }
          : current,
      );
    } catch (error) {
      const { code = "", detail = "" } = error as {
        code?: string;
        detail?: string;
      };
      const text = PROBLEMS[code]
        ? t(PROBLEMS[code])
        : t("The upload did not work. Try again.");
      setProblem(detail ? `${text} ${detail}` : text);
    } finally {
      setUploading(false);
    }
  }

  const titleOf = (game: DeveloperGame) => {
    const latest = game.versions[0];
    if (!latest) return game.id;
    return locale === "zh-CN" ? latest.title.zh : latest.title.en;
  };
  const doneTitle = done
    ? (() => {
        const v = done.game.versions.find((x) => x.version === done.version);
        return v
          ? locale === "zh-CN"
            ? v.title.zh
            : v.title.en
          : done.game.id;
      })()
    : "";

  return (
    <div className="container dev-page">
      <p className="eyebrow">{t("FOR GAME DEVELOPERS")}</p>
      <h1>{t("My games")}</h1>
      {state.status === "loading" && <p role="status">{t("Loading games…")}</p>}
      {state.status === "error" && (
        <p role="alert" className="dev-problem">
          {t("Games could not be loaded. Try again.")}
        </p>
      )}
      {state.status === "join" && (
        <Join result={state.result} onJoined={load} />
      )}
      {state.status === "ready" && (
        <>
          <p>
            {t(
              "Zip your game's folder, with game.json and index.html at the top, and upload it. Each upload needs a new version in game.json. It becomes a preview you can try right away, and goes live once dingn reviews it.",
            )}{" "}
            <Link href={href("/developers/")}>
              {t("Read the developer guide")}
            </Link>
          </p>
          <form className="dev-upload" onSubmit={upload}>
            <label htmlFor="dev-zip">{t("Game zip")}</label>
            <div className="dev-load-row">
              <input
                id="dev-zip"
                type="file"
                accept=".zip,application/zip"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setProblem("");
                }}
              />
              <button
                type="submit"
                className="button"
                disabled={!file || uploading}
              >
                {uploading ? t("Uploading…") : t("Upload")}
              </button>
            </div>
          </form>
          {problem && (
            <p role="alert" className="dev-problem">
              {problem}
            </p>
          )}
          {done && (
            <p role="status" className="dev-done">
              {t(`Uploaded ${doneTitle} ${done.version}.`)}{" "}
              <a href={`${href(`/play/${done.game.id}/`)}?v=${done.version}`}>
                {t("Try it")}
              </a>
            </p>
          )}

          <h2>{t("Your games")}</h2>
          {state.games.length === 0 && (
            <p>{t("You have not uploaded a game yet.")}</p>
          )}
          {state.games.map((game) => (
            <section
              key={game.id}
              className="dev-game"
              aria-labelledby={`dev-game-${game.id}`}
            >
              <h3 id={`dev-game-${game.id}`}>
                {titleOf(game)} <code>{game.id}</code>
              </h3>
              {game.status === "removed" && (
                <p className="dev-problem" role="note">
                  {t("dingn took this game down:")} {game.removedReason}
                </p>
              )}
              {game.plays && (
                <p className="dev-plays">
                  {t(
                    `Plays: ${game.plays.week} this week, ${game.plays.month} in 30 days, ${game.plays.total} in all`,
                  )}
                </p>
              )}
              <div className="dev-table-wrap">
                <table className="dev-table">
                  <thead>
                    <tr>
                      <th scope="col">{t("Version")}</th>
                      <th scope="col">{t("Status")}</th>
                      <th scope="col">
                        <span className="sr-only">{t("Actions")}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {game.versions.map((v) => (
                      <tr key={v.version}>
                        <th scope="row">{v.version}</th>
                        <td>
                          {v.version === game.live
                            ? t("Live")
                            : v.rejected
                              ? `${t("Needs changes:")} ${v.rejected}`
                              : v.reviewed
                                ? t("Reviewed")
                                : t("Waiting for review")}
                        </td>
                        <td>
                          <a
                            href={`${href(`/play/${game.id}/`)}?v=${v.version}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t("Try it")}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
          <UploadKeys />
        </>
      )}
    </div>
  );
}

/**
 * Upload keys: upload from a script or CI (such as a GitHub Action) without
 * this page. A new key is shown once; dingn keeps only a hash of it.
 */
function UploadKeys() {
  const { t, locale } = useLocale();
  const [keys, setKeys] = useState<UploadKey[] | null>(null);
  const [name, setName] = useState("");
  const [created, setCreated] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  useEffect(() => {
    listUploadKeys()
      .then((result) => setKeys(result.keys))
      .catch(() => setProblem(t("Upload keys could not be loaded.")));
  }, []);

  async function run(work: () => Promise<{ keys: UploadKey[]; key?: string }>) {
    setBusy(true);
    setProblem("");
    try {
      const result = await work();
      setKeys(result.keys);
      return result;
    } catch (error) {
      setProblem(
        (error as { code?: string }).code === "too-many-keys"
          ? t("You can have up to 5 keys. Revoke one first.")
          : t("That did not work. Try again."),
      );
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function create(event: React.FormEvent) {
    event.preventDefault();
    const result = await run(() => createUploadKey(name));
    if (result?.key) {
      setCreated(result.key);
      setName("");
    }
  }
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { dateStyle: "medium" });

  return (
    <section className="dev-keys" aria-labelledby="dev-keys-title">
      <h2 id="dev-keys-title">{t("Upload keys")}</h2>
      <p>
        {t(
          "A key lets a script or GitHub Action upload your games, with the same review and limits as this page. Send the zip to https://dingn.com/api/developer/games/upload with the header Authorization: Bearer followed by the key. Keep keys secret, for example as a GitHub secret.",
        )}
      </p>
      {created && (
        <div role="status" className="dev-done">
          <p>{t("Copy your new key now. dingn shows it only once.")}</p>
          <code className="dev-key">{created}</code>
        </div>
      )}
      <form className="dev-load-row" onSubmit={create}>
        <label htmlFor="dev-key-name" className="sr-only">
          {t("Key name")}
        </label>
        <input
          id="dev-key-name"
          value={name}
          maxLength={60}
          placeholder={t("Key name, such as GitHub Actions")}
          onChange={(event) => setName(event.target.value)}
        />
        <button
          type="submit"
          className="button"
          disabled={busy || !name.trim()}
        >
          {t("Create key")}
        </button>
      </form>
      {problem && (
        <p role="alert" className="dev-problem">
          {problem}
        </p>
      )}
      {keys && keys.length > 0 && (
        <ul className="dev-key-list">
          {keys.map((key) => (
            <li key={key.id}>
              <strong>{key.name}</strong> {t(`Created ${date(key.createdAt)}`)}
              {", "}
              {key.lastUsedAt
                ? t(`last used ${date(key.lastUsedAt)}`)
                : t("never used")}{" "}
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      t(
                        `Revoke ${key.name}? Anything using it will stop uploading.`,
                      ),
                    )
                  )
                    void run(() => revokeUploadKey(key.id));
                }}
              >
                {t("Revoke")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Signing up: accept the developer agreement to start uploading. */
function Join({
  result,
  onJoined,
}: {
  result: MyGamesResult;
  onJoined: () => void;
}) {
  const { t, href } = useLocale();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  if (result.blocked)
    return (
      <p>
        {t(
          "Your account can no longer upload games. If you think this is a mistake, tell us.",
        )}{" "}
        <Link href={href("/feedback/")}>{t("Contact dingn")}</Link>
      </p>
    );
  if (result.emailVerified === false)
    return (
      <p>
        {t(
          "To publish games, sign in with an account whose email is verified, such as a Google account. dingn emails you the result of every review.",
        )}
      </p>
    );

  async function join(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem("");
    try {
      await joinDevelopers(result.agreement);
      onJoined();
    } catch {
      setProblem(t("Signing up did not work. Try again."));
      setBusy(false);
    }
  }

  return (
    <form className="dev-join" onSubmit={join}>
      <h2>{t("Publish your games on dingn")}</h2>
      <p>
        {t(
          "Sign up as a developer to upload games. dingn reviews every version before players see it, and emails you the result. You can have up to 10 games and upload up to 20 versions a day.",
        )}
      </p>
      <label className="dev-agree">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
        />{" "}
        {t("I accept the")}{" "}
        <Link href={href("/developers/agreement/")} target="_blank">
          {t("developer agreement")}
        </Link>
      </label>
      {problem && (
        <p role="alert" className="dev-problem">
          {problem}
        </p>
      )}
      <p className="dev-actions">
        <button type="submit" className="button" disabled={!agreed || busy}>
          {busy ? t("Signing up…") : t("Sign up as a developer")}
        </button>
        <Link className="button secondary" href={href("/developers/")}>
          {t("Read the developer guide")}
        </Link>
      </p>
    </form>
  );
}
