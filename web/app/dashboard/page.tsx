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
  ["Leagues", "League schedule, results and standings.", "/leagues"],
  ["My profile", "Your stats and tournament history.", "/profile"],
];

const tournamentLinks = [
  ["Manage tournaments", "Create tournaments and events.", "/admin/tournaments"],
  ["Registrations and draw", "Walk-ins, payments and the scramble.", "/admin/registrations"],
  ["Bracket and scores", "Start the bracket and enter results.", "/admin/bracket"],
  ["Event points", "Save placements and points.", "/admin/results"],
  ["Printable player list", "Print, PDF or Word.", "/admin/print"],
];

const leagueLinks = [
  ["Manage leagues", "Create leagues and their categories.", "/admin/leagues"],
  ["League teams", "Enter teams, players and registration.", "/admin/leagues/teams"],
  ["Games and scores", "Schedule games, enter scores, see the standings.", "/admin/leagues/games"],
  ["League calendar", "Game nights and tournaments. Postpone, cancel or move.", "/admin/leagues/calendar"],
];

function CardLink({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <Link
      href={href}
      className="card group flex h-full flex-col justify-between gap-4 transition hover:border-green-600 hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-600"
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-base font-semibold sm:text-lg">{title}</span>
        <p className="text-sm leading-relaxed text-gray-400">{desc}</p>
      </div>
      <span className="flex items-center gap-1 text-xs font-medium text-green-400">
        Open
        <span className="transition group-hover:translate-x-1">&rarr;</span>
      </span>
    </Link>
  );
}

function Group({
  title,
  subtitle,
  links,
}: {
  title: string;
  subtitle?: string;
  links: string[][];
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-gray-400">{subtitle}</p>}
        </div>
        <span className="text-xs text-gray-400">{links.length} tools</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map(([t, d, h]) => (
          <CardLink key={h} title={t} desc={d} href={h} />
        ))}
      </div>
    </section>
  );
}

function Skeleton() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 md:py-10">
      <div className="h-24 animate-pulse rounded-xl bg-white/5" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
    </main>
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

  if (!profile) return <Skeleton />;

  const isAdmin = profile.role === "admin";
  const initial = (profile.full_name || "?").trim().charAt(0).toUpperCase();

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 md:py-10">
      <div className="card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-green-600 bg-green-600/15 text-lg font-bold text-green-400">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-gray-400">Welcome back</p>
            <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
              {profile.full_name}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-gray-400 sm:inline">
            {isAdmin ? "Tournaments and leagues" : "Your Dartify home"}
          </span>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              isAdmin
                ? "border-green-600 bg-green-600/15 text-green-400"
                : "border-white/15 bg-white/5 text-gray-300"
            }`}
          >
            {isAdmin ? "Admin" : "Player"}
          </span>
        </div>
      </div>

      {isAdmin ? (
        <>
          <Group
            title="Tournament tools"
            subtitle="Run one-day events: registrations, brackets and points."
            links={tournamentLinks}
          />
          <Group
            title="League tools"
            subtitle="Run seasons: teams, game nights, scores and standings."
            links={leagueLinks}
          />
        </>
      ) : (
        <Group title="Quick links" subtitle="Jump to what you need." links={playerLinks} />
      )}
    </main>
  );
}
