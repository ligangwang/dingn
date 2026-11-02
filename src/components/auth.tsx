"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "./session";
import { friendlyError, safeDestination } from "@/lib/models";
export function SignIn() {
  const { user, ready, login } = useSession();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (ready && user)
      router.replace(
        safeDestination(
          new URLSearchParams(window.location.search).get("next"),
        ),
      );
  }, [ready, user, router]);
  async function submit() {
    setPending(true);
    setError("");
    try {
      await login();
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
          Save your progress.
          <br />
          Keep your streak.
        </h1>
        <p>
          Sign in to play the memory games with words, numbers, and playing
          cards.
        </p>
        <button
          className="google-button"
          onClick={submit}
          disabled={!ready || pending}
        >
          <span aria-hidden="true" className="google-g">
            G
          </span>
          {pending ? "Signing in…" : "Continue with Google"}
        </button>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <Link className="quiet-link" href="/">
          Back to games
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
  const { user, ready } = useSession();
  if (!ready)
    return (
      <div className="center-page">
        <p role="status">Loading your game…</p>
      </div>
    );
  if (!user)
    return (
      <div className="center-page">
        <section className="signin-panel panel">
          <div className="round-icon" aria-hidden="true">
            ✦
          </div>
          <h1>Your next game awaits.</h1>
          <p>Sign in with your existing dingn account to continue.</p>
          <Link
            className="button"
            href={`/signin/?next=${encodeURIComponent(returnTo)}`}
          >
            Sign in to play
          </Link>
          <Link className="quiet-link" href="/">
            Back to games
          </Link>
        </section>
      </div>
    );
  return children;
}
