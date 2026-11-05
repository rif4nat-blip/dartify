"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const input = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-black";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone } },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Create your Dartify account</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input className={input} placeholder="Full name" value={fullName}
          onChange={(e) => setFullName(e.target.value)} required />
        <input className={input} placeholder="Phone number" value={phone}
          onChange={(e) => setPhone(e.target.value)} />
        <input className={input} type="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)} required />
        <input className={input} type="password" placeholder="Password (min 6 characters)"
          value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button disabled={loading}
          className="rounded-lg bg-green-600 py-2 font-semibold text-white disabled:opacity-50">
          {loading ? "Creating..." : "Register"}
        </button>
      </form>
      <p className="text-sm">
        Already have an account? <Link href="/login" className="underline">Log in</Link>
      </p>
    </main>
  );
}