"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PasswordInput from "../components/PasswordInput";

const input = "field";
const label = "flex flex-col gap-1.5 text-sm text-gray-300";

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
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center p-6">
      <div className="card flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
          <p className="mt-1 text-sm text-gray-400">Use at least 6 characters.</p>
        </div>

        {done ? (
          <>
            <div className="rounded-lg border border-green-600/40 bg-green-600/10 p-4 text-sm text-green-300">
              Your password was updated.
            </div>
            <Link href="/dashboard" className="btn w-full">Go to the dashboard</Link>
          </>
        ) : ready ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className={label}>
              New password
              <PasswordInput className={input} placeholder="New password" value={password}
                onChange={setPassword} required autoComplete="new-password" />
            </label>
            <label className={label}>
              Repeat new password
              <PasswordInput className={input} placeholder="Repeat the new password"
                value={confirm} onChange={setConfirm} required autoComplete="new-password" />
            </label>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button disabled={loading} className="btn w-full">
              {loading ? "Saving..." : "Save new password"}
            </button>
          </form>
        ) : expired ? (
          <p className="text-sm text-gray-300">
            This link is invalid or has expired.{" "}
            <Link href="/forgot-password" className="text-green-400 hover:underline">
              Request a new one
            </Link>
          </p>
        ) : (
          <p className="text-sm text-gray-400">Checking your link...</p>
        )}
      </div>
    </main>
  );
}
