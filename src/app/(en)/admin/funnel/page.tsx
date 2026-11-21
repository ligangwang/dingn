import { AdminFunnel } from "@/components/admin-funnel";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/admin/funnel/", "en");
export default function Page() {
  return <AdminFunnel />;
}
