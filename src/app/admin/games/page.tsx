import { AdminGames } from "@/components/admin-games";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/admin/games/", "en");
export default function Page() {
  return <AdminGames />;
}
