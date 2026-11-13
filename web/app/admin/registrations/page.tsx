"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Tournament = { id: string; name: string };
type EventRow = {
  id: string;
  tournament_id: string;
  name: string;
  category: string;
  team_size: number;
  format: string;
  status: string;
};
type Team = { id: string; event_id: string; team_name: string };
type Reg = {
  id: string;
  event_id: string;
  player_id: string | null;
  display_name: string;
  skill_class: string | null;
  team_id: string | null;
  payment_method: string;
  payment_status: string;
  reference_no: string | null;
};

type Match = { id: string; full_name: string; phone: string | null };

const input = "field";
const button = "btn";
const small = "field !w-auto !px-3 !py-1.5 text-sm";
const label = "flex flex-col gap-1.5 text-sm text-gray-300";

function payPill(status: string) {
  if (status === "paid") return "bg-green-900 text-green-300";
  if (status === "pending") return "bg-amber-900/60 text-amber-300";
  return "bg-gray-700 text-gray-300";
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildTeams(players: Reg[], ev: EventRow): { teams: Reg[][]; leftover: Reg[] } {
  const size = ev.team_size;

  if (ev.category === "open") {
    const pool = shuffle(players);
    const teams: Reg[][] = [];
    while (pool.length >= size) teams.push(pool.splice(0, size));
    return { teams, leftover: pool };
  }

  // Classified: every team has one A and one B
  const pick = (c: string) => shuffle(players.filter((p) => p.skill_class === c));
  const A = pick("A");
  const B = pick("B");

  let n = Math.min(A.length, B.length);
  if (size === 3) n = Math.min(n, Math.floor(players.length / 3));

  const teams: Reg[][] = [];
  for (let i = 0; i < n; i++) teams.push([A[i], B[i]]);

  const used = new Set(teams.flat().map((p) => p.id));
  const rest = players.filter((p) => !used.has(p.id));

  if (size !== 3) return { teams, leftover: shuffle(rest) };

  // 3-man: the third member is a class C player when there is one,
  // otherwise a random leftover player
  const thirds = [
    ...shuffle(rest.filter((p) => p.skill_class === "C")),
    ...shuffle(rest.filter((p) => p.skill_class !== "C")),
  ];
  teams.forEach((t) => {
    const extra = thirds.shift();
    if (extra) t.push(extra);
  });
  return { teams, leftover: thirds };
}

export default function AdminRegistrationsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [regs, setRegs] = useState<Reg[]>([]);

  const [tournamentId, setTournamentId] = useState("");
  const [eventId, setEventId] = useState("");

  const [walkName, setWalkName] = useState("");
  const [walkPaid, setWalkPaid] = useState(false);
  const [walkTeamName, setWalkTeamName] = useState("");
  const [walkMembers, setWalkMembers] = useState<string[]>([]);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [linkQuery, setLinkQuery] = useState("");
  const [linkResults, setLinkResults] = useState<Match[]>([]);
  const [linkAll, setLinkAll] = useState(true);

  const load = useCallback(async () => {
    const [t, e, tm, r] = await Promise.all([
      supabase.from("tournaments").select("id, name").order("event_date", { ascending: false }),
      supabase.from("events").select("*"),
      supabase.from("teams").select("*"),
      supabase.from("registrations").select("*").order("created_at"),
    ]);
    setTournaments(t.data ?? []);
    setEvents(e.data ?? []);
    setTeams(tm.data ?? []);
    setRegs(r.data ?? []);
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
      setReady(true);
    }
    init();
  }, [router, load]);

  const ev = events.find((x) => x.id === eventId);
  const evRegs = regs.filter((r) => r.event_id === eventId);
  const evTeams = teams.filter((t) => t.event_id === eventId);
  const isFixed = ev?.category === "fixed";
  const isClassified = ev?.category === "classified";
  const canScramble = !!ev && !isFixed && ev.team_size > 1;
  const unassigned = evRegs.filter((r) => !r.team_id);
  const paidCount = evRegs.filter((r) => r.payment_status === "paid").length;
  const memberFields = Array.from({ length: ev?.team_size ?? 0 }, (_, i) => walkMembers[i] ?? "");

  async function toggleRegistration() {
    if (!ev) return;
    await supabase
      .from("events")
      .update({ status: ev.status === "open" ? "ongoing" : "open" })
      .eq("id", ev.id);
    load();
  }

  async function setPayment(id: string, status: string) {
    await supabase.from("registrations").update({ payment_status: status }).eq("id", id);
    load();
  }

  async function setClass(id: string, cls: string) {
    await supabase.from("registrations").update({ skill_class: cls || null }).eq("id", id);
    load();
  }

  async function searchAccounts(q: string) {
    setLinkQuery(q);
    const term = q.trim().replace(/[%_,()]/g, "");
    if (term.length < 2) {
      setLinkResults([]);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, phone")
      .or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`)
      .limit(8);
    setLinkResults((data ?? []) as Match[]);
  }

  async function linkAccount(reg: Reg, account: Match) {
    setMessage("");
    const { error } = await supabase
      .from("registrations")
      .update({ player_id: account.id })
      .eq("id", reg.id);
    if (error) {
      setMessage(
        error.code === "23505"
          ? `${account.full_name} is already registered in this event. Remove the walk-in entry instead.`
          : error.message
      );
      return;
    }
    let note = "";
    if (linkAll) {
      const { error: e2 } = await supabase
        .from("registrations")
        .update({ player_id: account.id })
        .is("player_id", null)
        .ilike("display_name", reg.display_name.trim());
      if (e2) note = " Other entries with the same name could not be linked (the account may already be in those events).";
    }
    setMessage(`Linked ${reg.display_name} to the account of ${account.full_name}.${note}`);
    setLinkingId(null);
    setLinkQuery("");
    setLinkResults([]);
    load();
  }

  async function removeReg(id: string) {
    if (!confirm("Remove this player?")) return;
    await supabase.from("registrations").delete().eq("id", id);
    load();
  }

  async function removeTeam(teamId: string) {
    if (!confirm("Remove this whole team?")) return;
    await supabase.from("registrations").delete().eq("team_id", teamId);
    await supabase.from("teams").delete().eq("id", teamId);
    load();
  }

  async function addWalkIn(e: React.FormEvent) {
    e.preventDefault();
    if (!ev) return;
    setMessage("");
    const status = walkPaid ? "paid" : "unpaid";

    if (isFixed) {
      const names = memberFields.map((n) => n.trim());
      if (!walkTeamName.trim() || names.some((n) => !n)) {
        setMessage("Enter the team name and every member name.");
        return;
      }
      const { data: team, error } = await supabase
        .from("teams")
        .insert({ event_id: ev.id, team_name: walkTeamName.trim() })
        .select()
        .single();
      if (error || !team) {
        setMessage(error?.message ?? "Could not create the team.");
        return;
      }
      const { error: e2 } = await supabase.from("registrations").insert(
        names.map((n) => ({
          event_id: ev.id,
          display_name: n,
          team_id: team.id,
          payment_method: "onsite",
          payment_status: status,
        }))
      );
      if (e2) {
        setMessage(e2.message);
        return;
      }
    } else {
      if (!walkName.trim()) {
        setMessage("Enter the player name.");
        return;
      }
      const { error } = await supabase.from("registrations").insert({
        event_id: ev.id,
        display_name: walkName.trim(),
        payment_method: "onsite",
        payment_status: status,
      });
      if (error) {
        setMessage(error.message);
        return;
      }
    }
    setWalkName("");
    setWalkTeamName("");
    setWalkMembers([]);
    setWalkPaid(false);
    load();
  }

  async function scramble() {
    if (!ev) return;
    setMessage("");
    if (isClassified && evRegs.some((r) => !r.skill_class)) {
      if (!confirm("Some players have no class and may be left out. Continue?")) return;
    }
    if (evTeams.length > 0 && !confirm("This replaces the current teams. Continue?")) return;

    const { teams: groups, leftover } = buildTeams(evRegs, ev);
    if (groups.length === 0) {
      setMessage("No teams could be formed. Check the players and their classes.");
      return;
    }

    await supabase.from("teams").delete().eq("event_id", ev.id);
    const rows = groups.map((_, i) => ({ event_id: ev.id, team_name: `Team ${i + 1}` }));
    const { data: created, error } = await supabase.from("teams").insert(rows).select();
    if (error || !created) {
      setMessage(error?.message ?? "Could not create the teams.");
      return;
    }
    for (let i = 0; i < groups.length; i++) {
      const team = created.find((t) => t.team_name === `Team ${i + 1}`);
      if (!team) continue;
      const { error: e2 } = await supabase
        .from("registrations")
        .update({ team_id: team.id })
        .in("id", groups[i].map((p) => p.id));
      if (e2) {
        setMessage(e2.message);
        return;
      }
    }
    setMessage(`Created ${groups.length} teams. ${leftover.length} player(s) left unpaired.`);
    load();
  }

  if (!ready) return <main className="p-6">Loading...</main>;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Registrations and draw</h1>
          <p className="mt-1 text-sm text-gray-400">
            Approve payments, add walk-ins and draw the teams.
          </p>
        </div>
        <Link href="/admin/tournaments" className="btn-ghost">Tournaments</Link>
      </div>

      {message && <p className="text-sm text-yellow-300">{message}</p>}

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
              <option key={x.id} value={x.id}>{x.name}</option>
            ))}
          </select>
        </label>
      </div>

      {ev && (
        <>
          <section className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">
                  {ev.name}{" "}
                  <span className={`ml-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    ev.status === "open"
                      ? "bg-green-900 text-green-300"
                      : "bg-gray-700 text-gray-300"
                  }`}>
                    Registration {ev.status === "open" ? "open" : "closed"}
                  </span>
                </p>
                <p className="text-sm text-gray-400">
                  {ev.format === "single" ? "Single" : "Double"} elimination · {ev.category}
                </p>
              </div>
              <div className="flex gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-green-500">{evRegs.length}</p>
                  <p className="text-xs text-gray-400">Players</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-500">{paidCount}</p>
                  <p className="text-xs text-gray-400">Paid</p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn-ghost" onClick={toggleRegistration}>
                {ev.status === "open" ? "Close registration" : "Reopen registration"}
              </button>
              {canScramble && (
                <button className={button} onClick={scramble}>
                  {evTeams.length > 0 ? "Scramble again" : "Scramble teams"}
                </button>
              )}
            </div>
            {isClassified && (
              <p className="mt-3 text-sm text-gray-400">
                Set each player class (A, B{ev.team_size === 3 ? ", C is optional" : ""}) before
                scrambling.
              </p>
            )}
          </section>

          <section className="card">
            <h2 className="mb-4 text-lg font-semibold">
              {isFixed ? "Add a walk-in team" : "Add a walk-in player"}
            </h2>
            <form onSubmit={addWalkIn} className="flex flex-col gap-4">
              {isFixed ? (
                <>
                  <label className={label}>
                    Team name
                    <input className={input} value={walkTeamName}
                      onChange={(e) => setWalkTeamName(e.target.value)} />
                  </label>
                  {memberFields.map((n, i) => (
                    <label key={i} className={label}>
                      Member {i + 1} full name
                      <input className={input} value={n}
                        onChange={(e) =>
                          setWalkMembers(memberFields.map((x, j) => (j === i ? e.target.value : x)))
                        } />
                    </label>
                  ))}
                </>
              ) : (
                <label className={label}>
                  Player full name
                  <input className={input} value={walkName}
                    onChange={(e) => setWalkName(e.target.value)} />
                </label>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={walkPaid}
                  onChange={(e) => setWalkPaid(e.target.checked)} />
                Paid now
              </label>
              <div>
                <button className={`${button} w-full sm:w-auto`}>Add</button>
              </div>
            </form>
          </section>

          {ev.team_size > 1 && (evTeams.length > 0 || unassigned.length > 0) && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Teams</h2>
              <div className="flex flex-col gap-2">
                {evTeams.map((t) => (
                  <div key={t.id}
                    className="card-sm flex items-start justify-between gap-2 text-sm">
                    <div>
                      <p className="font-semibold">{t.team_name}</p>
                      <p className="text-gray-300">
                        {evRegs
                          .filter((r) => r.team_id === t.id)
                          .map((r) => r.display_name + (r.skill_class ? ` (${r.skill_class})` : ""))
                          .join("  +  ")}
                      </p>
                    </div>
                    {isFixed && (
                      <button onClick={() => removeTeam(t.id)}
                        className="rounded-xl px-3 py-1.5 text-red-400 hover:bg-red-500/10">
                        Remove team
                      </button>
                    )}
                  </div>
                ))}
                {!isFixed && unassigned.length > 0 && (
                  <p className="text-sm text-gray-400">
                    Not in a team yet: {unassigned.map((r) => r.display_name).join(", ")}
                  </p>
                )}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-lg font-semibold">Players</h2>
            {evRegs.length === 0 && <p className="text-sm text-gray-500">No players yet.</p>}
            <div className="flex flex-col gap-2">
              {evRegs.map((r) => (
                <div key={r.id} className="card-sm text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {r.display_name}
                        {!r.player_id && <span className="ml-2 font-normal text-gray-400">(walk-in)</span>}
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${payPill(r.payment_status)}`}>
                          {r.payment_status}
                        </span>
                      </p>
                      <p className="text-gray-400">
                        {r.payment_method === "online" ? "Online" : "At the event"}
                        {r.reference_no ? ` · ref ${r.reference_no}` : ""}
                        {r.team_id
                          ? ` · ${teams.find((t) => t.id === r.team_id)?.team_name ?? ""}`
                          : ""}
                      </p>
                    </div>
                    <button onClick={() => removeReg(r.id)}
                      className="rounded-xl px-3 py-1.5 text-red-400 hover:bg-red-500/10">Remove</button>
                  </div>
                  {linkingId === r.id && (
                    <div className="mt-3 flex flex-col gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
                      <input className="field" autoFocus placeholder="Search the account by name or phone"
                        value={linkQuery} onChange={(e) => searchAccounts(e.target.value)} />
                      {linkQuery.trim().length >= 2 && linkResults.length === 0 && (
                        <p className="text-xs text-gray-400">
                          No account found. Check the spelling, or ask the player to register first.
                        </p>
                      )}
                      {linkResults.map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-2">
                          <span>
                            {m.full_name}
                            {m.phone ? <span className="text-gray-400"> · {m.phone}</span> : null}
                          </span>
                          <button type="button" className="btn-ghost !px-3 !py-1.5 text-sm"
                            onClick={() => linkAccount(r, m)}>
                            Link
                          </button>
                        </div>
                      ))}
                      <label className="flex items-center gap-2 text-xs text-gray-300">
                        <input type="checkbox" className="accent-green-600" checked={linkAll}
                          onChange={(e) => setLinkAll(e.target.checked)} />
                        Also link other walk-in entries named {r.display_name}
                      </label>
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {!r.player_id && (
                      <button type="button" className="btn-ghost !px-3 !py-1.5 text-sm"
                        onClick={() => {
                          setLinkingId(linkingId === r.id ? null : r.id);
                          setLinkQuery("");
                          setLinkResults([]);
                        }}>
                        Link to account
                      </button>
                    )}
                    <select className={small} value={r.payment_status}
                      onChange={(e) => setPayment(r.id, e.target.value)}>
                      <option value="unpaid">Unpaid</option>
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                    </select>
                    {isClassified && (
                      <select className={small} value={r.skill_class ?? ""}
                        onChange={(e) => setClass(r.id, e.target.value)}>
                        <option value="">No class</option>
                        <option value="A">Class A</option>
                        <option value="B">Class B</option>
                        <option value="C">Class C</option>
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
