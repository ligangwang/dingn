import type { Metadata } from "next";
import { MorrowglintFeature } from "@/components/morrowglint";
export const metadata: Metadata = {
  title: "Morrowglint · 拾光幻境",
  description:
    "An upcoming 3D fantasy adventure by dingn. 开发中的 3D 奇幻冒险游戏《拾光幻境》。",
};
export default function MorrowglintPage() {
  return (
    <div className="container mind-page">
      <MorrowglintFeature full />
    </div>
  );
}
