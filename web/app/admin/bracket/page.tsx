"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { applyResult, championOf, layout, link, settle } from "@/lib/doubleElim";

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
  display_name: string;
  team_id: string | null;
  payment_status: string;
};
type Entry = { id: string; event_id: string; name: string; seed: number | null };
type Match = {
  id: string;
  event_id: string;
  bracket: string;
  round: number;
  match_no: number;
  entry1_id: string | null;
  entry2_id: string | null;
  game_type: number;
  legs_to_win: number;
  score1: number;
  score2: number;
  winner_id: string | null;
  status: string;
  next_match_id: string | null;
  loser_next_match_id: string | null;
};
type NewMatch = {
  event_id: string;
  bracket: string;
  round: number;
  match_no: number;
  entry1_id: string | null;
  entry2_id: string | null;
  game_type: number;
  legs_to_win: number;
  status: string;
};
type Item = { name: string; team_id: string | null; registration_id: string | null };

const input = "field";
const small = "field !px-3 !py-1.5 text-sm";
const button = "btn";

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Standard bracket order, e.g. 4 -> [1,4,2,3], 8 -> [1,8,4,5,2,7,3,6]
function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const total = order.length * 2;
    order = order.flatMap((s) => [s, total + 1 - s]);
  }
  return order;
}

function roundName(round: number, rounds: number) {
  const fromEnd = rounds - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinals";
  if (fromEnd === 2) return "Quarterfinals";
  return `Round ${round}`;
}

