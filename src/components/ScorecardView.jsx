import React from 'react';
import { eventsOfInnings, deriveInnings, battingTeamFor, oversText } from '../lib/scoring.js';

function InningsCard({ match, inningsNo }) {
  const events = eventsOfInnings(match, inningsNo);
  if (events.length === 0 && inningsNo === 2) return null;
  const view = deriveInnings(events);
  const batTeamName = battingTeamFor(match, inningsNo);
  const bowlTeamName = batTeamName === match.team1.name ? match.team2.name : match.team1.name;
  const batted = view.batting.filter(b => b.balls > 0 || b.out);
  const bowled = view.bowling.filter(b => b.balls > 0);

  if (events.length === 0) return null;

  return (
    <div className="panel">
      <h2>Innings {inningsNo} — {batTeamName}: {view.runs}/{view.wickets} ({view.overs} ov) · RR {view.runRate}</h2>

      <h3>Batting</h3>
      {batted.length === 0 && <p style={{ color: 'var(--muted)' }}>No batting data.</p>}
      {batted.length > 0 && (
        <table className="stats">
          <thead><tr>
            <th>Batter</th><th className="num">R</th><th className="num">B</th>
            <th className="num">4s</th><th className="num">6s</th><th className="num">SR</th><th>Dismissal</th>
          </tr></thead>
          <tbody>
            {batted.map(b => (
              <tr key={b.name}>
                <td>{b.name}</td>
                <td className="num"><b>{b.runs}</b></td>
                <td className="num">{b.balls}</td>
                <td className="num">{b.fours}</td>
                <td className="num">{b.sixes}</td>
                <td className="num">{b.strikeRate}</td>
                <td>{b.out ? <span className="tag red">{b.dismissal || 'out'}</span> : <span className="tag green">not out</span>}</td>
              </tr>
            ))}
            <tr>
              <td colSpan="1"><b>Extras</b></td>
              <td className="num" colSpan="6">
                {view.extras.total} (wd {view.extras.wd}, nb {view.extras.nb}, b {view.extras.b}, lb {view.extras.lb})
              </td>
            </tr>
            <tr>
              <td><b>Total</b></td>
              <td className="num" colSpan="6"><b>{view.runs}/{view.wickets} in {view.overs} overs · Run rate {view.runRate}</b></td>
            </tr>
          </tbody>
        </table>
      )}

      <h3>Bowling ({bowlTeamName})</h3>
      {bowled.length === 0 ? <p style={{ color: 'var(--muted)' }}>No bowling data.</p> : (
        <table className="stats">
          <thead><tr>
            <th>Bowler</th><th className="num">O</th><th className="num">M</th>
            <th className="num">R</th><th className="num">W</th><th className="num">Econ</th><th className="num">Dots</th>
          </tr></thead>
          <tbody>
            {bowled.map(b => (
              <tr key={b.name}>
                <td>{b.name}</td>
                <td className="num">{b.overs}</td>
                <td className="num">{b.maidens}</td>
                <td className="num">{b.runs}</td>
                <td className="num"><b>{b.wickets}</b></td>
                <td className="num">{b.economy}</td>
                <td className="num">{b.dots}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {view.fallOfWickets.length > 0 && (
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
          Fall of wickets: {view.fallOfWickets.map(f => `${f.wkt}-${f.runs} (${f.batter} ${f.over})`).join(', ')}
        </p>
      )}
    </div>
  );
}

export default function ScorecardView({ match, matches, setActiveId }) {
  if (!match) {
    return (
      <div className="panel">
        <h2>Scorecard</h2>
        <p style={{ color: 'var(--muted)' }}>No match open.</p>
        {matches.map(m => (
          <button key={m.id} style={{ margin: 4 }} onClick={() => setActiveId(m.id)}>
            {m.name} ({m.status})
          </button>
        ))}
      </div>
    );
  }
  return (
    <>
      <div className="panel">
        <h2>{match.name}</h2>
        <p style={{ color: 'var(--muted)', margin: 0 }}>
          {match.venue} · {match.dateTime?.replace('T', ' ')} · {match.overs} overs ·
          Toss: {match.tossWinner} elected to {match.tossDecision}
        </p>
        {match.result && <p><span className="tag green">{match.result}</span></p>}
      </div>
      <InningsCard match={match} inningsNo={1} />
      <InningsCard match={match} inningsNo={2} />
    </>
  );
}
