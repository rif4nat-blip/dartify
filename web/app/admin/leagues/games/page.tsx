"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  nextMatchups, pairs, roundRobinComplete, standings, tiebreakNeeded, winnerFromScores,
} from "@/lib/leagueLogic";
import { downloadLeagueXlsx, numberTeams } from "@/lib/leagueExport";

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
type Slot = { a: string; b: string };

const label = "flex flex-col gap-1.5 text-sm text-gray-300";
const small = "field !w-auto !px-3 !py-1.5 text-sm";

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function niceDate(d: string | null) {
  if (!d) return "No date yet";
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-PH", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function shortDate(d: string) {
  if (!d) return "No date";
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });
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
  const [night, setNight] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [count, setCount] = useState("6");

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
      const d = q.get("date");
      if (l) setLeagueId(l);
      if (e) setEventId(e);
      if (d) setNight(d);
      setReady(true);
    }
    init();
  }, [router, load]);

  const league = leagues.find((x) => x.id === leagueId);
  const lEvents = events.filter((x) => x.league_id === leagueId);
  const ev = events.find((x) => x.id === eventId && x.league_id === leagueId);
  const evTeams = useMemo(() => teams.filter((x) => x.league_event_id === eventId), [teams, eventId]);
  const evGames = useMemo(() => games.filter((x) => x.league_event_id === eventId), [games, eventId]);
  const teamNo = useMemo(() => numberTeams(evTeams).no, [evTeams]);
  const name = (id: string) => teams.find((t) => t.id === id)?.name ?? "?";

  const rows = standings(evTeams, evGames);
  const complete = roundRobinComplete(evGames);
  const needed = ev && ev.tiebreak_before_knockout && complete ? tiebreakNeeded(rows, ev.cut) : [];

  // game nights that already have games, oldest first
  const nightKeys = useMemo(() => {
    const set = new Set<string>();
    for (const g of evGames) set.add(g.game_date ?? "");
    const list = [...set].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
    if (night !== null && !set.has(night)) list.push(night);
    return list;
  }, [evGames, night]);

  // pick a night when a category is opened
  useEffect(() => {
    if (!eventId) return;
    setSlots([]);
    setDraft({});
    if (night !== null) return;
    const dates = [...new Set(evGames.map((g) => g.game_date).filter(Boolean) as string[])].sort();
    const t = todayStr();
    setNight(dates.find((d) => d >= t) ?? dates[dates.length - 1] ?? t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, evGames.length > 0]);

  const nightGames = useMemo(
    () => evGames
      .filter((g) => (g.game_date ?? "") === (night ?? ""))
      .sort((a, b) => (a.game_no ?? 999) - (b.game_no ?? 999)),
    [evGames, night]
  );
  const busyIds = useMemo(() => {
    const s = new Set<string>();
    for (const g of nightGames) if (g.status !== "cancelled") { s.add(g.team1_id); s.add(g.team2_id); }
    return s;
  }, [nightGames]);
  const nextNo = nightGames.reduce((m, g) => Math.max(m, g.game_no ?? 0), 0) + 1;
  const nightPlayed = nightGames.filter((g) => g.status === "played").length;

  function suggest() {
    if (!ev) return;
    const n = Math.max(1, Math.min(50, Number(count) || 1));
    const existing = evGames.filter((g) => g.kind === "regular" && g.status !== "cancelled")
      .map((g) => [g.team1_id, g.team2_id] as [string, string]);
    const busy = new Set(busyIds);
    const out = nextMatchups(evTeams.map((t) => t.id), existing, ev.rounds === "double" ? 2 : 1, n, busy);
    if (out.length === 0) { setMessage("No new matchups are left for the teams that are free this night."); return; }
    setMessage("");
    setSlots(out.map(([a, b]) => ({ a, b })));
  }

  function addBlankRows() {
    const n = Math.max(1, Math.min(50, Number(count) || 1));
    setSlots((cur) => [...cur, ...Array.from({ length: n }, () => ({ a: "", b: "" }))]);
  }

  function setSlot(i: number, patch: Partial<Slot>) {
    setSlots((cur) => cur.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async function saveSlots() {
    if (!ev || night === null) return;
    setMessage("");
    const filled = slots.filter((s) => s.a || s.b);
    if (filled.length === 0) { setMessage("Fill in at least one game."); return; }
    const seen = new Set(busyIds);
    for (const [i, s] of filled.entries()) {
      if (!s.a || !s.b) { setMessage(`Game row ${i + 1}: pick both teams.`); return; }
      if (s.a === s.b) { setMessage(`Game row ${i + 1}: a team cannot play itself.`); return; }
      for (const id of [s.a, s.b]) {
        if (seen.has(id)) { setMessage(`${name(id)} is already playing this night.`); return; }
        seen.add(id);
      }
    }
    const payload = filled.map((s, i) => ({
      league_event_id: ev.id,
      game_date: night || null,
      game_no: nextNo + i,
      team1_id: s.a,
      team2_id: s.b,
      kind: "regular",
    }));
    const { error } = await supabase.from("league_games").insert(payload);
    if (error) { setMessage(error.message); return; }
    setSlots([]);
    setMessage(`${payload.length} game${payload.length === 1 ? "" : "s"} saved for this night.`);
    load();
  }

  async function exportExcel() {
    if (!ev || !league) return;
    setMessage("");
    const { data: pl } = await supabase
      .from("league_team_players")
      .select("team_id, player_name")
      .in("team_id", evTeams.map((t) => t.id));
    const players: Record<string, string> = {};
    for (const p of pl ?? []) {
      players[p.team_id] = players[p.team_id] ? `${players[p.team_id]} / ${p.player_name}` : p.player_name;
    }
    try {
      await downloadLeagueXlsx({
        leagueName: league.name,
        categoryName: ev.name,
        cut: ev.cut,
        teams: evTeams,
        games: evGames,
        players,
      });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not create the Excel file.");
    }
  }

  async function createTiebreaks() {
    if (!ev) return;
    setMessage("");
    const payload: { league_event_id: string; team1_id: string; team2_id: string; kind: string; game_date: string | null }[] = [];
    for (const group of needed) {
      for (const [a, b] of pairs(group)) {
        const exists = evGames.some(
          (g) => g.kind === "tiebreak" &&
            ((g.team1_id === a.id && g.team2_id === b.id) || (g.team1_id === b.id && g.team2_id === a.id))
        );
        if (!exists) payload.push({ league_event_id: ev.id, team1_id: a.id, team2_id: b.id, kind: "tiebreak", game_date: night || null });
      }
    }
    if (payload.length === 0) { setMessage("Tiebreak games already exist. Enter their scores in the game night list."); return; }
    const { error } = await supabase.from("league_games").insert(payload);
    if (error) { setMessage(error.message); return; }
    setMessage(`${payload.length} tiebreak game${payload.length === 1 ? "" : "s"} created on ${night ? shortDate(night) : "the selected night"}.`);
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

  if (!ready) return <main className="p-6 text-gray-400">Loading...</main>;

  const teamLabel = (id: string) => `${teamNo.get(id) ?? "?"}. ${name(id)}`;

  const setForm = (
    <div className={`flex flex-col gap-3 ${nightGames.length > 0 ? "border-t border-white/10 pt-4" : ""}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="font-semibold">{nightGames.length === 0 ? "Set the games for this night" : "Add more games to this night"}</h3>
        <div className="flex flex-wrap items-end gap-2">
          <label className={label}>
            How many
            <input className="field !w-20" type="number" min={1} max={50} value={count} onChange={(e) => setCount(e.target.value)} />
          </label>
          <button type="button" onClick={suggest} className="btn">Suggest matchups</button>
          <button type="button" onClick={addBlankRows} className="btn-ghost">Add empty rows</button>
        </div>
      </div>

      {slots.length > 0 && (
        <>
          <div className="flex flex-col gap-2">
            {slots.map((s, i) => (
              <div key={i} className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-2 text-sm">
                <span className="w-16 text-gray-400">Game {nextNo + i}</span>
                <select className="field" value={s.a} onChange={(e) => setSlot(i, { a: e.target.value })}>
                  <option value="">Team 1</option>
                  {evTeams.map((t) => <option key={t.id} value={t.id}>{teamLabel(t.id)}</option>)}
                </select>
                <span className="text-gray-500">vs</span>
                <select className="field" value={s.b} onChange={(e) => setSlot(i, { b: e.target.value })}>
                  <option value="">Team 2</option>
                  {evTeams.map((t) => <option key={t.id} value={t.id}>{teamLabel(t.id)}</option>)}
                </select>
                <button type="button" onClick={() => setSlots((c) => c.filter((_, idx) => idx !== i))}
                  className="rounded-xl px-3 py-1 text-red-400 hover:bg-red-500/10">Remove</button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={saveSlots} className="btn">
              Save {slots.length} game{slots.length === 1 ? "" : "s"}
            </button>
            <button type="button" onClick={() => setSlots((c) => [...c, { a: "", b: "" }])} className="btn-ghost">+ Add a game</button>
            <button type="button" onClick={() => setSlots([])} className="btn-ghost">Clear</button>
          </div>
        </>
      )}
      <p className="text-xs text-gray-500">
        Suggest matchups picks pairs that have not met yet, with no team playing twice on the same night. You can change any team before saving.
        To postpone, cancel or move a whole night, use the League calendar.
      </p>
    </div>
  );

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Games and scores</h1>
          <p className="mt-1 text-sm text-gray-400">Set the games for each game night, enter the scores and watch the standings.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ev && <button type="button" onClick={exportExcel} className="btn">Export to Excel</button>}
          <Link href="/admin/leagues/calendar" className="btn-ghost">League calendar</Link>
          <Link href="/dashboard" className="btn-ghost">Dashboard</Link>
        </div>
      </div>

      {message && <p className="text-sm text-yellow-300">{message}</p>}

      <div className="card grid gap-4 sm:grid-cols-2">
        <label className={label}>
          1. League
          <select className="field" value={leagueId} onChange={(e) => { setLeagueId(e.target.value); setEventId(""); setNight(null); }}>
            <option value="">Select a league</option>
            {leagues.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <label className={label}>
          2. Category
          <select className="field" value={eventId} disabled={!leagueId} onChange={(e) => { setEventId(e.target.value); setNight(null); }}>
            <option value="">Select a category</option>
            {lEvents.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
      </div>

      {ev && (
        <>
          {/* Step 3: date */}
          <section className="card flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">3. Date</h2>
                <p className="text-sm text-gray-400">Pick a game night, or start a new one.</p>
              </div>
              <label className={label}>
                + New game night
                <input className="field" type="date" value={night ?? ""} onChange={(e) => { setNight(e.target.value); setSlots([]); }} />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {nightKeys.length === 0 && <p className="text-sm text-gray-500">No game nights yet. Pick a date above.</p>}
              {nightKeys.map((k) => {
                const list = evGames.filter((g) => (g.game_date ?? "") === k);
                const done = list.filter((g) => g.status === "played").length;
                return (
                  <button key={k || "none"} type="button" onClick={() => { setNight(k); setSlots([]); }}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      k === night ? "border-green-600 bg-green-600/15 text-green-400" : "border-white/15 bg-white/5 text-gray-300 hover:border-green-600"
                    }`}>
                    {shortDate(k)} · {done}/{list.length}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Step 4: games */}
          {night !== null && (
            <section className="card flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold">4. Games</h2>
                <p className="text-sm text-gray-400">
                  {night ? niceDate(night) : "Games with no date"}
                  {nightGames.length > 0 ? ` · ${nightPlayed} of ${nightGames.length} played` : " · no games yet"}
                </p>
              </div>

              {nightGames.length === 0 && setForm}

              <div className="flex flex-col gap-2">
                {nightGames.map((g, i) => {
                  const s = scoreOf(g);
                  const played = g.status === "played";
                  const open = g.status === "scheduled" || played;
                  return (
                    <div key={g.id} className="card-sm flex flex-col gap-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-gray-400">
                          Game {g.game_no ?? i + 1}
                          {g.kind === "tiebreak" && <span className="ml-2 rounded-full bg-amber-900/60 px-2 py-0.5 text-xs text-amber-300">tiebreak</span>}
                          {played && <span className="ml-2 rounded-full bg-green-900 px-2 py-0.5 text-xs text-green-300">played</span>}
                          {g.status === "postponed" && <span className="ml-2 rounded-full bg-amber-900/60 px-2 py-0.5 text-xs text-amber-300">postponed</span>}
                          {g.status === "cancelled" && <span className="ml-2 rounded-full bg-red-900/50 px-2 py-0.5 text-xs text-red-300">cancelled</span>}
                        </p>
                        <button onClick={() => remove(g)} className="rounded-xl px-3 py-1 text-red-400 hover:bg-red-500/10">Delete</button>
                      </div>
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <p className={`text-right text-base font-semibold ${g.winner_id === g.team1_id ? "text-green-400" : ""}`}>{teamLabel(g.team1_id)}</p>
                        <div className="flex items-center gap-2">
                          <input className="field !w-16 !px-2 !py-1.5 text-center" type="number" min={0} disabled={!open}
                            value={s.a} onChange={(e) => setDraft((c) => ({ ...c, [g.id]: { ...scoreOf(g), a: e.target.value } }))} />
                          <span className="text-gray-500">-</span>
                          <input className="field !w-16 !px-2 !py-1.5 text-center" type="number" min={0} disabled={!open}
                            value={s.b} onChange={(e) => setDraft((c) => ({ ...c, [g.id]: { ...scoreOf(g), b: e.target.value } }))} />
                        </div>
                        <p className={`text-base font-semibold ${g.winner_id === g.team2_id ? "text-green-400" : ""}`}>{teamLabel(g.team2_id)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {open && <button onClick={() => saveResult(g)} className="btn !px-4 !py-1.5 text-sm">Save result</button>}
                        {played && <button onClick={() => clearResult(g)} className="btn-ghost !px-4 !py-1.5 text-sm">Clear result</button>}
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

              {nightGames.length > 0 && setForm}
            </section>
          )}

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
        </>
      )}
    </main>
  );
}