"use client";
import { useLocale } from "@/components/locale";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "./auth";
import { useSession } from "./session";
import { PremiumPanel } from "./premium";
import { friendlyError } from "@/lib/models";
function Settings() {
  const { t, locale } = useLocale();

  const { user, profile, profileError, updateProfile, logout } = useSession();
  const router = useRouter();
  const [name, setName] = useState(profile.userName);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await updateProfile({ ...profile, userName: name });
      setMessage("Your profile is saved.");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  async function leave() {
    setBusy(true);
    setError("");
    try {
      await logout();
      router.push("/");
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }
  return (
    <div className="narrow container settings">
      <p className="eyebrow">{t("Make it yours")}</p>
      <h1>{t("Your player profile")}</h1>
      <p className="lede">{user?.email}</p>
      {profileError && (
        <p role="alert" className="error">
          {t("Your profile couldn’t be loaded.")}
          {t(profileError)}
          {t("Reload this page to try again.")}
        </p>
      )}
      <form className="panel" onSubmit={save}>
        <label htmlFor="display-name">{t("Display name")}</label>
        <input
          id="display-name"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          disabled={busy || !!profileError}
        />
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
      <PremiumPanel />
      <Link className="button" href="/#games">
        {t("Play games →")}
      </Link>
      <button className="text-button" onClick={leave} disabled={busy}>
        {t("Sign out")}
      </button>
    </div>
  );
}
export function Account() {
  const { t, locale } = useLocale();

  return (
    <AuthGate returnTo="/account/">
      <Settings />
    </AuthGate>
  );
}
