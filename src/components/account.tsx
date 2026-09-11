"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "./auth";
import { useSession } from "./session";
import { friendlyError, type CardSide } from "@/lib/models";
function Settings() {
  const { user, profile, profileError, updateProfile, logout } = useSession();
  const router = useRouter();
  const [name, setName] = useState(profile.userName);
  const [side, setSide] = useState<CardSide>(profile.cardSide);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await updateProfile({ userName: name, cardSide: side });
      setMessage("Your preferences are saved.");
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
      <p className="eyebrow">Make it yours</p>
      <h1>Your account</h1>
      <p className="lede">{user?.email}</p>
      {profileError && (
        <p role="alert" className="error">
          Your preferences couldn’t be loaded. {profileError} Reload this page
          to try again.
        </p>
      )}
      <form className="panel" onSubmit={save}>
        <label htmlFor="display-name">Display name</label>
        <input
          id="display-name"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          disabled={busy || !!profileError}
        />
        <fieldset disabled={busy || !!profileError}>
          <legend>How would you like to practice?</legend>
          <label className="radio-option">
            <input
              type="radio"
              name="side"
              value="OneSide"
              checked={side === "OneSide"}
              onChange={() => setSide("OneSide")}
            />
            <span>
              <strong>Training</strong>
              <small>See the prompt and its associations together.</small>
            </span>
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="side"
              value="TwoSides"
              checked={side === "TwoSides"}
              onChange={() => setSide("TwoSides")}
            />
            <span>
              <strong>Recall</strong>
              <small>Think of the answer before revealing it.</small>
            </span>
          </label>
        </fieldset>
        <button className="button" disabled={busy || !!profileError}>
          {busy ? "Please wait…" : "Save preferences"}
        </button>
        {message && <p role="status">{message}</p>}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </form>
      <button className="text-button" onClick={leave} disabled={busy}>
        Sign out
      </button>
    </div>
  );
}
export function Account() {
  return (
    <AuthGate returnTo="/account/">
      <Settings />
    </AuthGate>
  );
}
