"use client";
// The player's profile page (/account/): who they are and how far they have
// come at the top, then tabs for the rest. Tabs run down the side on a wide
// screen and across the top on a phone. The URL's hash names the tab, so a
// link can open one: /account/#wallet (or the older #badges), #shop,
// #settings. Back from a checkout (?purchase=…) opens the shop.
import { useLocale } from "@/components/locale";

import Link from "next/link";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "./auth";
import { useSession } from "./session";
import { ItemShop } from "./item-shop";
import { avatarPresets, friendlyError } from "@/lib/models";
import { Avatar } from "./avatar";
import { BadgeShelf, useWallet } from "./rewards";
import { BadgeMedal, Coin } from "./rewards-art";
import { KingdomCard } from "./kingdom-card";
import { LevelCard } from "./xp";
import { saveNickname, XpError } from "@/lib/xp";
import { BagIcon, GearIcon, PencilIcon, PersonIcon, WalletIcon } from "./icons";

type Tab = "overview" | "wallet" | "shop" | "settings";
const TABS: {
  id: Tab;
  label: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
}[] = [
  { id: "overview", label: "Overview", Icon: PersonIcon },
  { id: "wallet", label: "Wallet", Icon: WalletIcon },
  { id: "shop", label: "Shop", Icon: BagIcon },
  { id: "settings", label: "Settings", Icon: GearIcon },
];

/** The tab the address asks for. */
function tabFromLocation(): Tab {
  if (typeof window === "undefined") return "overview";
  const hash = window.location.hash.slice(1);
  if (hash === "badges") return "wallet";
  if (TABS.some((t) => t.id === hash)) return hash as Tab;
  // Back from a checkout with no tab named: the shop, to show how it went.
  if (new URLSearchParams(window.location.search).has("purchase"))
    return "shop";
  return "overview";
}

/**
 * The honor a level earns: the ring and medal round the player's avatar, in
 * the badge tiers' metals, and a title that follows the kingdom's stages
 * (src/data/kingdom.mjs), from a wanderer to the ruler of a capital.
 */
/**
 * The ranks a player rises through, from a wanderer to the ruler of a
 * capital. Each opens at a level, in the badge tiers' metals; the titles
 * follow the kingdom's stages (src/data/kingdom.mjs).
 */
export const HONORS = [
  { level: 1, tier: "bronze", title: "Wanderer" },
  { level: 2, tier: "bronze", title: "Camp leader" },
  { level: 4, tier: "bronze", title: "Village elder" },
  { level: 6, tier: "silver", title: "Town lord" },
  { level: 10, tier: "gold", title: "City governor" },
  { level: 15, tier: "gold", title: "Monarch" },
  { level: 20, tier: "diamond", title: "High monarch" },
] as const;

/** The honor a level earns: the ring and medal round the avatar, and a title. */
export function honorOf(level: number): {
  tier: (typeof HONORS)[number]["tier"];
  title: string;
} {
  let honor: (typeof HONORS)[number] = HONORS[0];
  for (const h of HONORS) if (level >= h.level) honor = h;
  return { tier: honor.tier, title: honor.title };
}

/** XP to reach a level: 50 × level × (level − 1), as scripts/game-core.mjs. */
const xpFor = (level: number) => 50 * level * (level - 1);

/**
 * Every rank on one road: the ones reached lit, the next one marked with the
 * XP still to go, the rest waiting with the level that opens them.
 */
