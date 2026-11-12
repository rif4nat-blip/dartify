"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PasswordInput from "../components/PasswordInput";

const input = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-black";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    const timer = setTimeout(() => setExpired(true), 4000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Use at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      {done ? (
        <>
          <p className="text-green-400">Your password was updated.</p>
          <Link href="/dashboard" className="underline">Go to the dashboard</Link>
        </>
      ) : ready ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <PasswordInput className={input} placeholder="New password" value={password}
            onChange={setPassword} required autoComplete="new-password" />
          <PasswordInput className={input} placeholder="Repeat the new password"
            value={confirm} onChange={setConfirm} required autoComplete="new-password" />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button disabled={loading}
            className="rounded-lg bg-green-600 py-2 font-semibold text-white disabled:opacity-50">
            {loading ? "Saving..." : "Save new password"}
          </button>
        </form>
      ) : expired ? (
        <p>
          This link is invalid or has expired.{" "}
          <Link href="/forgot-password" className="underline">Request a new one</Link>
        </p>
      ) : (
        <p className="text-sm text-gray-400">Checking your link...</p>
      )}
    </main>
  );
}