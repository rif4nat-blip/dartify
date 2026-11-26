"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import ScheduleCalendar from "../../../components/ScheduleCalendar";

export default function AdminLeagueCalendarPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role !== "admin") { router.replace("/dashboard"); return; }
      setReady(true);
    }
    init();
  }, [router]);

  if (!ready) return <main className="p-6 text-gray-400">Loading...</main>;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">League calendar</h1>
          <p className="mt-1 text-sm text-gray-400">
            League game nights and tournaments. Click a day to postpone, cancel or move it.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/leagues/games" className="btn-ghost">Games and scores</Link>
          <Link href="/dashboard" className="btn-ghost">Dashboard</Link>
        </div>
      </div>
      <section className="card">
        <ScheduleCalendar editable />
      </section>
    </main>
  );
}
