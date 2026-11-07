"use client";
import { useLocale } from "@/components/locale";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useSession } from "./session";
import { submitFeedback } from "@/lib/feedback";
import { friendlyError } from "@/lib/models";

export function Feedback() {
  const { t, locale } = useLocale();

  const { user, ready, login } = useSession();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current || !user) return;
    if (!message.trim()) {
      setError("Please enter your feedback.");
      return;
    }
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await submitFeedback(user.uid, message);
      setSent(true);
      setMessage("");
    } catch {
      setError(
        "We couldn’t save your feedback. Your message is still here; please try again.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function signIn() {
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
    <div className="settings container feedback-page">
      <h1>{t("We’re listening.")}</h1>
      <p>
        {t(
          "Share an idea, report a problem, or tell us what would make dingn better.",
        )}
      </p>
      <section className="panel">
        {sent ? (
          <div role="status">
            <h2>{t("Thanks for your feedback.")}</h2>
            <p>
              {t("Your message has been saved for the dingn team to review.")}
            </p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label htmlFor="feedback-message">{t("Your feedback")}</label>
            <textarea
              id="feedback-message"
              required
              maxLength={5000}
              rows={7}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={pending}
              aria-describedby="feedback-note"
            />
            <p id="feedback-note">
              {t(
                "Only the dingn team can read your feedback. Up to 5,000 characters.",
              )}
            </p>
            {user ? (
              <button
                className="button"
                type="submit"
                disabled={pending || !ready || !message.trim()}
              >
                {t(pending ? "Saving…" : "Submit feedback")}
              </button>
            ) : (
              <>
                <p>{t("Sign in to submit. Your draft will stay here.")}</p>
                <Link className="button" href="/signin/">
                  {t("Sign in with email")}
                </Link>
                <button
                  className="google-button"
                  type="button"
                  onClick={signIn}
                  disabled={pending || !ready}
                >
                  {t(pending ? "Signing in…" : "Continue with Google")}
                </button>
              </>
            )}
          </form>
        )}
        {error && (
          <p role="alert" className="error">
            {t(error)}
          </p>
        )}
      </section>
      <Link className="quiet-link" href="/">
        {t("Back to games")}
      </Link>
    </div>
  );
}
