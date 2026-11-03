"use client";
import { useLocale } from "@/components/locale";
import Link from "next/link";
export default function OptOut() {
  const { t, locale } = useLocale();

  return (
    <div className="container mind-page">
      <p className="eyebrow">{t("YOUR PRIVACY")}</p>
      <h1>{t("Analytics is off.")}</h1>
      <p>
        {t(
          "This page opts this browser out of dingn analytics. Sign-in and games work as usual.",
        )}
      </p>
      <p>
        {t(
          "Use this URL in each browser where you want to opt out: https://dingn.com/opt-out",
        )}
      </p>
      <Link className="button" href="/">
        {t("Back to dingn")}
      </Link>
    </div>
  );
}
