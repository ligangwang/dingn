"use client";
// Games admin: every published version of every game, with buttons to make a
// version live (a release or a rollback), set or clear the beta, and show or
// hide a game in the catalog. New versions are published from GitHub.
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "./locale";
import { useSession } from "./session";
import {
  changeGame,
  listGames,
  type AdminGame,
  type GameChange,
} from "@/lib/admin-games";

export function AdminGames() {
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
            href={`${href("/signin/")}?next=${encodeURIComponent(href("/admin/games/"))}`}
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
          <p>{t("Your account does not have permission to manage games.")}</p>
          <Link href={href("/")}>{t("Back to games")}</Link>
        </section>
      </div>
    );
  return <GameList key={user.uid} />;
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
        (list) => list?.map((g) => (g.id === updated.id ? updated : g)) ?? null,
      );
      setNotice(done);
    } catch {
      setError(t("That change could not be saved. Try again."));
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
          "New versions are published from GitHub. Here you choose which published version players get. Changes reach players within about 30 seconds.",
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
      {games?.length === 0 && <p>{t("No games have been published yet.")}</p>}
      {games?.map((game) => (
        <GameCard
          key={game.id}
          game={game}
          busy={busy === game.id}
          apply={apply}
        />
      ))}
    </div>
  );
}

function GameCard({
  game,
  busy,
  apply,
}: {
  game: AdminGame;
  busy: boolean;
  apply: (game: AdminGame, change: GameChange, done: string) => Promise<void>;
}) {
  const { t, locale, href } = useLocale();
  const latest = game.versions[0];
  const title = latest
    ? locale === "zh-CN"
      ? latest.title.zh
      : latest.title.en
    : game.id;
  const listed = game.status === "listed";
  const date = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString(locale === "zh-CN" ? "zh-CN" : "en")
      : "";

  return (
    <section className="panel admin-game" aria-labelledby={`game-${game.id}`}>
      <div className="admin-game-head">
        <div>
          <h2 id={`game-${game.id}`}>{title}</h2>
          <p className="admin-game-meta">
            <code>{game.id}</code> · {t(`Live: ${game.live ?? t("none")}`)} ·{" "}
            {t(`Beta: ${game.beta ?? t("none")}`)} ·{" "}
            {listed ? t("Shown in the catalog") : t("Hidden from the catalog")}
          </p>
        </div>
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
        </div>
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
                  {!isLive && (
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
                  {!isBeta && !isLive && (
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
