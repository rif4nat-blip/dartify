"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const input = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-black";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Reset your password</h1>
      {sent ? (
        <p>
          If an account exists for <strong>{email}</strong>, we sent a link to reset the password.
          Check your inbox and spam folder.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input className={input} type="email" placeholder="Your account email" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button disabled={loading}
            className="rounded-lg bg-green-600 py-2 font-semibold text-white disabled:opacity-50">
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>
      )}
      <Link href="/login" className="text-sm underline">Back to log in</Link>
    </main>
  );
}