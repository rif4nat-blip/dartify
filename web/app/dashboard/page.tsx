"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Profile = { full_name: string; role: string };

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();
      setProfile(data);
    }
    load();
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!profile) return <main className="p-6">Loading...</main>;

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold">Welcome, {profile.full_name}</h1>
      <p className="mt-1 text-sm text-gray-500">Role: {profile.role}</p>
      <button onClick={logout} className="mt-6 rounded-lg border px-4 py-2">
        Log out
      </button>
    </main>
  );
}