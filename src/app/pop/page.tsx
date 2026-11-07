import type { Metadata } from "next";
import { PopRedirect } from "./redirect";
export const metadata: Metadata = {
  title: "Crowd Rush · 人潮突击",
  robots: { index: false },
};
/** Bubble Calm used to live here; old links now go to Crowd Rush. */
export default function PopPage() {
  return <PopRedirect />;
}
