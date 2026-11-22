"use client";
// Users admin: who may upload games (developers) and who may run dingn
// (admins), both claims on the person's account, changed by email; and the
// test accounts admins make for trying dingn (scripts/test-accounts.mjs).
import { useEffect, useState } from "react";
import { AdminOnly } from "./admin-games";
import { useLocale } from "./locale";
import { useSession } from "./session";
import {
  changeAdmin,
  changeDeveloper,
  createTesters,
  deleteTester,
  listAdmins,
  listDevelopers,
  listTesters,
  resetTesterPassword,
  type Admin,
  type Developer,
  type Tester,
} from "@/lib/admin-games";

export function AdminUsers() {
  const { t } = useLocale();
  const { user } = useSession();
  return (
    <AdminOnly path="/admin/users/">
      <div className="container admin-games" key={user?.uid}>
        <p className="eyebrow">{t("ADMIN")}</p>
        <h1>{t("Users")}</h1>
        <p className="lede">
          {t(
            "Choose who can upload games and who can run dingn. A person must have signed in to dingn once before you can change their access.",
          )}
        </p>
        <Admins />
        <Developers />
        <TestAccounts />
      </div>
    </AdminOnly>
  );
}

/** Who may open the admin pages: games, users and feedback. */
function Admins() {
  const { t } = useLocale();
  const { user } = useSession();
  const [list, setList] = useState<Admin[] | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ error: false, text: "" });

  useEffect(() => {
    listAdmins()
      .then(setList)
      .catch(() =>
        setMessage({
          error: true,
          text: t("Admins could not be loaded. Try again."),
        }),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function change(target: string, action: "add" | "remove") {
    setBusy(true);
    setMessage({ error: false, text: "" });
    try {
      const admin = await changeAdmin(target, action);
      setList((current) => {
        const others = (current ?? []).filter((a) => a.uid !== admin.uid);
        return action === "add"
          ? [...others, admin].sort((a, b) => a.email.localeCompare(b.email))
          : others;
      });
      if (action === "add") setEmail("");
      setMessage({
        error: false,
        text:
          action === "add"
            ? t(`${admin.email} is an admin now.`)
            : t(`${admin.email} is no longer an admin.`),
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      setMessage({
        error: true,
        text:
          code === "user-not-found"
            ? t(
                "No dingn account uses that email. Ask them to sign in once first.",
              )
            : code === "cannot-remove-self"
              ? t("You cannot remove your own admin access.")
              : t("That change could not be saved. Try again."),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel admin-game" aria-labelledby="admin-admins">
      <h2 id="admin-admins">{t("Admins")}</h2>
      <p className="admin-game-meta">
        {t(
          "Admins can review and take down games, change anyone's access, including other admins', and read feedback. Only make someone an admin if you trust them with all of dingn.",
        )}
      </p>
      {message.text && (
        <p
          role={message.error ? "alert" : "status"}
          className={message.error ? "error" : undefined}
        >
          {message.text}
        </p>
      )}
      <form
        className="admin-developer-form"
        onSubmit={(event) => {
          event.preventDefault();
          const target = email.trim();
          if (target && window.confirm(t(`Make ${target} an admin?`)))
            void change(target, "add");
        }}
      >
        <label htmlFor="admin-email">{t("Account email")}</label>
        <input
          id="admin-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="off"
        />
        <button type="submit" className="button small" disabled={busy}>
          {t("Make admin")}
        </button>
      </form>
      {list && list.length > 0 && (
        <ul className="admin-developers">
          {list.map((admin) => (
            <li key={admin.uid}>
              {admin.email || admin.uid}{" "}
              {admin.uid === user?.uid ? (
                <span className="admin-game-meta">{t("(you)")}</span>
              ) : (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(t(`Remove ${admin.email}'s admin access?`))
                    )
                      void change(admin.email, "remove");
                  }}
                >
                  {t("Remove")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Who may upload games on /developers/games/. */
function Developers() {
  const { t } = useLocale();
  const [list, setList] = useState<Developer[] | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ error: false, text: "" });

  useEffect(() => {
    listDevelopers()
      .then(setList)
      .catch(() =>
        setMessage({
          error: true,
          text: t("Developers could not be loaded. Try again."),
        }),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function change(target: string, action: "add" | "remove") {
    setBusy(true);
    setMessage({ error: false, text: "" });
    try {
      const developer = await changeDeveloper(target, action);
      setList((current) => {
        const others = (current ?? []).filter((d) => d.uid !== developer.uid);
        return action === "add"
          ? [...others, developer].sort((a, b) =>
              a.email.localeCompare(b.email),
            )
          : others;
      });
      if (action === "add") setEmail("");
      setMessage({
        error: false,
        text:
          action === "add"
            ? t(`${developer.email} can upload games now.`)
            : t(`${developer.email} can no longer upload games.`),
      });
    } catch (error) {
      setMessage({
        error: true,
        text:
          (error as { code?: string }).code === "user-not-found"
            ? t(
                "No dingn account uses that email. Ask them to sign in once first.",
              )
            : t("That change could not be saved. Try again."),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel admin-game" aria-labelledby="admin-developers">
      <h2 id="admin-developers">{t("Developers")}</h2>
      <p className="admin-game-meta">
        {t(
          "Developers sign up at /developers/games/ by accepting the developer agreement, or you add them here. Removing one also stops them from signing up again.",
        )}
      </p>
      {message.text && (
        <p
          role={message.error ? "alert" : "status"}
          className={message.error ? "error" : undefined}
        >
          {message.text}
        </p>
      )}
      <form
        className="admin-developer-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (email.trim()) void change(email.trim(), "add");
        }}
      >
        <label htmlFor="developer-email">{t("Account email")}</label>
        <input
          id="developer-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="off"
        />
        <button type="submit" className="button small" disabled={busy}>
          {t("Allow uploads")}
        </button>
      </form>
      {list && list.length === 0 && <p>{t("No developers yet.")}</p>}
      {list && list.length > 0 && (
        <ul className="admin-developers">
          {list.map((developer) => (
            <li key={developer.uid}>
              {developer.email || developer.uid}{" "}
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      t(`Stop ${developer.email} from uploading games?`),
                    )
                  )
                    void change(developer.email, "remove");
                }}
              >
                {t("Remove")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The most test accounts made at once (MAX_TESTERS on the server). */
const MAX_TESTERS = 20;

/**
 * Accounts for testing dingn: made here, already confirmed, so they sign in
 * with no inbox. Only these can be given a new password or deleted here.
 */
function TestAccounts() {
  const { t, locale } = useLocale();
  const [list, setList] = useState<Tester[] | null>(null);
  const [email, setEmail] = useState("");
  // As typed; checked when the form is sent.
  const [count, setCount] = useState("1");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ error: false, text: "" });
  // A password just set, shown once.
  const [shown, setShown] = useState("");

  useEffect(() => {
    listTesters()
      .then(setList)
      .catch(() =>
        setMessage({
          error: true,
          text: t("Test accounts could not be loaded. Try again."),
        }),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const failed = (error: unknown) => {
    const code = (error as { code?: string }).code;
    setMessage({
      error: true,
      text:
        code === "email-already-in-use"
          ? t(
              "One of those addresses already has a dingn account. Choose another address.",
            )
          : code === "cannot-remove-self"
            ? t("You cannot remove your own admin access.")
            : code === "weak-password"
              ? t("Use a password of 8 to 128 characters, or leave it empty.")
              : code === "invalid-request"
                ? t(
                    `Check the email address, and make 1 to ${MAX_TESTERS} accounts at a time.`,
                  )
                : t("That change could not be saved. Try again."),
    });
  };

  async function create() {
    setBusy(true);
    setMessage({ error: false, text: "" });
    setShown("");
    try {
      const many = Number(count);
      if (!Number.isInteger(many) || many < 1 || many > MAX_TESTERS)
        throw Object.assign(new Error("count"), { code: "invalid-request" });
      const made = await createTesters({
        email: email.trim(),
        count: many,
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(password ? { password } : {}),
      });
      setList((current) =>
        [...(current ?? []), ...made.testers].sort((a, b) =>
          a.email.localeCompare(b.email),
        ),
      );
      setEmail("");
      setCount("1");
      setName("");
      setPassword("");
      setShown(made.password);
      setMessage({
        error: false,
        text: t(
          `Test accounts made: ${made.testers.map((m) => m.email).join(", ")}.`,
        ),
      });
    } catch (error) {
      failed(error);
    } finally {
      setBusy(false);
    }
  }

  async function reset(tester: Tester) {
    setBusy(true);
    setMessage({ error: false, text: "" });
    setShown("");
    try {
      const result = await resetTesterPassword(tester.uid);
      setShown(result.password);
      setMessage({
        error: false,
        text: t(`${tester.email} has a new password.`),
      });
    } catch (error) {
      failed(error);
    } finally {
      setBusy(false);
    }
  }

  async function remove(tester: Tester) {
    setBusy(true);
    setMessage({ error: false, text: "" });
    setShown("");
    try {
      await deleteTester(tester.uid);
      setList((current) =>
        (current ?? []).filter((other) => other.uid !== tester.uid),
      );
      setMessage({ error: false, text: t(`${tester.email} was deleted.`) });
    } catch (error) {
      failed(error);
    } finally {
      setBusy(false);
    }
  }

  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { dateStyle: "medium" });

  return (
    <section className="panel admin-game" aria-labelledby="admin-testers">
      <h2 id="admin-testers">{t("Test accounts")}</h2>
      <p className="admin-game-meta">
        {t(
          "Test accounts sign in on the sign-in page with their email and password. dingn sends them no email, so the address needs no inbox. They play like anyone else but never appear on the leaderboard or earn coins for bringing friends. Making several gives each its own address: qa@example.com makes qa1@example.com, qa2@example.com and so on.",
        )}
      </p>
      {message.text && (
        <p
          role={message.error ? "alert" : "status"}
          className={message.error ? "error" : undefined}
        >
          {message.text}
        </p>
      )}
      {shown && (
        <div className="admin-key-new">
          <p>{t("Copy the password now. dingn shows it only once.")}</p>
          <code className="admin-key">{shown}</code>
        </div>
      )}
      <form
        className="admin-developer-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (email.trim()) void create();
        }}
      >
        <label htmlFor="tester-email">{t("Email")}</label>
        <input
          id="tester-email"
          type="email"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="off"
        />
        <label htmlFor="tester-count">{t("How many")}</label>
        <input
          id="tester-count"
          type="number"
          className="admin-number"
          min={1}
          max={MAX_TESTERS}
          value={count}
          onChange={(event) => setCount(event.target.value)}
        />
        <label htmlFor="tester-name">{t("Display name (optional)")}</label>
        <input
          id="tester-name"
          maxLength={60}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
        />
        <label htmlFor="tester-password">
          {t("Password (empty: dingn makes one)")}
        </label>
        <input
          id="tester-password"
          type="text"
          minLength={8}
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="off"
        />
        <button type="submit" className="button small" disabled={busy}>
          {t("Make test accounts")}
        </button>
      </form>
      {list && list.length === 0 && <p>{t("No test accounts yet.")}</p>}
      {list && list.length > 0 && (
        <ul className="admin-developers">
          {list.map((tester) => (
            <li key={tester.uid}>
              {tester.email || tester.uid}
              {tester.name && ` (${tester.name})`}{" "}
              <span className="admin-game-meta">
                {tester.lastActive
                  ? t(`Last active ${date(tester.lastActive)}`)
                  : t("Never signed in")}
                {tester.roles.includes("admin") && ` · ${t("Admin")}`}
              </span>{" "}
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(t(`Give ${tester.email} a new password?`)))
                    void reset(tester);
                }}
              >
                {t("New password")}
              </button>{" "}
              <button
                type="button"
                className="secondary-button danger"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      t(
                        `Delete the test account ${tester.email}? This can't be undone.`,
                      ),
                    )
                  )
                    void remove(tester);
                }}
              >
                {t("Delete")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
