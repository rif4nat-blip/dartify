"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { standings } from "@/lib/leagueLogic";
import ScheduleCalendar from "../components/ScheduleCalendar";

type League = { id: string; name: string; venue: string | null; game_days: string[]; season_start: string | null; season_end: string | null };
type LeagueEvent = { id: string; league_id: string; name: string; cut: number };
type LTeam = { id: string; league_event_id: string; name: string };
type Game = {
  id: string; league_event_id: string; team1_id: string; team2_id: string; winner_id: string | null;
  team1_score: number | null; team2_score: number | null; status: string; kind: string;
};

const label = "flex flex-col gap-1.5 text-sm text-gray-300";

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [events, setEvents] = useState<LeagueEvent[]>([]);
  const [teams, setTeams] = useState<LTeam[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [leagueId, setLeagueId] = useState("");
  const [eventId, setEventId] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const [l, e, t, g] = await Promise.all([
        supabase.from("leagues").select("id, name, venue, game_days, season_start, season_end").neq("status", "draft").order("created_at", { ascending: false }),
        supabase.from("league_events").select("id, league_id, name, cut").order("created_at"),
        supabase.from("league_teams").select("id, league_event_id, name"),
        supabase.from("league_games").select("*"),
      ]);
      const ls = (l.data ?? []) as League[];
      const es = (e.data ?? []) as LeagueEvent[];
      setLeagues(ls);
      setEvents(es);
      setTeams((t.data ?? []) as LTeam[]);
      setGames((g.data ?? []) as Game[]);
      if (ls[0]) {
        setLeagueId(ls[0].id);
        const first = es.find((x) => x.league_id === ls[0].id);
        if (first) setEventId(first.id);
      }
      setLoaded(true);
    }
    load();
  }, []);

  const league = leagues.find((x) => x.id === leagueId);
  const lEvents = events.filter((x) => x.league_id === leagueId);
  const ev = events.find((x) => x.id === eventId && x.league_id === leagueId);
  const evTeams = teams.filter((x) => x.league_event_id === eventId);
  const evGames = games.filter((x) => x.league_event_id === eventId);
  const rows = standings(evTeams, evGames);

  if (!loaded) return <main className="mx-auto max-w-5xl px-5 py-10 text-gray-400">Loading...</main>;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-8 md:py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leagues</h1>
        <p className="mt-1 text-sm text-gray-400">Schedule, results and standings.</p>
      </div>

      {leagues.length === 0 ? (
        <p className="text-gray-500">No leagues yet.</p>
      ) : (
        <>
          <div className="card grid gap-4 sm:grid-cols-2">
            <label className={label}>
              League
              <select className="field" value={leagueId}
                onChange={(e) => {
                  setLeagueId(e.target.value);
                  const first = events.find((x) => x.league_id === e.target.value);
                  setEventId(first ? first.id : "");
                }}>
                {leagues.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
            <label className={label}>
              Category
              <select className="field" value={eventId} onChange={(e) => setEventId(e.target.value)}>
                {lEvents.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
          </div>

          {league && (
            <p className="text-sm text-gray-400">
              {league.venue ? `${league.venue}` : ""}
              {league.season_start ? ` · Season starts ${league.season_start}` : ""}
              {league.season_end ? ` · Planned end ${league.season_end}` : ""}
            </p>
          )}

          {ev && (
            <section className="card flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Standings</h2>
                <span className="text-sm text-gray-400">Top {ev.cut} qualify</span>
              </div>
              {rows.length === 0 ? (
                <p className="text-sm text-gray-500">No teams yet.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-gray-400">
                    <tr>
                      <th className="py-1 pr-2">#</th><th>Team</th>
                      <th className="text-right">P</th><th className="text-right">W</th><th className="text-right">L</th>
                      <th className="text-right">For</th><th className="text-right">Against</th><th className="text-right">Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className={`border-t border-white/10 ${r.rank <= ev.cut ? "" : "text-gray-400"}`}>
                        <td className="py-1.5 pr-2">{r.tied ? "T" : ""}{r.rank}</td>
                        <td className="font-medium">{r.name}</td>
                        <td className="text-right">{r.played}</td>
                        <td className="text-right">{r.wins}</td>
                        <td className="text-right">{r.losses}</td>
                        <td className="text-right">{r.pf}</td>
                        <td className="text-right">{r.pa}</td>
                        <td className="text-right">{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}

          <section className="card flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Schedule</h2>
            <ScheduleCalendar refresh={eventId} />
          </section>
        </>
      )}
    </main>
  );
}
