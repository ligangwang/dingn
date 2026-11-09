"use client";
import { LanguageSwitcher, useLocale } from "@/components/locale";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "./session";
import {
  CrowdIcon,
  DecisionIcon,
  LogicIcon,
  MailIcon,
  MemoryIcon,
} from "./icons";
import { LevelBadge } from "./xp";
import { Avatar } from "./avatar";
export function Header() {
  const { t, href: to } = useLocale();

  const path = usePathname();
  const { user, ready, profile, isAdmin } = useSession();
  return (
    <header className="site-header">
      <Link className="brand" href={to("/")} aria-label={t("dingn home")}>
        <img src="/dingn-mark.svg" width="34" height="34" alt="" />
        {t("dingn")}
      </Link>
      <nav aria-label={t("Main navigation")}>
        {[
          ["/logic/", "Logic", LogicIcon] as const,
          ["/memory-ladder/", "Memory", MemoryIcon] as const,
          ["/decisions/", "Decisions", DecisionIcon] as const,
          ["/crowd/", "Crowd Rush", CrowdIcon] as const,
          ...(ready && isAdmin
            ? [["/admin/feedback/", "Feedback", MailIcon] as const]
            : []),
        ].map(([href, label, Icon]) => (
          <Link
            key={href}
            href={to(href)}
            aria-label={t(label)}
            aria-current={
              path.replace(/\/$/, "") === to(href).replace(/\/$/, "")
                ? "page"
                : undefined
            }
          >
            <Icon className="nav-icon" size={18} />
            <span className="nav-label">{t(label)}</span>
          </Link>
        ))}
        {ready && user && <LevelBadge />}
        <div className="account-controls">
          <LanguageSwitcher />
          {ready && user ? (
            <Link
              className="account-link"
              href={to("/account/")}
              aria-label={t("Your account")}
            >
              <Avatar
                choice={profile.avatar}
                name={profile.userName}
                user={user}
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
