"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "./session";
import { readFeedbackPage, type FeedbackCursor } from "@/lib/admin-feedback";

export function AdminFeedback() {
  const { user, ready, isAdmin } = useSession();
  if (!ready)
    return (
      <div className="center-page">
        <p role="status">Checking access…</p>
      </div>
    );
  if (!user)
    return (
      <div className="center-page">
        <section className="panel signin-panel">
          <h1>Admin sign-in</h1>
          <p>Sign in with an account that has admin access.</p>
          <Link className="button" href="/signin/?next=%2Fadmin%2Ffeedback%2F">
            Sign in
          </Link>
        </section>
      </div>
    );
  if (!isAdmin)
    return (
      <div className="center-page">
        <section className="panel signin-panel">
          <h1>Admin access required</h1>
          <p>Your account does not have permission to view feedback.</p>
          <Link href="/">Back to practices</Link>
        </section>
      </div>
    );
  return <Inbox key={user.uid} />;
}

function Inbox() {
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
          <h1>Feedback inbox</h1>
          <p>Newest submissions first · Page {page + 1}</p>
        </div>
        <button
          className="secondary-button"
          onClick={() => {
            setCursors([undefined]);
            setPage(0);
            setRefresh((n) => n + 1);
          }}
        >
          Refresh
        </button>
      </div>
      {error ? (
        <p role="alert">
          Couldn’t load feedback. Check your admin access and try Refresh.
        </p>
      ) : !result ? (
        <p role="status">Loading feedback…</p>
      ) : result.items.length === 0 ? (
        <p role="status">No feedback on this page.</p>
      ) : (
        <div className="feedback-list">
          {result.items.map((item) => (
            <article className="panel" key={item.id}>
              <p className="eyebrow">
                {item.status} ·{" "}
                {item.createdAt ? (
                  <time dateTime={item.createdAt}>
                    {new Date(item.createdAt).toLocaleString()}
                  </time>
                ) : (
                  "Date unavailable"
                )}
              </p>
              <p className="feedback-message">{item.message}</p>
              <p className="feedback-author">
                {item.authorName ||
                  (item.uid === user?.uid
                    ? profile?.userName || user.displayName || user.email
                    : "") ||
                  "Name not set"}
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
          Newer
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
          Older
        </button>
      </div>
    </div>
  );
}
