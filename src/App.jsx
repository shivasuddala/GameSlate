import React, { useEffect, useMemo, useState } from 'react';
import MatchSetup from './components/MatchSetup.jsx';
import LiveScoring from './components/LiveScoring.jsx';
import ScorecardView from './components/ScorecardView.jsx';
import PlayersView from './components/PlayersView.jsx';
import LiveMatches from './components/LiveMatches.jsx';
import { saveState, loadState } from './lib/storage.js';

const TABS = [
  ['setup', '＋', 'New match', 'Set up'],
  ['score', '◉', 'Live scoring', 'Score'],
  ['card', '▤', 'Scorecard', 'Cards'],
  ['players', '♙', 'Players & career', 'Players'],
  ['live', '◌', 'Live matches', 'Live'],
];

export default function App() {
  const restored = useMemo(() => loadState(), []);
  const [matches, setMatches] = useState(restored?.matches || []);
  const [teams, setTeams] = useState(restored?.teams || []);
  const [activeId, setActiveId] = useState(restored?.activeId || null);
  const [tab, setTab] = useState('live');
  const [flash, setFlash] = useState('');

  useEffect(() => { saveState({ matches, teams, activeId }); }, [matches, teams, activeId]);

  const activeMatch = matches.find(match => match.id === activeId) || null;
  const updateMatch = (id, fn) => setMatches(previous => previous.map(match => match.id === id ? fn(match) : match));
  const say = (message) => { setFlash(message); window.setTimeout(() => setFlash(''), 2800); };

  const onExport = async () => {
    if (!matches.length && !teams.length) return say('Nothing to export yet.');
    const { exportWorkbook } = await import('./lib/excel.js');
    exportWorkbook(matches, teams);
    say('Your workbook is ready.');
  };

  const onImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const { importWorkbook } = await import('./lib/excel.js');
      const imported = await importWorkbook(file);
      setMatches(imported.matches);
      setTeams(imported.teams);
      const active = imported.matches.find(match => match.status !== 'completed') || imported.matches[0];
      setActiveId(active?.id || null);
      say(`Imported ${imported.matches.length} match(es) and ${imported.teams.length} team(s).`);
    } catch (error) {
      say(`Import failed: ${error.message}`);
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="#home" aria-label="GameSlate home" onClick={event => { event.preventDefault(); setTab('live'); }}>
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span className="brand-word">Game<span>Slate</span><small>THE GAME, IN PLAY</small></span>
        </a>
        <nav className="tabs" aria-label="Main navigation">
          {TABS.map(([id, icon, label]) => (
            <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}>
              <span className="tab-icon" aria-hidden="true">{icon}</span><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <span className="keyless-pill"><span /> Live scores · free</span>
          <button className="header-button" onClick={onExport} title="Export your match database">⇩ <span>Export</span></button>
          <label className="import-label" title="Import a match database">
            <input type="file" accept=".xlsx,.xls" onChange={onImport} />
            <span className="header-button">⇧ <span>Import</span></span>
          </label>
        </div>
      </header>

      {flash && <div className="toast" role="status">{flash}</div>}

      <main>
        {tab === 'setup' && <MatchSetup matches={matches} teams={teams} activeMatch={activeMatch} setMatches={setMatches} setTeams={setTeams} setActiveId={setActiveId} updateMatch={updateMatch} onGoScore={() => setTab('score')} />}
        {tab === 'score' && <LiveScoring match={activeMatch} updateMatch={updateMatch} matches={matches} setActiveId={setActiveId} />}
        {tab === 'card' && <ScorecardView match={activeMatch} matches={matches} setActiveId={setActiveId} />}
        {tab === 'players' && <PlayersView matches={matches} teams={teams} setTeams={setTeams} />}
        {tab === 'live' && <LiveMatches />}
        <footer className="footer-note">
          <span>Made for the love of the game.</span>
          <span>Match data stays on this device · Back it up anytime with Excel</span>
        </footer>
      </main>
      <div className="mobile-nav" aria-label="Mobile navigation">
        {TABS.map(([id, icon, , mobile]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}>
            <span aria-hidden="true">{icon}</span><small>{mobile}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

