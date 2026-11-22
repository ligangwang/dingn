"use client";
// API keys admin: the admin's own keys for calling dingn from a script, an
// assistant or CI, in one place (scripts/upload-keys.mjs).
//   - Review keys review games and reward system releases.
//   - Upload keys upload games and send reward system releases for review,
//     such as kingdom's DINGN_UPLOAD_KEY secret.
// A new key is shown once; dingn keeps only a hash of it.
import { useEffect, useState } from "react";
import { AdminOnly } from "./admin-games";
import { useLocale } from "./locale";
import {
  createReviewKey,
  listReviewKeys,
  revokeReviewKey,
} from "@/lib/admin-games";
import {
  createUploadKey,
  listUploadKeys,
  revokeUploadKey,
} from "@/lib/developer-games";

type ApiKey = {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
};
type KeysResult = { keys: ApiKey[]; key?: string };

export function AdminKeys() {
  return (
    <AdminOnly path="/admin/keys/">
      <Keys />
    </AdminOnly>
  );
}

function Keys() {
  const { t } = useLocale();
  return (
    <div className="container admin-games admin-api-keys">
      <p className="eyebrow">{t("ADMIN")}</p>
      <h1>{t("API keys")}</h1>
      <p className="lede">
        {t(
          "Keys let a script, an assistant or CI call dingn as you, without signing in. Send one in the header Authorization: Bearer followed by the key, and keep it secret, for example as a GitHub secret. A key stops working when it is revoked or its account is no longer an admin.",
        )}
      </p>
      <KeySection
        id="review"
        title="Review keys"
        about="A review key reviews for you: it can list games and reward system releases and approve or send back a version, and nothing else. Send POST requests to https://dingn.com/api/admin/games, https://dingn.com/api/admin/games/update, https://dingn.com/api/admin/rewards and https://dingn.com/api/admin/rewards/update."
        placeholder="Key name, such as Claude"
        failed="Review keys could not be loaded."
        api={{
          list: listReviewKeys,
          create: createReviewKey,
          revoke: revokeReviewKey,
        }}
      />
      <KeySection
        id="upload"
        title="Upload keys"
        about="An upload key uploads for you: games to https://dingn.com/api/developer/games/upload, and reward system releases to https://dingn.com/api/rewards/upload, where they wait for review. kingdom's release workflow uses one as its DINGN_UPLOAD_KEY secret. An upload key can never review."
        placeholder="Key name, such as GitHub Actions"
        failed="Upload keys could not be loaded."
        api={{
          list: listUploadKeys,
          create: createUploadKey,
          revoke: revokeUploadKey,
        }}
      />
    </div>
  );
}

/** One kind of key: what it does, a form to create one, and the list. */
function KeySection({
  id,
  title,
  about,
  placeholder,
  failed,
  api,
}: {
  id: string;
  title: string;
  about: string;
  placeholder: string;
  failed: string;
  api: {
    list: () => Promise<KeysResult>;
    create: (name: string) => Promise<KeysResult>;
    revoke: (id: string) => Promise<KeysResult>;
  };
}) {
  const { t, locale } = useLocale();
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [name, setName] = useState("");
  const [created, setCreated] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  useEffect(() => {
    api
      .list()
      .then((result) => setKeys(result.keys))
      .catch(() => setProblem(t(failed)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(work: () => Promise<KeysResult>) {
    setBusy(true);
    setProblem("");
    try {
      const result = await work();
      setKeys(result.keys);
      return result;
    } catch (error) {
      setProblem(
        (error as { code?: string }).code === "too-many-keys"
          ? t("You can have up to 5 keys. Revoke one first.")
          : t("That did not work. Try again."),
      );
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function create(event: React.FormEvent) {
    event.preventDefault();
    const result = await run(() => api.create(name));
    if (result?.key) {
      setCreated(result.key);
      setName("");
    }
  }
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { dateStyle: "medium" });

  return (
    <section className="panel admin-keys" aria-labelledby={`admin-keys-${id}`}>
      <h2 id={`admin-keys-${id}`}>{t(title)}</h2>
      <p>{t(about)}</p>
      {created && (
        <div role="status" className="admin-key-new">
          <p>{t("Copy your new key now. dingn shows it only once.")}</p>
          <code className="admin-key">{created}</code>
        </div>
      )}
      <form className="admin-key-form" onSubmit={create}>
        <label htmlFor={`admin-key-name-${id}`} className="sr-only">
          {t("Key name")}
        </label>
        <input
          id={`admin-key-name-${id}`}
          value={name}
          maxLength={60}
          placeholder={t(placeholder)}
          onChange={(event) => setName(event.target.value)}
        />
        <button
          type="submit"
          className="button"
          disabled={busy || !name.trim()}
        >
          {t("Create key")}
        </button>
      </form>
      {problem && (
        <p role="alert" className="error">
          {problem}
        </p>
      )}
      {keys && keys.length === 0 && (
        <p className="muted">{t("No keys yet.")}</p>
      )}
      {keys && keys.length > 0 && (
        <ul className="admin-key-list">
          {keys.map((key) => (
            <li key={key.id}>
              <strong>{key.name}</strong> {t(`Created ${date(key.createdAt)}`)}
              {", "}
              {key.lastUsedAt
                ? t(`last used ${date(key.lastUsedAt)}`)
                : t("never used")}{" "}
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      t(
                        `Revoke ${key.name}? Anything using it will stop working.`,
                      ),
                    )
                  )
                    void run(() => api.revoke(key.id));
                }}
              >
                {t("Revoke")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
