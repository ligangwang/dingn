import { PlayerPage } from "@/components/player-page";
import { pageMetadata } from "@/lib/seo";
// One page shows every player: the server serves it for /player/<number>/.
export const metadata = pageMetadata("/player/", "en");
export default function Page() {
  return <PlayerPage />;
}
