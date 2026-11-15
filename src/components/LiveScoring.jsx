import React, { useState } from 'react';
import {
  eventsOfInnings, deriveInnings, refreshResult,
  oversText, DISMISSALS, battingTeamFor,
} from '../lib/scoring.js';

const isLegal = (e) => e.extraType !== 'wd' && e.extraType !== 'nb';

function ballClass(e) {
  if (e.wicket) return 'wicket';
  if (['wd', 'nb'].includes(e.extraType)) return 'extra';
  const r = (e.runsOffBat || 0) + (['b', 'lb'].includes(e.extraType) ? (e.extraRuns || 0) : 0);
  if (r === 6) return 'six';
  if (r === 4) return 'four';
  if (r > 0) return 'run';
  return '';
}

function ballLabel(e) {
  if (e.wicket) return 'W';
  if (e.extraType === 'wd') return `wd${e.extraRuns > 1 ? e.extraRuns : ''}`;
  if (e.extraType === 'nb') return `nb${(e.runsOffBat || 0) || ''}`;
  const extra = ['b', 'lb'].includes(e.extraType) ? e.extraRuns : 0;
  const r = (e.runsOffBat || 0) + extra;
  return String(r);
}

function commentaryText(e) {
  const to = `${e.bowler} to ${e.striker}, `;
  if (e.wicket) {
    const f = e.wicket.fielder ? `, fielder ${e.wicket.fielder}` : '';
    return `OUT! ${e.wicket.playerOut} ${e.wicket.type}${f}`;
  }
  if (e.extraType === 'wd') return `${to}wide${e.extraRuns > 1 ? ` + ${e.extraRuns - 1} extra` : ''}`;
  if (e.extraType === 'nb') return `${to}no ball${e.runsOffBat ? ` + ${e.runsOffBat} off the bat` : ''}`;
  if (e.extraType === 'b') return `${to}${e.extraRuns} bye${e.extraRuns > 1 ? 's' : ''}`;
  if (e.extraType === 'lb') return `${to}${e.extraRuns} leg-bye${e.extraRuns > 1 ? 's' : ''}`;
  const r = e.runsOffBat || 0;
  if (r === 0) return `${to}dot ball, no run`;
  if (r === 4) return `${to}FOUR! 🏏`;
  if (r === 6) return `${to}SIX! 💥`;
  return `${to}${r} run${r > 1 ? 's' : ''}`;
}

function partnershipOf(events) {
  let runs = 0, balls = 0, batters = new Set();
  for (const e of events) {
    if (e.wicket) { runs = 0; balls = 0; batters = new Set(); continue; }
    runs += (e.runsOffBat || 0) + (e.extraRuns || 0);
    if (isLegal(e)) balls += 1;
    batters.add(e.striker); batters.add(e.nonStriker);
  }
  return { runs, balls, batters: [...batters] };
}

