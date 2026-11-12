"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Tournament = {
  id: string;
  name: string;
  event_date: string;
  venue: string | null;
  registration_fee: number;
};
type EventRow = {
  id: string;
  tournament_id: string;
  name: string;
  category: string;
  format: string;
};
type Team = { id: string; team_name: string };
type Reg = {
  event_id: string;
  display_name: string;
  skill_class: string | null;
  team_id: string | null;
  payment_method: string;
  payment_status: string;
};
type Row = {
  event: string;
  name: string;
  team: string;
  cls: string;
  payment: string;
  paid: boolean;
};
type Col = { label: string; get: (r: Row, i: number) => string };

const input = "field";
const button = "btn";

function fmt(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function money(n: number) {
  return "PHP " + n.toLocaleString("en-PH");
}

function paymentLabel(r: Reg) {
  if (r.payment_status === "paid") return "Paid";
  if (r.payment_status === "pending") return "Pending (online)";
  return r.payment_method === "online" ? "Unpaid (online)" : "Unpaid (at event)";
}

export default function AdminPrintPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [regs, setRegs] = useState<Reg[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournamentId, setTournamentId] = useState("");
  const [eventId, setEventId] = useState("");

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
      const [t, e, r, tm] = await Promise.all([
        supabase
          .from("tournaments")
          .select("id, name, event_date, venue, registration_fee")
          .order("event_date", { ascending: false }),
        supabase.from("events").select("id, tournament_id, name, category, format"),
        supabase
          .from("registrations")
          .select("event_id, display_name, skill_class, team_id, payment_method, payment_status"),
        supabase.from("teams").select("id, team_name"),
      ]);
      setTournaments((t.data ?? []) as Tournament[]);
      setEvents((e.data ?? []) as EventRow[]);
      setRegs((r.data ?? []) as Reg[]);
      setTeams((tm.data ?? []) as Team[]);
      setReady(true);
    }
    init();
  }, [router]);

  const tournament = tournaments.find((x) => x.id === tournamentId);
  const evList = events.filter((x) => x.tournament_id === tournamentId);
  const isAll = eventId === "all";
  const eventById = new Map(evList.map((x) => [x.id, x]));
  const teamById = new Map(teams.map((x) => [x.id, x.team_name]));

  const rows: Row[] = regs
    .filter((r) => eventById.has(r.event_id) && (isAll || r.event_id === eventId))
    .map((r) => ({
      event: eventById.get(r.event_id)?.name ?? "",
      name: r.display_name,
      team: r.team_id ? teamById.get(r.team_id) ?? "" : "",
      cls: r.skill_class ?? "",
      payment: paymentLabel(r),
      paid: r.payment_status === "paid",
    }))
    .sort(
      (a, b) =>
        a.event.localeCompare(b.event) ||
        a.team.localeCompare(b.team) ||
        a.name.localeCompare(b.name)
    );

  const hasTeam = rows.some((r) => r.team);
  const hasClass = rows.some((r) => r.cls);
  const columns: Col[] = [
    { label: "No.", get: (_r, i) => String(i + 1) },
    { label: "Player", get: (r) => r.name },
    ...(isAll ? [{ label: "Event", get: (r: Row) => r.event }] : []),
    ...(hasTeam ? [{ label: "Team", get: (r: Row) => r.team }] : []),
    ...(hasClass ? [{ label: "Class", get: (r: Row) => r.cls }] : []),
    { label: "Payment", get: (r) => r.payment },
    { label: "Signature", get: () => "" },
  ];

  const fee = tournament?.registration_fee ?? 0;
  const paid = rows.filter((r) => r.paid).length;
  const eventName = isAll ? "All events" : eventById.get(eventId)?.name ?? "";
  const summary = `${rows.length} player(s) · ${paid} paid · ${rows.length - paid} not paid yet`;
  const feeLine =
    fee > 0
      ? `Fee per player: ${money(fee)} · Expected: ${money(rows.length * fee)} · Collected: ${money(
          paid * fee
        )} · To collect: ${money((rows.length - paid) * fee)}`
      : "";

  async function downloadWord() {
    if (!tournament) return;
    const {
      Document,
      Packer,
      Paragraph,
      Table,
      TableRow,
      TableCell,
      TextRun,
      WidthType,
      HeadingLevel,
    } = await import("docx");

    const cell = (text: string, bold = false) =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
      });

    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: columns.map((c) => cell(c.label, true)),
        }),
        ...rows.map(
          (r, i) => new TableRow({ children: columns.map((c) => cell(c.get(r, i))) })
        ),
      ],
    });

    const lines = [
      `${fmt(tournament.event_date)} · ${tournament.venue || "Venue to be announced"}`,
      `Event: ${eventName}`,
      summary,
      ...(feeLine ? [feeLine] : []),
    ];

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ text: tournament.name, heading: HeadingLevel.HEADING_1 }),
            ...lines.map((text) => new Paragraph({ text })),
            new Paragraph({ text: "" }),
            table,
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${tournament.name}-${eventName}-players`
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .toLowerCase() + ".docx";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!ready) return <main className="p-6">Loading...</main>;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6 print:max-w-none print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-3xl font-bold tracking-tight">Printable player list</h1>
      </div>

      <div className="flex flex-col gap-3 print:hidden">
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
          <option value="all">All events of this tournament</option>
          {evList.map((x) => (
            <option key={x.id} value={x.id}>{x.name}</option>
          ))}
        </select>
        {tournament && eventId && rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <button className={button} onClick={() => window.print()}>
              Print or save as PDF
            </button>
            <button className={button} onClick={downloadWord}>
              Download Word file
            </button>
          </div>
        )}
        <p className="text-sm text-gray-400">
          This list shows payment status, so keep printed copies with the organizers.
        </p>
      </div>

      {tournament && eventId && rows.length === 0 && (
        <p className="text-sm text-gray-400 print:hidden">No players are registered yet.</p>
      )}

      {tournament && eventId && rows.length > 0 && (
        <section className="rounded-lg bg-white p-6 text-black print:rounded-none print:p-0">
          <h2 className="text-xl font-bold">{tournament.name}</h2>
          <p>{fmt(tournament.event_date)} · {tournament.venue || "Venue to be announced"}</p>
          <p className="font-semibold">Event: {eventName}</p>
          <p className="text-sm">{summary}</p>
          {feeLine && <p className="text-sm">{feeLine}</p>}
          <table className="mt-4 w-full border-collapse text-sm">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.label} className="border border-gray-500 px-2 py-1 text-left">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="h-9">
                  {columns.map((c) => (
                    <td key={c.label} className="border border-gray-500 px-2 py-1">
                      {c.get(r, i)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}