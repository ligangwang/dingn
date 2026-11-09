import type { MetadataRoute } from "next";
import { localePath } from "@/lib/i18n";
import { alternates, locales, siteUrl, sitemapPaths } from "@/lib/seo";
export const dynamic = "force-static";
/** Every public page in English and Chinese, each listing its translations. */
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapPaths.flatMap((path) =>
    locales.map((locale) => ({
      url: siteUrl + localePath(path, locale),
      alternates: { languages: alternates(path) },
    })),
  );
}
