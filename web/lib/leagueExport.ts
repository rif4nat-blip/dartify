import ExcelJS from "exceljs";
import { standings, type LGame, type LTeamLite } from "./leagueLogic";

export type ExportGame = LGame & {
  id: string;
  game_date: string | null;
  game_no: number | null;
};

export type ExportInput = {
  leagueName: string;
  categoryName: string;
  cut: number;
  teams: LTeamLite[];
  games: ExportGame[];
  players?: Record<string, string>; // team id -> "Player A / Player B"
};

const GREEN = "FF16A34A";
const GREEN_SOFT = "FFDCFCE7";
const GREY = "FFE5E7EB";
const AMBER = "FFFEF3C7";
const RED = "FFFEE2E2";
const BORDER = { style: "thin" as const, color: { argb: "FF9CA3AF" } };
const BOX = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };

function niceDate(d: string | null) {
  if (!d) return "No date";
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-PH", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

/** Team numbers follow the alphabetical order of names, so they are the same every time. */
export function numberTeams(teams: LTeamLite[]) {
  const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name));
  const no = new Map<string, number>();
  sorted.forEach((t, i) => no.set(t.id, i + 1));
  return { sorted, no };
}

export async function buildLeagueWorkbook(input: ExportInput): Promise<ExcelJS.Workbook> {
  const { sorted, no } = numberTeams(input.teams);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Dartify";

  // ---------- Schedule ----------
  const ws = wb.addWorksheet("Schedule", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  const regular = input.games.filter((g) => g.kind !== "tiebreak");
  const nights = new Map<string, ExportGame[]>();
  for (const g of regular) {
    const k = g.game_date ?? "";
    if (!nights.has(k)) nights.set(k, []);
    nights.get(k)!.push(g);
  }
  const keys = [...nights.keys()].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
  const maxGames = Math.max(1, ...[...nights.values()].map((v) => v.length));
  const lastCol = maxGames + 1;

  ws.mergeCells(1, 1, 1, lastCol);
  const title = ws.getCell(1, 1);
  title.value = `${input.leagueName.toUpperCase()}  -  ${input.categoryName}`;
  title.font = { bold: true, size: 16 };
  title.alignment = { horizontal: "center" };
  ws.mergeCells(2, 1, 2, lastCol);
  const sub = ws.getCell(2, 1);
  sub.value = "Each cell: top team plays bottom team. Green and bold = winner. Team numbers are listed on the Teams sheet.";
  sub.font = { italic: true, size: 10, color: { argb: "FF6B7280" } };
  sub.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  ws.getRow(2).height = 30;

  let r = 4;
  ws.getColumn(1).width = 24;
  for (let c = 2; c <= lastCol; c++) ws.getColumn(c).width = 7;

  const head = ws.getRow(r);
  head.getCell(1).value = "Game night";
  for (let c = 1; c <= maxGames; c++) head.getCell(c + 1).value = c;
  head.eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREY } };
    cell.border = BOX;
  });
  r++;

  keys.forEach((k, idx) => {
    const list = [...nights.get(k)!].sort((a, b) => (a.game_no ?? 999) - (b.game_no ?? 999));
    const top = ws.getRow(r);
    const bot = ws.getRow(r + 1);
    ws.mergeCells(r, 1, r + 1, 1);
    const lab = ws.getCell(r, 1);
    const allCancelled = list.every((g) => g.status === "cancelled");
    const anyPostponed = list.some((g) => g.status === "postponed");
    lab.value = `Week ${idx + 1}\n${niceDate(k || null)}${allCancelled ? "\n(cancelled)" : anyPostponed ? "\n(postponed)" : ""}`;
    lab.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
    lab.font = { bold: true, size: 10 };
    lab.border = BOX;
    top.height = 20;
    bot.height = 20;

    for (let c = 1; c <= maxGames; c++) {
      const g = list[c - 1];
      const tc = top.getCell(c + 1);
      const bc = bot.getCell(c + 1);
      for (const cell of [tc, bc]) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = BOX;
      }
      if (!g) continue;
      tc.value = no.get(g.team1_id) ?? "?";
      bc.value = no.get(g.team2_id) ?? "?";
      if (g.status === "cancelled") {
        for (const cell of [tc, bc]) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: RED } };
      } else if (g.status === "postponed") {
        for (const cell of [tc, bc]) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER } };
      }
      const win = g.winner_id === g.team1_id ? tc : g.winner_id === g.team2_id ? bc : null;
      if (win) {
        win.font = { bold: true, color: { argb: GREEN } };
        win.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_SOFT } };
        win.border = { top: { style: "medium", color: { argb: GREEN } }, left: { style: "medium", color: { argb: GREEN } }, bottom: { style: "medium", color: { argb: GREEN } }, right: { style: "medium", color: { argb: GREEN } } };
      }
    }
    r += 2;
  });

  const tb = input.games.filter((g) => g.kind === "tiebreak");
  if (tb.length) {
    r++;
    ws.getCell(r, 1).value = "Tiebreak games";
    ws.getCell(r, 1).font = { bold: true };
    r++;
    for (const g of tb) {
      ws.getCell(r, 1).value = `${no.get(g.team1_id)} vs ${no.get(g.team2_id)}`;
      ws.getCell(r, 2).value = g.winner_id ? `Winner: ${no.get(g.winner_id)}` : "Not played";
      r++;
    }
  }

  // ---------- Standings ----------
  const st = wb.addWorksheet("Standings", { pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
  st.columns = [
    { header: "Rank", width: 7 }, { header: "No.", width: 6 }, { header: "Team", width: 34 },
    { header: "P", width: 6 }, { header: "W", width: 6 }, { header: "L", width: 6 },
    { header: "For", width: 7 }, { header: "Against", width: 9 }, { header: "Diff", width: 7 },
  ];
  st.getRow(1).eachCell((c) => {
    c.font = { bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREY } };
    c.border = BOX;
    c.alignment = { horizontal: "center" };
  });
  standings(input.teams, regular).forEach((row) => {
    const x = st.addRow([`${row.rank}${row.tied ? " T" : ""}`, no.get(row.id), row.name, row.played, row.wins, row.losses, row.pf, row.pa, row.diff]);
    x.eachCell((c, col) => {
      c.border = BOX;
      c.alignment = { horizontal: col === 3 ? "left" : "center" };
      if (row.rank <= input.cut) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_SOFT } };
    });
  });

  // ---------- Teams ----------
  const tm = wb.addWorksheet("Teams", { pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
  tm.columns = [{ header: "No.", width: 6 }, { header: "Team", width: 34 }, { header: "Players", width: 46 }];
  tm.getRow(1).eachCell((c) => {
    c.font = { bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREY } };
    c.border = BOX;
  });
  sorted.forEach((t) => {
    const x = tm.addRow([no.get(t.id), t.name, input.players?.[t.id] ?? ""]);
    x.eachCell((c) => (c.border = BOX));
  });

  return wb;
}

/** Browser: builds the workbook and downloads it. */
export async function downloadLeagueXlsx(input: ExportInput) {
  const wb = await buildLeagueWorkbook(input);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${input.leagueName} - ${input.categoryName}.xlsx`.replace(/[\\/:*?"<>|]/g, "-");
  a.click();
  URL.revokeObjectURL(url);
}
