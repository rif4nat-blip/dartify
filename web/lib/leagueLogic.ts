export type LTeamLite = { id: string; name: string };
export type LGame = {
  team1_id: string;
  team2_id: string;
  winner_id: string | null;
  status: string;
  kind: string;
  team1_score: number | null;
  team2_score: number | null;
};
export type Row = {
  id: string;
  name: string;
  played: number;
  wins: number;
  losses: number;
  pf: number;
  pa: number;
  diff: number;
  rank: number;
  tied: boolean;
};

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function winnerFromScores(t1: string, t2: string, a: number, b: number): string | null {
  if (a === b) return null;
  return a > b ? t1 : t2;
}

// Ranked by wins, then fewer losses. Teams with the same record are "tied".
// A tie is settled when tiebreak games give every tied team a different number of wins.
// Inside a tie the order is: tiebreak wins, then score difference, then name.
export function standings(teams: LTeamLite[], games: LGame[]): Row[] {
  const reg = games.filter((g) => g.status === "played" && g.kind === "regular" && g.winner_id);
  const tb = games.filter((g) => g.status === "played" && g.kind === "tiebreak" && g.winner_id);

  const base = teams.map((t) => {
    const mine = reg.filter((g) => g.team1_id === t.id || g.team2_id === t.id);
    const wins = mine.filter((g) => g.winner_id === t.id).length;
    let pf = 0;
    let pa = 0;
    for (const g of mine) {
      if (g.team1_score == null || g.team2_score == null) continue;
      if (g.team1_id === t.id) {
        pf += g.team1_score;
        pa += g.team2_score;
      } else {
        pf += g.team2_score;
        pa += g.team1_score;
      }
    }
    return { id: t.id, name: t.name, played: mine.length, wins, losses: mine.length - wins, pf, pa, diff: pf - pa };
  });

  const sorted = [...base].sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name));
  const out: Row[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length && sorted[j].wins === sorted[i].wins && sorted[j].losses === sorted[i].losses) j++;
    const group = sorted.slice(i, j);
    const ids = new Set(group.map((x) => x.id));
    const withTb = group.map((x) => ({
      x,
      tbw: tb.filter((g) => g.winner_id === x.id && ids.has(g.team1_id) && ids.has(g.team2_id)).length,
    }));
    withTb.sort((a, b) => b.tbw - a.tbw || b.x.diff - a.x.diff || a.x.name.localeCompare(b.x.name));
    const resolved = group.length > 1 && new Set(withTb.map((w) => w.tbw)).size === group.length;
    withTb.forEach((w, k) => {
      out.push({
        id: w.x.id, name: w.x.name, played: w.x.played, wins: w.x.wins, losses: w.x.losses,
        pf: w.x.pf, pa: w.x.pa, diff: w.x.diff,
        rank: resolved ? i + k + 1 : i + 1,
        tied: group.length > 1 && !resolved,
      });
    });
    i = j;
  }
  return out;
}

// Ties that matter: the tied group sits on the qualify line (for example 16th and 17th).
export function tiebreakNeeded(rows: Row[], cut: number): Row[][] {
  const groups = new Map<number, Row[]>();
  for (const r of rows) {
    if (r.tied) groups.set(r.rank, [...(groups.get(r.rank) ?? []), r]);
  }
  const out: Row[][] = [];
  for (const [rank, g] of groups) {
    if (rank <= cut && rank + g.length - 1 > cut) out.push(g);
  }
  return out;
}

export function pairs<T>(list: T[]): [T, T][] {
  const out: [T, T][] = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) out.push([list[i], list[j]]);
  return out;
}

// Circle method. Every team plays once per round. Odd team counts get a bye.
export function roundRobin(ids: string[], double: boolean): [string, string][][] {
  const list: (string | null)[] = [...ids];
  if (list.length % 2 === 1) list.push(null);
  const n = list.length;
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const round: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (a && b) round.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(round);
    list.splice(1, 0, list.pop() as string | null);
  }
  if (!double) return rounds;
  return [...rounds, ...rounds.map((rd) => rd.map(([a, b]) => [b, a] as [string, string]))];
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function roundDates(seasonStart: string | null, gameDays: string[], count: number): (string | null)[] {
  const out: (string | null)[] = [];
  if (seasonStart && gameDays.length > 0) {
    const [y, m, d] = seasonStart.split("-").map(Number);
    const cur = new Date(y, m - 1, d);
    let guard = 0;
    while (out.length < count && guard < 3000) {
      if (gameDays.includes(DAY_KEYS[cur.getDay()])) {
        out.push(`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`);
      }
      cur.setDate(cur.getDate() + 1);
      guard++;
    }
  }
  while (out.length < count) out.push(null);
  return out;
}

// The round robin is finished when every regular game is played (or cancelled).
export function roundRobinComplete(games: LGame[]): boolean {
  const reg = games.filter((g) => g.kind === "regular");
  return reg.length > 0 && reg.every((g) => g.status === "played" || g.status === "cancelled");
}

// Picks the next matchups for one game night.
// meetings = how many times each pair plays in total (1 = round robin, 2 = double).
// Teams in `busy` already play that night. Nobody is picked twice in the same night.
export function nextMatchups(
  ids: string[],
  existing: [string, string][],
  meetings: number,
  count: number,
  busy: Set<string> = new Set()
): [string, string][] {
  const key = (a: string, b: string) => [a, b].sort().join("|");
  const met = new Map<string, number>();
  const games = new Map<string, number>();
  for (const [a, b] of existing) {
    met.set(key(a, b), (met.get(key(a, b)) ?? 0) + 1);
    games.set(a, (games.get(a) ?? 0) + 1);
    games.set(b, (games.get(b) ?? 0) + 1);
  }
  const all = pairs(ids)
    .map(([a, b]) => ({ a, b, n: met.get(key(a, b)) ?? 0, load: (games.get(a) ?? 0) + (games.get(b) ?? 0) }))
    .filter((p) => p.n < meetings)
    .sort((x, y) => x.n - y.n || x.load - y.load);
  const used = new Set(busy);
  const out: [string, string][] = [];
  for (const p of all) {
    if (out.length >= count) break;
    if (used.has(p.a) || used.has(p.b)) continue;
    out.push([p.a, p.b]);
    used.add(p.a);
    used.add(p.b);
  }
  return out;
}
