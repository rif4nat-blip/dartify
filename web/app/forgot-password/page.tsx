"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const input = "field";

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
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center p-6">
      <div className="card flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
          <p className="mt-1 text-sm text-gray-400">
            Enter your account email and we will send you a reset link.
          </p>
        </div>

        {sent ? (
          <div className="rounded-lg border border-green-600/40 bg-green-600/10 p-4 text-sm text-green-300">
            If an account exists for <strong>{email}</strong>, we sent a link to reset the
            password. Check your inbox and spam folder.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-sm text-gray-300">
              Email
              <input className={input} type="email" placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required />
            </label>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button disabled={loading} className="btn w-full">
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}

        <Link href="/login" className="text-sm text-green-400 hover:underline">
          Back to log in
        </Link>
      </div>
    </main>
  );
}
