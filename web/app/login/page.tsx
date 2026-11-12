"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PasswordInput from "../components/PasswordInput";

const input = "field";
const label = "flex flex-col gap-1.5 text-sm text-gray-300";

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
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center p-6">
      <div className="card flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Log in to Dartify</h1>
          <p className="mt-1 text-sm text-gray-400">Welcome back. Enter your details to continue.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className={label}>
            Email
            <input className={input} type="email" placeholder="you@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className={label}>
            Password
            <PasswordInput className={input} placeholder="Your password" value={password}
              onChange={setPassword} required autoComplete="current-password" />
          </label>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button disabled={loading} className="btn w-full">
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <div className="flex flex-col gap-1 text-sm">
          <Link href="/forgot-password" className="text-green-400 hover:underline">
            Forgot your password?
          </Link>
          <p className="text-gray-400">
            No account yet?{" "}
            <Link href="/register" className="text-green-400 hover:underline">Register</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
