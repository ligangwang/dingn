import Link from "next/link";
export default function NotFound() {
  return (
    <div className="center-page">
      <section className="signin-panel panel">
        <h1>This page wandered off.</h1>
        <p>Let’s get back to your memory practice.</p>
        <Link className="button" href="/">
          Back to dingn
        </Link>
      </section>
    </div>
  );
}
