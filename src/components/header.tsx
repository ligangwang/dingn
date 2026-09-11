"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "./session";
export function Header() {
  const path = usePathname();
  const { user, ready, profile } = useSession();
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="dingn home">
        dingn
      </Link>
      <nav aria-label="Main navigation">
        {[
          ["/word/", "Words", "Aa"],
          ["/number/", "Numbers", "#"],
          ["/card/", "Cards", "♧"],
        ].map(([href, label, icon]) => (
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
            <span className="nav-label">{label}</span>
            <span className="nav-icon" aria-hidden="true">
              {icon}
            </span>
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
