"use client";
// Games admin: the review queue of developers' uploads, players' reports, and
// every published version of every game, with buttons to make a version live
// (a release, an approval or a rollback), send an upload back, set or clear
// the beta, show or hide a game in the catalog, and take a game down.
// Who may upload or administer is on the Users page (admin-users.tsx).
import { pick, type Locale } from "@/lib/i18n";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useLocale } from "./locale";
import { useSession } from "./session";
import {
  changeGame,
  closeReport,
  createReviewKey,
  listGames,
  listReports,
  listReviewKeys,
  revokeReviewKey,
  type AdminGame,
  type GameChange,
  type Report,
  type ReviewKey,
} from "@/lib/admin-games";

const REASON_LABELS: Record<Report["reason"], string> = {
  broken: "Does not work",
  offensive: "Offensive or not for children",
  unsafe: "Unsafe or a scam",
  copyright: "Copies someone else's work",
  other: "Something else",
};

const titleIn = (game: AdminGame, version: string, locale: Locale) => {
  const v =
    game.versions.find((x) => x.version === version) ?? game.versions[0];
  return v ? pick(v.title, locale) : game.id;
};

export function AdminGames() {
  const { user } = useSession();
  return (
    <AdminOnly path="/admin/games/">
      <GameList key={user?.uid} />
    </AdminOnly>
  );
}

