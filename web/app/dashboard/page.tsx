"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Profile = { full_name: string; role: string };

const playerLinks = [
  ["Browse tournaments", "Find an event and join.", "/tournaments"],
  ["Live brackets", "Follow matches in real time.", "/bracket"],
  ["Leaderboard", "See the points ranking.", "/leaderboard"],
];

const adminLinks = [
  ["Manage tournaments", "Create tournaments and events.", "/admin/tournaments"],
  ["Registrations and draw", "Walk-ins, payments and the scramble.", "/admin/registrations"],
  ["Bracket and scores", "Start the bracket and enter results.", "/admin/bracket"],
  ["Event points", "Save placements and points.", "/admin/results"],
  ["Printable player list", "Print, PDF or Word.", "/admin/print"],
];

function CardLink({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="text-lg font-semibold">{title}</div>
      <p className="text-sm text-gray-400">{desc}</p>
      <Link
        href={href}
        className="mt-2 w-fit rounded border border-green-500 px-4 py-2 text-sm text-green-400 hover:bg-green-500/10"
      >
        Open
      </Link>
    </div>
  );
}

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

  if (!profile) return <main className="mx-auto max-w-6xl px-5 py-10">Loading...</main>;

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 md:py-10">
      <h1 className="text-2xl font-bold md:text-3xl">Welcome, {profile.full_name}</h1>
      <p className="mt-1 text-sm text-gray-400">Role: {profile.role}</p>

           {profile.role !== "admin" && (
        <>
          <h2 className="mb-3 mt-8 text-xl font-semibold">Player</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {playerLinks.map(([t, d, h]) => (
              <CardLink key={h} title={t} desc={d} href={h} />
            ))}
          </div>
        </>
      )}

      {profile.role === "admin" && (
        <>
          <h2 className="mb-3 mt-10 text-xl font-semibold">Admin</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {adminLinks.map(([t, d, h]) => (
              <CardLink key={h} title={t} desc={d} href={h} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}