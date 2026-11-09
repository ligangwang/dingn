import { AdminFeedback } from "@/components/admin-feedback";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/admin/feedback/", "en");
export default function Page() {
  return <AdminFeedback />;
}
