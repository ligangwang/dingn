import { Practice } from "@/components/practice";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/number/", "en");
export default function Page() {
  return <Practice mode="number" />;
}
