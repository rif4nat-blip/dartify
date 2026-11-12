"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Tournament = {
  id: string;
  name: string;
  event_date: string;
  venue: string | null;
  registration_fee: number;
  status: string;
};

type EventRow = {
  id: string;
  tournament_id: string;
  name: string;
  category: string;
  team_size: number;
  format: string;
  max_entries: number | null;
};

const input = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-black";
const button = "rounded-lg bg-green-600 px-4 py-2 font-semibold text-white";

const EVENT_PRESETS = [
  { label: "Open singles", category: "open", team_size: 1 },
  { label: "Open doubles", category: "open", team_size: 2 },
  { label: "Open 3-man team", category: "open", team_size: 3 },
  { label: "Classified doubles", category: "classified", team_size: 2 },
  { label: "Classified 3-man team", category: "classified", team_size: 3 },
  { label: "Fixed doubles", category: "fixed", team_size: 2 },
  { label: "Fixed 4-man team", category: "fixed", team_size: 4 },
];

export default function AdminTournamentsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [venue, setVenue] = useState("");
  const [fee, setFee] = useState("0");

  const [eventTournament, setEventTournament] = useState("");
  const [preset, setPreset] = useState(0);
  const [format, setFormat] = useState("single");
  const [maxEntries, setMaxEntries] = useState("");

  const load = useCallback(async () => {
    const { data: t } = await supabase
      .from("tournaments")
      .select("*")
      .order("event_date", { ascending: false });
    const { data: e } = await supabase.from("events").select("*");
    setTournaments(t ?? []);
    setEvents(e ?? []);
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile?.role !== "admin") {
        router.replace("/dashboard");
        return;
      }
      await load();
      setReady(true);
    }
    init();
  }, [router, load]);

  async function createTournament(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("tournaments").insert({
      name,
      event_date: date,
      venue: venue || null,
      registration_fee: Number(fee) || 0,
      status: "open",
      created_by: user?.id,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setName("");
    setDate("");
    setVenue("");
    setFee("0");
    load();
  }

  async function addEvent(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!eventTournament) {
      setError("Choose a tournament first.");
      return;
    }
    const p = EVENT_PRESETS[preset];
    const { error } = await supabase.from("events").insert({
      tournament_id: eventTournament,
      name: p.label,
      category: p.category,
      team_size: p.team_size,
      format,
      max_entries: maxEntries ? Number(maxEntries) : null,
      status: "open",
    });
    if (error) {
      setError(error.message);
      return;
    }
    setMaxEntries("");
    load();
  }

  async function setStatus(id: string, status: string) {
    setError("");
    if (
      status === "completed" &&
      !confirm("Mark this tournament as completed? It moves to Past tournaments and registration closes.")
    ) {
      return;
    }
    const { error } = await supabase.from("tournaments").update({ status }).eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    load();
  }

  async function deleteTournament(id: string) {
    if (!confirm("Delete this tournament and all its events?")) return;
    await supabase.from("tournaments").delete().eq("id", id);
    load();
  }

  async function deleteEvent(id: string) {
    await supabase.from("events").delete().eq("id", id);
    load();
  }

  if (!ready) return <main className="p-6">Loading...</main>;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manage tournaments</h1>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <section>
        <h2 className="mb-3 text-lg font-semibold">1. Create a tournament</h2>
        <form onSubmit={createTournament} className="flex flex-col gap-3">
          <input className={input} placeholder="Tournament name" value={name}
            onChange={(e) => setName(e.target.value)} required />
          <input className={input} type="date" value={date}
            onChange={(e) => setDate(e.target.value)} required />
          <input className={input} placeholder="Venue" value={venue}
            onChange={(e) => setVenue(e.target.value)} />
          <input className={input} type="number" min="0" placeholder="Registration fee (PHP)"
            value={fee} onChange={(e) => setFee(e.target.value)} />
          <button className={button}>Create tournament</button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">2. Add an event to a tournament</h2>
        <form onSubmit={addEvent} className="flex flex-col gap-3">
          <select className={input} value={eventTournament}
            onChange={(e) => setEventTournament(e.target.value)}>
            <option value="">Select tournament</option>
            {tournaments.filter((t) => t.status !== "completed").map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <select className={input} value={preset}
            onChange={(e) => setPreset(Number(e.target.value))}>
            {EVENT_PRESETS.map((p, i) => (
              <option key={p.label} value={i}>{p.label}</option>
            ))}
          </select>
          <select className={input} value={format}
            onChange={(e) => setFormat(e.target.value)}>
            <option value="single">Single elimination</option>
            <option value="double">Double elimination</option>
          </select>
          <input className={input} type="number" min="2" placeholder="Max entries (optional)"
            value={maxEntries} onChange={(e) => setMaxEntries(e.target.value)} />
          <button className={button}>Add event</button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Tournaments</h2>
        {tournaments.length === 0 && <p className="text-sm text-gray-500">None yet.</p>}
        <div className="flex flex-col gap-4">
          {tournaments.map((t) => (
            <div key={t.id} className="rounded-lg border border-gray-600 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {t.name}{" "}
                    <span className={`ml-1 rounded px-2 py-0.5 text-xs font-normal ${
                      t.status === "completed"
                        ? "bg-gray-700 text-gray-300"
                        : "bg-green-900 text-green-300"
                    }`}>
                      {t.status === "completed" ? "Completed" : "Active"}
                    </span>
                  </p>
                  <p className="text-sm text-gray-400">
                    {t.event_date} · {t.venue || "No venue"} · PHP {t.registration_fee}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 text-sm">
                  {t.status === "completed" ? (
                    <button onClick={() => setStatus(t.id, "open")}
                      className="text-green-400 underline">Reopen</button>
                  ) : (
                    <button onClick={() => setStatus(t.id, "completed")}
                      className="text-green-400 underline">Mark as completed</button>
                  )}
                  <button onClick={() => deleteTournament(t.id)}
                    className="text-red-400 underline">Delete</button>
                </div>
              </div>
              <ul className="mt-3 flex flex-col gap-1 text-sm">
                {events.filter((ev) => ev.tournament_id === t.id).map((ev) => (
                  <li key={ev.id} className="flex items-center justify-between">
                    <span>
                      {ev.name} · {ev.format} elimination
                      {ev.max_entries ? ` · max ${ev.max_entries}` : ""}
                    </span>
                    <button onClick={() => deleteEvent(ev.id)}
                      className="text-red-400 underline">Remove</button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
