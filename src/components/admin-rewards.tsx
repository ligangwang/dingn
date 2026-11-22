"use client";
// Rewards admin: every reward system dingn's games feed, kingdom first
// (src/data/reward-systems.ts), with what it grants, its versions and the
// one that is live. Kingdom runs as a plugin, like a game: its CI uploads
// each version, an admin approves it here, and it goes live with no rebuild
// (scripts/reward-plugin.mjs). Its rules are shown as the live version has
// them, so this page can't disagree with what players get.
import { useEffect, useState } from "react";
import { pick } from "@/lib/i18n";
import { AdminOnly } from "./admin-games";
import {
  listRewardReleases,
  reviewRewardRelease,
  type RewardReleases,
} from "@/lib/reward-releases";
import { useLocale } from "./locale";
import {
  REWARD_SYSTEMS,
  pinnedCommit,
  pinnedRelease,
  type RewardSystem,
} from "@/data/reward-systems";
import { useKingdomRules } from "@/lib/reward-plugin";

export function AdminRewards() {
  return (
    <AdminOnly path="/admin/rewards/">
      <Rewards />
    </AdminOnly>
  );
}

function Rewards() {
  const { t } = useLocale();
  return (
    <div className="container admin-games admin-rewards">
      <p className="eyebrow">{t("ADMIN")}</p>
      <h1>{t("Rewards")}</h1>
      <p className="lede">
        {t(
          "The reward systems dingn's games feed. Each lives in its own repository and decides what players earn; dingn reports what players do and saves what they get. To change a reward, change it in its repository and publish a new version, then approve it here.",
        )}
      </p>
      {REWARD_SYSTEMS.map((system) => (
        <System key={system.id} system={system} />
      ))}
    </div>
  );
}

