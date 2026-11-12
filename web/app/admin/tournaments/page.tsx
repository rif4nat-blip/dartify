"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

const input = "field";
const button = "btn";
const label = "flex flex-col gap-1.5 text-sm text-gray-300";

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

  const sorted = [...tournaments].sort(
    (a, b) => Number(a.status === "completed") - Number(b.status === "completed")
  );

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manage tournaments</h1>
        <p className="mt-1 text-sm text-gray-400">
          Create a tournament, add its events, and mark it completed when it is over.
        </p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">1. Create a tournament</h2>
        <form onSubmit={createTournament} className="grid gap-4 sm:grid-cols-2">
          <label className={`${label} sm:col-span-2`}>
            Tournament name
            <input className={input} placeholder="e.g. NDFP Open" value={name}
              onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className={label}>
            Date
            <input className={input} type="date" value={date}
              onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className={label}>
            Registration fee (PHP)
            <input className={input} type="number" min="0" value={fee}
              onChange={(e) => setFee(e.target.value)} />
          </label>
          <label className={`${label} sm:col-span-2`}>
            Venue
            <input className={input} placeholder="e.g. FHM Garden" value={venue}
              onChange={(e) => setVenue(e.target.value)} />
          </label>
          <div className="sm:col-span-2">
            <button className={`${button} w-full sm:w-auto`}>Create tournament</button>
          </div>
        </form>
      </section>

      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">2. Add an event to a tournament</h2>
        <form onSubmit={addEvent} className="grid gap-4 sm:grid-cols-2">
          <label className={`${label} sm:col-span-2`}>
            Tournament
            <select className={input} value={eventTournament}
              onChange={(e) => setEventTournament(e.target.value)}>
              <option value="">Select tournament</option>
              {tournaments.filter((t) => t.status !== "completed").map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label className={label}>
            Event type
            <select className={input} value={preset}
              onChange={(e) => setPreset(Number(e.target.value))}>
              {EVENT_PRESETS.map((p, i) => (
                <option key={p.label} value={i}>{p.label}</option>
              ))}
            </select>
          </label>
          <label className={label}>
            Format
            <select className={input} value={format}
              onChange={(e) => setFormat(e.target.value)}>
              <option value="single">Single elimination</option>
              <option value="double">Double elimination</option>
            </select>
          </label>
          <label className={`${label} sm:col-span-2`}>
            Max entries (optional)
            <input className={input} type="number" min="2" placeholder="Leave empty for no limit"
              value={maxEntries} onChange={(e) => setMaxEntries(e.target.value)} />
          </label>
          <div className="sm:col-span-2">
            <button className={`${button} w-full sm:w-auto`}>Add event</button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Tournaments</h2>
        {tournaments.length === 0 && <p className="text-sm text-gray-500">None yet.</p>}
        <div className="flex flex-col gap-4">
          {sorted.map((t) => (
            <div key={t.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">
                    {t.name}{" "}
                    <span className={`ml-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
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
                <div className="flex items-center gap-2 text-sm">
                  {t.status === "completed" ? (
                    <button onClick={() => setStatus(t.id, "open")}
                      className="btn-ghost">Reopen</button>
                  ) : (
                    <button onClick={() => setStatus(t.id, "completed")}
                      className="btn-ghost">Mark as completed</button>
                  )}
                  <button onClick={() => deleteTournament(t.id)}
                    className="rounded-xl px-3 py-1.5 text-red-400 hover:bg-red-500/10">Delete</button>
                </div>
              </div>
              <ul className="mt-4 flex flex-col gap-2 text-sm">
                {events.filter((ev) => ev.tournament_id === t.id).length === 0 && (
                  <li className="text-gray-500">No events yet.</li>
                )}
                {events.filter((ev) => ev.tournament_id === t.id).map((ev) => (
                  <li key={ev.id} className="card-sm flex items-center justify-between gap-2">
                    <span>
                      <span className="font-medium">{ev.name}</span>
                      <span className="text-gray-400">
                        {" "}· {ev.format} elimination
                        {ev.max_entries ? ` · max ${ev.max_entries}` : ""}
                      </span>
                    </span>
                    <button onClick={() => deleteEvent(ev.id)}
                      className="text-red-400 hover:underline">Remove</button>
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
