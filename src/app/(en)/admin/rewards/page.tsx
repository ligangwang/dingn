import { AdminRewards } from "@/components/admin-rewards";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/admin/rewards/", "en");
export default function Page() {
  return <AdminRewards />;
}
