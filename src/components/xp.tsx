"use client";
import { aroundLink, useLocale } from "@/components/locale";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "./session";
import { HonorAvatar, honorOf } from "./honor";
import {
  fetchLeaderboard,
  finishPlay,
  MIN_PLAY_MS,
  startPlay,
  XpError,
  type GameId,
  type LeaderboardEntry,
  type PlayResult,
} from "@/lib/xp";

type Outcome =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "done"; result: PlayResult }
  | { kind: "error"; message: string };

/**
 * Server-scored play for signed-in players. `begin` asks the server for a
 * new play (and its challenge); `submit` sends the raw answers for scoring.
 * Guests get `null` from begin and no XP.
 */
export function useXpPlay<C = unknown>(game: GameId) {
  const { user, setStats, stats } = useSession();
  const play = useRef<string | null>(null);
  const startedAt = useRef(0);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const begin = useCallback(async (): Promise<C | null> => {
    play.current = null;
    setOutcome({ kind: "idle" });
    if (!user) return null;
    try {
      const started = await startPlay<C>(game);
      play.current = started.playId;
      startedAt.current = Date.now();
      return started.challenge;
    } catch (e) {
      setOutcome({
        kind: "error",
        message:
          e instanceof XpError ? e.message : "XP is unavailable right now.",
      });
      return null;
    }
  }, [game, user]);
  const submit = useCallback(
    async (answers: unknown) => {
      const id = play.current;
      play.current = null;
      if (!id) return;
      setOutcome({ kind: "saving" });
      try {
        // The server rejects plays finished faster than its minimum time.
        // Starting the clock after the server responded keeps us on the
        // safe side of that check, so quick players still get their XP.
        const wait = startedAt.current + MIN_PLAY_MS[game] - Date.now();
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        const result = await finishPlay(id, answers);
        setOutcome({ kind: "done", result });
        setStats({
          level: result.level,
          xp: result.xp,
          floor: result.floor,
          next: result.next,
          streak: result.streak,
          best: { ...(stats?.best || {}), [game]: result.score },
        });
      } catch (e) {
        setOutcome({
          kind: "error",
          message:
            e instanceof XpError ? e.message : "XP is unavailable right now.",
        });
      }
    },
    [game, setStats, stats],
  );
  return { begin, submit, outcome, signedIn: !!user };
}

export function XpSummary({
  outcome,
  signedIn,
  returnTo,
}: {
  outcome: Outcome;
  signedIn: boolean;
  returnTo: string;
}) {
  const { t, locale, href } = useLocale();

  if (!signedIn)
    return (
      <p className="xp-note">
        {/* One sentence, so each language can put the link where it belongs. */}
        {aroundLink(
          t("{0} to earn XP and join the leaderboard."),
          <Link
            href={`${href("/signin/")}?next=${encodeURIComponent(href(returnTo))}`}
          >
            {t("Sign in")}
          </Link>,
        )}
      </p>
    );
  if (outcome.kind === "saving")
    return <p className="xp-note">{t("Scoring your game…")}</p>;
  if (outcome.kind === "error")
    return <p className="xp-note muted">{t(outcome.message)}</p>;
  if (outcome.kind !== "done") return null;
  const r = outcome.result;
  const span = Math.max(1, r.next - r.floor);
  return (
    <div className="xp-summary">
      <div className="xp-gain">{t(`+${r.xpGained} XP`)}</div>
      <div className="xp-level">
        <span>{t(`Level ${r.level}`)}</span>
        <div
          className="xp-bar"
          role="progressbar"
          aria-label={t("Progress to next level")}
          aria-valuemin={0}
          aria-valuemax={span}
          aria-valuenow={r.xp - r.floor}
        >
          <span style={{ width: `${((r.xp - r.floor) / span) * 100}%` }} />
        </div>
        <small>{t(`${r.xp} / ${r.next} XP`)}</small>
      </div>
      <p className="xp-tags">
        {r.streak > 1 && <span>{t(`🔥 ${r.streak}-day streak`)}</span>}
        {r.newBest && <span>{t("New best!")}</span>}
        {r.capped && <span>{t("Daily XP cap reached")}</span>}
      </p>
    </div>
  );
}

