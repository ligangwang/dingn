import { CrowdGame } from "@/components/crowd-game";
import "./crowd.css";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/crowd/", "en");
export default function CrowdPage() {
  return <CrowdGame />;
}
