"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const input = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-black";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(
        error.message.toLowerCase().includes("not confirmed")
          ? "Please confirm your email first. Check your inbox for the link."
          : error.message
      );
      return;
    }
    router.push("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Log in to Dartify</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input className={input} type="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)} required />
        <input className={input} type="password" placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button disabled={loading}
          className="rounded-lg bg-green-600 py-2 font-semibold text-white disabled:opacity-50">
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>
      <Link href="/forgot-password" className="text-sm underline">Forgot your password?</Link>
      <p className="text-sm">
        No account yet? <Link href="/register" className="underline">Register</Link>
      </p>
    </main>
  );
}