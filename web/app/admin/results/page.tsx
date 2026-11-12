"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { doublePlacements } from "@/lib/doubleElim";

type Tournament = { id: string; name: string };
type EventRow = { id: string; tournament_id: string; name: string; format: string };
type Entry = { id: string; name: string };
type Match = {
  id: string;
  bracket: string;
  round: number;
  match_no: number;
  entry1_id: string | null;
  entry2_id: string | null;
  winner_id: string | null;
  status: string;
  next_match_id: string | null;
  loser_next_match_id: string | null;
};
type Saved = { entry_id: string; placement: number; points: number };
type Row = { entryId: string; placement: number; label: string; points: number };

const input = "field";
const button = "btn";

const POINTS = { champion: 15, runnerUp: 10, semifinal: 5, quarterfinal: 3 };

function compute(matches: Match[]): Row[] | null {
  const rounds = matches.reduce((mx, m) => Math.max(mx, m.round), 0);
  const final = matches.find((m) => m.round === rounds);
  if (!final || final.status !== "completed" || !final.winner_id) return null;

  const rows: Row[] = [
    { entryId: final.winner_id, placement: 1, label: "Champion", points: POINTS.champion },
  ];
  matches.forEach((m) => {
    if (m.status !== "completed" || !m.entry1_id || !m.entry2_id || !m.winner_id) return;
    const loser = m.winner_id === m.entry1_id ? m.entry2_id : m.entry1_id;
    const fromEnd = rounds - m.round;
    if (fromEnd === 0) {
      rows.push({ entryId: loser, placement: 2, label: "Runner-up", points: POINTS.runnerUp });
    } else if (fromEnd === 1) {
      rows.push({ entryId: loser, placement: 3, label: "Semifinalist (top 4)", points: POINTS.semifinal });
    } else if (fromEnd === 2) {
      rows.push({ entryId: loser, placement: 5, label: "Quarterfinalist (top 8)", points: POINTS.quarterfinal });
    } else {
      rows.push({ entryId: loser, placement: 2 ** fromEnd + 1, label: "Eliminated earlier", points: 0 });
    }
  });
  return rows.sort((a, b) => a.placement - b.placement);
}

function computeDouble(matches: Match[]): Row[] | null {
  const list = doublePlacements(matches);
  if (!list) return null;
  return list.map((p) => ({
    entryId: p.entryId,
    placement: p.placement,
    label: p.label,
    points:
      p.placement === 1
        ? POINTS.champion
        : p.placement === 2
        ? POINTS.runnerUp
        : p.placement <= 4
        ? POINTS.semifinal
        : p.placement <= 8
        ? POINTS.quarterfinal
        : 0,
  }));
}

export default function AdminResultsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [tournamentId, setTournamentId] = useState("");
  const [eventId, setEventId] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [saved, setSaved] = useState<Saved[]>([]);

  const loadEvent = useCallback(async (id: string) => {
    if (!id) {
      setEntries([]);
      setMatches([]);
      setSaved([]);
      return;
    }
    const [en, m, s] = await Promise.all([
      supabase.from("entries").select("id, name").eq("event_id", id),
      supabase
        .from("matches")
        .select(
          "id, bracket, round, match_no, entry1_id, entry2_id, winner_id, status, next_match_id, loser_next_match_id"
        )
        .eq("event_id", id),
      supabase
        .from("event_results")
        .select("entry_id, placement, points")
        .eq("event_id", id)
        .order("placement"),
    ]);
    setEntries((en.data ?? []) as Entry[]);
    setMatches((m.data ?? []) as Match[]);
    setSaved((s.data ?? []) as Saved[]);
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
      const [t, e] = await Promise.all([
        supabase.from("tournaments").select("id, name").order("event_date", { ascending: false }),
        supabase.from("events").select("id, tournament_id, name, format"),
      ]);
      setTournaments((t.data ?? []) as Tournament[]);
      setEvents((e.data ?? []) as EventRow[]);
      setReady(true);
    }
    init();
  }, [router]);

  useEffect(() => {
    loadEvent(eventId);
  }, [eventId, loadEvent]);

  const event = events.find((x) => x.id === eventId);
  const isDouble = event?.format === "double";
  const names = new Map(entries.map((e) => [e.id, e.name]));
  const preview = event ? (isDouble ? computeDouble(matches) : compute(matches)) : null;
  const upToDate =
    !!preview &&
    saved.length === preview.length &&
    preview.every((r) =>
      saved.some((s) => s.entry_id === r.entryId && s.placement === r.placement && s.points === r.points)
    );

  async function save() {
    if (!preview || !eventId) return;
    setMessage("");
    if (saved.length > 0 && !confirm("This replaces the points already saved for this event. Continue?")) return;
    await supabase.from("event_results").delete().eq("event_id", eventId);
    const { error } = await supabase.from("event_results").insert(
      preview.map((r) => ({
        event_id: eventId,
        entry_id: r.entryId,
        placement: r.placement,
        points: r.points,
      }))
    );
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Points saved.");
    loadEvent(eventId);
  }

  async function remove() {
    if (!eventId || !confirm("Remove the saved points for this event?")) return;
    await supabase.from("event_results").delete().eq("event_id", eventId);
    setMessage("Saved points removed.");
    loadEvent(eventId);
  }

  if (!ready) return <main className="p-6">Loading...</main>;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Event points</h1>
        <Link href="/leaderboard" className="btn-ghost">Leaderboard</Link>
      </div>

      {message && <p className="text-sm text-yellow-300">{message}</p>}

      <div className="card grid gap-4 sm:grid-cols-2">
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
            <option key={x.id} value={x.id}>{x.name}</option>
          ))}
        </select>
      </div>

      {event && !preview && (
        <p className="text-sm text-gray-400">
          {isDouble
            ? "The Grand final has not been decided yet, so there are no placements to save."
            : "The final has not been played yet, so there are no placements to save."}
        </p>
      )}

      {preview && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Placements from the bracket</h2>
          <p className="text-sm text-gray-400">
            {isDouble
              ? "Champion 15, runner-up 10, third and fourth place 5, fifth to eighth place 3, everyone else 0."
              : "Champion 15, runner-up 10, semifinal losers 5, quarterfinal losers 3, everyone else 0."}{" "}
            Every member of a team gets the full points.
          </p>
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
                {preview.map((r) => (
                  <tr key={r.entryId} className="border-t border-gray-800">
                    <td className="py-1 pr-2">{r.placement}</td>
                    <td className="pr-2">{names.get(r.entryId) ?? "?"}</td>
                    <td className="pr-2">{r.label}</td>
                    <td className="font-semibold">{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={`text-sm ${upToDate ? "text-green-400" : "text-yellow-300"}`}>
            {saved.length === 0
              ? "These points are not published yet."
              : upToDate
              ? "The saved points match the bracket."
              : "The saved points differ from the bracket. Save again to update them."}
          </p>
          <div className="flex flex-wrap gap-3">
            <button className={button} onClick={save}>
              {saved.length > 0 ? "Save the points again" : "Save the points"}
            </button>
            {saved.length > 0 && (
              <button onClick={remove} className="text-red-400 underline">
                Remove saved points
              </button>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
