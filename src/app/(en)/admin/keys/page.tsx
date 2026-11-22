import { AdminKeys } from "@/components/admin-keys";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/admin/keys/", "en");
export default function Page() {
  return <AdminKeys />;
}
