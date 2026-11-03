"use client";
import Link from "next/link";
import { useLocale } from "./locale";
export function MorrowglintFeature({ full = false }: { full?: boolean }) {
  const { t, locale } = useLocale();
  return (
    <section
      className={`morrow-feature ${full ? "morrow-full" : ""}`}
      aria-labelledby="morrow-title"
    >
      <div className="morrow-emblem" aria-hidden="true">
        <span>✦</span>
      </div>
      <div className="morrow-copy">
        <p className="eyebrow">{t("A DINGN ORIGINAL · IN DEVELOPMENT")}</p>
        {full ? (
          <h1 id="morrow-title">
            {locale === "zh-CN" ? "拾光幻境" : "Morrowglint"}
          </h1>
        ) : (
          <h2 id="morrow-title">
            {locale === "zh-CN" ? "拾光幻境" : "Morrowglint"}
          </h2>
        )}
        {locale === "zh-CN" && <p className="morrow-subtitle">Morrowglint</p>}
        <p className="lede">
          {t("Awaken your power. Restore a forgotten world.")}
        </p>
        <p>
          {t(
            "A stylized 3D fantasy adventure about lost memories, luminous companions, and a world waiting to shine again.",
          )}
        </p>
        {full ? (
          <>
            <p>
              {t(
                "Try our first browser prototype in English or Simplified Chinese. The full adventure and Android / iOS apps are still in development.",
              )}
            </p>
            <div className="morrow-pillars">
              {[
                "Fight with memory",
                "Befriend luminous creatures",
                "Make your hero your own",
              ].map((title) => (
                <div key={title}>
                  <span aria-hidden="true">✧</span>
                  <h2>{t(title)}</h2>
                </div>
              ))}
            </div>
            <p>
              {t(
                "Our first chapter follows a memory restorer who rescues a fading light spirit and brings a ruined courtyard back to life. Features and release timing are still being developed.",
              )}
            </p>
            <Link className="button" href="/morrowglint/play/">
              {t("Play the first chapter →")}
            </Link>
            <Link className="quiet-link" href="/">
              {t("Back to games")}
            </Link>
          </>
        ) : (
          <Link className="button" href="/morrowglint/">
            {t("Discover Morrowglint →")}
          </Link>
        )}
      </div>
    </section>
  );
}
