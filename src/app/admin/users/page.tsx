import { AdminUsers } from "@/components/admin-users";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/admin/users/", "en");
export default function Page() {
  return <AdminUsers />;
}
