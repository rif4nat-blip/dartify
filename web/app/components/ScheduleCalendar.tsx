"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { nextMatchups } from "@/lib/leagueLogic";

type Tournament = { id: string; name: string; event_date: string | null; venue: string | null; status: string };
type League = { id: string; name: string; venue: string | null; game_days: string[]; season_start: string | null; season_end: string | null; status: string };
type LEvent = { id: string; league_id: string; name: string; rounds: string };
type LTeam = { id: string; league_event_id: string; name: string };
type Game = {
  id: string; league_event_id: string; game_date: string | null; game_no: number | null; table_no: number | null;
  team1_id: string; team2_id: string; winner_id: string | null; status: string; kind: string;
  team1_score: number | null; team2_score: number | null;
};

type Mark = { kind: string; ref_id: string; mark_date: string; status: string; note: string | null };

type GameRow = { id: string; eventId: string; text: string };
type CalEvent = {
  id: string;
  date: string;
  type: "tournament" | "league";
  refId: string;
  eventIds: string[];
  hasGames: boolean;
  playedCount: number;
  title: string;
  sub: string;
  mark: "" | "postponed" | "cancelled";
  note: string;
  lines: string[];
  href?: string;
  gameRows: GameRow[];
  cats: LEvent[];
  teams: LTeam[];
  regular: { eventId: string; a: string; b: string }[];
  tonight: { eventId: string; a: string; b: string }[];
  nextNo: number;
};
type DraftRow = { t1: string; t2: string; no: string; table: string };
type Draft = { eventId: string; rows: DraftRow[]; count: string };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const small = "field !w-auto !px-3 !py-1.5 text-sm";

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parse(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function nice(s: string) {
  return parse(s).toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function build(
  tournaments: Tournament[], leagues: League[], events: LEvent[], teams: LTeam[], games: Game[], marks: Mark[]
): CalEvent[] {
  const out: CalEvent[] = [];
  const tname = (id: string) => teams.find((t) => t.id === id)?.name ?? "?";
  const none = { gameRows: [], cats: [], teams: [], regular: [], tonight: [], nextNo: 1 };

  for (const t of tournaments) {
    if (!t.event_date) continue;
    const tdate = t.event_date.slice(0, 10);
    const tm = marks.find((m) => m.kind === "tournament" && m.ref_id === t.id && m.mark_date === tdate);
    out.push({
      id: "t-" + t.id,
      date: tdate,
      type: "tournament",
      refId: t.id,
      eventIds: [],
      hasGames: false,
      playedCount: 0,
      title: t.name,
      sub: "Tournament",
      mark: tm ? (tm.status as "postponed" | "cancelled") : "",
      note: tm?.note ?? "",
      lines: [t.venue ? `Venue: ${t.venue}` : "", `Status: ${t.status}`].filter(Boolean),
      href: "/tournaments",
      ...none,
    });
  }

  for (const l of leagues) {
    if (l.status === "draft") continue;
    const lEvents = events.filter((e) => e.league_id === l.id);
    const lTeams = teams.filter((t) => lEvents.some((e) => e.id === t.league_event_id));
    const lGames = games.filter((g) => g.game_date && lEvents.some((e) => e.id === g.league_event_id));
    const regular = games
      .filter((g) => g.kind === "regular" && lEvents.some((e) => e.id === g.league_event_id))
      .map((g) => ({ eventId: g.league_event_id, a: g.team1_id, b: g.team2_id }));
    const dates = new Set<string>(lGames.map((g) => g.game_date as string));

    // planned game days between season start and end
    if (l.season_start && l.game_days.length > 0) {
      const last = [...dates].sort().pop();
      let endStr = l.season_end;
      if (!endStr) {
        // no planned end yet: show 12 weeks from the season start (or up to the last game)
        const lim = parse(l.season_start);
        lim.setDate(lim.getDate() + 84);
        const limS = ymd(lim);
        endStr = last && last > limS ? last : limS;
      }
      const cur = parse(l.season_start);
      const end = parse(endStr);
      let guard = 0;
      while (cur <= end && guard < 800) {
        if (l.game_days.includes(DAY_KEYS[cur.getDay()])) dates.add(ymd(cur));
        cur.setDate(cur.getDate() + 1);
        guard++;
      }
    }

    for (const date of dates) {
      const day = lGames
        .filter((g) => g.game_date === date)
        .sort((a, b) => (a.game_no ?? 999) - (b.game_no ?? 999));
      const gameRows: GameRow[] = day.map((g) => {
        const cat = lEvents.find((e) => e.id === g.league_event_id)?.name ?? "";
        let s = `${cat} · ${g.game_no ? `Game ${g.game_no}: ` : ""}${tname(g.team1_id)} vs ${tname(g.team2_id)}`;
        if (g.table_no) s += ` (Table ${g.table_no})`;
        if (g.status === "played" && g.winner_id) s += ` — ${tname(g.winner_id)} won${g.team1_score !== null && g.team2_score !== null ? ` ${g.team1_score}-${g.team2_score}` : ""}`;
        else if (g.status === "postponed") s += " — postponed";
        else if (g.status === "cancelled") s += " — cancelled";
        if (g.kind === "tiebreak") s += " (tiebreak)";
        return { id: g.id, eventId: g.league_event_id, text: s };
      });
      const lm = marks.find((m) => m.kind === "league" && m.ref_id === l.id && m.mark_date === date);
      let mark: "" | "postponed" | "cancelled" = lm ? (lm.status as "postponed" | "cancelled") : "";
      if (!mark && day.length > 0 && day.every((g) => g.status === "cancelled")) mark = "cancelled";
      else if (!mark && day.length > 0 && day.every((g) => g.status === "postponed" || g.status === "cancelled")) mark = "postponed";
      out.push({
        id: `l-${l.id}-${date}`,
        date,
        type: "league",
        refId: l.id,
        eventIds: lEvents.map((e) => e.id),
        hasGames: day.length > 0,
        playedCount: day.filter((g) => g.status === "played").length,
        title: l.name,
        sub: day.length > 0 ? `${day.length} game${day.length === 1 ? "" : "s"}` : "Game night",
        mark,
        note: lm?.note ?? "",
        lines: gameRows.length > 0 ? gameRows.map((r) => r.text) : ["Game night. No games added yet."],
        href: "/leagues",
        gameRows,
        cats: lEvents,
        teams: lTeams,
        regular,
        tonight: day.map((g) => ({ eventId: g.league_event_id, a: g.team1_id, b: g.team2_id })),
        nextNo: day.reduce((m, g) => Math.max(m, g.game_no ?? 0), 0) + 1,
      });
    }
  }
  return out;
}

function chip(e: CalEvent) {
  if (e.mark === "cancelled") return "bg-red-900/40 text-red-300 line-through";
  if (e.mark === "postponed") return "bg-amber-900/50 text-amber-300";
  return e.type === "tournament" ? "bg-green-900/50 text-green-300" : "bg-sky-900/50 text-sky-300";
}

export default function ScheduleCalendar({
  refresh,
  editable,
  onChange,
}: {
  refresh?: string;
  editable?: boolean;
  onChange?: () => void;
}) {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [ym, setYm] = useState<{ y: number; m: number } | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [msg, setMsg] = useState("");
  const [moveTo, setMoveTo] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const load = useCallback(async () => {
    const [t, l, e, tm, g, mk] = await Promise.all([
      supabase.from("tournaments").select("id, name, event_date, venue, status"),
      supabase.from("leagues").select("id, name, venue, game_days, season_start, season_end, status"),
      supabase.from("league_events").select("id, league_id, name, rounds"),
      supabase.from("league_teams").select("id, league_event_id, name").order("name"),
      supabase.from("league_games").select("*"),
      supabase.from("schedule_marks").select("*"),
    ]);
    setEvents(
      build(
        (t.data ?? []) as Tournament[], (l.data ?? []) as League[], (e.data ?? []) as LEvent[],
        (tm.data ?? []) as LTeam[], (g.data ?? []) as Game[], (mk.data ?? []) as Mark[]
      )
    );
  }, []);

  useEffect(() => {
    load();
  }, [load, refresh]);

  async function afterChange() {
    await load();
    onChange?.();
  }

  async function setMark(e: CalEvent, status: "" | "postponed" | "cancelled") {
    setMsg("");
    if (status && e.playedCount > 0) {
      setMsg("Some games on this night are already played. Change the other games in Games and scores.");
      return;
    }
    if (status === "") {
      const { error } = await supabase.from("schedule_marks").delete()
        .eq("kind", e.type).eq("ref_id", e.refId).eq("mark_date", e.date);
      if (error) { setMsg(error.message); return; }
      if (e.type === "league" && e.eventIds.length > 0) {
        await supabase.from("league_games").update({ status: "scheduled" })
          .in("league_event_id", e.eventIds).eq("game_date", e.date).in("status", ["postponed", "cancelled"]);
      }
    } else {
      const { error } = await supabase.from("schedule_marks").upsert(
        { kind: e.type, ref_id: e.refId, mark_date: e.date, status, note: null },
        { onConflict: "kind,ref_id,mark_date" }
      );
      if (error) { setMsg(error.message); return; }
      if (e.type === "league" && e.eventIds.length > 0) {
        await supabase.from("league_games").update({ status, winner_id: null })
          .in("league_event_id", e.eventIds).eq("game_date", e.date).neq("status", "played");
      }
    }
    afterChange();
  }

  async function moveEvent(e: CalEvent) {
    setMsg("");
    const to = moveTo[e.id];
    if (!to || to === e.date) {
      setMsg("Pick a new date first.");
      return;
    }
    if (e.type === "tournament") {
      const { error } = await supabase.from("tournaments").update({ event_date: to }).eq("id", e.refId);
      if (error) { setMsg(error.message); return; }
      await supabase.from("schedule_marks").delete()
        .eq("kind", "tournament").eq("ref_id", e.refId).eq("mark_date", e.date);
    } else {
      if (!e.hasGames) { setMsg("Add games to this night first, then you can move it."); return; }
      const { error } = await supabase.from("league_games").update({ game_date: to, status: "scheduled" })
        .in("league_event_id", e.eventIds).eq("game_date", e.date).neq("status", "played");
      if (error) { setMsg(error.message); return; }
      await supabase.from("schedule_marks").delete()
        .eq("kind", "league").eq("ref_id", e.refId).eq("mark_date", to);
      if (e.playedCount === 0) {
        await supabase.from("schedule_marks").upsert(
          { kind: "league", ref_id: e.refId, mark_date: e.date, status: "postponed", note: `Moved to ${nice(to)}` },
          { onConflict: "kind,ref_id,mark_date" }
        );
      }
    }
    setSelected(to);
    const [y, m] = to.split("-").map(Number);
    setYm({ y, m: m - 1 });
    afterChange();
  }

  // ----- games on a night -----
  function getDraft(e: CalEvent): Draft {
    return drafts[e.id] ?? { eventId: e.cats[0]?.id ?? "", rows: [{ t1: "", t2: "", no: "", table: "" }], count: "6" };
  }
  function setDraft(e: CalEvent, patch: Partial<Draft>) {
    setDrafts((cur) => ({ ...cur, [e.id]: { ...getDraft(e), ...patch } }));
  }
  function setRow(e: CalEvent, i: number, patch: Partial<DraftRow>) {
    const d = getDraft(e);
    setDraft(e, { rows: d.rows.map((r, k) => (k === i ? { ...r, ...patch } : r)) });
  }

  function autoFill(e: CalEvent) {
    setMsg("");
    const d = getDraft(e);
    const cat = e.cats.find((c) => c.id === d.eventId);
    if (!cat) { setMsg("Pick a category first."); return; }
    const ids = e.teams.filter((t) => t.league_event_id === cat.id).map((t) => t.id);
    if (ids.length < 2) { setMsg("This category needs at least 2 teams. Add them on League teams."); return; }
    const count = Math.max(1, Math.min(50, Number(d.count) || 6));
    const existing = e.regular.filter((r) => r.eventId === cat.id).map((r) => [r.a, r.b] as [string, string]);
    const busy = new Set<string>();
    for (const g of e.tonight) if (g.eventId === cat.id) { busy.add(g.a); busy.add(g.b); }
    const picks = nextMatchups(ids, existing, cat.rounds === "double" ? 2 : 1, count, busy);
    if (picks.length === 0) { setMsg("No matchups left for this category."); return; }
    setDraft(e, {
      rows: picks.map(([a, b], i) => ({ t1: a, t2: b, no: String(e.nextNo + i), table: "" })),
    });
    if (picks.length < count) {
      setMsg(`Only ${picks.length} matchup${picks.length === 1 ? "" : "s"} fit this night. Nobody plays twice in a night.`);
    }
  }

  async function saveGames(e: CalEvent) {
    setMsg("");
    const d = getDraft(e);
    const rows = d.rows.filter((r) => r.t1 || r.t2);
    if (rows.length === 0) { setMsg("Add at least one game."); return; }
    for (const r of rows) {
      if (!r.t1 || !r.t2 || r.t1 === r.t2) { setMsg("Every game needs two different teams."); return; }
    }
    const payload = rows.map((r, i) => ({
      league_event_id: d.eventId,
      game_date: e.date,
      game_no: r.no ? Number(r.no) : e.nextNo + i,
      table_no: r.table ? Number(r.table) : null,
      team1_id: r.t1,
      team2_id: r.t2,
      kind: "regular",
    }));
    const { error } = await supabase.from("league_games").insert(payload);
    if (error) { setMsg(error.message); return; }
    setDrafts((cur) => { const n = { ...cur }; delete n[e.id]; return n; });
    setMsg(`${payload.length} game${payload.length === 1 ? "" : "s"} added to ${nice(e.date)}.`);
    afterChange();
  }

  async function deleteGame(id: string) {
    if (!confirm("Delete this game?")) return;
    await supabase.from("league_games").delete().eq("id", id);
    afterChange();
  }

  useEffect(() => {
    if (ym) return;
    const now = new Date();
    setYm({ y: now.getFullYear(), m: now.getMonth() });
  }, [ym]);

  if (!ym) return null;

  const first = new Date(ym.y, ym.m, 1).getDay();
  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const byDate = new Map<string, CalEvent[]>();
  for (const e of events) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);

  function move(delta: number) {
    setYm((cur) => {
      if (!cur) return cur;
      const d = new Date(cur.y, cur.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  const sel = selected ? byDate.get(selected) ?? [] : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => move(-1)} className="btn-ghost !px-3 !py-1.5 text-sm">&larr; Prev</button>
        <p className="text-lg font-semibold">{MONTHS[ym.m]} {ym.y}</p>
        <button type="button" onClick={() => move(1)} className="btn-ghost !px-3 !py-1.5 text-sm">Next &rarr;</button>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[680px]">
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400">
            {DOW.map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (d === null) return <div key={i} className="min-h-24 rounded-lg bg-white/[0.02]" />;
              const key = `${ym.y}-${pad(ym.m + 1)}-${pad(d)}`;
              const list = byDate.get(key) ?? [];
              return (
                <button type="button" key={i} onClick={() => setSelected(key)}
                  className={`min-h-24 rounded-lg border p-1 text-left align-top ${
                    selected === key
                      ? "border-green-500 bg-white/[0.08]"
                      : list.length > 0
                      ? "border-green-700/50 bg-white/[0.05]"
                      : "border-white/5 bg-transparent"
                  }`}>
                  <p className={`mb-1 px-1 text-xs ${list.length > 0 ? "font-semibold text-green-400" : "text-gray-500"}`}>{d}</p>
                  <div className="flex flex-col gap-1">
                    {list.map((e) => (
                      <div key={e.id} className={`rounded px-1 py-0.5 text-[11px] leading-tight ${chip(e)}`}>
                        <b>{e.title}</b>
                        <span className="block opacity-80">
                          {e.mark === "cancelled" ? "Cancelled" : e.mark === "postponed" ? "Postponed" : e.sub}
                        </span>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-green-700" />Tournament</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-sky-700" />League game night</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-amber-700" />Postponed</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-red-700" />Cancelled</span>
      </div>

      {selected && (
        <div className="card-sm flex flex-col gap-3 text-sm">
          <p className="font-semibold">{nice(selected)}</p>
          {msg && <p className="text-yellow-300">{msg}</p>}
          {sel.length === 0 && <p className="text-gray-500">Nothing scheduled.</p>}
          {sel.map((e) => {
            const d = getDraft(e);
            const catTeams = e.teams.filter((t) => t.league_event_id === d.eventId);
            return (
              <div key={e.id} className="flex flex-col gap-1">
                <p className="font-medium">
                  {e.title}{" "}
                  <span className="text-gray-400">
                    · {e.type === "tournament" ? "Tournament" : "League"}
                  </span>
                  {e.href && (
                    <Link href={e.href} className="ml-2 text-green-400 hover:underline">View</Link>
                  )}
                </p>
                {e.mark && (
                  <p className={e.mark === "cancelled" ? "text-red-300" : "text-amber-300"}>
                    {e.mark === "cancelled" ? "Cancelled" : "Postponed"}{e.note ? ` · ${e.note}` : ""}
                  </p>
                )}

                {editable && e.type === "league" ? (
                  <div className="mt-1 flex flex-col gap-1.5">
                    {e.gameRows.length === 0 && <p className="text-gray-500">No games on this night yet.</p>}
                    {e.gameRows.map((g) => (
                      <div key={g.id} className="flex items-center justify-between gap-2">
                        <span className="text-gray-300">{g.text}</span>
                        <button type="button" onClick={() => deleteGame(g.id)}
                          className="rounded-lg px-2 py-1 text-red-400 hover:bg-red-500/10">Delete</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  e.lines.map((ln, i) => <p key={i} className="text-gray-400">{ln}</p>)
                )}

                {editable && e.type === "league" && e.cats.length > 0 && (
                  <div className="mt-2 flex flex-col gap-3 rounded-xl border border-white/10 p-3">
                    <p className="font-medium">Add games to this night</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <select className={small} value={d.eventId}
                        onChange={(ev) => setDraft(e, { eventId: ev.target.value, rows: [{ t1: "", t2: "", no: "", table: "" }] })}>
                        {e.cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <input type="number" min={1} className={small + " w-20"} value={d.count}
                        onChange={(ev) => setDraft(e, { count: ev.target.value })} />
                      <span className="text-gray-400">games</span>
                      <button type="button" onClick={() => autoFill(e)} className="btn-ghost !px-3 !py-1.5 text-sm">
                        Suggest matchups
                      </button>
                    </div>

                    {d.rows.map((r, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-2">
                        <input type="number" min={1} placeholder="No." className={small + " w-16"} value={r.no}
                          onChange={(ev) => setRow(e, i, { no: ev.target.value })} />
                        <select className={small} value={r.t1} onChange={(ev) => setRow(e, i, { t1: ev.target.value })}>
                          <option value="">Team 1</option>
                          {catTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <span className="text-gray-500">vs</span>
                        <select className={small} value={r.t2} onChange={(ev) => setRow(e, i, { t2: ev.target.value })}>
                          <option value="">Team 2</option>
                          {catTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <input type="number" min={1} placeholder="Table" className={small + " w-20"} value={r.table}
                          onChange={(ev) => setRow(e, i, { table: ev.target.value })} />
                        <button type="button" onClick={() => setDraft(e, { rows: d.rows.filter((_, k) => k !== i) })}
                          className="rounded-lg px-2 py-1 text-red-400 hover:bg-red-500/10">x</button>
                      </div>
                    ))}

                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-ghost !px-3 !py-1.5 text-sm"
                        onClick={() => setDraft(e, { rows: [...d.rows, { t1: "", t2: "", no: String(e.nextNo + d.rows.length), table: "" }] })}>
                        + Add a game
                      </button>
                      <button type="button" className="btn !px-4 !py-1.5 text-sm" onClick={() => saveGames(e)}>
                        Save {d.rows.filter((r) => r.t1 || r.t2).length || ""} game{d.rows.filter((r) => r.t1 || r.t2).length === 1 ? "" : "s"}
                      </button>
                    </div>
                  </div>
                )}

                {editable && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {e.mark !== "postponed" && (
                      <button type="button" onClick={() => setMark(e, "postponed")}
                        className="rounded-xl border border-amber-700 px-3 py-1.5 text-amber-300 hover:bg-amber-500/10">Postpone</button>
                    )}
                    {e.mark !== "cancelled" && (
                      <button type="button" onClick={() => setMark(e, "cancelled")}
                        className="rounded-xl border border-red-700 px-3 py-1.5 text-red-300 hover:bg-red-500/10">Cancel</button>
                    )}
                    {e.mark && (
                      <button type="button" onClick={() => setMark(e, "")}
                        className="btn-ghost !px-3 !py-1.5 text-sm">Restore</button>
                    )}
                    <input type="date" className={small} value={moveTo[e.id] ?? ""}
                      onChange={(ev) => setMoveTo((cur) => ({ ...cur, [e.id]: ev.target.value }))} />
                    <button type="button" onClick={() => moveEvent(e)}
                      className="btn-ghost !px-3 !py-1.5 text-sm">Move to this date</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
