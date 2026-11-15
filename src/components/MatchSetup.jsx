import React, { useState } from 'react';
import {
  createTeam, createPlayer, createMatch, refreshResult,
} from '../lib/scoring.js';

const BLANK = { name: '', venue: '', dateTime: '', overs: 20 };
const STYLE_BAT = ['RHB', 'LHB'];
const STYLE_BOWL = ['—', 'Right-arm fast', 'Right-arm medium', 'Right-arm off-spin',
  'Right-arm leg-spin', 'Left-arm fast', 'Left-arm medium', 'Left-arm orthodox', 'Left-arm wrist-spin'];
const ROLES = ['Batter', 'Bowler', 'All-rounder', 'Wicket-keeper', 'Wicket-keeper batter'];

function TeamEditor({ title, id, team, onChange }) {
  const [p, setP] = useState({ name: '', role: 'Batter', battingStyle: 'RHB', bowlingStyle: '—' });
  const addPlayer = () => {
    if (!p.name.trim()) return;
    onChange({ ...team, players: [...team.players, createPlayer(p.name.trim(), p.role, p.battingStyle, p.bowlingStyle === '—' ? '' : p.bowlingStyle)] });
    setP({ ...p, name: '' });
  };
  const setPlayerField = (id, k, v) => onChange({
    ...team,
    players: team.players.map(x => (x.id === id ? { ...x, [k]: v } : x)),
  });
  const removePlayer = (id) => onChange({
    ...team, players: team.players.filter(x => x.id !== id),
  });

  return (
    <div className="panel">
      <h2>{title}</h2>
      <div className="row" style={{ marginBottom: 10 }}>
        <div>
          <label>Team name</label>
          <input value={team.name} placeholder="e.g. Mumbai Strikers"
            onChange={e => onChange({ ...team, name: e.target.value })} />
        </div>
        <div>
          <label>Load existing team</label>
          <TeamPicker id={id} onChange={onChange} />
        </div>
      </div>

      <div className="row">
        <div><label>Player name</label>
          <input value={p.name} onChange={e => setP({ ...p, name: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && addPlayer()} placeholder="Player name" /></div>
        <div><label>Role</label>
          <select value={p.role} onChange={e => setP({ ...p, role: e.target.value })}>
            {ROLES.map(r => <option key={r}>{r}</option>)}
          </select></div>
        <div><label>Batting style</label>
          <select value={p.battingStyle} onChange={e => setP({ ...p, battingStyle: e.target.value })}>
            {STYLE_BAT.map(r => <option key={r}>{r}</option>)}
          </select></div>
        <div><label>Bowling style</label>
          <select value={p.bowlingStyle} onChange={e => setP({ ...p, bowlingStyle: e.target.value })}>
            {STYLE_BOWL.map(r => <option key={r}>{r}</option>)}
          </select></div>
        <div style={{ flex: '0 0 auto' }}><button className="primary" onClick={addPlayer}>+ Add</button></div>
      </div>

      {team.players.length > 0 && (
        <table className="stats" style={{ marginTop: 12 }}>
          <thead><tr>
            <th>#</th><th>Player</th><th>Role</th><th>Bat</th><th>Bowl</th><th></th>
          </tr></thead>
          <tbody>
            {team.players.map((x, i) => (
              <tr key={x.id}>
                <td>{i + 1}</td>
                <td><input value={x.name} style={{ width: '95%' }}
                  onChange={e => setPlayerField(x.id, 'name', e.target.value)} /></td>
                <td>
                  <select value={x.role} onChange={e => setPlayerField(x.id, 'role', e.target.value)}>
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </td>
                <td>
                  <select value={x.battingStyle} onChange={e => setPlayerField(x.id, 'battingStyle', e.target.value)}>
                    {STYLE_BAT.map(r => <option key={r}>{r}</option>)}
                  </select>
                </td>
                <td>
                  <select value={x.bowlingStyle || '—'} onChange={e => setPlayerField(x.id, 'bowlingStyle', e.target.value === '—' ? '' : e.target.value)}>
                    {STYLE_BOWL.map(r => <option key={r}>{r}</option>)}
                  </select>
                </td>
                <td><button className="small danger" onClick={() => removePlayer(x.id)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function TeamPicker({ id, onChange }) {
  const inputId = `teamfile-${id}`;
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <input id={inputId} type="file" accept=".xlsx,.csv" style={{ display: 'none' }}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const XLSX = await import('xlsx');
          const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
          const players = rows.map(r => createPlayer(
            r.player || r.Player || r.name || r.Name,
            r.role || r.Role || 'All-rounder',
            r.battingStyle || r.Bat || 'RHB',
            r.bowlingStyle || r.Bowl || '')).filter(x => x.name);
          onChange({ name: file.name.replace(/\.(xlsx|csv)$/i, ''), players });
        }} />
      <button className="small" onClick={() => document.getElementById(inputId).click()}>From Excel/CSV</button>
    </div>
  );
}

export default function MatchSetup({ matches, teams, activeMatch, setMatches, setTeams, setActiveId, updateMatch, onGoScore }) {
  const [f, setF] = useState(BLANK);
  const [team1, setTeam1] = useState(() => teams[0] || createTeam('Team A', [
    createPlayer('Player A1'), createPlayer('Player A2'),
  ]));
  const [team2, setTeam2] = useState(() => teams[1] || createTeam('Team B', [
    createPlayer('Player B1'), createPlayer('Player B2'),
  ]));

  // keep editors in sync when the roster changes via Excel import
  React.useEffect(() => {
    const t1 = teams.find(t => t.name === team1.name);
    const t2 = teams.find(t => t.name === team2.name);
    if (t1 && t1.players.length > team1.players.length) setTeam1(t1);
    if (t2 && t2.players.length > team2.players.length) setTeam2(t2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams.length]);

  const startMatch = () => {
    if (!team1.name.trim() || !team2.name.trim()) return alert('Both teams need names.');
    if (team1.players.length < 2 || team2.players.length < 2) return alert('Add at least 2 players per team.');
    // persist teams into the roster
    setTeams(prev => {
      const next = [...prev];
      for (const t of [team1, team2]) {
        const ix = next.findIndex(x => x.name === t.name);
        if (ix >= 0) next[ix] = t; else next.push(t);
      }
      return next;
    });
    const m = refreshResult(createMatch({
      team1, team2, venue: f.venue, dateTime: f.dateTime, overs: f.overs,
      tossWinner: f.tossWinner || team1.name, tossDecision: f.tossDecision,
    }));
    setMatches(prev => [m, ...prev]);
    setActiveId(m.id);
    setF(BLANK);
    onGoScore();
  };

  return (
    <>
      <div className="panel">
        <h2>Teams &amp; Players</h2>
        <div className="grid grid-2">
          <TeamEditor title="Team 1" id="t1" team={team1} onChange={setTeam1} />
          <TeamEditor title="Team 2" id="t2" team={team2} onChange={setTeam2} />
        </div>
      </div>

      <div className="panel">
        <h2>Match Details</h2>
        <div className="grid grid-3">
          <div><label>Venue</label>
            <input value={f.venue} placeholder="Ground, City"
              onChange={e => setF({ ...f, venue: e.target.value })} /></div>
          <div><label>Date &amp; time</label>
            <input type="datetime-local" value={f.dateTime}
              onChange={e => setF({ ...f, dateTime: e.target.value })} /></div>
          <div><label>Overs per side</label>
            <input type="number" min="1" max="50" value={f.overs}
              onChange={e => setF({ ...f, overs: Number(e.target.value) })} /></div>
          <div><label>Toss won by</label>
            <select value={f.tossWinner || ''} onChange={e => setF({ ...f, tossWinner: e.target.value })}>
              <option value="">— select —</option>
              <option>{team1.name || 'Team 1'}</option>
              <option>{team2.name || 'Team 2'}</option>
            </select></div>
          <div><label>Elected to</label>
            <select value={f.tossDecision} onChange={e => setF({ ...f, tossDecision: e.target.value })}>
              <option value="bat">Bat first</option>
              <option value="bowl">Bowl first</option>
            </select></div>
        </div>
        <div style={{ marginTop: 14 }}>
          <button className="primary" onClick={startMatch}>▶ Start Match</button>
        </div>
      </div>

      <div className="panel">
        <h2>Matches ({matches.length})</h2>
        {matches.length === 0 && <p style={{ color: 'var(--muted)' }}>No matches yet — set up teams above, or import an Excel DB.</p>}
        <table className="stats">
          <thead><tr>
            <th>Match</th><th>Venue</th><th>When</th><th>Overs</th><th>Status</th><th>Result</th><th></th>
          </tr></thead>
          <tbody>
            {matches.map(m => (
              <tr key={m.id} style={{ background: m.id === activeMatch?.id ? '#1d3a2a' : undefined }}>
                <td>{m.name}</td>
                <td>{m.venue}</td>
                <td>{m.dateTime?.replace('T', ' ')}</td>
                <td>{m.overs}</td>
                <td><span className={`tag ${m.status === 'completed' ? 'green' : 'yellow'}`}>{m.status}</span></td>
                <td>{m.result}</td>
                <td>
                  <button className="small" onClick={() => { setActiveId(m.id); onGoScore(); }}>Open</button>{' '}
                  <button className="small danger" onClick={() => {
                    if (confirm(`Delete "${m.name}"?`)) {
                      setMatches(prev => prev.filter(x => x.id !== m.id));
                      setActiveId(null);
                    }
                  }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}


