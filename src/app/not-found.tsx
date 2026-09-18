import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-4xl font-extrabold">404</h1>
      <p className="mt-2 text-neutral-600">This page doesn&apos;t exist.</p>
      <Link href="/dashboard" className="btn-primary mt-6">
        Back to dashboard
      </Link>
    </main>
  );
}
