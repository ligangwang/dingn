"use client";
import { LanguageSwitcher, useLocale } from "@/components/locale";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "./session";
import { CrowdIcon, KeyIcon, ShieldIcon, TrophyIcon } from "./icons";
import { CATEGORY_INFO, playPath, useCatalog } from "./catalog";
import { CATEGORIES, gamesIn, type CatalogGame } from "@/lib/catalog";
import { HonorAvatar } from "./honor";
import { CoinCount } from "./rewards";
export function Header() {
  const { t, locale, href: to } = useLocale();

  const path = usePathname();
  const { user, ready, profile, isAdmin, isDeveloper, isTester, stats } =
    useSession();
  const catalog = useCatalog();
  const here = (href: string) =>
    path.replace(/\/$/, "") === to(href).replace(/\/$/, "");
  return (
    <header className="site-header">
      <Link className="brand" href={to("/")} aria-label={t("dingn home")}>
        <img src="/dingn-mark.svg" width="34" height="34" alt="" />
        {t("dingn")}
      </Link>
      <nav aria-label={t("Main navigation")}>
        {/* One menu for all the games, so the header stays short. */}
        <GamesMenu key={`games:${path}`} path={path} games={catalog} />
        {/* The open challenges, with the top players under them. */}
        <Link
          href={to("/challenges/")}
          aria-label={t("Challenges")}
          aria-current={here("/challenges/") ? "page" : undefined}
        >
          <TrophyIcon className="nav-icon" size={18} />
          <span className="nav-label">{t("Challenges")}</span>
        </Link>
        {ready && isAdmin && <AdminMenu key={`admin:${path}`} path={path} />}
        {ready && isDeveloper && !isAdmin && (
          // Developers reach their upload keys here; admins in the Admin menu.
          <Link
            href={to("/developers/keys/")}
            aria-label={t("API keys")}
            aria-current={here("/developers/keys/") ? "page" : undefined}
          >
            <KeyIcon className="nav-icon" size={18} />
            <span className="nav-label">{t("API keys")}</span>
          </Link>
        )}
        <div className="account-controls">
          <LanguageSwitcher />
          {/* The wallet sits by the account it belongs to. */}
          {ready && user && <CoinCount />}
          {ready && user ? (
            <Link
              className="account-link"
              href={to("/account/")}
              aria-label={
                stats
                  ? `${t("Your account")} · ${t(`Account level ${stats.level}`)}`
                  : t("Your account")
              }
              title={
                stats
                  ? t(`Account level ${stats.level}`) +
                    ` · ${t(`${(stats.xp ?? 0).toLocaleString(locale)} XP in all`)}`
                  : undefined
              }
            >
              {/* The level rides on the avatar, as on the profile page. */}
              <HonorAvatar
                className="header-avatar"
                tester={isTester}
                level={stats?.level}
                choice={profile.avatar}
                name={profile.userName}
                user={user}
                size={34}
                medal={26}
              />
            </Link>
          ) : (
            <Link className="button small" href={to("/signin/")}>
              {t("Sign in")}
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}

/**
 * Every kind of game in one menu: each category opens its page, which lists
 * its games. On a game's page, the menu and the game's category are marked.
 */
function GamesMenu({
  path,
  games,
}: {
  path: string;
  games: CatalogGame[] | null;
}) {
  const { t, locale, href: to } = useLocale();
  const same = (href: string) =>
    path.replace(/\/$/, "") === to(href).replace(/\/$/, "");
  const items = CATEGORIES.map((category) => {
    const { label, path: page, Icon } = CATEGORY_INFO[category];
    const list = games ? gamesIn(games, category, locale) : [];
    // A game's page counts as being inside its category.
    const inside = same(page) || list.some((g) => same(playPath(g.id)));
    return { category, label, page, Icon, inside };
  });
  return (
    <details className="admin-menu games-menu">
      <summary
        aria-label={t("Games")}
        aria-current={items.some((i) => i.inside) ? "page" : undefined}
      >
        <CrowdIcon className="nav-icon" size={18} />
        <span className="nav-label">{t("Games")}</span>
      </summary>
      <ul>
        {items.map(({ category, label, page, Icon, inside }) => (
          <li key={category}>
            <Link href={to(page)} aria-current={inside ? "page" : undefined}>
              <Icon className="nav-icon" size={18} />
              {t(label)}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** The admin pages, in a menu only admins see. */
function AdminMenu({ path }: { path: string }) {
  const { t, href: to } = useLocale();
  const here = (href: string) =>
    path.replace(/\/$/, "") === to(href).replace(/\/$/, "");
  const items = [
    ["/admin/games/", "Games"],
    ["/admin/users/", "Users"],
    ["/admin/players/", "Players"],
    ["/admin/funnel/", "Funnel"],
    ["/admin/rewards/", "Rewards"],
    ["/developers/keys/", "API keys"],
    ["/admin/feedback/", "Feedback"],
  ] as const;
  const inside = items.some(([href]) => here(href));
  return (
    <details className="admin-menu">
      <summary
        aria-label={t("Admin")}
        aria-current={inside ? "page" : undefined}
      >
        <ShieldIcon className="nav-icon" size={18} />
        <span className="nav-label">{t("Admin")}</span>
      </summary>
      <ul>
        {items.map(([href, label]) => (
          <li key={href}>
            <Link
              href={to(href)}
              aria-current={here(href) ? "page" : undefined}
            >
              {t(label)}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
