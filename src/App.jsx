import React, { useEffect, useMemo, useState } from 'react';
import MatchSetup from './components/MatchSetup.jsx';
import LiveScoring, { ApiKeyModal } from './components/LiveScoring.jsx';
import ScorecardView from './components/ScorecardView.jsx';
import PlayersView from './components/PlayersView.jsx';
import LiveMatches from './components/LiveMatches.jsx';
import { saveState, loadState, saveApiKey } from './lib/storage.js';

const TABS = [
  ['setup', '📋', 'Match Setup'],
  ['score', '🏏', 'Live Scoring'],
  ['card', '📊', 'Scorecard'],
  ['players', '👤', 'Players & Career'],
  ['live', '📡', 'Live Matches'],
];

export default function App() {
  const restored = useMemo(() => loadState(), []);
  const [matches, setMatches] = useState(restored?.matches || []);
  const [teams, setTeams] = useState(restored?.teams || []);
  const [activeId, setActiveId] = useState(restored?.activeId || null);
  const [tab, setTab] = useState('setup');
  const [flash, setFlash] = useState('');
  const [keyModal, setKeyModal] = useState(false);

  useEffect(() => {
    saveState({ matches, teams, activeId });
  }, [matches, teams, activeId]);

  const activeMatch = matches.find(m => m.id === activeId) || null;

  const updateMatch = (id, fn) => setMatches(prev =>
    prev.map(m => (m.id === id ? fn(m) : m)));

  const say = (msg) => { setFlash(msg); setTimeout(() => setFlash(''), 2500); };

  // ---- Excel as DB ----------------------------------------------------
  const onExport = async () => {
    if (!matches.length && !teams.length) return say('Nothing to export yet.');
    const { exportWorkbook } = await import('./lib/excel.js');
    exportWorkbook(matches, teams);
    say('Workbook exported — keep it as your match database.');
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { importWorkbook } = await import('./lib/excel.js');
      const { matches: ms, teams: ts } = await importWorkbook(file);
      setMatches(ms);
      setTeams(ts);
      const live = ms.find(m => m.status !== 'completed');
      setActiveId(live ? live.id : (ms[0]?.id || null));
      say(`Imported ${ms.length} match(es), ${ts.length} team(s).`);
    } catch (err) {
      say(`Import failed: ${err.message}`);
    }
  };

  const onApiKey = () => setKeyModal(true);

  return (
    <>
      <header className="app-header">
        <h1><span className="emoji">🏟️</span> Game<span>Slate</span></h1>
        <div className="header-actions">
          <button onClick={onExport}>⬇ Export Excel DB</button>
          <label className="small" style={{ display: 'inline' }}>
            <input type="file" accept=".xlsx,.xls" onChange={onImport} style={{ display: 'none' }} id="importFile" />
            <button className="small" onClick={() => document.getElementById('importFile').click()}>⬆ Import Excel DB</button>
          </label>
          <button onClick={onApiKey}>🔑 API Key</button>
        </div>
      </header>

      {flash && <div className="notice info" style={{ margin: '10px 20px 0' }}>{flash}</div>}

      <nav className="tabs">
        {TABS.map(([id, icon, label]) => (
          <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {icon} {label}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'setup' && (
          <MatchSetup
            matches={matches} teams={teams} activeMatch={activeMatch}
            setMatches={setMatches} setTeams={setTeams}
            setActiveId={setActiveId} updateMatch={updateMatch}
            onGoScore={() => setTab('score')}
          />
        )}
        {tab === 'score' && (
          <LiveScoring
            match={activeMatch} updateMatch={updateMatch}
            matches={matches} setActiveId={setActiveId}
          />
        )}
        {tab === 'card' && (
          <ScorecardView match={activeMatch} matches={matches} setActiveId={setActiveId} />
        )}
        {tab === 'players' && <PlayersView matches={matches} teams={teams} setTeams={setTeams} />}
        {tab === 'live' && <LiveMatches updateMatch={updateMatch} matches={matches} />}
        <p className="footer-note">
          GameSlate — scoreboard & match stats. Data persists in this browser; export the
          Excel workbook to back up or continue on another platform. Live data via free
          APIs (bring your own free key). Built multi-sport ready.
        </p>
      </main>

      {keyModal && (
        <ApiKeyModal
          initial={loadApiKey()}
          onClose={() => setKeyModal(false)}
          onSave={(k) => { saveApiKey(k); setKeyModal(false); say('API key saved locally.'); }}
        />
      )}
    </>
  );
}
