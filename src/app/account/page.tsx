import { Account } from "@/components/account";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/account/", "en");
export default function Page() {
  return <Account />;
}
