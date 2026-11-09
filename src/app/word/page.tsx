import { Practice } from "@/components/practice";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/word/", "en");
export default function Page() {
  return <Practice mode="word" />;
}
