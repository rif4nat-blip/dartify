"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
};
type Team = { id: string; event_id: string; team_name: string };
type Reg = {
  id: string;
  event_id: string;
  display_name: string;
  skill_class: string | null;
  team_id: string | null;
  payment_status: string;
};
type Sheet = {
  tag: string;
  title: string;
  sub: string;
  columns: string[];
  rows: string[][];
  footer: string;
  note?: string;
};
type Kind = "players" | "pairs" | "payments";

const label = "flex flex-col gap-1.5 text-sm text-gray-300";

const kinds: [Kind, string][] = [
  ["players", "Player list"],
  ["pairs", "Pairing list"],
  ["payments", "Payment checklist"],
];

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function byName(a: Reg, b: Reg) {
  return a.display_name.localeCompare(b.display_name);
}

function playerSheet(t: Tournament, ev: EventRow, regs: Reg[]): Sheet | null {
  const list = regs.filter((r) => r.event_id === ev.id).sort(byName);
  if (list.length === 0) return null;
  return {
    tag: "",
    title: "Player list",
    sub: `${t.name} · ${ev.name} · ${list.length} player${list.length === 1 ? "" : "s"}`,
    columns: ["No.", "Player name"],
    rows: list.map((r, i) => [String(i + 1), r.display_name]),
    footer: `Total: ${list.length} player${list.length === 1 ? "" : "s"}`,
  };
}

function pairSheet(t: Tournament, ev: EventRow, regs: Reg[], teams: Team[]): Sheet | null {
  if (ev.team_size < 2) return null;
  const evTeams = teams
    .filter((x) => x.event_id === ev.id)
    .sort((a, b) => a.team_name.localeCompare(b.team_name, undefined, { numeric: true }));
  const groups = evTeams
    .map((tm) => ({ team: tm, members: regs.filter((r) => r.team_id === tm.id).sort(byName) }))
    .filter((g) => g.members.length > 0);
  if (groups.length === 0) return null;

  const size = Math.max(ev.team_size, ...groups.map((g) => g.members.length));
  let columns: string[];
  let rows: string[][];
  let sub: string;

  if (ev.category === "classified") {
    columns = ["Team", "Class A player", "Class B player"];
    if (size >= 3) columns.push("Class C / third player");
    rows = groups.map((g, i) => {
      const a = g.members.find((m) => m.skill_class === "A");
      const b = g.members.find((m) => m.skill_class === "B");
      const rest = g.members.filter((m) => m !== a && m !== b);
      const cells = [String(i + 1), a?.display_name ?? "–", b?.display_name ?? "–"];
      if (size >= 3) cells.push(rest[0]?.display_name ?? "–");
      return cells;
    });
    sub = `${t.name} · ${ev.name} · one Class A with one Class B`;
  } else if (ev.category === "fixed") {
    columns = ["Team", "Team name"];
    for (let i = 1; i <= size; i++) columns.push(`Player ${i}`);
    rows = groups.map((g, i) => {
      const cells = [String(i + 1), g.team.team_name];
      for (let k = 0; k < size; k++) cells.push(g.members[k]?.display_name ?? "–");
      return cells;
    });
    sub = `${t.name} · ${ev.name} · players registered together`;
  } else {
    columns = ["Team"];
    for (let i = 1; i <= size; i++) columns.push(`Player ${i}`);
    rows = groups.map((g, i) => {
      const cells = [String(i + 1)];
      for (let k = 0; k < size; k++) cells.push(g.members[k]?.display_name ?? "–");
      return cells;
    });
    sub = `${t.name} · ${ev.name} · random draw`;
  }

  return {
    tag: "",
    title: "Pairing list",
    sub,
    columns,
    rows,
    footer: `Total: ${groups.length} team${groups.length === 1 ? "" : "s"}`,
  };
}

function paymentSheet(t: Tournament, evs: EventRow[], regs: Reg[], single: boolean): Sheet | null {
  const evName = new Map(evs.map((e) => [e.id, e.name]));
  const order: Record<string, number> = { unpaid: 0, pending: 1, paid: 2 };
  const list = regs
    .filter((r) => evName.has(r.event_id))
    .sort(
      (a, b) =>
        (order[a.payment_status] ?? 3) - (order[b.payment_status] ?? 3) || byName(a, b)
    );
  if (list.length === 0) return null;
  const open = list.filter((r) => r.payment_status !== "paid").length;
  const nice = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return {
    tag: "Admin only · ",
    title: "Payment checklist",
    sub: `${t.name} · ${single ? evName.get(evs[0].id) : "all events"} · for the registration desk`,
    columns: ["Player", "Event", "Status", "Paid"],
    rows: list.map((r) => [
      r.display_name,
      evName.get(r.event_id) ?? "",
      nice(r.payment_status),
      r.payment_status === "paid" ? "" : "☐",
    ]),
    footer: `${open} unpaid or pending of ${list.length}`,
    note: "Unpaid and pending players are listed first. Not meant to be posted.",
  };
}

