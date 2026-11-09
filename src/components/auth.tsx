"use client";
import { useLocale } from "@/components/locale";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "./session";
import { friendlyError, safeDestination } from "@/lib/models";
export function SignIn() {
  const { t, locale, href } = useLocale();

  const { user, ready, login, loginEmail } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [create, setCreate] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (ready && user)
      router.replace(
        safeDestination(
          new URLSearchParams(window.location.search).get("next"),
          locale,
        ),
      );
  }, [ready, user, router, locale]);
  async function submit(emailLogin = false) {
    setPending(true);
    setError("");
    try {
      if (emailLogin) {
        await loginEmail(email, password, create);
        setPassword("");
      } else await login();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="center-page">
      <section className="signin-panel panel">
        <div className="round-icon" aria-hidden="true">
          ✦
        </div>
        <h1>
          {t("Save your progress.")}
          <br />
          {t("Keep your streak.")}
        </h1>
        <p>
          {t(
            "Sign in to play the memory games with words, numbers, and playing cards.",
          )}
        </p>
        <form
          className="email-signin"
          onSubmit={(event) => {
            event.preventDefault();
            if (!pending) void submit(true);
          }}
        >
          <label htmlFor="signin-email">{t("Email")}</label>
          <input
            id="signin-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={pending}
          />
          <label htmlFor="signin-password">{t("Password")}</label>
          <input
            id="signin-password"
            name="password"
            type="password"
            autoComplete={create ? "new-password" : "current-password"}
            required
            minLength={create ? 8 : undefined}
            maxLength={4096}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={pending}
          />
          {create && <p>{t("Use at least 8 characters.")}</p>}
          <button className="button" type="submit" disabled={!ready || pending}>
            {t(
              pending
                ? "Please wait…"
                : create
                  ? "Create account"
                  : "Sign in with email",
            )}
          </button>
          <button
            className="quiet-link"
            type="button"
            disabled={pending}
            onClick={() => {
              setCreate(!create);
              setError("");
            }}
          >
            {t(
              create
                ? "Already have an account? Sign in"
                : "New here? Create an account",
            )}
          </button>
        </form>
        <p className="signin-divider">{t("or")}</p>
        <button
          className="google-button"
          onClick={() => void submit()}
          disabled={!ready || pending}
        >
          <span aria-hidden="true" className="google-g">
            {t("G")}
          </span>
          {t(pending ? "Signing in…" : "Continue with Google")}
        </button>
        {error && (
          <p role="alert" className="error">
            {t(error)}
          </p>
        )}
        <Link className="quiet-link" href={href("/")}>
          {t("Back to games")}
        </Link>
      </section>
    </div>
  );
}
export function AuthGate({
  children,
  returnTo,
}: {
  children: React.ReactNode;
  returnTo: string;
}) {
  const { t, locale, href } = useLocale();

  const { user, ready } = useSession();
  if (!ready)
    return (
      <div className="center-page">
        <p role="status">{t("Loading your game…")}</p>
      </div>
    );
  if (!user)
    return (
      <div className="center-page">
        <section className="signin-panel panel">
          <div className="round-icon" aria-hidden="true">
            ✦
          </div>
          <h1>{t("Your next game awaits.")}</h1>
          <p>{t("Sign in with your existing dingn account to continue.")}</p>
          <Link
            className="button"
            href={`${href("/signin/")}?next=${encodeURIComponent(href(returnTo))}`}
          >
            {t("Sign in to play")}
          </Link>
          <Link className="quiet-link" href={href("/")}>
            {t("Back to games")}
          </Link>
        </section>
      </div>
    );
  return children;
}
