import { CoinShop } from "@/components/coin-shop";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/coins/", "en");
export default function Page() {
  return <CoinShop />;
}
