import { OptOut } from "@/components/opt-out";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/opt-out/", "en");
export default function Page() {
  return <OptOut />;
}
