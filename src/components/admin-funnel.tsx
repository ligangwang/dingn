"use client";
// Funnel admin: where players come from and how far they get, by source
// (scripts/funnel.mjs). Visit → game start → finished round → return visit,
// plus challenge links shared and the friends they brought.
import { useEffect, useState } from "react";
import { AdminOnly } from "./admin-games";
import { useLocale } from "./locale";
import { useSession } from "./session";
import {
  getFunnel,
  type FunnelReport,
  type FunnelRow,
} from "@/lib/admin-games";

const RANGES = [1, 7, 30, 90] as const;
const COLUMNS: [keyof FunnelRow, string, string][] = [
  ["visitors", "Visitors", "Browsers that visited, once a day each"],
  ["new", "New visitors", "First visit ever"],
  ["starts", "Game starts", "Games opened"],
  ["finishes", "Rounds finished", "Only games that report it (Memory so far)"],
  ["returning", "Return visits", "Came back on a later day"],
  [
    "returners",
    "Back within a week",
    "Came back within 7 days of their first visit, counted once",
  ],
  ["shares", "Challenges sent", "Challenge links made"],
  ["referred", "Referred", "New visitors from a friend's challenge link"],
];

export function AdminFunnel() {
  const { user } = useSession();
  return (
    <AdminOnly path="/admin/funnel/">
      <Funnel key={user?.uid} />
    </AdminOnly>
  );
}

function Funnel() {
  const { t, locale } = useLocale();
  const [days, setDays] = useState<number>(7);
  const [report, setReport] = useState<FunnelReport | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setReport(null);
    setError(false);
    getFunnel(days)
      .then((r) => current && setReport(r))
      .catch(() => current && setError(true));
    return () => {
      current = false;
    };
  }, [days, attempt]);

  const n = (value: number) => value.toLocaleString(locale);
  const rate = (part: number, whole: number) =>
    whole ? `${Math.round((part / whole) * 100)}%` : "–";
  const sources = report
    ? Object.entries(report.sources).sort(
        ([a, x], [b, y]) => y.visitors - x.visitors || a.localeCompare(b),
      )
    : [];
  const games = report
    ? Object.entries(report.games).sort(
        ([a, x], [b, y]) => y.starts - x.starts || a.localeCompare(b),
      )
    : [];
  const total = report?.total;

  return (
    <div className="container admin-games admin-funnel">
      <p className="eyebrow">{t("ADMIN")}</p>
      <h1>{t("Funnel")}</h1>
      <p className="lede">
        {t(
          "Where players come from and how far they get: visit, game start, finished round, return visit. Sources come from utm_source or ref in the link, a challenge link, or the site that linked here. Browsers that opted out are not counted, and nothing identifies a player.",
        )}
      </p>
      <div className="digit-tabs" role="group" aria-label={t("Period")}>
        {RANGES.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={days === d}
            onClick={() => setDays(d)}
          >
            {t(d === 1 ? "Today" : `${d} days`)}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="error">
          {t("The funnel could not be loaded. Try again.")}{" "}
          <button
            type="button"
            className="secondary-button"
            onClick={() => setAttempt((a) => a + 1)}
          >
            {t("Try again")}
          </button>
        </p>
      )}
      {!report && !error && <p role="status">{t("Loading…")}</p>}
      {report && total && (
        <>
          <p>{t(`${report.from} to ${report.to} (UTC)`)}</p>
          <ul className="funnel-steps" aria-label={t("Funnel")}>
            <li>
              <strong>{n(total.visitors)}</strong> {t("Visitors")}
            </li>
            <li>
              <strong>{n(total.starts)}</strong> {t("Game starts")}{" "}
              <small>{rate(total.starts, total.visitors)}</small>
            </li>
            <li>
              <strong>{n(total.finishes)}</strong> {t("Rounds finished")}{" "}
              <small>{rate(total.finishes, total.starts)}</small>
            </li>
            <li>
              <strong>{n(total.returners)}</strong> {t("Back within a week")}{" "}
              <small>{rate(total.returners, total.new)}</small>
            </li>
            <li>
              <strong>{n(total.referred)}</strong> {t("Referred")}{" "}
              <small>{rate(total.referred, total.new)}</small>
            </li>
          </ul>
          <h2>{t("By source")}</h2>
          {sources.length === 0 ? (
            <p>{t("No visits counted yet.")}</p>
          ) : (
            <div className="admin-table-scroll">
              <table className="admin-game-versions">
                <thead>
                  <tr>
                    <th scope="col">{t("Source")}</th>
                    {COLUMNS.map(([key, label, hint]) => (
                      <th scope="col" key={key} title={t(hint)}>
                        {t(label)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sources.map(([source, row]) => (
                    <tr key={source}>
                      <th scope="row">{source}</th>
                      {COLUMNS.map(([key]) => (
                        <td key={key}>{n(row[key])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">{t("Total")}</th>
                    {COLUMNS.map(([key]) => (
                      <td key={key}>{n(total[key])}</td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <h2>{t("By game")}</h2>
          {games.length === 0 ? (
            <p>{t("No games started yet.")}</p>
          ) : (
            <div className="admin-table-scroll">
              <table className="admin-game-versions">
                <thead>
                  <tr>
                    <th scope="col">{t("Game")}</th>
                    <th scope="col">{t("Game starts")}</th>
                    <th scope="col">{t("Rounds finished")}</th>
                    <th scope="col">{t("Challenges sent")}</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map(([game, row]) => (
                    <tr key={game}>
                      <th scope="row">{game}</th>
                      <td>{n(row.starts)}</td>
                      <td>{n(row.finishes)}</td>
                      <td>{n(row.shares)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted">
            {t(
              "Tag links you post so they show up as their own source, for example dingn.com/play/memory/?utm_source=tiktok.",
            )}
          </p>
        </>
      )}
    </div>
  );
}
