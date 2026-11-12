"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PasswordInput from "../components/PasswordInput";

const input = "field";
const label = "flex flex-col gap-1.5 text-sm text-gray-300";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!agree) {
      setError("Please accept the privacy notice to register.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          phone: phone.trim(),
          consented_at: new Date().toISOString(),
        },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (!data.session) {
      setSent(true);
      return;
    }
    router.push("/dashboard");
  }

  if (sent) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center p-6">
        <div className="card flex flex-col gap-4">
          <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
          <div className="rounded-lg border border-green-600/40 bg-green-600/10 p-4 text-sm text-green-300">
            We sent a confirmation link to <strong>{email}</strong>. Open it, then log in.
          </div>
          <Link href="/login" className="btn w-full">Go to log in</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center p-6">
      <div className="card flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create your Dartify account</h1>
          <p className="mt-1 text-sm text-gray-400">
            Join tournaments, follow brackets and collect points.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className={label}>
            Full name
            <input className={input} placeholder="Juan Dela Cruz" value={fullName}
              onChange={(e) => setFullName(e.target.value)} required />
          </label>
          <label className={label}>
            Phone number
            <input className={input} placeholder="09XX XXX XXXX" value={phone}
              onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className={label}>
            Email
            <input className={input} type="email" placeholder="you@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className={label}>
            Password
            <PasswordInput className={input} placeholder="At least 6 characters"
              value={password} onChange={setPassword} minLength={6} required
              autoComplete="new-password" />
          </label>
          <label className="flex items-start gap-2 text-sm text-gray-300">
            <input type="checkbox" className="mt-1 accent-green-600" checked={agree}
              onChange={(e) => setAgree(e.target.checked)} required />
            <span>
              I have read the{" "}
              <Link href="/privacy" target="_blank" className="text-green-400 hover:underline">
                privacy notice
              </Link>{" "}
              and agree that my name appears in public brackets and results.
            </span>
          </label>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button disabled={loading} className="btn w-full">
            {loading ? "Creating..." : "Register"}
          </button>
        </form>

        <p className="text-sm text-gray-400">
          Already have an account?{" "}
          <Link href="/login" className="text-green-400 hover:underline">Log in</Link>
        </p>
      </div>
    </main>
  );
}
