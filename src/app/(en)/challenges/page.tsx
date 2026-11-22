import { ChallengesPage } from "@/components/challenges-page";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/challenges/", "en");
export default function Page() {
  return <ChallengesPage />;
}