function HonorPath() {
  const { t, locale } = useLocale();
  const { stats } = useSession();
  const level = stats?.level ?? 0;
  const next = HONORS.find((h) => h.level > level);
  return (
    <section className="panel honor-path" aria-labelledby="honor-path-title">
      <h2 id="honor-path-title">{t("Path of honor")}</h2>
      {stats && (
        <p className="muted">
          {next
            ? t(
                `${t(next.title)} at level ${next.level}: ${Math.max(0, xpFor(next.level) - stats.xp).toLocaleString(locale)} XP to go.`,
              )
            : t("You hold the highest honor in dingn.")}
        </p>
      )}
      <ol>
        {HONORS.map((h) => {
          const reached = level >= h.level;
          const state = reached
            ? honorOf(level).title === h.title
              ? "current"
              : "reached"
            : next === h
              ? "next"
              : "locked";
          return (
            <li key={h.title} className={`honor-step ${state}`}>
              <BadgeMedal
                tier={h.tier}
                level={h.level}
                locked={!reached}
                levelText={t("LV")}
                size={52}
                label={t(h.title)}
              />
              <strong>{t(h.title)}</strong>
              <small>{t(`Level ${h.level}+`)}</small>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Who the player is, and their level, coins, badges and streak at a glance. */
function ProfileHead({ onEdit }: { onEdit: () => void }) {
  const { t, locale } = useLocale();
  const { user, profile, stats } = useSession();
  const wallet = useWallet();
  const name = profile.userName || user?.email?.split("@")[0] || "";
  const span = stats ? Math.max(1, stats.next - stats.floor) : 1;
  const into = stats ? Math.min(span, Math.max(0, stats.xp - stats.floor)) : 0;
  const honor = stats ? honorOf(stats.level) : null;
  return (
    <header className="profile-head">
      <div className="profile-who">
        <div className={`profile-avatar honor-${honor?.tier ?? "none"}`}>
          <Avatar choice={profile.avatar} name={name} user={user} size={84} />
          {stats && honor && (
            <span className="profile-medal">
              <BadgeMedal
                tier={honor.tier}
                level={stats.level}
                // An account level, not a game's: its own word on the medal.
                levelText={t("LV")}
                size={40}
                label={t(`Account level ${stats.level}`)}
              />
            </span>
          )}
        </div>
        <div className="profile-name">
          <h1>{name || t("Your player profile")}</h1>
          {honor && (
            <p className={`profile-honor honor-${honor.tier}`}>
              {t(honor.title)}
            </p>
          )}
        </div>
        {/* Editing is in the Settings tab; this only opens it. */}
        <button
          type="button"
          className="profile-edit"
          onClick={onEdit}
          aria-label={t("Edit profile")}
          title={t("Edit profile")}
        >
          <PencilIcon size={18} />
        </button>
      </div>
      <dl className="profile-stats">
        <div className="profile-stat profile-level">
          <dt>{t("Level")}</dt>
          <dd>
            <strong>{stats ? stats.level : "–"}</strong>
            {stats && (
              <>
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
                <small>
                  {t(`${stats.xp.toLocaleString(locale)} XP in all`)}
                </small>
              </>
            )}
          </dd>
        </div>
        <div className="profile-stat">
          <dt>{t("Coins")}</dt>
          <dd>
            <Coin size={22} />
            <strong>
              {wallet ? wallet.coins.toLocaleString(locale) : "–"}
            </strong>
          </dd>
        </div>
        <div className="profile-stat">
          <dt>{t("Badges")}</dt>
          <dd>
            <strong>{wallet ? wallet.badges.length : "–"}</strong>
          </dd>
        </div>
        <div className="profile-stat">
          <dt>{t("Streak")}</dt>
          <dd>
            <strong>{stats ? `🔥 ${stats.streak}` : "–"}</strong>
            <small>{t("days")}</small>
          </dd>
        </div>
      </dl>
    </header>
  );
}

/** The name and avatar, and signing out. */
function Settings() {
  const { t, href } = useLocale();
  const { user, profile, profileError, updateProfile, logout } = useSession();
  const router = useRouter();
  const [name, setName] = useState(profile.userName);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  // The saved profile can arrive after this tab first shows.
  useEffect(() => {
    setName(profile.userName);
    setAvatar(profile.avatar);
  }, [profile.userName, profile.avatar]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      // Nicknames are unique, so the server checks and saves a new one.
      let userName = profile.userName;
      if (name.trim() !== profile.userName.trim())
        userName = (await saveNickname(name)).name;
      await updateProfile({ ...profile, userName, avatar });
      setName(userName);
      setMessage("Your profile is saved.");
    } catch (e) {
      const code = e instanceof XpError ? e.code : "";
      setError(
        code === "nickname_taken"
          ? "That nickname is taken. Try another."
          : code === "bad_nickname"
            ? "Nicknames are 2 to 24 characters."
            : friendlyError(e),
      );
    } finally {
      setBusy(false);
    }
  }
  async function leave() {
    setBusy(true);
    setError("");
    try {
      await logout();
      router.push(href("/"));
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }
  return (
    <>
      {profileError && (
        <p role="alert" className="error">
          {t("Your profile couldn’t be loaded.")}
          {t(profileError)}
          {t("Reload this page to try again.")}
        </p>
      )}
      <form className="panel" onSubmit={save}>
        <h2>{t("Your profile")}</h2>
        <p className="muted">{t(`Signed in as ${user?.email ?? ""}.`)}</p>
        <label htmlFor="display-name">{t("Nickname")}</label>
        <input
          id="display-name"
          value={name}
          minLength={2}
          maxLength={24}
          aria-describedby="nickname-hint"
          onChange={(e) => setName(e.target.value)}
          disabled={busy || !!profileError}
        />
        <p id="nickname-hint" className="muted">
          {t("Other players see your nickname. No two players share one.")}
        </p>
        <fieldset className="avatar-picker" disabled={busy || !!profileError}>
          <legend>{t("Avatar")}</legend>
          <div className="avatar-options">
            {[
              ["", user?.photoURL ? "Sign-in photo" : "Initials"],
              ...(user?.photoURL ? [["initials", "Initials"]] : []),
              ...avatarPresets.map((a) => [
                a.id,
                a.id[0].toUpperCase() + a.id.slice(1),
              ]),
            ].map(([id, label]) => (
              <button
                key={id || "default"}
                type="button"
                className="avatar-option"
                aria-pressed={avatar === id}
                aria-label={t(label)}
                title={t(label)}
                onClick={() => setAvatar(id)}
              >
                <Avatar choice={id} name={name} user={user} size={48} />
              </button>
            ))}
          </div>
        </fieldset>
        <button className="button" disabled={busy || !!profileError}>
          {t(busy ? "Please wait…" : "Save profile")}
        </button>
        {message && <p role="status">{t(message)}</p>}
        {error && (
          <p role="alert" className="error">
            {t(error)}
          </p>
        )}
      </form>
      <section className="panel">
        <h2>{t("Sign out")}</h2>
        <button
          type="button"
          className="secondary-button"
          onClick={leave}
          disabled={busy}
        >
          {t("Sign out")}
        </button>
      </section>
    </>
  );
}

function Profile() {
  const { t, href } = useLocale();
  const [tab, setTab] = useState<Tab>("overview");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    setTab(tabFromLocation());
    const follow = () => setTab(tabFromLocation());
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, []);
  const open = (next: Tab, focus = false) => {
    setTab(next);
    // The address names the tab, without a new history entry each time.
    const url = new URL(window.location.href);
    url.hash = next === "overview" ? "" : next;
    // Leaving the shop drops the checkout's ?purchase, so a reload or a shared
    // link opens the tab the player chose.
    if (next !== "shop") url.searchParams.delete("purchase");
    window.history.replaceState(null, "", url);
    if (focus) tabs.current[TABS.findIndex((x) => x.id === next)]?.focus();
  };
  // Arrow keys move between tabs, as in any tab list.
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const step =
      e.key === "ArrowDown" || e.key === "ArrowRight"
        ? 1
        : e.key === "ArrowUp" || e.key === "ArrowLeft"
          ? -1
          : 0;
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      open(TABS[e.key === "Home" ? 0 : TABS.length - 1].id, true);
    } else if (step) {
      e.preventDefault();
      open(TABS[(i + step + TABS.length) % TABS.length].id, true);
    }
  };
  return (
    <div className="container profile-page">
      <ProfileHead onEdit={() => open("settings", true)} />
      <div className="profile-body">
        <div
          className="profile-tabs"
          role="tablist"
          aria-label={t("Your profile")}
          aria-orientation="vertical"
        >
          {TABS.map(({ id, label, Icon }, i) => (
            <button
              key={id}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`profile-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`profile-panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => open(id)}
              onKeyDown={(e) => onKey(e, i)}
            >
              <Icon size={18} />
              <span>{t(label)}</span>
            </button>
          ))}
        </div>
        <div
          className="profile-panel"
          role="tabpanel"
          id={`profile-panel-${tab}`}
          aria-labelledby={`profile-tab-${tab}`}
        >
          {tab === "overview" && (
            <>
              <LevelCard />
              <HonorPath />
              <KingdomCard />
              <Link className="button" href={href("/#games")}>
                {t("Play games →")}
              </Link>
            </>
          )}
          {tab === "wallet" && <BadgeShelf />}
          {tab === "shop" && <ItemShop />}
          {tab === "settings" && <Settings />}
        </div>
      </div>
    </div>
  );
}

export function Account() {
  return (
    <AuthGate returnTo="/account/">
      <Profile />
    </AuthGate>
  );
}
