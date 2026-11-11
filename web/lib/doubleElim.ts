// Double elimination helpers: layout, links between matches, byes, results.

export type EMatch = {
  id: string;
  bracket: string; // "winners" | "losers" | "grand"
  round: number;
  match_no: number;
  entry1_id: string | null;
  entry2_id: string | null;
  winner_id: string | null;
  status: string;
  next_match_id: string | null;
  loser_next_match_id: string | null;
};

export type Slot = { bracket: string; round: number; match_no: number };

// Every match slot of a double elimination bracket for `size` (a power of 2, >= 4)
export function layout(size: number): Slot[] {
  const k = Math.log2(size);
  const out: Slot[] = [];
  for (let r = 1; r <= k; r++) {
    for (let m = 1; m <= size / 2 ** r; m++) out.push({ bracket: "winners", round: r, match_no: m });
  }
  for (let j = 1; j <= k - 1; j++) {
    const count = size / 2 ** (j + 1);
    for (const round of [2 * j - 1, 2 * j]) {
      for (let m = 1; m <= count; m++) out.push({ bracket: "losers", round, match_no: m });
    }
  }
  out.push({ bracket: "grand", round: 1, match_no: 1 });
  out.push({ bracket: "grand", round: 2, match_no: 1 }); // reset, only played if needed
  return out;
}

// Fill next_match_id (winner goes) and loser_next_match_id (loser goes)
export function link<T extends EMatch>(ms: T[], size: number) {
  const k = Math.log2(size);
  const lastLb = 2 * (k - 1);
  const find = (b: string, r: number, m: number) =>
    ms.find((x) => x.bracket === b && x.round === r && x.match_no === m);
  const gf = find("grand", 1, 1);
  for (const x of ms) {
    x.next_match_id = null;
    x.loser_next_match_id = null;
    if (x.bracket === "winners") {
      const nx = x.round < k ? find("winners", x.round + 1, Math.ceil(x.match_no / 2)) : gf;
      const lo =
        x.round === 1
          ? find("losers", 1, Math.ceil(x.match_no / 2))
          : find("losers", 2 * (x.round - 1), x.match_no);
      x.next_match_id = nx?.id ?? null;
      x.loser_next_match_id = lo?.id ?? null;
    } else if (x.bracket === "losers") {
      let nx: T | undefined;
      if (x.round % 2 === 1) nx = find("losers", x.round + 1, x.match_no);
      else nx = x.round < lastLb ? find("losers", x.round + 1, Math.ceil(x.match_no / 2)) : gf;
      x.next_match_id = nx?.id ?? null;
    }
  }
}

// Which side (1 or 2) of the target match a result from `src` goes into
function slotOf(src: EMatch, tgt: EMatch): 1 | 2 {
  if (tgt.bracket === "grand") return src.bracket === "winners" ? 1 : 2;
  if (tgt.bracket === "losers") {
    if (src.bracket === "winners") {
      return src.round === 1 ? (src.match_no % 2 === 1 ? 1 : 2) : 2;
    }
    return tgt.round % 2 === 0 ? 1 : src.match_no % 2 === 1 ? 1 : 2;
  }
  return src.match_no % 2 === 1 ? 1 : 2;
}

function place(ms: EMatch[], src: EMatch, targetId: string, entryId: string) {
  const t = ms.find((x) => x.id === targetId);
  if (!t) return;
  if (slotOf(src, t) === 1) t.entry1_id = entryId;
  else t.entry2_id = entryId;
}

// Auto-complete matches that can never get a second entry (byes). Changes `ms` in place.
export function settle(ms: EMatch[]) {
  let progress = true;
  while (progress) {
    progress = false;
    for (const x of ms) {
      if (x.status === "completed" || x.bracket === "grand") continue;
      const sources = ms.filter((s) => s.next_match_id === x.id || s.loser_next_match_id === x.id);
      if (!sources.every((s) => s.status === "completed")) continue;
      const count = (x.entry1_id ? 1 : 0) + (x.entry2_id ? 1 : 0);
      if (count >= 2) continue;
      x.status = "completed";
      x.winner_id = x.entry1_id ?? x.entry2_id;
      if (x.winner_id && x.next_match_id) place(ms, x, x.next_match_id, x.winner_id);
      progress = true;
    }
  }
}

// Call after the played match was set to completed with its winner. Moves winner and loser on.
export function applyResult(ms: EMatch[], matchId: string, winnerId: string, loserId: string | null) {
  const m = ms.find((x) => x.id === matchId);
  if (!m) return;
  if (m.bracket === "grand") {
    if (m.round === 1) {
      const reset = ms.find((x) => x.bracket === "grand" && x.round === 2);
      if (reset) {
        if (winnerId === m.entry2_id) {
          // the losers-bracket team won, so the final is played again
          reset.entry1_id = m.entry1_id;
          reset.entry2_id = m.entry2_id;
        } else {
          reset.entry1_id = null;
          reset.entry2_id = null;
        }
      }
    }
    return;
  }
  if (m.next_match_id) place(ms, m, m.next_match_id, winnerId);
  if (m.loser_next_match_id && loserId) place(ms, m, m.loser_next_match_id, loserId);
  settle(ms);
}

export function championOf(ms: EMatch[]): string | null {
  const gf = ms.find((x) => x.bracket === "grand" && x.round === 1);
  const reset = ms.find((x) => x.bracket === "grand" && x.round === 2);
  if (reset && reset.status === "completed" && reset.entry1_id && reset.entry2_id) return reset.winner_id;
  if (gf && gf.status === "completed" && gf.winner_id && gf.winner_id === gf.entry1_id) return gf.winner_id;
  return null;
}

export type Placement = { entryId: string; placement: number; label: string };

// Final standings of a finished double elimination event (null until a champion is decided)
export function doublePlacements(ms: EMatch[]): Placement[] | null {
  const gf = ms.find((x) => x.bracket === "grand" && x.round === 1);
  const reset = ms.find((x) => x.bracket === "grand" && x.round === 2);
  let final: EMatch | undefined;
  if (reset && reset.status === "completed" && reset.entry1_id && reset.entry2_id) final = reset;
  else if (gf && gf.status === "completed" && gf.winner_id && gf.winner_id === gf.entry1_id) final = gf;
  if (!final || !final.winner_id || !final.entry1_id || !final.entry2_id) return null;

  const loserOf = (m: EMatch) => (m.winner_id === m.entry1_id ? m.entry2_id : m.entry1_id);
  const rows: Placement[] = [
    { entryId: final.winner_id, placement: 1, label: "Champion" },
    { entryId: loserOf(final) as string, placement: 2, label: "Runner-up" },
  ];

  // losers bracket: whoever loses in the latest round finishes highest
  const played = ms.filter(
    (x) => x.bracket === "losers" && x.status === "completed" && x.entry1_id && x.entry2_id && x.winner_id
  );
  const roundsDesc = Array.from(new Set(played.map((x) => x.round))).sort((a, b) => b - a);
  let place = 3;
  for (const r of roundsDesc) {
    const losers = played.filter((x) => x.round === r).map(loserOf).filter((x): x is string => !!x);
    for (const l of losers) {
      const label =
        place === 3 ? "Third place (top 4)" : place === 4 ? "Fourth place (top 4)" : place <= 8 ? "Top 8" : "Eliminated earlier";
      rows.push({ entryId: l, placement: place, label });
    }
    place += losers.length;
  }
  return rows;
}
