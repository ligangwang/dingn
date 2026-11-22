import { ApiKeys } from "@/components/api-keys";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/developers/keys/", "en");
export default function Page() {
  return <ApiKeys />;
}
