"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const input = "field";

type ResultRow = {
  placement: number;
  points: number;
  events: {
    name: string;
    tournaments: { name: string; event_date: string | null } | null;
  } | null;
};

function ordinal(n: number) {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [userId, setUserId] = useState("");
  const [history, setHistory] = useState<ResultRow[]>([]);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id);
      setEmail(user.email ?? "");

      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user.id)
        .single();
      setFullName(p?.full_name ?? "");
      setPhone(p?.phone ?? "");

      const { data: regs } = await supabase
        .from("registrations")
        .select("id, team_id")
        .eq("player_id", user.id);

      const regIds = (regs ?? []).map((r) => r.id);
      const teamIds = (regs ?? []).map((r) => r.team_id).filter(Boolean);
      const parts: string[] = [];
      if (regIds.length) parts.push(`registration_id.in.(${regIds.join(",")})`);
      if (teamIds.length) parts.push(`team_id.in.(${teamIds.join(",")})`);

      if (parts.length) {
        const { data: ents } = await supabase
          .from("entries")
          .select("id")
          .or(parts.join(","));
        const entryIds = (ents ?? []).map((e) => e.id);
        if (entryIds.length) {
          const { data: res } = await supabase
            .from("event_results")
            .select("placement, points, events(name, tournaments(name, event_date))")
            .in("entry_id", entryIds);
          const rows = (res ?? []) as unknown as ResultRow[];
          rows.sort((a, b) =>
            (b.events?.tournaments?.event_date ?? "").localeCompare(
              a.events?.tournaments?.event_date ?? ""
            )
          );
          setHistory(rows);
        }
      }
      setLoading(false);
    }
    load();
  }, [router]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), phone: phone.trim() })
      .eq("id", userId);
    setSaving(false);
    setMsg(error ? error.message : "Saved.");
  }

  if (loading) return <main className="p-6">Loading...</main>;

  const eventsPlayed = history.length;
  const titles = history.filter((h) => h.placement === 1).length;
  const totalPoints = history.reduce((sum, h) => sum + (h.points ?? 0), 0);

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-6">
      <h1 className="text-3xl font-bold tracking-tight">My profile</h1>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl border border-white/10 p-4">
          <p className="text-2xl font-bold text-green-500">{eventsPlayed}</p>
          <p className="text-sm text-gray-400">Events played</p>
        </div>
        <div className="rounded-xl border border-white/10 p-4">
          <p className="text-2xl font-bold text-green-500">{titles}</p>
          <p className="text-sm text-gray-400">Titles</p>
        </div>
        <div className="rounded-xl border border-white/10 p-4">
          <p className="text-2xl font-bold text-green-500">{totalPoints}</p>
          <p className="text-sm text-gray-400">Total points</p>
        </div>
      </div>

      <form onSubmit={save} className="flex flex-col gap-3">
        <label className="text-sm text-gray-400">Email</label>
        <input className={input} value={email} disabled />
        <label className="text-sm text-gray-400">Full name</label>
        <input className={input} value={fullName}
          onChange={(e) => setFullName(e.target.value)} required />
        <label className="text-sm text-gray-400">Phone number</label>
        <input className={input} value={phone}
          onChange={(e) => setPhone(e.target.value)} />
        {msg && <p className="text-sm">{msg}</p>}
        <button disabled={saving}
          className="btn w-full">
          {saving ? "Saving..." : "Save changes"}
        </button>
      </form>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Tournament history</h2>
        {history.length === 0 ? (
          <p className="text-gray-400">No results yet. Join a tournament to get started.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((h, i) => (
              <li key={i} className="flex items-center justify-between rounded-xl border border-white/10 p-3">
                <div>
                  <p className="font-medium">{h.events?.tournaments?.name} - {h.events?.name}</p>
                  <p className="text-sm text-gray-400">{h.events?.tournaments?.event_date ?? ""}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{ordinal(h.placement)}</p>
                  <p className="text-sm text-green-500">{h.points} pts</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
