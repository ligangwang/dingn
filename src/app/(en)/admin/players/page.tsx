import { AdminPlayers } from "@/components/admin-players";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/admin/players/", "en");
export default function Page() {
  return <AdminPlayers />;
}
