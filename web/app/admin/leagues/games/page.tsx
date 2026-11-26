"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  pairs, roundDates, roundRobin, roundRobinComplete, standings, tiebreakNeeded, winnerFromScores,
} from "@/lib/leagueLogic";

type League = { id: string; name: string; game_days: string[]; season_start: string | null };
type LeagueEvent = {
  id: string; league_id: string; name: string; category: string; rounds: string; cut: number;
  tiebreak_before_knockout: boolean;
};
type LTeam = { id: string; league_event_id: string; name: string };
type Game = {
  id: string;
  league_event_id: string;
  game_date: string | null;
  game_no: number | null;
  table_no: number | null;
  team1_id: string;
  team2_id: string;
  winner_id: string | null;
  team1_score: number | null;
  team2_score: number | null;
  status: string;
  kind: string;
};

const label = "flex flex-col gap-1.5 text-sm text-gray-300";
const small = "field !w-auto !px-3 !py-1.5 text-sm";

function niceDate(d: string | null) {
  if (!d) return "No date yet";
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-PH", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

export default function AdminLeagueGamesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [leagues, setLeagues] = useState<League[]>([]);
  const [events, setEvents] = useState<LeagueEvent[]>([]);
  const [teams, setTeams] = useState<LTeam[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [leagueId, setLeagueId] = useState("");
  const [eventId, setEventId] = useState("");
  const [draft, setDraft] = useState<Record<string, { a: string; b: string }>>({});

  const [gDate, setGDate] = useState("");
  const [gNo, setGNo] = useState("");
  const [gTable, setGTable] = useState("");
  const [gT1, setGT1] = useState("");
  const [gT2, setGT2] = useState("");
  const [gKind, setGKind] = useState("regular");

  const load = useCallback(async () => {
    const [l, e, t, g] = await Promise.all([
      supabase.from("leagues").select("id, name, game_days, season_start").order("created_at", { ascending: false }),
      supabase.from("league_events").select("id, league_id, name, category, rounds, cut, tiebreak_before_knockout").order("created_at"),
      supabase.from("league_teams").select("id, league_event_id, name").order("name"),
      supabase.from("league_games").select("*"),
    ]);
    setLeagues((l.data ?? []) as League[]);
    setEvents((e.data ?? []) as LeagueEvent[]);
    setTeams((t.data ?? []) as LTeam[]);
    setGames((g.data ?? []) as Game[]);
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role !== "admin") { router.replace("/dashboard"); return; }
      await load();
      const q = new URLSearchParams(window.location.search);
      const l = q.get("league");
      const e = q.get("event");
      if (l) setLeagueId(l);
      if (e) setEventId(e);
      setReady(true);
    }
    init();
  }, [router, load]);

  const league = leagues.find((x) => x.id === leagueId);
  const lEvents = events.filter((x) => x.league_id === leagueId);
  const ev = events.find((x) => x.id === eventId && x.league_id === leagueId);
  const evTeams = teams.filter((x) => x.league_event_id === eventId);
  const evGames = games.filter((x) => x.league_event_id === eventId);
  const name = (id: string) => teams.find((t) => t.id === id)?.name ?? "?";

  const rows = standings(evTeams, evGames);
  const complete = roundRobinComplete(evGames);
  const needed = ev && ev.tiebreak_before_knockout && complete ? tiebreakNeeded(rows, ev.cut) : [];

  async function addGame(e: React.FormEvent) {
    e.preventDefault();
    if (!ev) return;
    setMessage("");
    if (!gT1 || !gT2 || gT1 === gT2) { setMessage("Pick two different teams."); return; }
    const { error } = await supabase.from("league_games").insert({
      league_event_id: ev.id,
      game_date: gDate || null,
      game_no: gNo ? Number(gNo) : null,
      table_no: gTable ? Number(gTable) : null,
      team1_id: gT1,
      team2_id: gT2,
      kind: gKind,
    });
    if (error) { setMessage(error.message); return; }
    setGT1(""); setGT2(""); setGNo(""); setGTable("");
    load();
  }

  async function generate() {
    if (!ev) return;
    setMessage("");
    if (evTeams.length < 2) { setMessage("Add at least 2 teams first."); return; }
    if (evGames.some((g) => g.kind === "regular")) {
      if (!confirm("This category already has games. Generate and add the full schedule anyway?")) return;
    }
    const rounds = roundRobin(evTeams.map((t) => t.id), ev.rounds === "double");
    const dates = roundDates(league?.season_start ?? null, league?.game_days ?? [], rounds.length);
    const payload = rounds.flatMap((round, ri) =>
      round.map(([a, b], i) => ({
        league_event_id: ev.id, game_date: dates[ri], game_no: i + 1, team1_id: a, team2_id: b, kind: "regular",
      }))
    );
    const { error } = await supabase.from("league_games").insert(payload);
    if (error) { setMessage(error.message); return; }
    setMessage(`${payload.length} games created in ${rounds.length} rounds.${dates[0] ? "" : " Set the league season start and game days to fill in dates automatically."}`);
    load();
  }

  async function createTiebreaks() {
    if (!ev) return;
    setMessage("");
    const payload: { league_event_id: string; team1_id: string; team2_id: string; kind: string }[] = [];
    for (const group of needed) {
      for (const [a, b] of pairs(group)) {
        const exists = evGames.some(
          (g) => g.kind === "tiebreak" &&
            ((g.team1_id === a.id && g.team2_id === b.id) || (g.team1_id === b.id && g.team2_id === a.id))
        );
        if (!exists) payload.push({ league_event_id: ev.id, team1_id: a.id, team2_id: b.id, kind: "tiebreak" });
      }
    }
    if (payload.length === 0) { setMessage("Tiebreak games already exist. Enter their scores below."); return; }
    const { error } = await supabase.from("league_games").insert(payload);
    if (error) { setMessage(error.message); return; }
    setMessage(`${payload.length} tiebreak game${payload.length === 1 ? "" : "s"} created. Set a date and enter the score below.`);
    load();
  }

  async function update(g: Game, patch: Partial<Game>) {
    await supabase.from("league_games").update(patch).eq("id", g.id);
    load();
  }

  function scoreOf(g: Game) {
    return draft[g.id] ?? {
      a: g.team1_score === null ? "" : String(g.team1_score),
      b: g.team2_score === null ? "" : String(g.team2_score),
    };
  }

  async function saveResult(g: Game) {
    setMessage("");
    const s = scoreOf(g);
    const a = Number(s.a);
    const b = Number(s.b);
    if (s.a === "" || s.b === "" || !Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
      setMessage("Enter both scores as whole numbers, for example 1 and 0.");
      return;
    }
    const w = winnerFromScores(g.team1_id, g.team2_id, a, b);
    if (!w) { setMessage("The scores are equal. A game needs a winner."); return; }
    await update(g, { team1_score: a, team2_score: b, winner_id: w, status: "played" });
    setDraft((cur) => { const n = { ...cur }; delete n[g.id]; return n; });
  }

  async function clearResult(g: Game) {
    await update(g, { team1_score: null, team2_score: null, winner_id: null, status: "scheduled" });
    setDraft((cur) => { const n = { ...cur }; delete n[g.id]; return n; });
  }

  async function setStatus(g: Game, status: string) {
    await update(g, { status, team1_score: null, team2_score: null, winner_id: null });
    setDraft((cur) => { const n = { ...cur }; delete n[g.id]; return n; });
  }

  async function remove(g: Game) {
    if (!confirm("Delete this game?")) return;
    await supabase.from("league_games").delete().eq("id", g.id);
    load();
  }

  const sorted = [...evGames].sort((a, b) => {
    if (a.game_date !== b.game_date) {
      if (!a.game_date) return 1;
      if (!b.game_date) return -1;
      return a.game_date.localeCompare(b.game_date);
    }
    return (a.game_no ?? 999) - (b.game_no ?? 999);
  });
  const groups: { date: string | null; games: Game[] }[] = [];
  for (const g of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.date === g.game_date) last.games.push(g);
    else groups.push({ date: g.game_date, games: [g] });
  }

  if (!ready) return <main className="p-6 text-gray-400">Loading...</main>;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Games and scores</h1>
          <p className="mt-1 text-sm text-gray-400">Schedule games, enter the score of each match and watch the standings.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/leagues/calendar" className="btn-ghost">League calendar</Link>
          <Link href="/dashboard" className="btn-ghost">Dashboard</Link>
        </div>
      </div>

      {message && <p className="text-sm text-yellow-300">{message}</p>}

      <div className="card grid gap-4 sm:grid-cols-2">
        <label className={label}>
          League
          <select className="field" value={leagueId} onChange={(e) => { setLeagueId(e.target.value); setEventId(""); }}>
            <option value="">Select a league</option>
            {leagues.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <label className={label}>
          Category
          <select className="field" value={eventId} disabled={!leagueId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">Select a category</option>
            {lEvents.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
      </div>

      {ev && (
        <>
          {/* Standings */}
          <section className="card flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Standings</h2>
              <span className="text-sm text-gray-400">Top {ev.cut} qualify for the main bracket</span>
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
            <p className="text-xs text-gray-500">
              Ranked by wins, then fewer losses. A T means teams are tied; inside a tie they are listed by score difference.
              {ev.tiebreak_before_knockout
                ? " Tiebreak before the knockout is on for this category."
                : " Tiebreak before the knockout is off for this category."}
            </p>
          </section>

          {needed.length > 0 && (
            <section className="card flex flex-col gap-3 !border-amber-700">
              <h2 className="text-lg font-semibold text-amber-300">Tiebreak needed before the knockout</h2>
              <p className="text-sm text-gray-300">
                The round robin is finished and these teams are tied on the qualify line (top {ev.cut}):
              </p>
              <ul className="text-sm text-gray-300">
                {needed.map((g) => (
                  <li key={g[0].id}>Place {g[0].rank}: {g.map((r) => r.name).join(" / ")}</li>
                ))}
              </ul>
              <div><button onClick={createTiebreaks} className="btn">Create tiebreak games</button></div>
            </section>
          )}

                    <section className="card flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-400">Games are scheduled on the League calendar. Pick a game night and add the games there.</p>
            <Link href="/admin/leagues/calendar" className="btn">Open league calendar</Link>
          </section>

          {/* Games */}
          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">Games ({evGames.length})</h2>
            {groups.length === 0 && <p className="text-sm text-gray-500">No games yet.</p>}
            {groups.map((grp) => (
              <div key={grp.date ?? "none"} className="flex flex-col gap-2">
                <p className="text-sm font-medium text-green-400">{niceDate(grp.date)}</p>
                {grp.games.map((g) => {
                  const s = scoreOf(g);
                  const played = g.status === "played";
                  const open = g.status === "scheduled" || played;
                  return (
                    <div key={g.id} className="card-sm flex flex-col gap-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-gray-400">
                          {g.game_no ? `Game ${g.game_no}` : "Game"}{g.table_no ? ` · Table ${g.table_no}` : ""}
                          {g.kind === "tiebreak" && (
                            <span className="ml-2 rounded-full bg-amber-900/60 px-2 py-0.5 text-xs text-amber-300">tiebreak</span>
                          )}
                          {played && (
                            <span className="ml-2 rounded-full bg-green-900 px-2 py-0.5 text-xs text-green-300">played</span>
                          )}
                          {g.status === "postponed" && (
                            <span className="ml-2 rounded-full bg-amber-900/60 px-2 py-0.5 text-xs text-amber-300">postponed</span>
                          )}
                          {g.status === "cancelled" && (
                            <span className="ml-2 rounded-full bg-red-900/50 px-2 py-0.5 text-xs text-red-300">cancelled</span>
                          )}
                        </p>
                        <button onClick={() => remove(g)} className="rounded-xl px-3 py-1 text-red-400 hover:bg-red-500/10">Delete</button>
                      </div>

                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <p className={`text-right text-base font-semibold ${g.winner_id === g.team1_id ? "text-green-400" : ""}`}>
                          {name(g.team1_id)}
                        </p>
                        <div className="flex items-center gap-2">
                          <input className="field !w-16 !px-2 !py-1.5 text-center" type="number" min={0} disabled={!open}
                            value={s.a} onChange={(e) => setDraft((c) => ({ ...c, [g.id]: { ...scoreOf(g), a: e.target.value } }))} />
                          <span className="text-gray-500">-</span>
                          <input className="field !w-16 !px-2 !py-1.5 text-center" type="number" min={0} disabled={!open}
                            value={s.b} onChange={(e) => setDraft((c) => ({ ...c, [g.id]: { ...scoreOf(g), b: e.target.value } }))} />
                        </div>
                        <p className={`text-base font-semibold ${g.winner_id === g.team2_id ? "text-green-400" : ""}`}>
                          {name(g.team2_id)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {open && (
                          <button onClick={() => saveResult(g)} className="btn !px-4 !py-1.5 text-sm">Save result</button>
                        )}
                        {played && (
                          <button onClick={() => clearResult(g)} className="btn-ghost !px-4 !py-1.5 text-sm">Clear result</button>
                        )}
                        <input className={small} type="date" value={g.game_date ?? ""}
                          onChange={(e) => update(g, { game_date: e.target.value || null })} />
                        <input className={small + " w-24"} type="number" min={1} placeholder="Game no." defaultValue={g.game_no ?? ""}
                          onBlur={(e) => update(g, { game_no: e.target.value ? Number(e.target.value) : null })} />
                        <input className={small + " w-24"} type="number" min={1} placeholder="Table" defaultValue={g.table_no ?? ""}
                          onBlur={(e) => update(g, { table_no: e.target.value ? Number(e.target.value) : null })} />
                        {!played && (
                          <select className={small} value={g.status} onChange={(e) => setStatus(g, e.target.value)}>
                            <option value="scheduled">Scheduled</option>
                            <option value="postponed">Postponed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
