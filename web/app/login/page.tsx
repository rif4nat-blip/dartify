"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PasswordInput from "../components/PasswordInput";

const input = "field";

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
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Log in to Dartify</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input className={input} type="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)} required />
        <PasswordInput className={input} placeholder="Password" value={password}
          onChange={setPassword} required autoComplete="current-password" />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button disabled={loading}
          className="btn w-full">
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