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
type EventRow = { id: string; tournament_id: string; name: string };
type Result = { event_id: string; entry_id: string; placement: number; points: number };
type Entry = { id: string; name: string };

const input = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-black";

function placeLabel(p: number) {
  if (p === 1) return "Champion";
  if (p === 2) return "Runner-up";
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
        supabase.from("events").select("id, tournament_id, name"),
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

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <Link href="/dashboard" className="underline">Dashboard</Link>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Player ranking</h2>
        <p className="text-sm text-gray-400">
          Total points from all tournaments. Champion 15, runner-up 10, top 4 earn 5, top 8 earn 3.
        </p>
        {loaded && ranked.length === 0 && (
          <p className="text-sm text-gray-500">No points have been published yet.</p>
        )}
        {ranked.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-gray-400">
                <tr>
                  <th className="py-1 pr-2">Rank</th>
                  <th className="pr-2">Player</th>
                  <th className="pr-2">Events</th>
                  <th className="pr-2">Titles</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((p) => (
                  <tr key={p.player_key} className="border-t border-gray-800">
                    <td className="py-1 pr-2">{p.rank}</td>
                    <td className="pr-2">{p.player_name}</td>
                    <td className="pr-2">{p.events_played}</td>
                    <td className="pr-2">{p.titles}</td>
                    <td className="font-semibold">{p.total_points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {results.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Results by event</h2>
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
                {x.name}{hasResults(x.id) ? "" : " (no results yet)"}
              </option>
            ))}
          </select>

          {eventId && eventResults.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-gray-400">
                    <tr>
                      <th className="py-1 pr-2">Place</th>
                      <th className="pr-2">Team or player</th>
                      <th className="pr-2">Result</th>
                      <th>Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventResults.map((r) => (
                      <tr key={r.entry_id} className="border-t border-gray-800">
                        <td className="py-1 pr-2">{r.placement}</td>
                        <td className="pr-2">{names.get(r.entry_id) ?? "?"}</td>
                        <td className="pr-2">{placeLabel(r.placement)}</td>
                        <td className="font-semibold">{r.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Link href={`/bracket?event=${eventId}`} className="text-sm underline">
                View the bracket
              </Link>
            </>
          )}
        </section>
      )}
    </main>
  );
}