/** Shows `children` only to a signed-in admin; asks anyone else to sign in. */
export function AdminOnly({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) {
  const { t, href } = useLocale();
  const { user, ready, isAdmin } = useSession();
  if (!ready)
    return (
      <div className="center-page">
        <p role="status">{t("Checking access…")}</p>
      </div>
    );
  if (!user)
    return (
      <div className="center-page">
        <section className="panel signin-panel">
          <h1>{t("Admin sign-in")}</h1>
          <p>{t("Sign in with an account that has admin access.")}</p>
          <Link
            className="button"
            href={`${href("/signin/")}?next=${encodeURIComponent(href(path))}`}
          >
            {t("Sign in")}
          </Link>
        </section>
      </div>
    );
  if (!isAdmin)
    return (
      <div className="center-page">
        <section className="panel signin-panel">
          <h1>{t("Admin access required")}</h1>
          <p>{t("Your account does not have permission to manage dingn.")}</p>
          <Link href={href("/")}>{t("Back to games")}</Link>
        </section>
      </div>
    );
  return <>{children}</>;
}

function GameList() {
  const { t } = useLocale();
  const [games, setGames] = useState<AdminGame[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    listGames()
      .then(setGames)
      .catch(() => setError(t("Games could not be loaded. Try again.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function apply(game: AdminGame, change: GameChange, done: string) {
    setBusy(game.id);
    setError("");
    setNotice("");
    try {
      const updated = await changeGame(game.id, change);
      setGames(
        (list) =>
          list?.map((g) =>
            g.id === updated.id
              ? { ...updated, plays: g.plays }
              : // Featuring a game unpins the others in its category.
                change.action === "feature" && g.category === updated.category
                ? { ...g, featuredAt: null }
                : // The home page features one game.
                  change.action === "feature-home"
                  ? { ...g, homeAt: null }
                  : g,
          ) ?? null,
      );
      setNotice(done);
      return true;
    } catch (error) {
      const code = (error as { code?: string }).code;
      setError(
        code === "user-not-found"
          ? t(
              "No dingn account uses that email. Ask them to sign in once first.",
            )
          : code === "already-owned"
            ? t("That game already belongs to a developer.")
            : code === "not-a-developer"
              ? t(
                  "That account is not a developer yet. Sign it up on My games first, by accepting the developer agreement.",
                )
              : t("That change could not be saved. Try again."),
      );
      return false;
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="container admin-games">
      <p className="eyebrow">{t("ADMIN")}</p>
      <h1>{t("Games")}</h1>
      <p className="lede">
        {t(
          "New versions come from GitHub or from invited developers' uploads. Here you choose which version players get: making a developer's upload live is how you approve it. Changes reach players within about 30 seconds.",
        )}
      </p>
      <p role="status" aria-live="polite" className="admin-games-notice">
        {notice}
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!games && !error && <p role="status">{t("Loading games…")}</p>}
      {games && <ReviewQueue games={games} busy={busy} apply={apply} />}
      {games && <Reports games={games} busy={busy} apply={apply} />}
      {games?.length === 0 && <p>{t("No games have been published yet.")}</p>}
      {games?.map((game) => (
        <GameCard
          key={game.id}
          game={game}
          busy={busy === game.id}
          apply={apply}
        />
      ))}
      <ReviewKeys />
    </div>
  );
}

/**
 * Review keys: approve or reject uploads from a script or an assistant
 * without this page. A key can only list games and approve or reject a
 * version. A new key is shown once; dingn keeps only a hash of it.
 */
function ReviewKeys() {
  const { t, locale } = useLocale();
  const [keys, setKeys] = useState<ReviewKey[] | null>(null);
  const [name, setName] = useState("");
  const [created, setCreated] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  useEffect(() => {
    listReviewKeys()
      .then((result) => setKeys(result.keys))
      .catch(() => setProblem(t("Review keys could not be loaded.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(work: () => Promise<{ keys: ReviewKey[]; key?: string }>) {
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
    const result = await run(() => createReviewKey(name));
    if (result?.key) {
      setCreated(result.key);
      setName("");
    }
  }
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { dateStyle: "medium" });

  return (
    <section className="admin-keys" aria-labelledby="admin-keys-title">
      <h2 id="admin-keys-title">{t("Review keys")}</h2>
      <p>
        {t(
          "A review key lets a script or an assistant review games for you: it can list the games and approve or reject a version, and nothing else. Send POST requests to https://dingn.com/api/admin/games and https://dingn.com/api/admin/games/update with the header Authorization: Bearer followed by the key. A key stops working when it is revoked or its account is no longer an admin.",
        )}
      </p>
      {created && (
        <div role="status" className="admin-key-new">
          <p>{t("Copy your new key now. dingn shows it only once.")}</p>
          <code className="admin-key">{created}</code>
        </div>
      )}
      <form className="admin-key-form" onSubmit={create}>
        <label htmlFor="admin-key-name" className="sr-only">
          {t("Key name")}
        </label>
        <input
          id="admin-key-name"
          value={name}
          maxLength={60}
          placeholder={t("Key name, such as Claude")}
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
        <p role="alert" className="error">
          {problem}
        </p>
      )}
      {keys && keys.length > 0 && (
        <ul className="admin-key-list">
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
                        `Revoke ${key.name}? Anything using it will stop working.`,
                      ),
                    )
                  )
                    void run(() => revokeReviewKey(key.id));
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

type Apply = (
  game: AdminGame,
  change: GameChange,
  done: string,
) => Promise<boolean>;

/** Asks for a reason, which the developer receives by email. */
function askReason(question: string) {
  const reason = window.prompt(question)?.trim() ?? "";
  return reason.slice(0, 500);
}

/** Developers' uploads that nobody has made live or sent back yet. */
function ReviewQueue({
  games,
  busy,
  apply,
}: {
  games: AdminGame[];
  busy: string;
  apply: Apply;
}) {
  const { t, locale, href } = useLocale();
  const waiting = games.flatMap((game) =>
    game.owner && game.status !== "removed"
      ? game.versions
          .filter((v) => !v.reviewed && !v.rejected)
          .map((v) => ({ game, version: v }))
      : [],
  );
  return (
    <section className="panel admin-game" aria-labelledby="admin-review">
      <h2 id="admin-review">
        {t("Waiting for review")} ({waiting.length})
      </h2>
      {waiting.length === 0 ? (
        <p>{t("No uploads are waiting.")}</p>
      ) : (
        <ul className="admin-queue">
          {waiting.map(({ game, version: v }) => {
            const title = titleIn(game, v.version, locale);
            return (
              <li key={`${game.id}@${v.version}`}>
                <span>
                  <strong>{title}</strong> <code>{game.id}</code> {v.version} ·{" "}
                  {game.owner}
                </span>
                <span className="admin-version-actions">
                  <a
                    href={`${href(`/play/${game.id}/`)}?v=${v.version}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("Try it")}
                  </a>
                  <button
                    type="button"
                    className="button small"
                    disabled={busy === game.id}
                    onClick={() => {
                      if (
                        window.confirm(
                          t(`Approve ${title} ${v.version} and make it live?`),
                        )
                      )
                        void apply(
                          game,
                          { action: "set-live", version: v.version },
                          t(`${title} ${v.version} is live.`),
                        );
                    }}
                  >
                    {t("Approve")}
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={busy === game.id}
                    onClick={() => {
                      const reason = askReason(
                        t("What should the developer change?"),
                      );
                      if (reason)
                        void apply(
                          game,
                          { action: "reject", version: v.version, reason },
                          t(`${title} ${v.version} was sent back.`),
                        );
                    }}
                  >
                    {t("Send back")}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Players' open reports. */
function Reports({
  games,
  busy,
  apply,
}: {
  games: AdminGame[];
  busy: string;
  apply: Apply;
}) {
  const { t, locale, href } = useLocale();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    listReports()
      .then(setReports)
      .catch(() => setFailed(true));
  }, []);

  async function close(report: Report, action: "dismiss" | "resolve") {
    try {
      await closeReport(report.id, action);
      setReports((list) => list?.filter((r) => r.id !== report.id) ?? null);
    } catch {
      setFailed(true);
    }
  }

  return (
    <section className="panel admin-game" aria-labelledby="admin-reports">
      <h2 id="admin-reports">
        {t("Reports")} ({reports?.length ?? 0})
      </h2>
      {failed && (
        <p role="alert" className="error">
          {t("Reports could not be loaded. Try again.")}
        </p>
      )}
      {reports?.length === 0 && <p>{t("No open reports.")}</p>}
      {reports && reports.length > 0 && (
        <ul className="admin-queue">
          {reports.map((report) => {
            const game = games.find((g) => g.id === report.game);
            const title = game
              ? titleIn(game, report.version, locale)
              : report.game;
            return (
              <li key={report.id}>
                <span>
                  <strong>{title}</strong> <code>{report.game}</code>{" "}
                  {report.version} · {t(REASON_LABELS[report.reason])}
                  {report.details && <> · “{report.details}”</>}
                  <br />
                  <small>
                    {report.reporter} ·{" "}
                    {new Date(report.createdAt).toLocaleString(locale)}
                  </small>
                </span>
                <span className="admin-version-actions">
                  <a
                    href={`${href(`/play/${report.game}/`)}?v=${report.version}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("Try it")}
                  </a>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void close(report, "dismiss")}
                  >
                    {t("Dismiss")}
                  </button>
                  {game && game.status !== "removed" && (
                    <button
                      type="button"
                      className="secondary-button danger"
                      disabled={busy === game.id}
                      onClick={async () => {
                        const reason = askReason(
                          t("Why is this game being taken down?"),
                        );
                        if (
                          reason &&
                          (await apply(
                            game,
                            { action: "take-down", reason },
                            t(`${title} was taken down.`),
                          ))
                        )
                          void close(report, "resolve");
                      }}
                    >
                      {t("Take down")}
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function GameCard({
  game,
  busy,
  apply,
}: {
  game: AdminGame;
  busy: boolean;
  apply: Apply;
}) {
  const { t, locale, href } = useLocale();
  const latest = game.versions[0];
  const title = latest ? pick(latest.title, locale) : game.id;
  const listed = game.status === "listed";
  const removed = game.status === "removed";
  // The category page's name, as the menu shows it.
  const page = {
    casual: "Casual",
    memory: "Memory",
    puzzle: "Puzzle",
    adventure: "Adventure",
  }[game.category ?? "casual"];
  const date = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(locale) : "";

  return (
    <section className="panel admin-game" aria-labelledby={`game-${game.id}`}>
      <div className="admin-game-head">
        <div>
          <h2 id={`game-${game.id}`}>{title}</h2>
          <p className="admin-game-meta">
            <code>{game.id}</code> · {t(`Live: ${game.live ?? t("none")}`)} ·{" "}
            {t(`Beta: ${game.beta ?? t("none")}`)} ·{" "}
            {removed
              ? t("Taken down")
              : listed
                ? t("Shown in the catalog")
                : t("Hidden from the catalog")}
            {listed && game.featuredAt && (
              <> · {t(`Featured on the ${page} page`)}</>
            )}
            {listed && game.homeAt && <> · {t("Featured on the home page")}</>}
            {game.owner && <> · {t(`Uploaded by ${game.owner}`)}</>}
            {game.plays && (
              <>
                {" "}
                ·{" "}
                {t(
                  `Plays: ${game.plays.week} this week, ${game.plays.month} in 30 days, ${game.plays.total} in all`,
                )}
              </>
            )}
          </p>
          {removed && (
            <p className="error">
              {t("Taken down:")} {game.removedReason}
            </p>
          )}
        </div>
        {removed ? (
          <div className="admin-game-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() =>
                apply(game, { action: "restore" }, t(`${title} is back.`))
              }
            >
              {t("Restore")}
            </button>
          </div>
        ) : (
          <div className="admin-game-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() =>
                apply(
                  game,
                  { action: listed ? "unlist" : "list" },
                  listed
                    ? t(`${title} is hidden from the catalog.`)
                    : t(`${title} is shown in the catalog.`),
                )
              }
            >
              {listed ? t("Hide from catalog") : t("Show in catalog")}
            </button>
            {listed && game.live && (
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                aria-pressed={!!game.featuredAt}
                onClick={() =>
                  apply(
                    game,
                    { action: game.featuredAt ? "unfeature" : "feature" },
                    game.featuredAt
                      ? t(
                          `${title} is no longer featured. The ${page} page picks its banner game itself.`,
                        )
                      : t(`${title} is featured on the ${page} page.`),
                  )
                }
              >
                {game.featuredAt
                  ? t("Stop featuring")
                  : t(`Feature on the ${page} page`)}
              </button>
            )}
            {listed && game.live && (
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                aria-pressed={!!game.homeAt}
                onClick={() =>
                  apply(
                    game,
                    { action: game.homeAt ? "unfeature-home" : "feature-home" },
                    game.homeAt
                      ? t(
                          `${title} is off the home page. The home page picks its game itself.`,
                        )
                      : t(`${title} is featured on the home page.`),
                  )
                }
              >
                {game.homeAt
                  ? t("Take off the home page")
                  : t("Feature on the home page")}
              </button>
            )}
            {game.beta && (
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() =>
                  apply(
                    game,
                    { action: "clear-beta" },
                    t(`${title} has no beta now.`),
                  )
                }
              >
                {t("Clear beta")}
              </button>
            )}
            {!game.owner && (
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => {
                  const email = window
                    .prompt(
                      t(
                        "Email of the developer account that will publish this game. It must have signed up as a developer.",
                      ),
                    )
                    ?.trim();
                  if (email)
                    void apply(
                      game,
                      { action: "transfer", email },
                      t(`${title} now belongs to ${email}.`),
                    );
                }}
              >
                {t("Transfer to a developer")}
              </button>
            )}
            <button
              type="button"
              className="secondary-button danger"
              disabled={busy}
              onClick={() => {
                const reason = askReason(
                  t("Why is this game being taken down?"),
                );
                if (reason)
                  void apply(
                    game,
                    { action: "take-down", reason },
                    t(`${title} was taken down.`),
                  );
              }}
            >
              {t("Take down")}
            </button>
          </div>
        )}
      </div>
      <table className="admin-game-versions">
        <thead>
          <tr>
            <th scope="col">{t("Version")}</th>
            <th scope="col">{t("Published")}</th>
            <th scope="col">
              <span className="sr-only">{t("Actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {game.versions.map((v) => {
            const isLive = v.version === game.live;
            const isBeta = v.version === game.beta;
            return (
              <tr key={v.version} aria-current={isLive ? "true" : undefined}>
                <th scope="row">
                  {v.version}
                  {isLive && (
                    <span className="admin-tag live">{t("Live")}</span>
                  )}
                  {isBeta && (
                    <span className="admin-tag beta">{t("Beta")}</span>
                  )}
                  {!v.reviewed && !v.rejected && (
                    <span className="admin-tag review">
                      {t("Needs review")}
                    </span>
                  )}
                  {v.rejected && (
                    <span className="admin-tag review" title={v.rejected}>
                      {t("Sent back")}
                    </span>
                  )}
                </th>
                <td>{date(v.publishedAt)}</td>
                <td className="admin-version-actions">
                  <a
                    href={`${href(`/play/${game.id}/`)}?v=${v.version}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("Try it")}
                  </a>
                  {!isLive && !removed && (
                    <button
                      type="button"
                      className="button small"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            t(`Make ${v.version} the version everyone plays?`),
                          )
                        )
                          void apply(
                            game,
                            { action: "set-live", version: v.version },
                            t(`${title} ${v.version} is live.`),
                          );
                      }}
                    >
                      {t("Make live")}
                    </button>
                  )}
                  {!isBeta && !isLive && !removed && (
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={busy}
                      onClick={() =>
                        apply(
                          game,
                          { action: "set-beta", version: v.version },
                          t(`${title} ${v.version} is the beta.`),
                        )
                      }
                    >
                      {t("Make beta")}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
