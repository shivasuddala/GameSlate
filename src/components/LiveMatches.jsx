import React, { useCallback, useEffect, useState } from 'react';
import { fetchCurrentMatches } from '../lib/liveApi.js';

const REFRESH_MS = 60_000;

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  }).format(date);
}

export default function LiveMatches() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [filterLive, setFilterLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async (signal) => {
    setStatus(current => current === 'idle' || current === 'error' ? 'loading' : current);
    setError('');
    try {
      const data = await fetchCurrentMatches({ signal });
      setItems(data);
      setLastUpdated(new Date());
      setStatus('ok');
    } catch (cause) {
      if (cause.name === 'AbortError') return;
      setError(cause.message || 'Could not reach the live score source.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    const timer = window.setInterval(() => load(controller.signal), REFRESH_MS);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [load]);

  const shown = filterLive ? items.filter(match => match.live) : items;

  return (
    <section className="live-center" aria-labelledby="live-title">
      <div className="live-heading">
        <div>
          <span className="eyebrow">CRICKET · LIVE CENTRE</span>
          <h2 id="live-title">The matchday, at a glance.</h2>
          <p>Live scores and fixtures, refreshed every minute. No account or API key required.</p>
        </div>
        <div className="live-tools">
          {lastUpdated && <span className="updated-at">Updated {lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>}
          <button className="refresh-button" onClick={() => load()} disabled={status === 'loading'}>
            <span aria-hidden="true">↻</span> {status === 'loading' ? 'Updating' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="live-toolbar">
        <div className="live-filter" role="group" aria-label="Filter matches">
          <button className={!filterLive ? 'selected' : ''} onClick={() => setFilterLive(false)}>All matches <span>{items.length}</span></button>
          <button className={filterLive ? 'selected' : ''} onClick={() => setFilterLive(true)}>Live now <span>{items.filter(match => match.live).length}</span></button>
        </div>
        <span className="source-label"><span className="source-dot" /> Free public score feed</span>
      </div>

      {status === 'error' && (
        <div className="feed-message feed-error" role="alert">
          <span className="feed-message-icon" aria-hidden="true">!</span>
          <div><strong>Scores could not be refreshed</strong><p>{error}. Your saved match data is safe; try again in a moment.</p></div>
          <button onClick={() => load()}>Try again</button>
        </div>
      )}

      {status === 'loading' && items.length === 0 && (
        <div className="match-grid" aria-label="Loading matches">
          {[1, 2, 3].map(n => <div className="match-skeleton" key={n}><span /><span /><span /></div>)}
        </div>
      )}

      {status === 'ok' && shown.length > 0 && (
        <div className="match-grid">
          {shown.map(match => (
            <article className={`match-card ${match.live ? 'is-live' : ''}`} key={match.id}>
              <div className="match-card-top">
                <span className={`match-state ${match.live ? 'live' : ''}`}>
                  {match.live && <span className="live-dot" />}{match.live ? 'LIVE' : 'MATCH'}
                </span>
                <span className="match-format">{match.matchType}</span>
              </div>
              <h3>{match.name}</h3>
              <p className="match-status">{match.status}</p>
              <div className="match-scores">
                {(match.score || []).length > 0 ? match.score.map((score, index) => (
                  <div className="match-score-row" key={`${match.id}-${index}`}>
                    <div><b>{score.team}</b>{score.innings?.length > 0 && <small>{score.innings.map((inn, i) => inn.runs != null ? `${i + 1}${i + 1 === 1 ? 'st' : i + 1 === 2 ? 'nd' : 'th'} innings ${inn.runs}${inn.wickets != null ? `/${inn.wickets}` : ''}${inn.overs ? ` (${inn.overs} ov)` : ''}` : '').filter(Boolean).join(' · ')}</small>}</div>
                    <strong>{score.runs === '' ? '—' : score.runs}{score.wickets !== '' && score.wickets != null ? `/${score.wickets}` : ''}</strong>
                  </div>
                )) : (
                  <div className="match-teams">{(match.teams || []).join('  ·  ') || 'Teams to be confirmed'}</div>
                )}
              </div>
              <div className="match-card-foot">
                <span>{match.venue || 'Venue to be confirmed'}</span>
                <span>{formatDate(match.date)}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {status === 'ok' && shown.length === 0 && (
        <div className="empty-matches">
          <span className="empty-ball" aria-hidden="true">🏏</span>
          <h3>{filterLive ? 'No live matches right now' : 'No matches on the board'}</h3>
          <p>{filterLive ? 'Switch to all matches to see upcoming fixtures and recent results.' : 'There are no fixtures available from the score feed right now. Check back closer to match time.'}</p>
          {filterLive && <button onClick={() => setFilterLive(false)}>Show all matches</button>}
        </div>
      )}

      <p className="feed-attribution">Scores are supplied by ESPN’s publicly accessible feed. It is an unofficial feed and its availability or coverage can change.</p>
    </section>
  );
}

