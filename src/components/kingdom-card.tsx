"use client";
// The kingdom on the account page: the stage, and what the next level opens.
import { pick } from "@/lib/i18n";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "./locale";
import { HALL_TITLES, MIN_LEVEL, STAGES } from "kingdom/kingdom";
import { xpToReach } from "kingdom/levels";
import { fetchKingdom, type KingdomView } from "@/lib/kingdom";

export function KingdomCard() {
  const { t, locale, href } = useLocale();
  const [view, setView] = useState<KingdomView | null>(null);
  useEffect(() => {
    fetchKingdom()
      .then(setView)
      .catch(() => {});
  }, []);
  const name = (title: { en: string; zh: string }) => pick(title, locale, true);
  const stage = STAGES.find((s) => s.id === view?.stage);
  const next = STAGES.find((s) => s.level > (view?.level ?? 0));
  const toGo = view && next ? Math.max(0, xpToReach(next.level) - view.xp) : 0;
  return (
    <section className="panel kingdom-card">
      <h2>{t("Your kingdom")}</h2>
      {!view ? (
        <p className="muted">{t("Loading…")}</p>
      ) : stage ? (
        <>
          <p>
            {t(
              `A ${name(stage.title).toLowerCase()} with a ${name(HALL_TITLES[view.hall]).toLowerCase()} and ${Object.keys(view.tiles).length} buildings.`,
            )}
          </p>
          {next && (
            <p className="muted">
              {t(
                `${toGo.toLocaleString(locale)} XP to a ${name(next.title).toLowerCase()}`,
              )}
            </p>
          )}
        </>
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
