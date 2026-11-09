"use client";
// Plays a game published on the dingn game platform. The page is the same for
// every game: it asks the registry which version is live, runs that version in
// a sandboxed frame, and answers the game's SDK requests (src/lib/game-bridge).
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "./locale";
import { useOptionalSession } from "./session";
import { database, doc, getDoc, setDoc } from "@/lib/database";
import {
  countPlay,
  reportGame,
  REPORT_REASONS,
  type ReportReason,
} from "@/lib/game-reports";
import {
  accountProgress,
  handleGameRequest,
  isGameRequest,
  progressField,
  PROTOCOL,
  type BridgeContext,
  type Player,
} from "@/lib/game-bridge";

export type PublishedGame = {
  id: string;
  version: string;
  title: { en: string; zh: string };
  description: { en: string; zh: string };
  entry: string;
  url: string;
  /** An outside developer's upload that dingn has not reviewed yet. */
  preview?: boolean;
};

/** The game id in /play/<id>/ or /zh/play/<id>/. */
export function gameIdFromPath(pathname: string) {
  return (
    /^\/(?:zh\/)?play\/([a-z][a-z0-9]{1,30})\/?$/.exec(pathname)?.[1] ?? ""
  );
}

// What a sandboxed frame may do. It has no allow-same-origin, so the game runs
// in its own opaque origin, cut off from the website's cookies and storage.
export const SANDBOX =
  "allow-scripts allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-forms";

