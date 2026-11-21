import { Feedback } from "@/components/feedback";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/feedback/", "en");
export default function Page() {
  return <Feedback />;
}