function System({ system }: { system: RewardSystem }) {
  const { t } = useLocale();
  const release = pinnedRelease(system);
  const commit = release ? null : pinnedCommit(system);
  const repo = `https://github.com/${system.repo}`;
  return (
    <section
      className="panel reward-system"
      aria-labelledby={`reward-${system.id}`}
    >
      <h2 id={`reward-${system.id}`}>{t(system.title)}</h2>
      <p>{t(system.description)}</p>
      <dl className="reward-facts">
        <dt>{t("Repository")}</dt>
        <dd>
          <a href={repo} target="_blank" rel="noreferrer">
            {system.repo}
          </a>
        </dd>
        <dt>{t("Built-in copy")}</dt>
        <dd>
          {release ? (
            <a
              href={`${repo}/releases/tag/${release}`}
              target="_blank"
              rel="noreferrer"
            >
              <code>{system.version}</code>
            </a>
          ) : (
            <>
              <code>{system.version}</code>{" "}
              {commit ? (
                <a
                  href={`${repo}/commit/${commit}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <code>{commit.slice(0, 7)}</code>
                </a>
              ) : null}{" "}
              <span className="reward-unreleased">
                {t("Not a published release")}
              </span>
            </>
          )}
        </dd>
        <dt>{t("Events from dingn")}</dt>
        <dd>
          {system.events.map((e) => (
            <code key={e}>{e}</code>
          ))}
        </dd>
      </dl>
      <h3>{t("What it grants")}</h3>
      <div className="admin-table-scroll">
        <table className="admin-game-versions">
          <thead>
            <tr>
              <th scope="col">{t("Reward")}</th>
              <th scope="col">{t("Listens for")}</th>
            </tr>
          </thead>
          <tbody>
            {system.kinds.map((kind) => (
              <tr key={kind.id}>
                <th scope="row">
                  <code>{kind.id}</code>
                </th>
                <td>{kind.on.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Releases system={system} />
      {system.id === "kingdom" && <KingdomRules />}
    </section>
  );
}

/**
 * The versions the system's CI uploaded (scripts/reward-releases.mjs),
 * newest first, and the live one. Approving a version makes it live;
 * approving an older approved one makes it live again.
 */
function Releases({ system }: { system: RewardSystem }) {
  const { t, locale } = useLocale();
  const [releases, setReleases] = useState<RewardReleases | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => {
    let live = true;
    listRewardReleases()
      .then(({ systems }) => {
        if (!live) return;
        setReleases(
          systems.find((s) => s.system === system.id) ?? {
            system: system.id,
            live: null,
            running: null,
            versions: [],
          },
        );
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [system.id]);

  const name = t(system.title);
  const date = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale) : "";
  async function review(
    version: string,
    change: { action: "approve" } | { action: "reject"; reason: string },
    done: string,
  ) {
    setBusy(true);
    setNote("");
    try {
      setReleases(await reviewRewardRelease(system.id, version, change));
      setNote(done);
    } catch (e) {
      setNote(t("Something went wrong. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h3>{t("Releases")}</h3>
      <p className="muted">
        {t(
          "Each new version waits here for review. Approving it makes it live: every server runs it within a minute, with no rebuild.",
        )}
      </p>
      {releases && (
        <p>
          {t("Live version")}:{" "}
          {releases.live ? (
            <code>{releases.live}</code>
          ) : (
            t("none yet, so dingn runs its built-in copy.")
          )}
        </p>
      )}
      {releases?.running?.problem && (
        <p className="error" role="alert">
          {t(
            `This server can't load the live version, so it runs ${releases.running.version} meanwhile:`,
          )}{" "}
          <code>{releases.running.problem}</code>
        </p>
      )}
      {failed ? (
        <p>{t("Releases could not be loaded. Try again.")}</p>
      ) : !releases ? (
        <p className="muted">{t("Loading…")}</p>
      ) : releases.versions.length === 0 ? (
        <p>{t("No versions have been sent for review yet.")}</p>
      ) : (
        <div className="admin-table-scroll">
          <table className="admin-game-versions">
            <thead>
              <tr>
                <th scope="col">{t("Version")}</th>
                <th scope="col">{t("Uploaded")}</th>
                <th scope="col">{t("Status")}</th>
              </tr>
            </thead>
            <tbody>
              {releases.versions.map((v) => (
                <tr key={v.version}>
                  <th scope="row">
                    <a href={v.notes} target="_blank" rel="noreferrer">
                      <code>{v.version}</code>
                    </a>
                  </th>
                  <td>{date(v.uploadedAt)}</td>
                  <td className="admin-version-actions">
                    {v.version === releases.live ? (
                      <span className="admin-tag live">{t("Live")}</span>
                    ) : v.approvedAt ? (
                      <>
                        <span className="admin-tag">{t("Approved")}</span>
                        {/* To roll back to it. */}
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                t(`Make ${name} ${v.version} live again?`),
                              )
                            )
                              void review(
                                v.version,
                                { action: "approve" },
                                t(
                                  `${name} ${v.version} is live. Every server runs it within a minute.`,
                                ),
                              );
                          }}
                        >
                          {t("Make live")}
                        </button>
                      </>
                    ) : !v.bundle ? (
                      <span className="admin-tag review">
                        {t("Sent before plugins")}
                      </span>
                    ) : v.rejected ? (
                      <span className="admin-tag review" title={v.rejected}>
                        {t("Sent back")}
                      </span>
                    ) : (
                      <>
                        <span className="admin-tag review">
                          {t("Waiting for review")}
                        </span>
                        <button
                          type="button"
                          className="button small"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                t(
                                  `Approve ${name} ${v.version}? It goes live within a minute.`,
                                ),
                              )
                            )
                              void review(
                                v.version,
                                { action: "approve" },
                                t(
                                  `${name} ${v.version} is live. Every server runs it within a minute.`,
                                ),
                              );
                          }}
                        >
                          {t("Approve")}
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={busy}
                          onClick={() => {
                            const reason = (
                              window.prompt(
                                t("Why is this version sent back?"),
                              ) ?? ""
                            )
                              .trim()
                              .slice(0, 500);
                            if (reason)
                              void review(
                                v.version,
                                { action: "reject", reason },
                                t(`${name} ${v.version} was sent back.`),
                              );
                          }}
                        >
                          {t("Send back")}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {note && (
        <p className="muted" role="status">
          {note}
        </p>
      )}
    </>
  );
}

