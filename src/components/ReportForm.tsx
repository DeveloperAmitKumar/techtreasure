"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const REPORT_TYPES = [
  ["bug", "Bug report"],
  ["complaint", "Complaint"],
  ["question", "Question"],
  ["billing", "Billing or payment"],
  ["suggestion", "Suggestion"],
] as const;

export default function ReportForm({ userId, initialEmail }: { userId: string; initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [type, setType] = useState("bug");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    if (!email.trim() || !subject.trim() || !message.trim()) {
      setResult({ type: "error", text: "Please complete your email, subject, and message." });
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("reports").insert({
      user_id: userId,
      email: email.trim(),
      type,
      subject: subject.trim(),
      message: message.trim(),
      page_url: pageUrl.trim() || null,
    });
    setBusy(false);
    if (error) {
      setResult({ type: "error", text: error.message });
      return;
    }
    setSubject("");
    setMessage("");
    setPageUrl("");
    setResult({ type: "success", text: "Your report was sent. We will contact you by email." });
  }

  return (
    <form onSubmit={submit} className="card max-w-2xl space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="report-type">What do you need?</label>
          <select id="report-type" className="input" value={type} onChange={(event) => setType(event.target.value)}>
            {REPORT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="report-email">Your email</label>
          <input id="report-email" type="email" required className="input" value={email} onChange={(event) => setEmail(event.target.value)} />
          <p className="mt-1 text-xs text-neutral-500">We will use this address to reply.</p>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="report-subject">Subject</label>
        <input id="report-subject" required maxLength={160} className="input" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Briefly describe the issue" />
      </div>
      <div>
        <label className="label" htmlFor="report-message">Details</label>
        <textarea id="report-message" required maxLength={5000} className="input min-h-40 resize-y" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tell us what happened, what you expected, and the steps to reproduce it." />
      </div>
      <div>
        <label className="label" htmlFor="report-page">Page or feature involved <span className="font-normal text-neutral-400">(optional)</span></label>
        <input id="report-page" className="input" value={pageUrl} onChange={(event) => setPageUrl(event.target.value)} placeholder="For example: New batch, Pricing, or /dashboard/guides" />
      </div>
      {result && <p className={result.type === "error" ? "rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" : "rounded-md bg-green-50 px-3 py-2 text-sm text-green-700"}>{result.text}</p>}
      <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Sending…" : "Send report"}</button>
    </form>
  );
}
