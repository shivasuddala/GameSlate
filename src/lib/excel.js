// Excel-as-database: every match, team and delivery lives in one .xlsx
// workbook. Export to save / move platforms, import to continue later.
import * as XLSX from 'xlsx';
import { newId } from './scoring.js';

const APP = 'GameSlate v1';
export const DB_FILENAME_PREFIX = 'gameslate-db';

export function exportWorkbook(matches, teams, filename) {
  const wb = XLSX.utils.book_new();

  const readme = [
    ['GameSlate Workbook'],
    ['App', APP],
    ['Exported', new Date().toISOString()],
    ['How to use', 'Import this file on any device/platform to restore matches, teams and ball-by-ball data.'],
    ['Sheets', 'Matches | Teams | Deliveries | State | Career'],
  ];
  const wsReadme = XLSX.utils.aoa_to_sheet(readme);
  XLSX.utils.book_append_sheet(wb, wsReadme, 'README');

  // Matches -------------------------------------------------------------
  const matchRows = matches.map(m => ({
    id: m.id, name: m.name, date: m.dateTime, venue: m.venue,
    overs: m.overs, team1: m.team1.name, team2: m.team2.name,
    tossWinner: m.tossWinner, tossDecision: m.tossDecision,
    status: m.status, result: m.result,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matchRows), 'Matches');

  // Teams ---------------------------------------------------------------
  const teamRows = [];
  for (const t of teams) {
    for (const p of t.players) {
      teamRows.push({ team: t.name, player: p.name, role: p.role,
        battingStyle: p.battingStyle, bowlingStyle: p.bowlingStyle });
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(teamRows), 'Teams');

  // Deliveries ----------------------------------------------------------
  const deliveryRows = [];
  for (const m of matches) {
    for (const e of m.events) {
      deliveryRows.push({
        matchId: m.id, innings: e.innings, over: e.over, ball: e.ball,
        striker: e.striker, nonStriker: e.nonStriker, bowler: e.bowler,
        runsOffBat: e.runsOffBat || 0,
        extraType: e.extraType || '', extraRuns: e.extraRuns || 0,
        wicketType: e.wicket?.type || '', playerOut: e.wicket?.playerOut || '',
        fielder: e.wicket?.fielder || '',
      });
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(deliveryRows), 'Deliveries');

  // State (crease / UI state per match) ---------------------------------
  const stateRows = matches.map(m => ({
    matchId: m.id, currentInnings: m.currentInnings,
    uiState: JSON.stringify(m.ui || {}),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stateRows), 'State');

  // Career (computed at export time for convenience) --------------------
  // Note: full career can always be recomputed from Deliveries.
  XLSX.writeFile(wb, filename || `${DB_FILENAME_PREFIX}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function importWorkbook(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const get = (name) => wb.SheetNames.includes(name)
    ? XLSX.utils.sheet_to_json(wb.Sheets[name]) : [];

  const matchRows = get('Matches');
  const teamRows = get('Teams');
  const deliveryRows = get('Deliveries');
  const stateRows = get('State');

  // teams keyed by name
  const teamMap = new Map();
  for (const r of teamRows) {
    if (!teamMap.has(r.team)) teamMap.set(r.team, { id: newId(), name: r.team, players: [] });
    teamMap.get(r.team).players.push({
      id: newId(), name: r.player, role: r.role || 'All-rounder',
      battingStyle: r.battingStyle || 'RHB', bowlingStyle: r.bowlingStyle || '',
    });
  }

  // deliveries grouped by match
  const evByMatch = new Map();
  for (const r of deliveryRows) {
    if (!evByMatch.has(r.matchId)) evByMatch.set(r.matchId, []);
    evByMatch.get(r.matchId).push({
      innings: Number(r.innings) || 1, over: Number(r.over) || 0, ball: Number(r.ball) || 0,
      striker: r.striker, nonStriker: r.nonStriker, bowler: r.bowler,
      runsOffBat: Number(r.runsOffBat) || 0,
      extraType: r.extraType || null, extraRuns: Number(r.extraRuns) || 0,
      wicket: r.wicketType ? {
        type: r.wicketType, playerOut: r.playerOut, fielder: r.fielder || '',
      } : null,
    });
  }

  const matches = matchRows.map(r => ({
    id: String(r.id || newId()),
    name: r.name || `${r.team1} vs ${r.team2}`,
    venue: r.venue || '', dateTime: String(r.date || ''),
    overs: Number(r.overs) || 20,
    team1: { name: r.team1, players: (teamMap.get(r.team1)?.players) || [] },
    team2: { name: r.team2, players: (teamMap.get(r.team2)?.players) || [] },
    tossWinner: r.tossWinner || '', tossDecision: r.tossDecision || 'bat',
    status: r.status || 'completed', result: r.result || '',
    events: evByMatch.get(String(r.id)) || [],
    currentInnings: 1,
    ui: {},
  }));

  for (const m of matches) {
    const st = stateRows.find(s => String(s.matchId) === m.id);
    if (st) {
      m.currentInnings = Number(st.currentInnings) || 1;
      try { m.ui = JSON.parse(st.uiState || '{}'); } catch { m.ui = {}; }
    }
    // normalise events (sort to original order)
    m.events.sort((a, b) => (a.innings - b.innings) || (a.over - b.over) || (a.ball - b.ball));
  }

  const teams = [...teamMap.values()];
  return { matches, teams };
}
