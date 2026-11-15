import React, { useState } from 'react';
import { careerStats, createPlayer, createTeam } from '../lib/scoring.js';

const STYLE_BOWL = ['—', 'Right-arm fast', 'Right-arm medium', 'Right-arm off-spin',
  'Right-arm leg-spin', 'Left-arm fast', 'Left-arm medium', 'Left-arm orthodox', 'Left-arm wrist-spin'];

export default function PlayersView({ matches, teams, setTeams }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);

  // unique player list with team + style info
  const players = [];
  const seen = new Set();
  for (const t of teams) {
    for (const p of t.players) {
      if (seen.has(p.name)) continue;
      seen.add(p.name);
      players.push({ ...p, team: t.name });
    }
  }
  const filtered = players.filter(p =>
    !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.team.toLowerCase().includes(q.toLowerCase()));

  const selected = sel
    ? { player: players.find(p => p.name === sel), stats: careerStats(sel, matches) }
    : null;

  const updatePlayer = (teamName, name, patch) => {
    setTeams(prev => prev.map(t => t.name !== teamName ? t : ({
      ...t,
      players: t.players.map(p => p.name === name ? { ...p, ...patch } : p),
    })));
  };

  const exportTeamFile = (team) => {
    import('../lib/excel.js').then(({ exportWorkbook }) =>
      exportWorkbook([], [team], `${team.name.replace(/\s+/g, '-').toLowerCase()}.xlsx`));
  };

  return (
    <>
      <div className="panel">
        <h2>Players ({players.length})</h2>
        <div className="row" style={{ marginBottom: 10 }}>
          <div><label>Search</label>
            <input value={q} placeholder="player or team…" onChange={e => setQ(e.target.value)} /></div>
        </div>
        {players.length === 0 && (
          <p style={{ color: 'var(--muted)' }}>
            No players yet. Add teams in Match Setup, or import an Excel DB — teams are stored in the Teams sheet.
          </p>
        )}
        <table className="stats">
          <thead><tr>
            <th>Player</th><th>Team</th><th>Role</th><th>Bat</th><th>Bowl</th><th></th>
          </tr></thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.name + p.team}>
                <td><b>{p.name}</b></td>
                <td>{p.team}</td>
                <td><span className="tag">{p.role}</span></td>
                <td>{p.battingStyle}</td>
                <td>{p.bowlingStyle || '—'}</td>
                <td><button className="small" onClick={() => setSel(p.name)}>Career</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>Teams</h2>
        {teams.map(t => (
          <div key={t.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <span><b>{t.name}</b> <span className="tag">{t.players.length} players</span></span>
            <button className="small" onClick={() => exportTeamFile(t)}>export .xlsx</button>
          </div>
        ))}
        {teams.length === 0 && <p style={{ color: 'var(--muted)' }}>No teams saved yet.</p>}
      </div>

      {selected?.player && (
        <div className="panel">
          <h2>{selected.player.name} — profile &amp; career <button className="small" onClick={() => setSel(null)}>✕</button></h2>
          <div className="grid grid-3" style={{ marginBottom: 12 }}>
            <div><label>Batting style</label>
              <select value={selected.player.battingStyle}
                onChange={e => updatePlayer(selected.player.team, selected.player.name, { battingStyle: e.target.value })}>
                <option>RHB</option><option>LHB</option>
              </select></div>
            <div><label>Bowling style</label>
              <select value={selected.player.bowlingStyle || '—'}
                onChange={e => updatePlayer(selected.player.team, selected.player.name, { bowlingStyle: e.target.value === '—' ? '' : e.target.value })}>
                {STYLE_BOWL.map(s => <option key={s}>{s}</option>)}
              </select></div>
            <div><label>Role</label>
              <select value={selected.player.role}
                onChange={e => updatePlayer(selected.player.team, selected.player.name, { role: e.target.value })}>
                {['Batter', 'Bowler', 'All-rounder', 'Wicket-keeper', 'Wicket-keeper batter'].map(r => <option key={r}>{r}</option>)}
              </select></div>
          </div>
          <table className="stats">
            <thead><tr>
              <th className="num">Mat</th><th className="num">Inn</th><th className="num">Runs</th>
              <th className="num">HS</th><th className="num">Avg</th><th className="num">SR</th>
              <th className="num">50s</th><th className="num">100s</th>
              <th className="num">Balls</th><th className="num">Wkts</th><th className="num">Best</th><th className="num">Econ</th>
            </tr></thead>
            <tbody>
              <tr>
                <td className="num">{selected.stats.matches}</td>
                <td className="num">{selected.stats.innings}</td>
                <td className="num"><b>{selected.stats.runs}</b></td>
                <td className="num">{selected.stats.hs}</td>
                <td className="num">{selected.stats.battingAvg}</td>
                <td className="num">{selected.stats.battingSR}</td>
                <td className="num">{selected.stats.fifties}</td>
                <td className="num">{selected.stats.hundreds}</td>
                <td className="num">{selected.stats.ballsBowled}</td>
                <td className="num"><b>{selected.stats.wickets}</b></td>
                <td className="num">{selected.stats.best}</td>
                <td className="num">{selected.stats.bowlingEcon}</td>
              </tr>
            </tbody>
          </table>
          <p style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
            Career totals are computed live from all matches in the current database.
            Export the Excel workbook to carry them anywhere.
          </p>
        </div>
      )}
    </>
  );
}
