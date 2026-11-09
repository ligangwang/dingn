"use client";
// Players admin: every dingn account, page by page, with its roles and when
// it joined and was last seen. Changing access stays on the Users page.
import { useEffect, useState } from "react";
import { AdminOnly } from "./admin-games";
import { useLocale } from "./locale";
import { useSession } from "./session";
import { listPlayers, type Player } from "@/lib/admin-games";

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
  const { t, locale } = useLocale();
  // tokens[i] opens page i + 1; page 1 needs none.
  const [tokens, setTokens] = useState<(string | null)[]>([null]);
  const [page, setPage] = useState(0);
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [error, setError] = useState(false);
  // Bumped by Try again, to load the same page once more.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    setPlayers(null);
    setError(false);
    listPlayers(tokens[page])
      .then(({ players, next }) => {
        if (!current) return;
        setPlayers(players);
        setTokens((list) =>
          next && list.length === page + 1 ? [...list, next] : list,
        );
      })
      .catch(() => current && setError(true));
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, attempt]);

  const date = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString(locale === "zh-CN" ? "zh-CN" : "en", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : t("Never");
  const roles = (p: Player) =>
    [
      p.admin && t("Admin"),
      p.developer && t("Developer"),
      p.developerBlocked && t("Uploads blocked"),
      p.disabled && t("Disabled"),
    ]
      .filter(Boolean)
      .join(", ") || t("Player");
  const hasNext = tokens.length > page + 1;
  const loading = !players && !error;

  return (
    <div className="container admin-games">
      <p className="eyebrow">{t("ADMIN")}</p>
      <h1>{t("Players")}</h1>
      <p className="lede">
        {t(
          "Every dingn account, including developers and admins. Change who can upload or administer on the Users page.",
        )}
      </p>
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
                <th scope="col">{t("Role")}</th>
                <th scope="col">{t("Signs in with")}</th>
                <th scope="col">{t("Joined")}</th>
                <th scope="col">{t("Last sign-in")}</th>
                <th scope="col">{t("Last active")}</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.uid}>
                  <th scope="row">
                    {p.name && <strong>{p.name}</strong>}
                    {p.name && <br />}
                    <small>{p.email || p.uid}</small>
                  </th>
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
          disabled={page === 0 || loading}
          onClick={() => setPage(page - 1)}
        >
          {t("Previous")}
        </button>
        <span>{t(`Page ${page + 1}`)}</span>
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