function buildHtml(title: string, sheets: Sheet[], date: string) {
  const css = `
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; background: #d9dcdb; }
.sheet { background: #fff; max-width: 760px; margin: 16px auto; padding: 36px 40px; box-shadow: 0 2px 10px rgba(0,0,0,.25); }
.brand { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #16a34a; padding-bottom: 10px; }
.brand b { font-size: 20px; color: #16a34a; }
.brand span { font-size: 11px; color: #555; }
h1 { font-size: 18px; margin: 16px 0 2px; }
.sub { font-size: 12px; color: #555; margin-bottom: 14px; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { background: #f0f4f2; text-align: left; padding: 8px; border: 1px solid #cfd8d3; font-size: 12px; }
td { padding: 9px 8px; border: 1px solid #cfd8d3; }
th:first-child { width: 56px; }
.note { margin-top: 10px; font-size: 11px; color: #666; }
.foot { margin-top: 14px; font-size: 11px; color: #666; }
@media print {
  body { background: #fff; }
  .sheet { max-width: none; margin: 0; padding: 0; box-shadow: none; page-break-after: always; }
  .sheet:last-child { page-break-after: auto; }
}`;
  const body = sheets
    .map((s) => {
      const th = s.columns.map((c) => `<th>${esc(c)}</th>`).join("");
      const tr = s.rows
        .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
        .join("");
      return `<section class="sheet">
<div class="brand"><b>Dartify</b><span>${esc(s.tag)}Printed ${date}</span></div>
<h1>${esc(s.title)}</h1><div class="sub">${esc(s.sub)}</div>
<table border="1" cellspacing="0" cellpadding="6"><tr>${th}</tr>${tr}</table>
${s.note ? `<div class="note">${esc(s.note)}</div>` : ""}
<div class="foot">${esc(s.footer)}</div>
</section>`;
    })
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body>${body}</body></html>`;
}

export default function AdminPrintPage() {
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [regs, setRegs] = useState<Reg[]>([]);
  const [tournamentId, setTournamentId] = useState("");
  const [eventId, setEventId] = useState("all");
  const [kind, setKind] = useState<Kind>("players");
  const [printedOn, setPrintedOn] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (p?.role !== "admin") {
        router.replace("/dashboard");
        return;
      }
      const [t, e, tm, r] = await Promise.all([
        supabase.from("tournaments").select("id, name").order("event_date", { ascending: false }),
        supabase.from("events").select("id, tournament_id, name, category, team_size"),
        supabase.from("teams").select("id, event_id, team_name"),
        supabase
          .from("registrations")
          .select("id, event_id, display_name, skill_class, team_id, payment_status"),
      ]);
      const ts = (t.data ?? []) as Tournament[];
      setTournaments(ts);
      setEvents((e.data ?? []) as EventRow[]);
      setTeams((tm.data ?? []) as Team[]);
      setRegs((r.data ?? []) as Reg[]);
      if (ts.length > 0) setTournamentId(ts[0].id);
      setPrintedOn(
        new Date().toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" })
      );
      setReady(true);
    }
    load();
  }, [router]);

  const tournament = tournaments.find((t) => t.id === tournamentId);
  const tEvents = events.filter((e) => e.tournament_id === tournamentId);
  const picked = eventId === "all" ? tEvents : tEvents.filter((e) => e.id === eventId);

  const sheets: Sheet[] = useMemo(() => {
    if (!tournament) return [];
    if (kind === "payments") {
      const s = paymentSheet(tournament, picked, regs, eventId !== "all");
      return s ? [s] : [];
    }
    const out: Sheet[] = [];
    for (const ev of picked) {
      const s =
        kind === "players"
          ? playerSheet(tournament, ev, regs)
          : pairSheet(tournament, ev, regs, teams);
      if (s) out.push(s);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament, kind, eventId, tournamentId, events, regs, teams]);

  const kindName = kinds.find((k) => k[0] === kind)?.[1] ?? "";
  const html = buildHtml(`Dartify - ${kindName}`, sheets, printedOn);

  function printNow() {
    const w = frame.current?.contentWindow;
    if (!w) return;
    w.focus();
    w.print();
  }

  function downloadWord() {
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dartify-${kind}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function emptyText() {
    if (kind === "pairs") {
      return "No teams to show yet. Run the draw for team events on the Registrations page first (singles events have no pairing list).";
    }
    if (kind === "payments") return "No registrations found for this selection.";
    return "No registered players found for this selection.";
  }

  if (!ready) return <main className="p-6 text-gray-400">Loading...</main>;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Print lists</h1>
          <p className="mt-1 text-sm text-gray-400">
            Pick what to print, check the preview, then print, save as PDF or download for Word.
          </p>
        </div>
        <Link href="/admin/registrations" className="btn-ghost">Registrations</Link>
      </div>

      <div className="card flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>
            Tournament
            <select className="field" value={tournamentId}
              onChange={(e) => { setTournamentId(e.target.value); setEventId("all"); }}>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label className={label}>
            Event
            <select className="field" value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="all">All events</option>
              {tEvents.map((x) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {kinds.map(([k, name]) => (
            <button key={k} type="button" onClick={() => setKind(k)}
              className={k === kind ? "btn" : "btn-ghost"}>
              {name}
            </button>
          ))}
        </div>
        {kind === "payments" && (
          <p className="text-xs text-yellow-300">
            Admin only. This sheet shows payment status, so do not post it for players.
          </p>
        )}
      </div>

      {sheets.length === 0 ? (
        <p className="text-sm text-gray-500">{emptyText()}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn" onClick={printNow}>Print or save as PDF</button>
            <button type="button" className="btn-ghost" onClick={downloadWord}>Download for Word</button>
            <span className="text-sm text-gray-400">
              {sheets.length} page{sheets.length === 1 ? "" : "s"}
            </span>
          </div>
          <iframe ref={frame} title="Print preview" srcDoc={html}
            className="h-[720px] w-full rounded-xl border border-white/10 bg-[#d9dcdb]" />
        </>
      )}
    </main>
  );
}
