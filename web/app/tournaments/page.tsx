"use client";

import { useCallback, useEffect, useState } from "react";
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
  team_size: number;
  format: string;
  max_entries: number | null;
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
  payment_status: string;
};

const input = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-black";
const button = "rounded-lg bg-green-600 px-4 py-2 font-semibold text-white";

function howItWorks(ev: EventRow) {
  if (ev.category === "fixed") return "Register your set team together.";
  if (ev.category === "classified")
    return "Register alone. The admin sets your class, then draws your partner.";
  return ev.team_size > 1
    ? "Register alone. The admin randomly draws your partner."
    : "Register alone.";
}

export default function TournamentsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [myName, setMyName] = useState("");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [regs, setRegs] = useState<Reg[]>([]);

  const [openEvent, setOpenEvent] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [partners, setPartners] = useState<string[]>([]);
  const [payMethod, setPayMethod] = useState("onsite");
  const [refNo, setRefNo] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);
    if (user) {
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      setMyName(p?.full_name ?? "");
    }
    const [t, e, tm, r] = await Promise.all([
      supabase.from("tournaments").select("*").order("event_date"),
      supabase.from("events").select("*"),
      supabase.from("teams").select("*"),
      supabase.from("registrations").select("*"),
    ]);
    setTournaments(t.data ?? []);
    setEvents(e.data ?? []);
    setTeams(tm.data ?? []);
    setRegs(r.data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openForm(ev: EventRow) {
    setOpenEvent(ev.id);
    setMessage("");
    setTeamName("");
    setRefNo("");
    setPartners(Array(Math.max(ev.team_size - 1, 0)).fill(""));
  }

  function paymentOk() {
    if (payMethod === "online" && !refNo.trim()) {
      setMessage("Enter your payment reference number.");
      return false;
    }
    return true;
  }

  function finish(error: { message: string } | null) {
    if (error) {
      setMessage(error.message);
      return;
    }
    setOpenEvent(null);
    setMessage("You're registered!");
    load();
  }

  async function joinSolo(ev: EventRow) {
    setMessage("");
    if (!userId || !paymentOk()) return;
    const { error } = await supabase.from("registrations").insert({
      event_id: ev.id,
      player_id: userId,
      display_name: myName,
      payment_method: payMethod,
      payment_status: payMethod === "online" ? "pending" : "unpaid",
      reference_no: payMethod === "online" ? refNo.trim() : null,
    });
    finish(error);
  }

  async function joinFixed(ev: EventRow) {
    setMessage("");
    if (!userId || !paymentOk()) return;
    const names = partners.map((p) => p.trim());
    if (!teamName.trim() || names.some((n) => !n)) {
      setMessage("Enter the team name and every partner's name.");
      return;
    }
    const { error } = await supabase.rpc("register_fixed_team", {
      p_event_id: ev.id,
      p_team_name: teamName.trim(),
      p_partner_names: names,
      p_payment_method: payMethod,
      p_reference_no: payMethod === "online" ? refNo.trim() : null,
    });
    finish(error);
  }

  async function cancel(regId: string) {
    if (!confirm("Cancel your registration?")) return;
    const { error } = await supabase.from("registrations").delete().eq("id", regId);
    if (error) setMessage(error.message);
    load();
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tournaments</h1>
        <Link href={userId ? "/dashboard" : "/login"} className="underline">
          {userId ? "Dashboard" : "Log in"}
        </Link>
      </div>

      {message && <p className="text-sm text-yellow-300">{message}</p>}
      {tournaments.length === 0 && <p className="text-sm text-gray-500">No tournaments yet.</p>}

      {tournaments.map((t) => (
        <section key={t.id} className="rounded-lg border border-gray-600 p-4">
          <p className="text-lg font-semibold">{t.name}</p>
          <p className="text-sm text-gray-400">
            {t.event_date} · {t.venue || "Venue to be announced"} · Fee PHP {t.registration_fee}
          </p>

          <div className="mt-3 flex flex-col gap-3">
            {events
              .filter((ev) => ev.tournament_id === t.id)
              .map((ev) => {
                const mine = regs.find((r) => r.event_id === ev.id && r.player_id === userId);
                const team = teams.find((tm) => tm.id === mine?.team_id);
                const mates = mine?.team_id
                  ? regs.filter((r) => r.team_id === mine.team_id && r.id !== mine.id)
                  : [];
                const isFixed = ev.category === "fixed";
                const count = isFixed
                  ? teams.filter((tm) => tm.event_id === ev.id).length
                  : regs.filter((r) => r.event_id === ev.id).length;
                const full = ev.max_entries !== null && count >= ev.max_entries;

                return (
                  <div key={ev.id} className="rounded-lg border border-gray-700 p-3">
                    <p className="font-medium">{ev.name}</p>
                    <p className="text-sm text-gray-400">
                      {ev.format === "single" ? "Single" : "Double"} elimination · {count}
                      {ev.max_entries ? `/${ev.max_entries}` : ""} {isFixed ? "teams" : "players"}
                    </p>
                    <p className="text-sm text-gray-500">{howItWorks(ev)}</p>

                    {mine ? (
                      <div className="mt-2 text-sm">
                        <p className="text-green-400">
                          You&apos;re registered · Payment: {mine.payment_status}
                          {mine.skill_class ? ` · Class ${mine.skill_class}` : ""}
                        </p>
                        {team && (
                          <p>
                            Team: {team.team_name}
                            {mates.length > 0 && ` · with ${mates.map((m) => m.display_name).join(", ")}`}
                          </p>
                        )}
                        {!mine.team_id && ev.status === "open" && (
                          <button onClick={() => cancel(mine.id)}
                            className="mt-1 text-red-400 underline">
                            Cancel registration
                          </button>
                        )}
                      </div>
                    ) : !userId ? (
                      <Link href="/login" className="mt-2 inline-block text-sm underline">
                        Log in to join
                      </Link>
                    ) : ev.status !== "open" ? (
                      <p className="mt-2 text-sm text-gray-400">Registration is closed.</p>
                    ) : full ? (
                      <p className="mt-2 text-sm text-red-400">This event is full.</p>
                    ) : openEvent === ev.id ? (
                      <div className="mt-3 flex flex-col gap-2">
                        {isFixed && (
                          <>
                            <input className={input} placeholder="Team name" value={teamName}
                              onChange={(e) => setTeamName(e.target.value)} />
                            {partners.map((p, i) => (
                              <input key={i} className={input}
                                placeholder={`Partner ${i + 1} full name`} value={p}
                                onChange={(e) =>
                                  setPartners(partners.map((x, j) => (j === i ? e.target.value : x)))
                                } />
                            ))}
                          </>
                        )}
                        <select className={input} value={payMethod}
                          onChange={(e) => setPayMethod(e.target.value)}>
                          <option value="onsite">Pay at the event</option>
                          <option value="online">Pay online (enter reference no.)</option>
                        </select>
                        {payMethod === "online" && (
                          <input className={input} placeholder="Payment reference number"
                            value={refNo} onChange={(e) => setRefNo(e.target.value)} />
                        )}
                        <button className={button}
                          onClick={() => (isFixed ? joinFixed(ev) : joinSolo(ev))}>
                          {isFixed ? "Register team" : "Join"}
                        </button>
                        <button className="text-sm underline" onClick={() => setOpenEvent(null)}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button className={`${button} mt-2`} onClick={() => openForm(ev)}>
                        {isFixed ? "Register team" : "Join"}
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        </section>
      ))}
    </main>
  );
}