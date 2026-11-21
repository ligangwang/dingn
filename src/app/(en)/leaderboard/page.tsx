import { LeaderboardPage } from "@/components/leaderboard-page";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/leaderboard/", "en");
export default function Page() {
  return <LeaderboardPage />;
}
