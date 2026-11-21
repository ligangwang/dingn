"use client";
import { useLocale } from "@/components/locale";
import { SiteChrome } from "@/components/site-chrome";
import Link from "next/link";
/** The page for an unknown address, in the frame English pages have. */
export default function NotFound() {
  return (
    <SiteChrome>
      <Lost />
    </SiteChrome>
  );
}
function Lost() {
  const { t, locale, href } = useLocale();

  return (
    <div className="center-page">
      <section className="signin-panel panel">
        <h1>{t("This page wandered off.")}</h1>
        <p>{t("Let’s get you back to the games.")}</p>
        <Link className="button" href={href("/")}>
          {t("Back to dingn")}
        </Link>
      </section>
    </div>
  );
}
