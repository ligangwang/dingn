import Link from "next/link";
export default function OptOut() {
  return (
    <div className="container mind-page">
      <p className="eyebrow">YOUR PRIVACY</p>
      <h1>Analytics is off.</h1>
      <p>
        This page opts this browser out of dingn analytics. Sign-in and games
        work as usual.
      </p>
      <p>
        Use this URL in each browser where you want to opt out:
        https://dingn.com/opt-out
      </p>
      <Link className="button" href="/">
        Back to dingn
      </Link>
    </div>
  );
}
