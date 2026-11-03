"use client";
import { useLocale } from "@/components/locale";
import Link from "next/link";
export default function NotFound() {
  const { t, locale } = useLocale();

  return (
    <div className="center-page">
      <section className="signin-panel panel">
        <h1>{t("This page wandered off.")}</h1>
        <p>{t("Let’s get you back to the games.")}</p>
        <Link className="button" href="/">
          {t("Back to dingn")}
        </Link>
      </section>
    </div>
  );
}
