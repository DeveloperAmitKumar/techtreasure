"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (!acceptedTerms || !acceptedPrivacy) {
      setError("Please accept the Terms and Conditions and Privacy Policy.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // If email confirmation is disabled, Supabase returns a session immediately.
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setMessage("Check your email to confirm your account, then log in.");
  }

  return (
    <>
      <h1 className="mb-1 text-xl font-bold">Create your account</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Start with 20 free monthly pin credits. AI credits are coming soon.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div className="space-y-2 rounded-md bg-neutral-50 p-3 text-sm text-neutral-700">
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />
            <span>I agree to the <Link href="/legal/terms" target="_blank" className="font-semibold text-brand hover:underline">Terms and Conditions</Link>.</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand" checked={acceptedPrivacy} onChange={(e) => setAcceptedPrivacy(e.target.checked)} />
            <span>I acknowledge the <Link href="/legal/privacy" target="_blank" className="font-semibold text-brand hover:underline">Privacy Policy</Link>.</span>
          </label>
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <p className="mt-1 text-xs text-neutral-400">Minimum 6 characters.</p>
        </div>
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {message && (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            {message}
          </p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Creating account…" : "Sign up"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-neutral-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}