/**
 * The player's level on their profile page: the level, all the XP they have,
 * a bar to the next level and their daily streak.
 */
export function LevelCard() {
  const { t, locale } = useLocale();
  const { stats } = useSession();
  const span = stats ? Math.max(1, stats.next - stats.floor) : 1;
  const into = stats ? Math.min(span, Math.max(0, stats.xp - stats.floor)) : 0;
  return (
    <section className="panel level-card" aria-labelledby="level-card-title">
      <h2 id="level-card-title">{t("Your level")}</h2>
      {!stats ? (
        <p className="muted">{t("Loading…")}</p>
      ) : (
        <>
          <p className="level-card-top">
            <strong>{t(`Account level ${stats.level}`)}</strong>
            <span>{t(`${stats.xp.toLocaleString(locale)} XP in all`)}</span>
          </p>
          <span
            className="xp-bar"
            role="progressbar"
            aria-label={t(`Progress to level ${stats.level + 1}`)}
            aria-valuemin={0}
            aria-valuemax={span}
            aria-valuenow={into}
          >
            <span style={{ width: `${(into / span) * 100}%` }} />
          </span>
          <p className="muted">
            {t(
              `${(stats.next - stats.xp).toLocaleString(locale)} XP to level ${stats.level + 1}`,
            )}
            {stats.streak > 1 && <> · {t(`🔥 ${stats.streak}-day streak`)}</>}
          </p>
          <p className="muted">
            {t("Earn XP by playing games and winning badges.")}
          </p>
        </>
      )}
    </section>
  );
}

export function Leaderboard({ title = "Top players" }: { title?: string }) {
  const { t, locale, href } = useLocale();

  // Refetch whenever this player's XP changes so fresh scores show up.
  const { stats, isAdmin } = useSession();
  const xp = stats?.xp;
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [shown, setShown] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    fetchLeaderboard()
      .then((value) => {
        if (!active) return;
        setEntries(value.entries);
        setShown(value.shown);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [xp]);
  // Until an admin makes it public (Players admin page), only admins see the
  // board. Nobody sees an empty or broken board while it loads.
  if (failed || !entries || (!shown && !isAdmin)) return null;
  return (
    <section className="leaderboard" id="leaderboard" aria-label={t(title)}>
      <p className="eyebrow">{t("Leaderboard")}</p>
      <h2>{t(title)}</h2>
      {!shown && (
        <p className="muted">
          {t("Only admins see this. Make it public on the Players admin page.")}
        </p>
      )}
      {!entries.length ? (
        <p className="muted">{t("No scores yet. Sign in and be the first.")}</p>
      ) : (
        <ol>
          {entries.map((e, i) => (
            <li key={i}>
              <span className="rank">{i + 1}</span>
              <span className="name">
                {/* The level on the avatar, as in the header. */}
                <HonorAvatar
                  className="board-avatar"
                  level={e.level}
                  choice={e.avatar ?? ""}
                  name={e.name}
                  user={null}
                  size={30}
                  medal={22}
                />
                {e.number ? (
                  // Anyone can open the player's public page.
                  <Link href={href(`/player/${e.number}/`)}>{e.name}</Link>
                ) : (
                  e.name
                )}
              </span>
              <span className={`lv honor-${honorOf(e.level).tier}`}>
                {t(honorOf(e.level).title)}
              </span>
              <span className="pts">{t(`${e.xp} XP`)}</span>
              {e.uid && (
                // Admins can also open the player on the Players admin page,
                // from the end of the row.
                <a
                  className="admin-link"
                  href={href(
                    `/admin/players/?uid=${encodeURIComponent(e.uid)}`,
                  )}
                >
                  {t("Admin")}
                </a>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
