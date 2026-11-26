"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type League = { id: string; name: string };
type LeagueEvent = {
  id: string;
  league_id: string;
  name: string;
  category: string;
  roster_min: number;
  roster_max: number;
  rounds: string;
  playoff_format: string;
  cut: number;
};
type LTeam = {
  id: string;
  league_event_id: string;
  name: string;
  captain: string | null;
  payment_status: string;
};
type LPlayer = { id: string; team_id: string; player_name: string; side: string | null };

const CATS: Record<string, string> = {
  singles: "Singles",
  doubles: "Doubles",
  "3man": "3-man",
};

const label = "flex flex-col gap-1.5 text-sm text-gray-300";
const small = "field !w-auto !px-3 !py-1.5 text-sm";

function payPill(status: string) {
  if (status === "paid") return "bg-green-900 text-green-300";
  if (status === "pending") return "bg-amber-900/60 text-amber-300";
  return "bg-gray-700 text-gray-300";
}

export default function AdminLeagueTeamsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [leagues, setLeagues] = useState<League[]>([]);
  const [events, setEvents] = useState<LeagueEvent[]>([]);
  const [teams, setTeams] = useState<LTeam[]>([]);
  const [players, setPlayers] = useState<LPlayer[]>([]);

  const [leagueId, setLeagueId] = useState("");
  const [eventId, setEventId] = useState("");

  const [tName, setTName] = useState("");
  const [tCaptain, setTCaptain] = useState("");
  const [tPay, setTPay] = useState("unpaid");
  const [tPlayers, setTPlayers] = useState("");
  const [newPlayer, setNewPlayer] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [l, e, t, p] = await Promise.all([
      supabase.from("leagues").select("id, name").order("created_at", { ascending: false }),
      supabase.from("league_events").select("*").order("created_at"),
      supabase.from("league_teams").select("*").order("name"),
      supabase.from("league_team_players").select("*").order("created_at"),
    ]);
    setLeagues((l.data ?? []) as League[]);
    setEvents((e.data ?? []) as LeagueEvent[]);
    setTeams((t.data ?? []) as LTeam[]);
    setPlayers((p.data ?? []) as LPlayer[]);
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
      const q = new URLSearchParams(window.location.search);
      const l = q.get("league");
      const e = q.get("event");
      if (l) setLeagueId(l);
      if (e) setEventId(e);
      setReady(true);
    }
    init();
  }, [router, load]);

  const lEvents = events.filter((x) => x.league_id === leagueId);
  const ev = events.find((x) => x.id === eventId && x.league_id === leagueId);
  const evTeams = teams.filter((x) => x.league_event_id === eventId);
  const is3 = ev?.category === "3man";

  async function addTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!ev) return;
    setMessage("");
    const name = tName.trim();
    if (!name) {
      setMessage(ev.category === "singles" ? "Enter the player name." : "Enter the team name.");
      return;
    }
    let names: string[];
    if (ev.category === "singles") {
      names = [name];
    } else {
      names = tPlayers
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);
      if (names.length < ev.roster_min || names.length > ev.roster_max) {
        setMessage(
          ev.roster_min === ev.roster_max
            ? `This category needs exactly ${ev.roster_min} players (one name per line).`
            : `This category needs ${ev.roster_min} to ${ev.roster_max} players (one name per line).`
        );
        return;
      }
    }
    const { data: team, error } = await supabase
      .from("league_teams")
      .insert({
        league_event_id: ev.id,
        name,
        captain: ev.category === "singles" ? null : tCaptain.trim() || null,
        payment_status: tPay,
      })
      .select()
      .single();
    if (error || !team) {
      setMessage(
        error?.code === "23505"
          ? "A team with this name already exists in this category."
          : error?.message ?? "Could not add the team."
      );
      return;
    }
    const half = Math.ceil(names.length / 2);
    const rows = names.map((n, i) => ({
      team_id: team.id,
      player_name: n,
      side: ev.category === "3man" ? (i < half ? "A" : "B") : null,
    }));
    const { error: e2 } = await supabase.from("league_team_players").insert(rows);
    if (e2) setMessage(e2.message);
    setTName("");
    setTCaptain("");
    setTPlayers("");
    setTPay("unpaid");
    load();
  }

  async function setTeamPayment(id: string, status: string) {
    await supabase.from("league_teams").update({ payment_status: status }).eq("id", id);
    load();
  }

  async function removeTeam(t: LTeam) {
    if (!confirm(`Remove ${t.name}?`)) return;
    await supabase.from("league_teams").delete().eq("id", t.id);
    load();
  }

  async function addPlayer(t: LTeam) {
    const n = (newPlayer[t.id] ?? "").trim();
    if (!n) return;
    const count = players.filter((p) => p.team_id === t.id).length;
    if (ev && count >= ev.roster_max) {
      setMessage(`${t.name} already has the maximum of ${ev.roster_max} players.`);
      return;
    }
    await supabase.from("league_team_players").insert({
      team_id: t.id,
      player_name: n,
      side: is3 ? "B" : null,
    });
    setNewPlayer((cur) => ({ ...cur, [t.id]: "" }));
    load();
  }

  async function setSide(id: string, side: string) {
    await supabase.from("league_team_players").update({ side: side || null }).eq("id", id);
    load();
  }

  async function removePlayer(id: string) {
    await supabase.from("league_team_players").delete().eq("id", id);
    load();
  }

  if (!ready) return <main className="p-6 text-gray-400">Loading...</main>;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">League teams</h1>
          <p className="mt-1 text-sm text-gray-400">
            Enter each team with its players and registration status.
          </p>
        </div>
        <Link href="/admin/leagues" className="btn-ghost">Manage leagues</Link>
      </div>

      {message && <p className="text-sm text-yellow-300">{message}</p>}

      <div className="card grid gap-4 sm:grid-cols-2">
        <label className={label}>
          League
          <select className="field" value={leagueId}
            onChange={(e) => { setLeagueId(e.target.value); setEventId(""); }}>
            <option value="">Select a league</option>
            {leagues.map((x) => (
              <option key={x.id} value={x.id}>{x.name}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          Category
          <select className="field" value={eventId} disabled={!leagueId}
            onChange={(e) => setEventId(e.target.value)}>
            <option value="">Select a category</option>
            {lEvents.map((x) => (
              <option key={x.id} value={x.id}>{x.name}</option>
            ))}
          </select>
        </label>
      </div>

      {leagueId && lEvents.length === 0 && (
        <p className="text-sm text-gray-500">
          This league has no categories yet. Add one on the Manage leagues page.
        </p>
      )}

      {ev && (
        <>
          <p className="text-sm text-gray-400">
            {CATS[ev.category]} · {ev.rounds === "double" ? "Double round robin" : "Round robin"} then{" "}
            {ev.playoff_format === "double" ? "double" : "single"} elimination · top {ev.cut} qualify
          </p>

          <form onSubmit={addTeam} className="card flex flex-col gap-4">
            <h3 className="font-semibold">
              {ev.category === "singles" ? "Add a player" : "Add a team"}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={label}>
                {ev.category === "singles" ? "Player name" : "Team name"}
                <input className="field" value={tName} onChange={(e) => setTName(e.target.value)} required />
              </label>
              <label className={label}>
                Registration
                <select className="field" value={tPay} onChange={(e) => setTPay(e.target.value)}>
                  <option value="unpaid">Unpaid</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </label>
              {ev.category !== "singles" && (
                <label className={label}>
                  Captain (optional)
                  <input className="field" value={tCaptain} onChange={(e) => setTCaptain(e.target.value)} />
                </label>
              )}
            </div>
            {ev.category !== "singles" && (
              <label className={label}>
                Players, one name per line ({ev.roster_min === ev.roster_max
                  ? `exactly ${ev.roster_min}`
                  : `${ev.roster_min} to ${ev.roster_max}`})
                <textarea className="field min-h-32" value={tPlayers}
                  onChange={(e) => setTPlayers(e.target.value)} />
              </label>
            )}
            <div>
              <button className="btn">{ev.category === "singles" ? "Add player" : "Add team"}</button>
            </div>
          </form>

          <p className="text-sm text-gray-400">
            {evTeams.length} {ev.category === "singles" ? "players" : "teams"}
          </p>
          {evTeams.length === 0 && <p className="text-sm text-gray-500">Nothing added yet.</p>}

          <div className="flex flex-col gap-3">
            {evTeams.map((t) => {
              const ps = players.filter((p) => p.team_id === t.id);
              const a = ps.filter((p) => p.side === "A").length;
              const b = ps.filter((p) => p.side === "B").length;
              const short = ps.length < ev.roster_min;
              return (
                <div key={t.id} className="card-sm text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {t.name}
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${payPill(t.payment_status)}`}>
                          {t.payment_status}
                        </span>
                      </p>
                      {ev.category !== "singles" && (
                        <p className="text-gray-400">
                          {t.captain ? `Captain: ${t.captain} · ` : ""}
                          {ps.length} player{ps.length === 1 ? "" : "s"}
                          {is3 ? ` · A: ${a} · B: ${b}` : ""}
                          {short ? ` · needs at least ${ev.roster_min}` : ""}
                        </p>
                      )}
                    </div>
                    <button onClick={() => removeTeam(t)}
                      className="rounded-xl px-3 py-1.5 text-red-400 hover:bg-red-500/10">Remove</button>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <select className={small} value={t.payment_status}
                      onChange={(e) => setTeamPayment(t.id, e.target.value)}>
                      <option value="unpaid">Unpaid</option>
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>

                  {ev.category !== "singles" && (
                    <div className="mt-3 flex flex-col gap-1.5">
                      {ps.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-2">
                          <span>{p.player_name}</span>
                          <span className="flex items-center gap-2">
                            {is3 && (
                              <select className={small} value={p.side ?? ""}
                                onChange={(e) => setSide(p.id, e.target.value)}>
                                <option value="A">Team A</option>
                                <option value="B">Team B</option>
                              </select>
                            )}
                            <button onClick={() => removePlayer(p.id)}
                              className="rounded-lg px-2 py-1 text-red-400 hover:bg-red-500/10">x</button>
                          </span>
                        </div>
                      ))}
                      <div className="mt-1 flex gap-2">
                        <input className="field !py-1.5 text-sm" placeholder="Add a player"
                          value={newPlayer[t.id] ?? ""}
                          onChange={(e) => setNewPlayer((cur) => ({ ...cur, [t.id]: e.target.value }))} />
                        <button type="button" className="btn-ghost !px-3 !py-1.5 text-sm"
                          onClick={() => addPlayer(t)}>Add</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
