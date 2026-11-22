"use client";
// The Leaderboard page (/leaderboard/): the top players. The menu links the
// Challenges page (challenges-page.tsx), which shows the same board; only
// admins can open either board until an admin makes it public on the Players
// admin page.
import { useLocale } from "./locale";
import { Leaderboard } from "./xp";

export function LeaderboardPage() {
  const { t } = useLocale();
  return (
    <div className="container leaderboard-page">
      <Leaderboard
        hidden={
          <section className="panel">
            <h1>{t("Leaderboard")}</h1>
            <p className="muted">{t("The leaderboard isn’t open yet.")}</p>
          </section>
        }
      />
    </div>
  );
}
