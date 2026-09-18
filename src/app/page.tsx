import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 text-center">
      <span className="mb-4 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
        TechTreasure
      </span>
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
        Bulk Pinterest pins, generated in seconds.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-neutral-600">
        Turn one input into 20–200 pins. AI writes SEO-friendly titles,
        descriptions and tags. Images render right in your browser, and you
        export a CSV ready for Pinterest&apos;s bulk uploader — with every link
        monetized through our redirector.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/signup" className="btn-primary">
          Get started free
        </Link>
        <Link href="/login" className="btn-secondary">
          Log in
        </Link>
        <Link href="/pricing" className="btn-secondary">
          Pricing
        </Link>
      </div>
      <Link
        href="/redirector.html"
        className="mt-5 text-sm font-semibold text-brand hover:underline"
      >
        Open the redirector tool →
      </Link>
      <p className="mt-4 text-sm text-neutral-500">
        20 free monthly pin credits. AI credits are coming soon.
      </p>
      <nav className="mt-8 flex flex-wrap justify-center gap-4 text-xs text-neutral-500">
        <Link href="/legal/terms" className="hover:text-brand hover:underline">Terms</Link>
        <Link href="/legal/privacy" className="hover:text-brand hover:underline">Privacy</Link>
        <Link href="/legal/payments" className="hover:text-brand hover:underline">Payments</Link>
      </nav>
    </main>
  );
}