export default function AdminBracketPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [regs, setRegs] = useState<Reg[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);

  const [tournamentId, setTournamentId] = useState("");
  const [eventId, setEventId] = useState("");
  const [gameType, setGameType] = useState("501");
  const [legs, setLegs] = useState("3");
  const [finalLegs, setFinalLegs] = useState("3");
  const [scores, setScores] = useState<Record<string, { a: string; b: string }>>({});

  const load = useCallback(async () => {
    const [t, e, tm, r, en, m] = await Promise.all([
      supabase.from("tournaments").select("id, name").order("event_date", { ascending: false }),
      supabase.from("events").select("*"),
      supabase.from("teams").select("*"),
      supabase.from("registrations").select("*"),
      supabase.from("entries").select("*"),
      supabase.from("matches").select("*"),
    ]);
    setTournaments(t.data ?? []);
    setEvents(e.data ?? []);
    setTeams(tm.data ?? []);
    setRegs(r.data ?? []);
    setEntries(en.data ?? []);
    setMatches(m.data ?? []);
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
  const isDouble = ev?.format === "double";
  const evMatches = matches
    .filter((m) => m.event_id === eventId)
    .sort((a, b) => a.round - b.round || a.match_no - b.match_no);
  const winnersMatches = evMatches.filter((m) => (m.bracket ?? "winners") === "winners");
  const rounds = winnersMatches.reduce((mx, m) => Math.max(mx, m.round), 0);
  const hasBracket = evMatches.length > 0;

  let champion: string | null | undefined = null;
  if (isDouble) {
    const id = championOf(evMatches);
    champion = id ? entries.find((x) => x.id === id)?.name : null;
  } else {
    const finalMatch = winnersMatches.find((m) => m.round === rounds);
    champion =
      finalMatch?.status === "completed"
        ? entries.find((x) => x.id === finalMatch.winner_id)?.name
        : null;
  }

  // matches that were skipped because nobody can ever play them are hidden
  const visible = evMatches.filter(
    (m) => !(m.status === "completed" && !m.entry1_id && !m.entry2_id)
  );
  const sections: { key: string; title: string; list: Match[] }[] = [];
  for (let r = 1; r <= rounds; r++) {
    const list = visible.filter((m) => (m.bracket ?? "winners") === "winners" && m.round === r);
    if (list.length) {
      sections.push({
        key: `w${r}`,
        title: (isDouble ? "Winners bracket: " : "") + roundName(r, rounds),
        list,
      });
    }
  }
  const lbRounds = Array.from(
    new Set(visible.filter((m) => m.bracket === "losers").map((m) => m.round))
  ).sort((a, b) => a - b);
  lbRounds.forEach((r, i) => {
    sections.push({
      key: `l${r}`,
      title: `Losers bracket: Round ${i + 1}`,
      list: visible.filter((m) => m.bracket === "losers" && m.round === r),
    });
  });
  const gf = visible.find((m) => m.bracket === "grand" && m.round === 1);
  if (gf) sections.push({ key: "g1", title: "Grand final", list: [gf] });
  const reset = visible.find(
    (m) => m.bracket === "grand" && m.round === 2 && m.entry1_id && m.entry2_id
  );
  if (reset) sections.push({ key: "g2", title: "Grand final reset", list: [reset] });

  function label(id: string | null, m: Match) {
    if (id) return entries.find((x) => x.id === id)?.name ?? "?";
    return m.status === "completed" ? "BYE" : "To be decided";
  }

  function current(m: Match) {
    return (
      scores[m.id] ?? {
        a: m.status === "completed" ? String(m.score1) : "",
        b: m.status === "completed" ? String(m.score2) : "",
      }
    );
  }

  function setScore(m: Match, field: "a" | "b", value: string) {
    setScores({ ...scores, [m.id]: { ...current(m), [field]: value } });
  }

  async function startBracket() {
    if (!ev) return;
    setMessage("");
    const evRegs = regs.filter((r) => r.event_id === ev.id);
    let list: Item[];

    if (ev.team_size > 1) {
      const loose = evRegs.filter((r) => !r.team_id).length;
      if (loose > 0 && !confirm(`${loose} player(s) are not in a team and will be left out. Continue?`)) return;
      list = teams
        .filter((t) => t.event_id === ev.id && evRegs.some((r) => r.team_id === t.id))
        .map((t) => {
          const members = evRegs.filter((r) => r.team_id === t.id).map((r) => r.display_name);
          const name =
            ev.category === "fixed"
              ? `${t.team_name}: ${members.join(" / ")}`
              : members.join(" / ");
          return { name, team_id: t.id, registration_id: null };
        });
    } else {
      list = evRegs.map((r) => ({ name: r.display_name, team_id: null, registration_id: r.id }));
    }

    if (list.length < 2) {
      setMessage("You need at least 2 teams or players.");
      return;
    }
    if (isDouble && list.length < 3) {
      setMessage("Double elimination needs at least 3 teams or players.");
      return;
    }
    if (hasBracket && !confirm("This deletes the current bracket and all scores. Continue?")) return;
    const unpaid = evRegs.filter((r) => r.payment_status !== "paid").length;
    if (unpaid > 0 && !confirm(`${unpaid} player(s) are not marked as paid. Continue anyway?`)) return;

    await supabase.from("matches").delete().eq("event_id", ev.id);
    await supabase.from("entries").delete().eq("event_id", ev.id);

    const drawn = shuffle(list);
    const { data: created, error: e1 } = await supabase
      .from("entries")
      .insert(
        drawn.map((x, i) => ({
          event_id: ev.id,
          name: x.name,
          team_id: x.team_id,
          registration_id: x.registration_id,
          seed: i + 1,
        }))
      )
      .select();
    if (e1 || !created) {
      setMessage(e1?.message ?? "Could not create the entries.");
      return;
    }
    const bySeed: Record<number, string> = {};
    created.forEach((c: { id: string; seed: number }) => {
      bySeed[c.seed] = c.id;
    });

    const n = drawn.length;
    let size = 2;
    while (size < n) size *= 2;
    const total = Math.log2(size);
    const positions = seedOrder(size);
    const legsN = Math.max(1, Number(legs) || 3);
    const finalN = Math.max(1, Number(finalLegs) || 3);

    const rows: NewMatch[] = [];
    if (isDouble) {
      for (const s of layout(size)) {
        let e1: string | null = null;
        let e2: string | null = null;
        if (s.bracket === "winners" && s.round === 1) {
          const s1 = positions[(s.match_no - 1) * 2];
          const s2 = positions[(s.match_no - 1) * 2 + 1];
          e1 = s1 <= n ? bySeed[s1] : null;
          e2 = s2 <= n ? bySeed[s2] : null;
        }
        rows.push({
          event_id: ev.id,
          bracket: s.bracket,
          round: s.round,
          match_no: s.match_no,
          entry1_id: e1,
          entry2_id: e2,
          game_type: s.bracket === "losers" ? 701 : Number(gameType),
          legs_to_win: s.bracket === "grand" ? finalN : s.bracket === "losers" ? 1 : legsN,
          status: "scheduled",
        });
      }
    } else {
      for (let r = 1; r <= total; r++) {
        const count = size / 2 ** r;
        for (let m = 1; m <= count; m++) {
          let e1: string | null = null;
          let e2: string | null = null;
          if (r === 1) {
            const s1 = positions[(m - 1) * 2];
            const s2 = positions[(m - 1) * 2 + 1];
            e1 = s1 <= n ? bySeed[s1] : null;
            e2 = s2 <= n ? bySeed[s2] : null;
          }
          rows.push({
            event_id: ev.id,
            bracket: "winners",
            round: r,
            match_no: m,
            entry1_id: e1,
            entry2_id: e2,
            game_type: Number(gameType),
            legs_to_win: r === total ? finalN : legsN,
            status: "scheduled",
          });
        }
      }
    }

    const { data: inserted, error: e2 } = await supabase.from("matches").insert(rows).select();
    if (e2 || !inserted) {
      setMessage(e2?.message ?? "Could not create the matches.");
      return;
    }
    const made = inserted as Match[];

    if (isDouble) {
      // link the matches, then let byes move forward automatically
      link(made, size);
      settle(made);
      const results = await Promise.all(
        made.map((mt) =>
          supabase
            .from("matches")
            .update({
              next_match_id: mt.next_match_id,
              loser_next_match_id: mt.loser_next_match_id,
              entry1_id: mt.entry1_id,
              entry2_id: mt.entry2_id,
              status: mt.status,
              winner_id: mt.winner_id,
            })
            .eq("id", mt.id)
        )
      );
      const failed = results.find((x) => x.error);
      if (failed?.error) {
        setMessage(failed.error.message);
        return;
      }
    } else {
      const find = (r: number, m: number) => made.find((x) => x.round === r && x.match_no === m);

      for (const mt of made) {
        if (mt.round < total) {
          const next = find(mt.round + 1, Math.ceil(mt.match_no / 2));
          if (next) {
            await supabase.from("matches").update({ next_match_id: next.id }).eq("id", mt.id);
          }
        }
      }

      // Byes: the only entry moves straight to round 2
      for (const mt of made) {
        if (mt.round !== 1) continue;
        const only =
          mt.entry1_id && !mt.entry2_id ? mt.entry1_id : !mt.entry1_id && mt.entry2_id ? mt.entry2_id : null;
        if (!only) continue;
        await supabase.from("matches").update({ status: "completed", winner_id: only }).eq("id", mt.id);
        const next = find(2, Math.ceil(mt.match_no / 2));
        if (next) {
          await supabase
            .from("matches")
            .update(mt.match_no % 2 === 1 ? { entry1_id: only } : { entry2_id: only })
            .eq("id", next.id);
        }
      }
    }

    await supabase.from("events").update({ status: "ongoing" }).eq("id", ev.id);
    setScores({});
    setMessage(`Bracket created with ${n} entries.`);
    load();
  }

  async function saveScore(m: Match) {
    setMessage("");
    const s = current(m);
    const a = Number(s.a);
    const b = Number(s.b);
    if (s.a === "" || s.b === "" || Number.isNaN(a) || Number.isNaN(b)) {
      setMessage("Enter both scores.");
      return;
    }
    const need = m.legs_to_win;
    const valid = (a === need && b >= 0 && b < need) || (b === need && a >= 0 && a < need);
    if (!valid) {
      setMessage(`The winner must reach exactly ${need} legs and the other side fewer.`);
      return;
    }
    if (!m.entry1_id || !m.entry2_id) return;
    const winner = a > b ? m.entry1_id : m.entry2_id;
    const loser = a > b ? m.entry2_id : m.entry1_id;

    const evAll = matches.filter((x) => x.event_id === m.event_id);
    const winnerChanged = m.status === "completed" && m.winner_id !== winner;
    if (winnerChanged) {
      const blocked = evAll.some(
        (x) =>
          x.status === "completed" &&
          (x.id === m.next_match_id ||
            x.id === m.loser_next_match_id ||
            (m.bracket === "grand" && m.round === 1 && x.bracket === "grand" && x.round === 2))
      );
      if (blocked) {
        setMessage("The next match was already played, so the winner of this match can't be changed.");
        return;
      }
    }

    // work out every change in memory first, then save only what changed
    const ms = evAll.map((x) => ({ ...x }));
    const cm = ms.find((x) => x.id === m.id);
    if (!cm) return;
    cm.score1 = a;
    cm.score2 = b;
    cm.winner_id = winner;
    cm.status = "completed";
    applyResult(ms, m.id, winner, loser);

    const updates = ms
      .map((x) => {
        const old = evAll.find((o) => o.id === x.id);
        if (!old) return null;
        const changed =
          old.entry1_id !== x.entry1_id ||
          old.entry2_id !== x.entry2_id ||
          old.status !== x.status ||
          old.winner_id !== x.winner_id ||
          old.score1 !== x.score1 ||
          old.score2 !== x.score2;
        return changed ? x : null;
      })
      .filter((x): x is Match => x !== null);

    const results = await Promise.all(
      updates.map((x) =>
        supabase
          .from("matches")
          .update({
            entry1_id: x.entry1_id,
            entry2_id: x.entry2_id,
            status: x.status,
            winner_id: x.winner_id,
            score1: x.score1,
            score2: x.score2,
          })
          .eq("id", x.id)
      )
    );
    const failed = results.find((x) => x.error);
    if (failed?.error) {
      setMessage(failed.error.message);
      return;
    }

    if (m.status === "completed") {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("score_edits").insert({
        match_id: m.id,
        edited_by: user?.id,
        old_score1: m.score1,
        old_score2: m.score2,
        new_score1: a,
        new_score2: b,
      });
    }
    load();
  }

  if (!ready) return <main className="p-6">Loading...</main>;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Bracket and scores</h1>
        <Link href="/admin/registrations" className="btn-ghost">Registrations</Link>
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

      {ev && (
        <>
          <section className="card">
            <p className="font-semibold">{ev.name}</p>
            <p className="text-sm text-gray-400">
              {isDouble ? "Double" : "Single"} elimination ·{" "}
              {hasBracket ? `${evMatches.length} matches` : "bracket not started"}
            </p>
            <div className="mt-3 flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <label className="flex flex-col gap-1">
                  Game
                  <select className={small} value={gameType}
                    onChange={(e) => setGameType(e.target.value)}>
                    <option value="501">501</option>
                    <option value="301">301</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  Legs to win
                  <input className={small} type="number" min="1" value={legs}
                    onChange={(e) => setLegs(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  {isDouble ? "Grand final legs" : "Final legs"}
                  <input className={small} type="number" min="1" value={finalLegs}
                    onChange={(e) => setFinalLegs(e.target.value)} />
                </label>
              </div>
              <button className={button} onClick={startBracket}>
                {hasBracket ? "Reset and rebuild bracket" : "Start tournament"}
              </button>
            </div>
            {champion && (
              <p className="mt-3 font-semibold text-green-400">Champion: {champion}</p>
            )}
          </section>

          {sections.map((sec) => (
            <section key={sec.key}>
              <h2 className="mb-3 text-lg font-semibold">{sec.title}</h2>
              <div className="flex flex-col gap-3">
                {sec.list.map((m) => {
                  const played = m.status === "completed" && !!m.entry1_id && !!m.entry2_id;
                  const cur = current(m);
                  return (
                    <div key={m.id} className="card-sm text-sm">
                      <p className="text-gray-400">
                        Match {m.match_no} · {m.game_type} · first to {m.legs_to_win}
                      </p>
                      <p className={m.winner_id && m.winner_id === m.entry1_id ? "font-semibold text-green-400" : ""}>
                        {label(m.entry1_id, m)}{played ? ` (${m.score1})` : ""}
                      </p>
                      <p className={m.winner_id && m.winner_id === m.entry2_id ? "font-semibold text-green-400" : ""}>
                        {label(m.entry2_id, m)}{played ? ` (${m.score2})` : ""}
                      </p>
                      {m.entry1_id && m.entry2_id && (
                        <div className="mt-2 flex items-center gap-2">
                          <input type="number" min="0" className={`${small} w-16`} value={cur.a}
                            onChange={(e) => setScore(m, "a", e.target.value)} />
                          <span>-</span>
                          <input type="number" min="0" className={`${small} w-16`} value={cur.b}
                            onChange={(e) => setScore(m, "b", e.target.value)} />
                          <button onClick={() => saveScore(m)}
                            className="btn !px-3 !py-1 text-sm">
                            {m.status === "completed" ? "Update score" : "Save score"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}
    </main>
  );
}

