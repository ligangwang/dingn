"use client";
import { useLocale } from "@/components/locale";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "./session";
import { readFeedbackPage, type FeedbackCursor } from "@/lib/admin-feedback";

export function AdminFeedback() {
  const { t, locale, href } = useLocale();

  const { user, ready, isAdmin } = useSession();
  if (!ready)
    return (
      <div className="center-page">
        <p role="status">{t("Checking access…")}</p>
      </div>
    );
  if (!user)
    return (
      <div className="center-page">
        <section className="panel signin-panel">
          <h1>{t("Admin sign-in")}</h1>
          <p>{t("Sign in with an account that has admin access.")}</p>
          <Link
            className="button"
            href={`${href("/signin/")}?next=${encodeURIComponent(href("/admin/feedback/"))}`}
          >
            {t("Sign in")}
          </Link>
        </section>
      </div>
    );
  if (!isAdmin)
    return (
      <div className="center-page">
        <section className="panel signin-panel">
          <h1>{t("Admin access required")}</h1>
          <p>{t("Your account does not have permission to view feedback.")}</p>
          <Link href={href("/")}>{t("Back to games")}</Link>
        </section>
      </div>
    );
  return <Inbox key={user.uid} />;
}

function Inbox() {
  const { t, locale, href } = useLocale();

  const { user, profile } = useSession();
  const [cursors, setCursors] = useState<(FeedbackCursor | undefined)[]>([
    undefined,
  ]);
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof readFeedbackPage>
  > | null>(null);
  const [error, setError] = useState(false);
  const cursor = cursors[page];
  useEffect(() => {
    let active = true;
    setResult(null);
    setError(false);
    readFeedbackPage(cursor)
      .then((value) => {
        if (active) setResult(value);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [cursor, refresh]);
  return (
    <div className="container admin-feedback">
      <div className="practice-toolbar">
        <div>
          <h1>{t("Feedback inbox")}</h1>
          <p>{t(`Newest submissions first · Page ${page + 1}`)}</p>
        </div>
        <button
          className="secondary-button"
          onClick={() => {
            setCursors([undefined]);
            setPage(0);
            setRefresh((n) => n + 1);
          }}
        >
          {t("Refresh")}
        </button>
      </div>
      {error ? (
        <p role="alert">
          {t(
            "Couldn’t load feedback. Check your admin access and try Refresh.",
          )}
        </p>
      ) : !result ? (
        <p role="status">{t("Loading feedback…")}</p>
      ) : result.items.length === 0 ? (
        <p role="status">{t("No feedback on this page.")}</p>
      ) : (
        <div className="feedback-list">
          {result.items.map((item) => (
            <article className="panel" key={item.id}>
              <p className="eyebrow">
                {t(item.status)} ·{" "}
                {item.createdAt ? (
                  <time dateTime={item.createdAt}>
                    {new Date(item.createdAt).toLocaleString(locale)}
                  </time>
                ) : (
                  t("Date unavailable")
                )}
              </p>
              <p className="feedback-message">{item.message}</p>
              <p className="feedback-author">
                {item.authorName ||
                  (item.uid === user?.uid
                    ? profile?.userName || user.displayName || user.email
                    : "") ||
                  t("Name not set")}
              </p>
            </article>
          ))}
        </div>
      )}
      <div className="pager">
        <button
          className="secondary-button"
          disabled={page === 0 || !result}
          onClick={() => setPage((n) => n - 1)}
        >
          {t("Newer")}
        </button>
        <button
          className="secondary-button"
          disabled={!result?.more}
          onClick={() => {
            if (!result?.cursor) return;
            setCursors((previous) => [
              ...previous.slice(0, page + 1),
              result.cursor,
            ]);
            setPage((n) => n + 1);
          }}
        >
          {t("Older")}
        </button>
      </div>
    </div>
  );
}