/* ---------------- Wicket modal ---------------- */
function WicketModal({ onConfirm, onClose, striker, nonStriker }) {
  const [type, setType] = useState('bowled');
  const [who, setWho] = useState('striker');
  const [fielder, setFielder] = useState('');
  const needsFielder = ['caught', 'stumped', 'run out', 'caught & bowled'].includes(type);
  const playerOut = who === 'striker' ? striker : nonStriker;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>🧤 Wicket!</h3>
        <div className="field">
          <label>Dismissal type</label>
          <select value={type} onChange={e => setType(e.target.value)}>
            {DISMISSALS.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        {type === 'run out' && (
          <div className="field">
            <label>Who is out?</label>
            <div className="row">
              <button className={who === 'striker' ? 'primary' : ''} onClick={() => setWho('striker')}>{striker || 'striker'}</button>
              <button className={who === 'nonStriker' ? 'primary' : ''} onClick={() => setWho('nonStriker')}>{nonStriker || 'non-striker'}</button>
            </div>
          </div>
        )}
        {needsFielder && (
          <div className="field">
            <label>Fielder (optional)</label>
            <input value={fielder} onChange={e => setFielder(e.target.value)} placeholder="Fielder name" />
          </div>
        )}
        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={() => onConfirm({ type, playerOut, fielder })}>
            Confirm wicket — {playerOut || '?'} out
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Extra-runs modal (byes/leg-byes/wide+/nb+) ---------------- */
function ExtraModal({ kind, onConfirm, onClose }) {
  const label = { b: 'Byes', lb: 'Leg-byes', wd: 'Wide', nb: 'No ball' }[kind];
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>⚪ {label}</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>How many extra runs?</p>
        <div className="row">
          {[1, 2, 3, 4, 5].map(r => (
            <button key={r} className="run-btn" onClick={() => onConfirm(r)}>{r}</button>
          ))}
        </div>
        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Main ---------------- */
export default function LiveScoring({ match, updateMatch, matches, setActiveId }) {
  const [wicketOpen, setWicketOpen] = useState(false);
  const [extraKind, setExtraKind] = useState(null);

  if (!match) {
    return (
      <div className="panel">
        <h2>🏏 Live Scoring</h2>
        <p style={{ color: 'var(--muted)' }}>No match open. Create one in Match Setup or import an Excel DB.</p>
        {matches.length > 0 && (
          <div>
            <h3>Existing matches</h3>
            <div className="row">
              {matches.map(m => (
                <button key={m.id} onClick={() => setActiveId(m.id)}>
                  {m.name} · <span className="tag yellow">{m.status}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const ui = match.ui || {};
  const setUi = (patch) => updateMatch(match.id, m => ({ ...m, ui: { ...m.ui, ...patch } }));
  const inn = match.currentInnings;
  const view = deriveInnings(eventsOfInnings(match, inn));
  const batTeamName = battingTeamFor(match, inn);
  const batTeam = batTeamName === match.team1.name ? match.team1 : match.team2;
  const bowlTeamName = batTeamName === match.team1.name ? match.team2.name : match.team1.name;
  const bowlTeam = bowlTeamName === match.team1.name ? match.team1 : match.team2;
  const striker = ui.striker || view.striker || '';
  const nonStriker = ui.nonStriker || view.nonStriker || '';
  const bowler = ui.bowler || view.bowler || '';
  const legal = view.legalBalls;
  const oversDone = legal >= match.overs * 6;
  const allOut = view.wickets >= batTeam.players.length - 1;

  const v1 = deriveInnings(eventsOfInnings(match, 1));
  const target = inn === 2 ? v1.runs + 1 : null;
  const need = target ? Math.max(target - view.runs, 0) : 0;
  const ballsLeft = match.overs * 6 - legal;
  const rrr = target && ballsLeft > 0 ? (need * 6 / ballsLeft).toFixed(2) : '—';

  // bowler-repeat warning (new over about to start with same bowler)
  const repeatWarn = bowler && legal % 6 === 0 && legal > 0 &&
    view.oversList[view.oversList.length - 1]?.bowler === bowler;

  const record = (e) => {
    if (!striker || !nonStriker || !bowler) {
      alert('Select striker, non-striker and bowler first.');
      return;
    }
    const ev = {
      innings: inn,
      over: Math.floor(legal / 6),
      ball: (legal % 6) + 1,
      striker, nonStriker, bowler,
      runsOffBat: 0, extraType: null, extraRuns: 0, wicket: null,
      ...e,
    };
    updateMatch(match.id, m => refreshResult({ ...m, events: [...m.events, ev] }));
    if (ev.wicket) {
      const outPos = ev.wicket.playerOut === nonStriker ? 'nonStriker' : 'striker';
      setUi({ pendingNewBatter: { end: outPos, outName: ev.wicket.playerOut } });
    }
  };

  const undo = () => {
    updateMatch(match.id, m => refreshResult({ ...m, events: m.events.slice(0, -1) }));
    setUi({ pendingNewBatter: null });
  };

  const endInningsNow = () => {
    if (!confirm('End this innings now (declare / cut short)?')) return;
    updateMatch(match.id, m => refreshResult({ ...m, currentInnings: m.currentInnings === 1 ? 2 : m.currentInnings }));
    setUi({ striker: '', nonStriker: '', bowler: '', pendingNewBatter: null });
  };

  const swapCrease = () => setUi({ striker: nonStriker, nonStriker: striker });

  const usedNames = new Set(view.batting.map(b => b.name));
  const available = batTeam.players.filter(p => !usedNames.has(p.name));
  const partnership = partnershipOf(view.events);

  return (
    <>
      {/* ---------- Scoreboard hero ---------- */}
      <div className="scoreboard">
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="innings-tag">
              <span className="live-dot" /> Innings {inn} · {batTeamName} batting
              {oversDone || allOut ? ' · innings over' : ''}
            </div>
            <div className="score">
              {view.runs}<span style={{ color: '#9fd8bd' }}>/{view.wickets}</span>{' '}
              <span className="ov">({view.overs} ov)</span>
            </div>
            <div className="sub">
              CRR <b className="crr">{view.runRate}</b>
              {target != null && ballsLeft > 0 && view.runs < target && (
                <> · need <b style={{ color: '#fff' }}>{need}</b> off <b style={{ color: '#fff' }}>{ballsLeft}</b> · RRR <b className="crr">{rrr}</b></>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right', zIndex: 1 }}>
            <div className="tag blue">{match.venue || 'no venue set'}</div>
            <div className="tag" style={{ marginTop: 6 }}>{match.dateTime?.replace('T', ' ') || ''}</div>
            {match.result && <div className="tag green" style={{ marginTop: 6 }}>{match.result}</div>}
          </div>
        </div>

        <div className="crease">
          <span className="crease-chip striker">🏏 <b>{striker || '—'}</b> *</span>
          <span className="crease-chip">🏏 {nonStriker || '—'}</span>
          <span className="crease-chip">⚽ <b>{bowler || '—'}</b></span>
          <span className="crease-chip">Extras {view.extras.total} · wd {view.extras.wd} · nb {view.extras.nb} · b {view.extras.b} · lb {view.extras.lb}</span>
        </div>

        <div className="partnership-box">
          <span className="pnum">🤝 {partnership.runs} ({partnership.balls})</span>
          <span>current partnership{partnership.batters.length === 2 ? `: ${partnership.batters.join(' & ')}` : ''}</span>
        </div>

        <div className="innings-pills">
          {v1.legalBalls > 0 && (
            <div className={`innings-pill ${inn === 1 ? 'current' : ''}`}>
              1st: <b>{v1.team1?.name || ''}</b> — {battingTeamFor(match, 1)} {v1.runs}/{v1.wickets} ({v1.overs})
            </div>
          )}
          {view.legalBalls > 0 && (
            <div className="innings-pill current">Now: {batTeamName} {view.runs}/{view.wickets} ({view.overs})</div>
          )}
        </div>
      </div>

      {/* ---------- Innings break ---------- */}
      {(oversDone || allOut) && inn === 1 && (
        <div className="notice warn">
          🏁 Innings 1 complete: {view.runs}/{view.wickets} in {view.overs} overs. Target for {bowlTeamName}: <b>{view.runs + 1}</b>.
          <button className="primary small" style={{ marginLeft: 10 }}
            onClick={() => { updateMatch(match.id, m => refreshResult({ ...m, currentInnings: 2 })); setUi({ striker: '', nonStriker: '', bowler: '', pendingNewBatter: null }); }}>
            ▶ Start Innings 2
          </button>
        </div>
      )}
      {match.status === 'completed' && <div className="notice green">🏆 {match.result}</div>}

      {/* ---------- Ball input ---------- */}
      {match.status !== 'completed' && !(oversDone || allOut) && (
        <div className="panel">
          <h2>
            Record Ball
            <span className="tag yellow">
              next: Ov {Math.floor(legal / 6) + 1} · Ball {(legal % 6) + 1}
            </span>
            {repeatWarn && <span className="tag red">⚠ {bowler} bowled the previous over</span>}
          </h2>

          <div className="grid grid-3">
            <div>
              <label>Striker</label>
              <select value={striker} onChange={e => setUi({ striker: e.target.value })}>
                <option value="">— select —</option>
                {batTeam.players.map(p => <option key={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label>Non-striker</label>
              <select value={nonStriker} onChange={e => setUi({ nonStriker: e.target.value })}>
                <option value="">— select —</option>
                {batTeam.players.map(p => <option key={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label>Bowler ({bowlTeamName})</label>
              <select value={bowler} onChange={e => setUi({ bowler: e.target.value })}>
                <option value="">— select —</option>
                {bowlTeam.players.map(p => <option key={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div className="run-pad">
            {[0, 1, 2, 3, 4, 6].map(r => (
              <button key={r} className="run-btn" onClick={() => record({ runsOffBat: r })}>
                {r}<small>{['dot', 'single', 'double', 'triple', 'four', '', '', 'six'][r] || ''}</small>
              </button>
            ))}
            <button className="run-btn wicket" onClick={() => setWicketOpen(true)}>W<small>wicket</small></button>
            <button className="run-btn extra" onClick={() => record({ extraType: 'wd', extraRuns: 1 })}>wd<small>wide</small></button>
            <button className="run-btn extra" onClick={() => record({ extraType: 'nb', extraRuns: 1 })}>nb<small>no ball</small></button>
            <button className="run-btn extra" onClick={() => setExtraKind('b')}>b<small>bye</small></button>
            <button className="run-btn extra" onClick={() => setExtraKind('lb')}>lb<small>leg bye</small></button>
            <button className="run-btn" title="Swap ends" onClick={swapCrease}>⇄<small>swap</small></button>
            <button className="run-btn danger" title="Undo last ball" onClick={undo}>↩<small>undo</small></button>
            <button className="run-btn" title="End innings early" onClick={endInningsNow}>🏁<small>end inn</small></button>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '0.8rem', margin: '10px 0 0' }}>
            Wide/no-ball don't count as balls faced. Byes/leg-byes count as balls faced; runs go to the team.
          </p>
        </div>
      )}

      {/* ---------- Next batter after wicket ---------- */}
      {ui.pendingNewBatter && (
        <div className="panel" style={{ borderColor: 'rgba(248,113,113,0.5)' }}>
          <h2 style={{ color: 'var(--danger)' }}>🧤 {ui.pendingNewBatter.outName} is out — next batter</h2>
          {available.length > 0 ? (
            <div className="row">
              <div>
                <label>Comes in at the {ui.pendingNewBatter.end === 'striker' ? 'striker' : 'non-striker'} end</label>
                <select defaultValue=""
                  onChange={e => e.target.value && setUi({ [ui.pendingNewBatter.end]: e.target.value, pendingNewBatter: null })}>
                  <option value="">— select next batter —</option>
                  {available.map(p => <option key={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <p className="notice warn">No batters left — innings over.</p>
          )}
        </div>
      )}

      {/* ---------- Over strip ---------- */}
      <div className="panel">
        <h2>Over by over</h2>
        {view.oversList.length === 0 && <p style={{ color: 'var(--muted)' }}>No balls recorded yet.</p>}
        <div className="over-strip">
          {[...view.oversList].reverse().slice(0, 12).map(o => (
            <div className="over-chip" key={o.no}>
              <span className="ov">Ov {o.no} · <b>{o.bowler}</b></span>
              <div>
                {o.balls.map((b, i) => (
                  <span key={i} className={`ball ${ballClass(b)}`} title={commentaryText(b)}>
                    {ballLabel(b)}
                  </span>
                ))}
              </div>
              <span className="ov" style={{ marginTop: 4 }}>
                {o.runs} run{o.runs === 1 ? '' : 's'}{o.wickets ? ` · ${o.wickets}w` : ''}{o.maiden ? ' · maiden 🌟' : ''}
              </span>
            </div>
          ))}
        </div>
        {view.fallOfWickets.length > 0 && (
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: 12 }}>
            <b>Fall of wickets:</b> {view.fallOfWickets.map(f => `${f.wkt}-${f.runs} (${f.batter} ${f.over})`).join(', ')}
          </p>
        )}
      </div>

      {/* ---------- Commentary ---------- */}
      {view.events.length > 0 && (
        <div className="panel">
          <h2>Ball-by-ball commentary</h2>
          <div className="commentary">
            {[...view.events].reverse().map((e, i) => (
              <div className="comm-row" key={i}>
                <span className="comm-over">{e.over}.{e.ball}</span>
                <span className={`comm-text ${e.wicket ? 'W' : (e.runsOffBat === 4 ? 'w4' : e.runsOffBat === 6 ? 'w6' : '')}`}>
                  {commentaryText(e)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {wicketOpen && (
        <WicketModal
          striker={striker} nonStriker={nonStriker}
          onClose={() => setWicketOpen(false)}
          onConfirm={(w) => { record({ wicket: w }); setWicketOpen(false); }}
        />
      )}
      {extraKind && (
        <ExtraModal
          kind={extraKind}
          onClose={() => setExtraKind(null)}
          onConfirm={(r) => {
            record(extraKind === 'wd'
              ? { extraType: 'wd', extraRuns: r }
              : extraKind === 'nb'
                ? { extraType: 'nb', extraRuns: 1, runsOffBat: r - 1 }
                : { extraType: extraKind, extraRuns: r });
            setExtraKind(null);
          }}
        />
      )}
    </>
  );
}


