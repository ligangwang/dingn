"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "./session";
import { DecisionIcon, LogicIcon, MailIcon, MemoryIcon } from "./icons";
export function Header() {
  const path = usePathname();
  const { user, ready, profile, isAdmin } = useSession();
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="dingn home">
        <img src="/dingn-mark.svg" width="34" height="34" alt="" /> dingn
      </Link>
      <nav aria-label="Main navigation">
        {(
          [
            ["/logic/", "Logic", LogicIcon],
            ["/number/", "Memory", MemoryIcon],
            ["/decisions/", "Decisions", DecisionIcon],
            ...(ready && isAdmin
              ? [["/admin/feedback/", "Feedback", MailIcon] as const]
              : []),
          ] as const
        ).map(([href, label, Icon]) => (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={
              path.replace(/\/$/, "") === href.replace(/\/$/, "")
                ? "page"
                : undefined
            }
          >
            <Icon className="nav-icon" />
            <span className="nav-label">{label}</span>
          </Link>
        ))}
        {ready && user ? (
          <Link
            className="account-link"
            href="/account/"
            aria-label="Your account"
          >
            {(profile.userName || user.displayName || user.email || "Me")
              .slice(0, 2)
              .toUpperCase()}
          </Link>
        ) : (
          <Link className="button small" href="/signin/">
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
