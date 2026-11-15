import React, { useEffect, useState } from 'react';
import { fetchCurrentMatches, DEMO_MATCHES, PROVIDERS } from '../lib/liveApi.js';
import { loadApiKey, saveApiKey } from '../lib/storage.js';

export default function LiveMatches() {
  const [apiKey, setApiKey] = useState(loadApiKey());
  const [provider, setProvider] = useState('cricapi');
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | error | ok
  const [err, setErr] = useState('');
  const [filterLive, setFilterLive] = useState(false);

  const load = async () => {
    if (!apiKey.trim()) {
      setStatus('error');
      setErr('No API key saved. Get a free key (cricapi.com or cricketdata.org) and save it via the 🔑 API Key button.');
      return;
    }
    setStatus('loading');
    setErr('');
    try {
      const data = await fetchCurrentMatches(provider, apiKey.trim());
      setItems(data);
      setStatus('ok');
    } catch (e) {
      setStatus('error');
      setErr(`${e.message}. Note: the free tier has daily limits and the browser must reach the API directly (CORS). Try the other provider or check your key.`);
    }
  };

  useEffect(() => { if (status === 'idle') setItems(DEMO_MATCHES); }, []); // eslint-disable-line

  const shown = filterLive ? items.filter(m => m.status?.includes('won') || m.score?.length) : items;

  return (
    <>
      <div className="panel">
        <h2>Live Matches — free APIs</h2>
        <div className="row">
          <div>
            <label>Provider</label>
            <select value={provider} onChange={e => setProvider(e.target.value)}>
              {Object.entries(PROVIDERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label>API key (free tier)</label>
            <input type="password" value={apiKey} placeholder="paste key…"
              onChange={e => setApiKey(e.target.value)} />
          </div>
          <div style={{ flex: '0 0 auto' }}>
            <button className="primary" onClick={() => { saveApiKey(apiKey.trim()); load(); }}>
              {status === 'loading' ? 'Loading…' : '💾 Save key & fetch'}
            </button>
          </div>
          <div style={{ flex: '0 0 auto' }}>
            <label style={{ visibility: 'hidden' }}>f</label>
            <button onClick={() => setFilterLive(f => !f)}>
              {filterLive ? 'show all' : 'show in-play only'}
            </button>
          </div>
        </div>

        {status === 'error' && <div className="notice warn" style={{ marginTop: 10 }}>⚠ {err}</div>}
        {!apiKey && (
          <div className="notice info" style={{ marginTop: 10 }}>
            Free keys: <b>cricapi.com</b> (Web dashboard → get key) or <b>cricketdata.org</b>.
            The key is stored only in this browser's localStorage. Below are demo matches until you fetch live data.
          </div>
        )}
      </div>

      {shown.map(m => (
        <div className="live-card" key={m.id}>
          <h4>
            {m.demo && <span className="badge-demo">DEMO</span>} {m.name}
            <span className="tag" style={{ marginLeft: 8 }}>{m.matchType?.toUpperCase()}</span>
          </h4>
          <div className="status">{m.status}</div>
          <div className="scoreline">
            {m.venue && <>📍 {m.venue} · </>}
            {m.date && new Date(m.date).toLocaleString()}
          </div>
          {(m.score || []).map((s, i) => (
            <div className="scoreline" key={i}>
              <b>{s.team}</b>: {s.runs}{s.wickets !== '' ? `/${s.wickets}` : ''} in {s.overs} ov
            </div>
          ))}
          {(m.teams || []).length > 0 && (
            <div className="scoreline">{m.teams.join(' vs ')}</div>
          )}
        </div>
      ))}

      {status === 'ok' && items.length === 0 && (
        <div className="panel"><p style={{ color: 'var(--muted)' }}>No matches returned right now.</p></div>
      )}
    </>
  );
}
