import { pageMetadata } from "@/lib/seo";
import { localeOfPrefix } from "@/lib/packs.server";
export { default } from "@/app/(en)/casual/page";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  return pageMetadata("/casual/", localeOfPrefix((await params).lang));
}
