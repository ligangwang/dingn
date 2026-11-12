"use client";
// The kingdom on the account page: the stage, and what the next level opens.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "./locale";
import { HALL_TITLES, MIN_LEVEL, STAGES } from "@/data/kingdom.mjs";
import { fetchKingdom, type KingdomView } from "@/lib/kingdom";

export function KingdomCard() {
  const { t, locale, href } = useLocale();
  const [view, setView] = useState<KingdomView | null>(null);
  useEffect(() => {
    fetchKingdom()
      .then(setView)
      .catch(() => {});
  }, []);
  const name = (title: { en: string; zh: string }) =>
    locale === "zh-CN" ? title.zh : title.en;
  const stage = STAGES.find((s) => s.id === view?.stage);
  const next = STAGES.find((s) => s.level > (view?.level ?? 0));
  const toGo = view && next ? 50 * next.level * (next.level - 1) - view.xp : 0;
  return (
    <section className="panel kingdom-card">
      <h2>{t("Your kingdom")}</h2>
      {!view ? (
        <p className="muted">{t("Loading…")}</p>
      ) : stage ? (
        <p>
          {t(
            `A ${name(stage.title).toLowerCase()} with a ${name(HALL_TITLES[view.hall]).toLowerCase()} and ${Object.keys(view.tiles).length} buildings.`,
          )}{" "}
          {next &&
            t(
              `Level ${next.level}: your land grows into a ${name(next.title).toLowerCase()}, ${toGo.toLocaleString(locale)} XP to go.`,
            )}
        </p>
      ) : (
        <p>
          {t(
            `Reach level ${MIN_LEVEL} to found your kingdom, ${toGo.toLocaleString(locale)} XP to go.`,
          )}
        </p>
      )}
      <Link className="button" href={href("/kingdom/")}>
        {t("Visit your kingdom →")}
      </Link>
    </section>
  );
}
