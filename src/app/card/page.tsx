import { Practice } from "@/components/practice";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/card/", "en");
export default function Page() {
  return <Practice mode="card" />;
}