/** Plays the game in the URL (/play/<id>/), or `gameId` on a game's own page. */
export function GameHost({ gameId }: { gameId?: string } = {}) {
  const { locale, t, href } = useLocale();
  const session = useOptionalSession();
  const frame = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<
    | { status: "loading" | "missing" | "error" }
    | { status: "ready"; game: PublishedGame; pinned: string }
  >({ status: "loading" });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const id = gameId ?? gameIdFromPath(location.pathname);
    const requested = new URLSearchParams(location.search).get("v") ?? "";
    if (!id) return setState({ status: "missing" });
    let active = true;
    fetch(
      `/api/games/${id}${requested ? `?v=${encodeURIComponent(requested)}` : ""}`,
    )
      .then(async (response) => {
        if (!active) return;
        if (response.status === 404) return setState({ status: "missing" });
        if (!response.ok) throw new Error("unavailable");
        setState({
          status: "ready",
          game: await response.json(),
          pinned: requested,
        });
      })
      .catch(() => active && setState({ status: "error" }));
    return () => {
      active = false;
    };
  }, []);

  const game = state.status === "ready" ? state.game : null;
  const title = game
    ? locale === "zh-CN"
      ? game.title.zh
      : game.title.en
    : "";
  useEffect(() => {
    if (title) document.title = `${title} · dingn`;
  }, [title]);

  const user = session?.user ?? null;
  const player: Player = {
    signedIn: !!user,
    name: session?.profile.userName || user?.displayName || "",
    avatar: user?.photoURL || "",
  };
  // The bridge reads the latest values through a ref, so the message listener
  // is attached once per game.
  const context = useRef<BridgeContext | null>(null);
  context.current = game && {
    gameId: game.id,
    version: game.version,
    locale,
    player,
    storage: (() => {
      try {
        return window.localStorage;
      } catch {
        return null;
      }
    })(),
    loadProgress: async () => {
      if (!user) return null;
      const data = (await getDoc(doc(database, "accounts", user.uid))).data();
      return accountProgress(game.id, data);
    },
    saveProgress: async (json) => {
      if (!user) throw new Error("signed_out");
      await setDoc(
        doc(database, "accounts", user.uid),
        { [progressField(game.id)]: json },
        { merge: true },
      );
    },
    navigate: (path) => {
      // The bridge already checked the path; check the final URL again so a
      // game can never send the player to another site.
      const target = new URL(href(path), location.origin);
      if (target.origin === location.origin) location.href = target.href;
    },
    signIn: () => {
      location.href = `${href("/signin/")}?next=${encodeURIComponent(location.pathname + location.search)}`;
    },
    ready: () => setLoaded(true),
  };

  useEffect(() => {
    if (!game) return;
    function onMessage(event: MessageEvent) {
      const target = frame.current?.contentWindow;
      // Only the game's own frame, which runs in an opaque ("null") origin.
      if (!target || event.source !== target || !isGameRequest(event.data))
        return;
      const ctx = context.current;
      if (!ctx) return;
      void handleGameRequest(event.data, ctx).then((reply) => {
        if (reply) target.postMessage(reply, "*");
      });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [game?.id, game?.version]);

  // Count one play each time a game opens, for its developer's stats.
  useEffect(() => {
    if (game) countPlay(game.id, game.version);
  }, [game?.id, game?.version]);

  // Tell the game when the player signs in or out.
  const playerKey = JSON.stringify(player);
  const firstPlayer = useRef(true);
  useEffect(() => {
    if (firstPlayer.current) {
      firstPlayer.current = false;
      return;
    }
    frame.current?.contentWindow?.postMessage(
      { dingn: "host", v: PROTOCOL, event: "player", data: player },
      "*",
    );
  }, [playerKey]);

  if (state.status === "loading")
    return (
      <div className="container play-page">
        <p className="play-status">{t("Loading game…")}</p>
      </div>
    );
  if (state.status !== "ready")
    return (
      <div className="container play-page">
        <h1>
          {state.status === "missing"
            ? t("Game not found")
            : t("This game is not available right now.")}
        </h1>
        <p>
          <Link href={href("/")}>{t("Find another game →")}</Link>
        </p>
      </div>
    );

  const testing = state.pinned
    ? state.pinned === "beta"
      ? t("Beta")
      : state.pinned
    : "";
  return (
    <div className="play-page play-ready">
      <div className="play-bar">
        <h1>{title}</h1>
        {testing && (
          <span className="play-version" title={state.game.version}>
            {testing} · {state.game.version}
          </span>
        )}
        <button
          type="button"
          className="play-fullscreen"
          onClick={() => void frame.current?.requestFullscreen?.()}
        >
          {t("Full screen")}
        </button>
      </div>
      {state.game.preview && (
        <p className="play-preview" role="note">
          {t(
            "Preview: an outside developer made this version, and dingn has not reviewed it yet. Never enter a password or payment details in a game.",
          )}
        </p>
      )}
      <div className="play-stage">
        {!loaded && <p className="play-status">{t("Loading game…")}</p>}
        <iframe
          ref={frame}
          src={state.game.url}
          title={title}
          sandbox={SANDBOX}
          allow="fullscreen; autoplay; gamepad; accelerometer; gyroscope"
          allowFullScreen
          onLoad={() => setTimeout(() => setLoaded(true), 4000)}
        />
      </div>
      <ReportGame game={state.game} signedIn={!!user} />
    </div>
  );
}

const REASON_TEXT: Record<ReportReason, string> = {
  broken: "It does not work",
  offensive: "It is offensive or not for children",
  unsafe: "It asks for personal details, or looks like a scam",
  copyright: "It copies someone else's game or work",
  other: "Something else",
};

/** Lets a player tell dingn about a problem with a game. */
function ReportGame({
  game,
  signedIn,
}: {
  game: PublishedGame;
  signedIn: boolean;
}) {
  const { t, href } = useLocale();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<"" | "sending" | "sent" | "failed">("");

  if (status === "sent")
    return (
      <p className="play-report" role="status">
        {t("Thanks. dingn will look at this game.")}
      </p>
    );
  if (!open)
    return (
      <p className="play-report">
        <button
          type="button"
          className="link-button"
          onClick={() => setOpen(true)}
        >
          {t("Report a problem with this game")}
        </button>
      </p>
    );
  if (!signedIn)
    return (
      <p className="play-report">
        {t("Sign in to report a game.")}{" "}
        <Link
          href={`${href("/signin/")}?next=${encodeURIComponent(
            typeof location === "undefined"
              ? href(`/play/${game.id}/`)
              : location.pathname + location.search,
          )}`}
        >
          {t("Sign in")}
        </Link>
      </p>
    );

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!reason) return;
    setStatus("sending");
    try {
      await reportGame({ id: game.id, version: game.version, reason, details });
      setStatus("sent");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <form className="play-report play-report-form" onSubmit={send}>
      <fieldset>
        <legend>{t("What is wrong with this game?")}</legend>
        {REPORT_REASONS.map((value) => (
          <label key={value}>
            <input
              type="radio"
              name="report-reason"
              value={value}
              checked={reason === value}
              onChange={() => setReason(value)}
            />{" "}
            {t(REASON_TEXT[value])}
          </label>
        ))}
      </fieldset>
      <label htmlFor="report-details">{t("Details (optional)")}</label>
      <textarea
        id="report-details"
        value={details}
        maxLength={1000}
        rows={3}
        onChange={(event) => setDetails(event.target.value)}
      />
      {status === "failed" && (
        <p role="alert" className="error">
          {t("The report could not be sent. Try again.")}
        </p>
      )}
      <p>
        <button
          type="submit"
          className="button small"
          disabled={
            !reason ||
            (reason === "other" && !details.trim()) ||
            status === "sending"
          }
        >
          {t("Send report")}
        </button>{" "}
        <button
          type="button"
          className="secondary-button"
          onClick={() => setOpen(false)}
        >
          {t("Cancel")}
        </button>
      </p>
    </form>
  );
}
