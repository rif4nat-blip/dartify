"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Player = {
  player_key: string;
  player_name: string;
  total_points: number;
  events_played: number;
  titles: number;
};
type Tournament = { id: string; name: string; event_date: string };
type EventRow = { id: string; tournament_id: string; name: string; format: string };
type Result = { event_id: string; entry_id: string; placement: number; points: number };
type Entry = { id: string; name: string };

const input = "field";
const label = "flex flex-col gap-1.5 text-sm text-gray-300";

function placeLabel(p: number, format: string) {
  if (p === 1) return "Champion";
  if (p === 2) return "Runner-up";
  if (format === "double") {
    if (p === 3) return "Third place";
    if (p === 4) return "Fourth place";
    if (p <= 8) return "Top 8";
    return "Eliminated earlier";
  }
  if (p === 3) return "Semifinalist";
  if (p === 5) return "Quarterfinalist";
  return "Eliminated earlier";
}

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [tournamentId, setTournamentId] = useState("");
  const [eventId, setEventId] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const [p, t, e, r] = await Promise.all([
        supabase.from("leaderboard").select("*"),
        supabase
          .from("tournaments")
          .select("id, name, event_date")
          .order("event_date", { ascending: false }),
        supabase.from("events").select("id, tournament_id, name, format"),
        supabase
          .from("event_results")
          .select("event_id, entry_id, placement, points")
          .order("placement"),
      ]);
      const res = (r.data ?? []) as Result[];
      const evs = (e.data ?? []) as EventRow[];
      const ids = Array.from(new Set(res.map((x) => x.entry_id)));
      let ens: Entry[] = [];
      if (ids.length > 0) {
        const { data } = await supabase.from("entries").select("id, name").in("id", ids);
        ens = (data ?? []) as Entry[];
      }
      setPlayers((p.data ?? []) as Player[]);
      setTournaments((t.data ?? []) as Tournament[]);
      setEvents(evs);
      setResults(res);
      setEntries(ens);
      const first = evs.find((x) => res.some((y) => y.event_id === x.id));
      if (first) {
        setTournamentId(first.tournament_id);
        setEventId(first.id);
      }
      setLoaded(true);
    }
    load();
  }, []);

  const ranked = [...players]
    .sort(
      (a, b) =>
        b.total_points - a.total_points ||
        b.titles - a.titles ||
        a.player_name.localeCompare(b.player_name)
    )
    .map((p) => ({
      ...p,
      rank: 1 + players.filter((x) => x.total_points > p.total_points).length,
    }));

  const names = new Map(entries.map((e) => [e.id, e.name]));
  const hasResults = (id: string) => results.some((r) => r.event_id === id);
  const eventResults = results.filter((r) => r.event_id === eventId);
  const eventFormat = events.find((x) => x.id === eventId)?.format ?? "single";
  const podium = ranked.slice(0, 3);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
        <p className="mt-1 text-sm text-gray-400">
          Total points from all tournaments. Champion 15, runner-up 10, top 4 earn 5, top 8 earn 3.
        </p>
      </div>

      {loaded && ranked.length === 0 && (
        <p className="text-sm text-gray-500">No points have been published yet.</p>
      )}

      {podium.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-3">
          {podium.map((p, i) => (
            <div key={p.player_key}
              className={`card text-center ${i === 0 ? "!border-green-600" : ""}`}>
              <p className="text-sm text-gray-400">
                {p.rank === 1 ? "1st" : p.rank === 2 ? "2nd" : p.rank === 3 ? "3rd" : `${p.rank}th`}
              </p>
              <p className={`mt-1 text-lg font-semibold ${i === 0 ? "text-green-400" : ""}`}>
                {p.player_name}
              </p>
              <p className="mt-2 text-3xl font-bold text-green-500">{p.total_points}</p>
              <p className="text-xs text-gray-400">points</p>
            </div>
          ))}
        </section>
      )}

      {ranked.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Player ranking</h2>
          <div className="card !p-0 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-gray-400">
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-2 py-3">Player</th>
                  <th className="px-2 py-3">Events</th>
                  <th className="px-2 py-3">Titles</th>
                  <th className="px-4 py-3">Points</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((p) => (
                  <tr key={p.player_key} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                        p.rank === 1 ? "bg-green-600 text-white" : "bg-white/10"
                      }`}>
                        {p.rank}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 font-medium">{p.player_name}</td>
                    <td className="px-2 py-2.5">{p.events_played}</td>
                    <td className="px-2 py-2.5">{p.titles}</td>
                    <td className="px-4 py-2.5 font-semibold text-green-400">{p.total_points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {results.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Results by event</h2>
          <div className="card grid gap-4 sm:grid-cols-2">
            <label className={label}>
              Tournament
              <select className={input} value={tournamentId}
                onChange={(e) => { setTournamentId(e.target.value); setEventId(""); }}>
                <option value="">Select tournament</option>
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <label className={label}>
              Event
              <select className={input} value={eventId} disabled={!tournamentId}
                onChange={(e) => setEventId(e.target.value)}>
                <option value="">Select event</option>
                {events.filter((x) => x.tournament_id === tournamentId).map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}{hasResults(x.id) ? "" : " (no results yet)"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {eventId && eventResults.length > 0 && (
            <>
              <div className="card !p-0 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-gray-400">
                    <tr className="border-b border-white/10">
                      <th className="px-4 py-3">Place</th>
                      <th className="px-2 py-3">Team or player</th>
                      <th className="px-2 py-3">Result</th>
                      <th className="px-4 py-3">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventResults.map((r) => (
                      <tr key={r.entry_id} className="border-t border-white/5 hover:bg-white/[0.03]">
                        <td className="px-4 py-2.5">{r.placement}</td>
                        <td className="px-2 py-2.5 font-medium">{names.get(r.entry_id) ?? "?"}</td>
                        <td className="px-2 py-2.5">{placeLabel(r.placement, eventFormat)}</td>
                        <td className="px-4 py-2.5 font-semibold text-green-400">{r.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <Link href={`/bracket?event=${eventId}`} className="btn-ghost">
                  View the bracket
                </Link>
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}
