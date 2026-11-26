"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type League = {
  id: string;
  name: string;
  venue: string | null;
  game_days: string[];
  season_start: string | null;
  season_end: string | null;
  status: string;
};
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
  stage: string;
  tiebreak_before_knockout: boolean;
};
type LTeamRef = { id: string; league_event_id: string };

const DAYS: [string, string][] = [
  ["mon", "Mon"],
  ["tue", "Tue"],
  ["wed", "Wed"],
  ["thu", "Thu"],
  ["fri", "Fri"],
  ["sat", "Sat"],
  ["sun", "Sun"],
];

const CATS: Record<string, { label: string; min: number; max: number }> = {
  singles: { label: "Singles", min: 1, max: 1 },
  doubles: { label: "Doubles", min: 2, max: 2 },
  "3man": { label: "3-man", min: 6, max: 8 },
};

const label = "flex flex-col gap-1.5 text-sm text-gray-300";
const small = "field !w-auto !px-3 !py-1.5 text-sm";

export default function AdminLeaguesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [leagues, setLeagues] = useState<League[]>([]);
  const [events, setEvents] = useState<LeagueEvent[]>([]);
  const [teams, setTeams] = useState<LTeamRef[]>([]);

  const [leagueId, setLeagueId] = useState("");

  // new league form
  const [lName, setLName] = useState("");
  const [lVenue, setLVenue] = useState("");
  const [lDays, setLDays] = useState<string[]>(["fri"]);
  const [lStart, setLStart] = useState("");
  const [lEnd, setLEnd] = useState("");

  // new category form
  const [cCat, setCCat] = useState("3man");
  const [cName, setCName] = useState("");
  const [cRounds, setCRounds] = useState("single");
  const [cPlayoff, setCPlayoff] = useState("double");
  const [cCut, setCCut] = useState("16");
  const [cTie, setCTie] = useState(false);

  const load = useCallback(async () => {
    const [l, e, t] = await Promise.all([
      supabase.from("leagues").select("*").order("created_at", { ascending: false }),
      supabase.from("league_events").select("*").order("created_at"),
      supabase.from("league_teams").select("id, league_event_id"),
    ]);
    setLeagues((l.data ?? []) as League[]);
    setEvents((e.data ?? []) as LeagueEvent[]);
    setTeams((t.data ?? []) as LTeamRef[]);
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
      const fromUrl = new URLSearchParams(window.location.search).get("league");
      if (fromUrl) setLeagueId(fromUrl);
      setReady(true);
    }
    init();
  }, [router, load]);

  const league = leagues.find((x) => x.id === leagueId);
  const lEvents = events.filter((x) => x.league_id === leagueId);

  function toggleDay(d: string) {
    setLDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  }

  async function createLeague(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (!lName.trim()) {
      setMessage("Give the league a name.");
      return;
    }
    const { data, error } = await supabase
      .from("leagues")
      .insert({
        name: lName.trim(),
        venue: lVenue.trim() || null,
        game_days: lDays,
        season_start: lStart || null,
        season_end: lEnd || null,
        status: "open",
      })
      .select()
      .single();
    if (error || !data) {
      setMessage(error?.message ?? "Could not create the league.");
      return;
    }
    setLName("");
    setLVenue("");
    setLStart("");
    setLEnd("");
    await load();
    setLeagueId(data.id);
    setMessage(`League "${data.name}" created. Now add a category below.`);
  }

  async function updateLeague(patch: Partial<League>) {
    if (!league) return;
    await supabase.from("leagues").update(patch).eq("id", league.id);
    load();
  }

  async function deleteLeague() {
    if (!league) return;
    if (!confirm(`Delete "${league.name}" with all its categories, teams and games?`)) return;
    await supabase.from("leagues").delete().eq("id", league.id);
    setLeagueId("");
    load();
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!league) return;
    setMessage("");
    const cat = CATS[cCat];
    const cut = Number(cCut);
    if (!Number.isInteger(cut) || cut < 2) {
      setMessage("The number of teams that qualify must be 2 or more.");
      return;
    }
    const { error } = await supabase.from("league_events").insert({
      league_id: league.id,
      name: cName.trim() || cat.label,
      category: cCat,
      roster_min: cat.min,
      roster_max: cat.max,
      rounds: cRounds,
      playoff_format: cPlayoff,
      cut,
      tiebreak_before_knockout: cTie,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setCName("");
    load();
  }

  async function deleteCategory(ev: LeagueEvent) {
    if (!confirm(`Delete "${ev.name}" with its teams and games?`)) return;
    await supabase.from("league_events").delete().eq("id", ev.id);
    load();
  }

  async function updateCategory(id: string, patch: Partial<LeagueEvent>) {
    await supabase.from("league_events").update(patch).eq("id", id);
    load();
  }

  if (!ready) return <main className="p-6 text-gray-400">Loading...</main>;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage leagues</h1>
          <p className="mt-1 text-sm text-gray-400">
            Create a league and add its categories. Teams, games and standings have their own pages.
          </p>
        </div>
        <Link href="/dashboard" className="btn-ghost">Dashboard</Link>
      </div>

      {message && <p className="text-sm text-yellow-300">{message}</p>}

      {/* Create league */}
      <section className="card flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Create a league</h2>
        <form onSubmit={createLeague} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={label}>
              League name
              <input className="field" placeholder="Inter-office league 2026" value={lName}
                onChange={(e) => setLName(e.target.value)} required />
            </label>
            <label className={label}>
              Venue
              <input className="field" placeholder="Where the games are played" value={lVenue}
                onChange={(e) => setLVenue(e.target.value)} />
            </label>
          </div>
          <div className={label}>
            Game days
            <div className="flex flex-wrap gap-2">
              {DAYS.map(([k, name]) => (
                <button key={k} type="button" onClick={() => toggleDay(k)}
                  className={lDays.includes(k) ? "btn !px-4 !py-1.5 text-sm" : "btn-ghost !px-4 !py-1.5 text-sm"}>
                  {name}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={label}>
              Season starts
              <input className="field" type="date" value={lStart}
                onChange={(e) => setLStart(e.target.value)} />
            </label>
            <label className={label}>
              Planned end (you can move it later)
              <input className="field" type="date" value={lEnd}
                onChange={(e) => setLEnd(e.target.value)} />
            </label>
          </div>
          <div>
            <button className="btn">Create league</button>
          </div>
        </form>
      </section>

      {/* Pick a league */}
      {leagues.length > 0 && (
        <section className="card flex flex-col gap-4">
          <label className={label}>
            Manage a league
            <select className="field" value={leagueId} onChange={(e) => setLeagueId(e.target.value)}>
              <option value="">Select a league</option>
              {leagues.map((x) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
            </select>
          </label>

          {league && (
            <div className="flex flex-col gap-4 border-t border-white/10 pt-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <label className={label}>
                  Status
                  <select className="field" value={league.status}
                    onChange={(e) => updateLeague({ status: e.target.value })}>
                    <option value="draft">Draft</option>
                    <option value="open">Open</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>
                <label className={label}>
                  Season starts
                  <input className="field" type="date" value={league.season_start ?? ""}
                    onChange={(e) => updateLeague({ season_start: e.target.value || null })} />
                </label>
                <label className={label}>
                  Planned end
                  <input className="field" type="date" value={league.season_end ?? ""}
                    onChange={(e) => updateLeague({ season_end: e.target.value || null })} />
                </label>
              </div>
              <p className="text-sm text-gray-400">
                {league.venue ? `${league.venue} · ` : ""}
                Game days: {league.game_days.length > 0
                  ? league.game_days.map((d) => DAYS.find((x) => x[0] === d)?.[1] ?? d).join(", ")
                  : "not set"}
              </p>
              <div>
                <button onClick={deleteLeague}
                  className="rounded-xl px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10">
                  Delete this league
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Categories */}
      {league && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Categories of {league.name}</h2>

          {lEvents.length === 0 && (
            <p className="text-sm text-gray-500">No categories yet. Add one below.</p>
          )}
          <div className="flex flex-col gap-3">
            {lEvents.map((x) => {
              const count = teams.filter((t) => t.league_event_id === x.id).length;
              return (
                <div key={x.id} className="card-sm text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{x.name}</p>
                      <p className="text-gray-400">
                        {CATS[x.category]?.label} · {x.rounds === "double" ? "Double round robin" : "Round robin"} then{" "}
                        {x.playoff_format === "double" ? "double" : "single"} elimination · {count}{" "}
                        {x.category === "singles" ? "players" : "teams"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 text-gray-300">
                        Qualify
                        <input className={small + " w-20"} type="number" min={2} value={x.cut}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isInteger(n) && n >= 2) updateCategory(x.id, { cut: n });
                          }} />
                      </label>
                      <label className="flex items-center gap-2 text-gray-300">
                        <input type="checkbox" checked={x.tiebreak_before_knockout}
                          onChange={(e) => updateCategory(x.id, { tiebreak_before_knockout: e.target.checked })} />
                        Tiebreak
                      </label>
                      <Link href={`/admin/leagues/teams?league=${x.league_id}&event=${x.id}`}
                        className="btn-ghost !px-3 !py-1.5 text-sm">
                        Teams
                      </Link>
                      <button onClick={() => deleteCategory(x)}
                        className="rounded-xl px-3 py-1.5 text-red-400 hover:bg-red-500/10">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <form onSubmit={addCategory} className="card flex flex-col gap-4">
            <h3 className="font-semibold">Add a category</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={label}>
                Type
                <select className="field" value={cCat} onChange={(e) => setCCat(e.target.value)}>
                  <option value="singles">Singles (1 vs 1)</option>
                  <option value="doubles">Doubles (teams of 2)</option>
                  <option value="3man">3-man (teams of 6 to 8 players)</option>
                </select>
              </label>
              <label className={label}>
                Name (optional)
                <input className="field" placeholder={CATS[cCat].label} value={cName}
                  onChange={(e) => setCName(e.target.value)} />
              </label>
              <label className={label}>
                Round robin
                <select className="field" value={cRounds} onChange={(e) => { setCRounds(e.target.value); setCTie(e.target.value === "double"); }}>
                  <option value="single">Round robin (everyone plays everyone once)</option>
                  <option value="double">Double round robin (twice)</option>
                </select>
              </label>
              <label className={label}>
                Then the knockout is
                <select className="field" value={cPlayoff} onChange={(e) => setCPlayoff(e.target.value)}>
                  <option value="double">Double elimination</option>
                  <option value="single">Single elimination</option>
                </select>
              </label>
              <label className={label}>
                Teams that qualify for the main bracket
                <input className="field" type="number" min={2} value={cCut}
                  onChange={(e) => setCCut(e.target.value)} />
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={cTie} onChange={(e) => setCTie(e.target.checked)} />
                Tiebreak game before the knockout
              </label>
            </div>
            <div>
              <button className="btn">Add category</button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
