import { DeveloperGames } from "@/components/developer-games";
import { pageMetadata } from "@/lib/seo";
import "../developers.css";
export const metadata = pageMetadata("/developers/games/", "en");
export default function Page() {
  return <DeveloperGames />;
}
