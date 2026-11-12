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
  ["My profile", "Your stats and tournament history.", "/profile"],
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
    <Link
      href={href}
      className="card group flex flex-col gap-1.5 transition hover:border-green-600 hover:bg-white/[0.07]"
    >
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">{title}</span>
        <span className="text-green-400 transition group-hover:translate-x-1">&rarr;</span>
      </div>
      <p className="text-sm text-gray-400">{desc}</p>
    </Link>
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

  if (!profile) {
    return <main className="mx-auto max-w-5xl px-5 py-10 text-gray-400">Loading...</main>;
  }

  const isAdmin = profile.role === "admin";
  const links = isAdmin ? adminLinks : playerLinks;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-8 md:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-400">Welcome back</p>
          <h1 className="text-3xl font-bold tracking-tight">{profile.full_name}</h1>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${
          isAdmin
            ? "border-green-600 bg-green-600/15 text-green-400"
            : "border-white/15 bg-white/5 text-gray-300"
        }`}>
          {isAdmin ? "Admin" : "Player"}
        </span>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">{isAdmin ? "Admin tools" : "Quick links"}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {links.map(([t, d, h]) => (
            <CardLink key={h} title={t} desc={d} href={h} />
          ))}
        </div>
      </section>
    </main>
  );
}