/** "bronze" → "Bronze". */
const title = (word: string) => word[0].toUpperCase() + word.slice(1);

/** Kingdom's numbers, straight from the live version. */
function KingdomRules() {
  const { t, locale } = useLocale();
  const {
    coins: { BADGE_XP, DAILY_GAME_COINS, MAX_EARN, MAX_GAME_COINS, TIER_COINS },
    levels: { DAILY_XP_CAP, xpToReach },
    honors: { HONORS },
    kingdom: { BUILDINGS, STAGES, STARTERS, building },
  } = useKingdomRules();
  const n = (value: number) => value.toLocaleString(locale);
  const tiers = Object.keys(TIER_COINS) as (keyof typeof TIER_COINS)[];
  return (
    <details className="reward-rules">
      <summary>{t("Kingdom's rules")}</summary>

      <h3>{t("Badges")}</h3>
      <div className="admin-table-scroll">
        <table className="admin-game-versions">
          <thead>
            <tr>
              <th scope="col">{t("Tier")}</th>
              <th scope="col">{t("Coins")}</th>
              <th scope="col">XP</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier) => (
              <tr key={tier}>
                <th scope="row">{t(title(tier))}</th>
                <td>{n(TIER_COINS[tier])}</td>
                <td>{n(BADGE_XP[tier])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul>
        <li>
          {t(`One game's badges pay at most ${n(MAX_GAME_COINS)} coins.`)}
        </li>
        <li>
          {t(
            `A game can pay ${n(DAILY_GAME_COINS)} coins a day for play, up to ${n(MAX_EARN)} at a time.`,
          )}
        </li>
        <li>{t(`Play XP is capped at ${n(DAILY_XP_CAP)} a day.`)}</li>
      </ul>

      <h3>{t("Honors")}</h3>
      <div className="admin-table-scroll">
        <table className="admin-game-versions">
          <thead>
            <tr>
              <th scope="col">{t("Honor")}</th>
              <th scope="col">{t("From level")}</th>
              <th scope="col">XP</th>
              <th scope="col">{t("Tier")}</th>
            </tr>
          </thead>
          <tbody>
            {HONORS.map((h) => (
              <tr key={h.title}>
                <th scope="row">{t(h.title)}</th>
                <td>{n(h.level)}</td>
                <td>{n(xpToReach(h.level))}</td>
                <td>{t(title(h.tier))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>{t("Kingdom stages")}</h3>
      <div className="admin-table-scroll">
        <table className="admin-game-versions">
          <thead>
            <tr>
              <th scope="col">{t("Stage")}</th>
              <th scope="col">{t("From level")}</th>
              <th scope="col">{t("Land")}</th>
              <th scope="col">{t("Free buildings")}</th>
            </tr>
          </thead>
          <tbody>
            {STAGES.map((s) => (
              <tr key={s.id}>
                <th scope="row">{pick(s.title, locale, true)}</th>
                <td>{n(s.level)}</td>
                <td>{`${s.size} × ${s.size}`}</td>
                <td>
                  {STARTERS[s.id]
                    .map(([id]) => {
                      const def = building(id);
                      return def ? pick(def.title, locale, true) : id;
                    })
                    .join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>{t("Buildings for coins")}</h3>
      <div className="admin-table-scroll">
        <table className="admin-game-versions">
          <thead>
            <tr>
              <th scope="col">{t("Building")}</th>
              <th scope="col">{t("Stage")}</th>
              <th scope="col">{t("Coins")}</th>
              <th scope="col">{t("Most per kingdom")}</th>
            </tr>
          </thead>
          <tbody>
            {BUILDINGS.map((b) => {
              const stage = STAGES.find((s) => s.id === b.stage);
              return (
                <tr key={b.id}>
                  <th scope="row">{pick(b.title, locale, true)}</th>
                  <td>{stage ? pick(stage.title, locale, true) : b.stage}</td>
                  <td>{n(b.coins)}</td>
                  <td>{n(b.max)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
