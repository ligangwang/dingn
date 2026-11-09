"use client";
// Users admin: who may upload games (developers) and who may run dingn
// (admins). Both are claims on the person's account, changed by email.
import { useEffect, useState } from "react";
import { AdminOnly } from "./admin-games";
import { useLocale } from "./locale";
import { useSession } from "./session";
import {
  changeAdmin,
  changeDeveloper,
  listAdmins,
  listDevelopers,
  type Admin,
  type Developer,
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
