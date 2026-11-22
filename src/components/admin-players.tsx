"use client";
// Players admin: every dingn account, most recently active first, page by
// page, with its roles and when it joined and was last seen. "Last sign-in" is
// when they last signed in; "Last active" is their last visit while signed in. Changing access stays on the Users page.
import { useEffect, useRef, useState } from "react";
import { AdminOnly } from "./admin-games";
import { useLocale } from "./locale";
import { useSession } from "./session";
import {
  getSettings,
  listPlayers,
  updateSettings,
  type Player,
} from "@/lib/admin-games";

const PROVIDERS: Record<string, string> = {
  "google.com": "Google",
  password: "Email",
  "apple.com": "Apple",
};

export function AdminPlayers() {
  const { user } = useSession();
  return (
    <AdminOnly path="/admin/players/">
      <PlayerList key={user?.uid} />
    </AdminOnly>
  );
}

function PlayerList() {
  const { t, locale, href } = useLocale();
  // Opened from a name on the leaderboard: show that player.
  const [wanted] = useState(() =>
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("uid") ?? ""),
  );
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [error, setError] = useState(false);
  // Bumped by Try again, to load the same page once more.
  const [attempt, setAttempt] = useState(0);
  // Set when a load has already brought the page it moves to.
  const skipLoad = useRef(false);
  // The wanted player is looked up once, on the first load only.
  const lookedUp = useRef(false);

  useEffect(() => {
    if (skipLoad.current) {
      skipLoad.current = false;
      return;
    }
    let current = true;
    setPlayers(null);
    setError(false);
    // The first load finds the wanted player's page; paging on is as usual.
    const find = wanted && !lookedUp.current ? wanted : undefined;
    lookedUp.current = true;
    (find ? listPlayers(page, find) : listPlayers(page))
      .then((result) => {
        if (!current) return;
        setPlayers(result.players);
        setPages(result.pages);
        setTotal(result.total);
        if (result.page && result.page !== page) {
          skipLoad.current = true;
          setPage(result.page);
        }
      })
      .catch(() => current && setError(true));
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, attempt]);

  // Bring the wanted player into view once their row is on screen.
  useEffect(() => {
    if (!wanted || !players) return;
    document
      .getElementById(`player-${wanted}`)
      ?.scrollIntoView({ block: "center" });
  }, [wanted, players]);

  const date = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString(locale, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : t("Never");
  const roles = (p: Player) =>
    [
      p.roles.includes("admin") && t("Admin"),
      p.roles.includes("developer") && t("Developer"),
      p.developerBlocked && t("Uploads blocked"),
      p.roles.includes("tester") && t("Test account"),
      p.disabled && t("Disabled"),
    ]
      .filter(Boolean)
      .join(", ") || t("Player");
  const hasNext = page < pages;
  const loading = !players && !error;

  return (
    <div className="container admin-games">
      <p className="eyebrow">{t("ADMIN")}</p>
      <h1>{t("Players")}</h1>
      <p className="lede">
        {t(
          "Every dingn account, including developers and admins, most recently active first. Change who can upload or administer on the Users page.",
        )}
      </p>
      <LeaderboardSwitch />
      {total > 0 && <p>{t(`${total} players`)}</p>}
      {error && (
        <p role="alert" className="error">
          {t("Players could not be loaded. Try again.")}{" "}
          <button
            type="button"
            className="secondary-button"
            onClick={() => setAttempt((n) => n + 1)}
          >
            {t("Try again")}
          </button>
        </p>
      )}
      {!players && !error && <p role="status">{t("Loading players…")}</p>}
      {players?.length === 0 && <p>{t("No players yet.")}</p>}
      {players && players.length > 0 && (
        <div className="admin-table-scroll">
          <table className="admin-game-versions admin-players">
            <thead>
              <tr>
                <th scope="col">{t("Player")}</th>
                <th scope="col">{t("Player ID")}</th>
                <th scope="col">{t("Role")}</th>
                <th scope="col">{t("Signs in with")}</th>
                <th scope="col">{t("Joined")}</th>
                <th scope="col">{t("Last sign-in")}</th>
                <th scope="col">{t("Last active")}</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr
                  key={p.uid}
                  id={`player-${p.uid}`}
                  className={
                    p.uid === wanted ? "admin-player-wanted" : undefined
                  }
                >
                  <th scope="row">
                    {/* The nickname other players see, then who signed in. */}
                    {p.nickname && <strong>{p.nickname}</strong>}
                    {p.nickname && <br />}
                    <small>
                      {[p.name, p.email || p.uid].filter(Boolean).join(" · ")}
                    </small>
                  </th>
                  <td className="admin-player-id">
                    {p.number ? (
                      <a href={href(`/player/${p.number}/`)}>{p.number}</a>
                    ) : (
                      "–"
                    )}
                  </td>
                  <td>{roles(p)}</td>
                  <td>
                    {p.providers.map((id) => PROVIDERS[id] ?? id).join(", ") ||
                      "–"}
                  </td>
                  <td>{date(p.createdAt)}</td>
                  <td>{date(p.lastSignIn)}</td>
                  <td>{date(p.lastActive)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <nav className="admin-pager" aria-label={t("Pages")}>
        <button
          type="button"
          className="secondary-button"
          disabled={page === 1 || loading}
          onClick={() => setPage(page - 1)}
        >
          {t("Previous")}
        </button>
        <span>{t(`Page ${page} of ${pages}`)}</span>
        <button
          type="button"
          className="secondary-button"
          disabled={!hasNext || loading}
          onClick={() => setPage(page + 1)}
        >
          {t("Next")}
        </button>
      </nav>
    </div>
  );
}

/** Opens the Leaderboard page (/leaderboard/) to everyone, or admins only again. */
function LeaderboardSwitch() {
  const { t } = useLocale();
  const [open, setOpen] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    getSettings()
      .then((s) => setOpen(s.leaderboardPublic))
      .catch(() => setError(true));
  }, []);
  async function flip() {
    if (open === null) return;
    setSaving(true);
    setError(false);
    try {
      setOpen(
        (await updateSettings({ leaderboardPublic: !open })).leaderboardPublic,
      );
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="admin-setting" aria-label={t("Leaderboard")}>
      <h2>{t("Leaderboard")}</h2>
      <p>
        {open === null
          ? t(error ? "The setting could not be loaded." : "Loading…")
          : t(
              open
                ? "Public: anyone can open the Leaderboard page. Only admins see it in the menu."
                : "Admins only: only admins can open the Leaderboard page, from the menu.",
            )}
      </p>
      {open !== null && (
        <button
          type="button"
          className={open ? "secondary-button" : "button small"}
          disabled={saving}
          onClick={flip}
        >
          {t(open ? "Hide it again" : "Make it public")}
        </button>
      )}
      {error && open !== null && (
        <p role="alert" className="error">
          {t("That didn’t save. Try again.")}
        </p>
      )}
    </section>
  );
}
