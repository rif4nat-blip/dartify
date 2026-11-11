"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Tournament = { id: string; name: string; event_date: string; venue: string | null };
type EventRow = { id: string; tournament_id: string; name: string; format: string };
type Entry = { id: string; name: string };
type Match = {
  id: string;
  round: number;
  match_no: number;
  entry1_id: string | null;
  entry2_id: string | null;
  score1: number;
  score2: number;
  winner_id: string | null;
  status: string;
  game_type: number;
  legs_to_win: number;
};

const input = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-black";

function roundName(round: number, rounds: number) {
  const fromEnd = rounds - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinals";
  if (fromEnd === 2) return "Quarterfinals";
  return `Round ${round}`;
}

export default function PublicBracketPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [withBracket, setWithBracket] = useState<string[]>([]);
  const [tournamentId, setTournamentId] = useState("");
  const [eventId, setEventId] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [updated, setUpdated] = useState("");
  const [loaded, setLoaded] = useState(false);

  const loadBase = useCallback(async () => {
    const [t, e, m] = await Promise.all([
      supabase
        .from("tournaments")
        .select("id, name, event_date, venue")
        .order("event_date", { ascending: false }),
      supabase.from("events").select("id, tournament_id, name, format"),
      supabase.from("matches").select("event_id"),
    ]);
    const es = (e.data ?? []) as EventRow[];
    const ids = Array.from(
      new Set(((m.data ?? []) as { event_id: string }[]).map((x) => x.event_id))
    );
    setTournaments((t.data ?? []) as Tournament[]);
    setEvents(es);
    setWithBracket(ids);
    return { es, ids };
  }, []);

  const loadBracket = useCallback(async (id: string) => {
    if (!id) {
      setEntries([]);
      setMatches([]);
      return;
    }
    const [en, m] = await Promise.all([
      supabase.from("entries").select("id, name").eq("event_id", id),
      supabase.from("matches").select("*").eq("event_id", id),
    ]);
    setEntries((en.data ?? []) as Entry[]);
    setMatches((m.data ?? []) as Match[]);
    setUpdated(new Date().toLocaleTimeString("en-PH"));
  }, []);

  useEffect(() => {
    async function init() {
      const { es, ids } = await loadBase();
      const wanted = new URLSearchParams(window.location.search).get("event");
      const start = es.find((x) => x.id === wanted) ?? es.find((x) => ids.includes(x.id));
      if (start) {
        setTournamentId(start.tournament_id);
        setEventId(start.id);
      }
      setLoaded(true);
    }
    init();
  }, [loadBase]);

  useEffect(() => {
    loadBracket(eventId);
    if (!eventId) return;
    const timer = setInterval(() => loadBracket(eventId), 15000);
    return () => clearInterval(timer);
  }, [eventId, loadBracket]);

  const tournament = tournaments.find((t) => t.id === tournamentId);
  const event = events.find((x) => x.id === eventId);
  const names = new Map(entries.map((e) => [e.id, e.name]));
  const sorted = [...matches].sort((a, b) => a.round - b.round || a.match_no - b.match_no);
  const rounds = sorted.reduce((mx, m) => Math.max(mx, m.round), 0);
  const finalMatch = sorted.find((m) => m.round === rounds);
  const champion =
    finalMatch?.status === "completed" && finalMatch.winner_id
      ? names.get(finalMatch.winner_id)
      : null;

  function slot(id: string | null, round: number) {
    if (id) return names.get(id) ?? "?";
    return round === 1 ? "BYE" : "To be decided";
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Live brackets</h1>
      </div>

      {!loaded && <p className="text-sm text-gray-500">Loading...</p>}
      {loaded && tournaments.length === 0 && (
        <p className="text-sm text-gray-500">No tournaments yet.</p>
      )}

      {tournaments.length > 0 && (
        <div className="flex flex-col gap-3">
          <select className={input} value={tournamentId}
            onChange={(e) => { setTournamentId(e.target.value); setEventId(""); }}>
            <option value="">Select tournament</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <select className={input} value={eventId} disabled={!tournamentId}
            onChange={(e) => setEventId(e.target.value)}>
            <option value="">Select event</option>
            {events.filter((x) => x.tournament_id === tournamentId).map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}{withBracket.includes(x.id) ? " (bracket live)" : " (no bracket yet)"}
              </option>
            ))}
          </select>
        </div>
      )}

      {tournament && event && (
        <section>
          <p className="text-lg font-semibold">{tournament.name} · {event.name}</p>
          <p className="text-sm text-gray-400">
            {tournament.event_date} · {tournament.venue || "Venue to be announced"} ·{" "}
            {event.format === "single" ? "Single" : "Double"} elimination
          </p>
          {updated && matches.length > 0 && (
            <p className="text-xs text-gray-500">
              Updated {updated} · refreshes every 15 seconds
            </p>
          )}
        </section>
      )}

      {event && matches.length === 0 && (
        <p className="text-sm text-gray-400">The bracket has not been created yet.</p>
      )}

      {champion && (
        <div className="rounded-lg border border-green-600 p-4 text-center">
          <p className="text-sm text-gray-400">Champion</p>
          <p className="text-xl font-bold text-green-400">{champion}</p>
        </div>
      )}

      {Array.from({ length: rounds }, (_, i) => i + 1).map((r) => (
        <section key={r}>
          <h2 className="mb-3 text-lg font-semibold">{roundName(r, rounds)}</h2>
          <div className="flex flex-col gap-3">
            {sorted.filter((m) => m.round === r).map((m) => {
              const ready = !!m.entry1_id && !!m.entry2_id;
              const done = m.status === "completed";
              const label = ready
                ? done ? "Completed" : "Up next"
                : done ? "Bye" : "Waiting";
              const row = (id: string | null, score: number) => (
                <div className={`flex justify-between gap-2 ${
                  id && m.winner_id === id ? "font-semibold text-green-400" : ""
                }`}>
                  <span>{slot(id, m.round)}</span>
                  {ready && done && <span>{score}</span>}
                </div>
              );
              return (
                <div key={m.id}
                  className={`rounded-lg border p-3 text-sm ${
                    label === "Up next" ? "border-green-600" : "border-gray-700"
                  }`}>
                  <p className="mb-1 text-xs text-gray-400">
                    Match {m.match_no} · {m.game_type} · first to {m.legs_to_win} · {label}
                  </p>
                  {row(m.entry1_id, m.score1)}
                  {row(m.entry2_id, m.score2)}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}