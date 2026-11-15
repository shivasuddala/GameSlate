import React, { useEffect, useMemo, useState } from 'react';
import { createMatch, createPlayer, createTeam, deriveInnings, eventsOfInnings, newId, refreshResult } from '../lib/scoring.js';

const ROLES = ['Batter', 'Bowler', 'All-rounder', 'Wicket-keeper', 'Wicket-keeper batter'];
const BAT_STYLES = ['RHB', 'LHB'];
const BOWL_STYLES = ['—', 'Right-arm fast', 'Right-arm medium', 'Right-arm off-spin', 'Right-arm leg-spin', 'Left-arm fast', 'Left-arm medium', 'Left-arm orthodox', 'Left-arm wrist-spin'];
const emptyLeagueForm = { name: '', season: new Date().getFullYear().toString(), overs: 20 };
const emptyFixtureForm = { team1Id: '', team2Id: '', dateTime: '', venue: '', round: 'League match', overs: 20 };

const teamName = (teams, id) => teams.find(team => team.id === id)?.name || 'Unknown team';
const dateLabel = value => value ? new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : 'Time to be confirmed';

function buildStandings(league, teams, matches) {
  const rows = new Map(league.teamIds.map(id => [id, { id, name: teamName(teams, id), played: 0, won: 0, lost: 0, tied: 0, points: 0, runsFor: 0, runsAgainst: 0 }]));
  for (const fixture of league.fixtures) {
    const match = matches.find(item => item.id === fixture.matchId);
    if (!match || match.status !== 'completed') continue;
    const one = rows.get(fixture.team1Id), two = rows.get(fixture.team2Id);
    if (!one || !two) continue;
    one.played += 1; two.played += 1;
    let inningsOneTeam = match.team1.name;
    let inningsTwoTeam = match.team2.name;
    try {
      const first = deriveInnings(eventsOfInnings(match, 1));
      const second = deriveInnings(eventsOfInnings(match, 2));
      const tossWinner = match.tossWinner || match.team1.name;
      inningsOneTeam = match.tossDecision === 'bowl' ? (tossWinner === match.team1.name ? match.team2.name : match.team1.name) : tossWinner;
      inningsTwoTeam = inningsOneTeam === match.team1.name ? match.team2.name : match.team1.name;
      const scores = new Map([[inningsOneTeam, first.runs], [inningsTwoTeam, second.runs]]);
      one.runsFor += scores.get(one.name) || 0; one.runsAgainst += scores.get(two.name) || 0;
      two.runsFor += scores.get(two.name) || 0; two.runsAgainst += scores.get(one.name) || 0;
      const winner = second.runs === first.runs ? null : (second.runs > first.runs ? inningsTwoTeam : inningsOneTeam);
      if (!winner) { one.tied += 1; two.tied += 1; one.points += 1; two.points += 1; }
      else {
        const winRow = winner === one.name ? one : two;
        const loseRow = winRow === one ? two : one;
        winRow.won += 1; winRow.points += 2; loseRow.lost += 1;
      }
    } catch { /* A malformed imported card should not hide the rest of the table. */ }
  }
  return [...rows.values()].sort((a, b) => b.points - a.points || (b.runsFor - b.runsAgainst) - (a.runsFor - a.runsAgainst) || a.name.localeCompare(b.name));
}

function RosterCard({ team, onChange }) {
  const [player, setPlayer] = useState({ name: '', role: 'All-rounder', battingStyle: 'RHB', bowlingStyle: '—', reserve: false });
  const setPlayerField = (id, field, value) => onChange({ ...team, players: team.players.map(item => item.id === id ? { ...item, [field]: value } : item) });
  const addPlayer = () => {
    if (!player.name.trim()) return;
    const created = createPlayer(player.name.trim(), player.role, player.battingStyle, player.bowlingStyle === '—' ? '' : player.bowlingStyle);
    onChange({ ...team, players: [...team.players, { ...created, isReserve: player.reserve }] });
    setPlayer({ ...player, name: '' });
  };

  return (
    <article className="squad-card">
      <div className="squad-card-heading">
        <div className="squad-name-editor"><span className="eyebrow">SQUAD</span><input aria-label="Team name" value={team.name} onChange={e => onChange({ ...team, name: e.target.value })} /></div>
        <span className="tag green">{team.players.filter(item => !item.isReserve).length} players · {team.players.filter(item => item.isReserve).length} reserves</span>
      </div>
      <div className="roster-form">
        <label className="roster-name-field"><span>Player name</span><input value={player.name} onChange={e => setPlayer({ ...player, name: e.target.value })} onKeyDown={e => e.key === 'Enter' && addPlayer()} placeholder="Add a player" /></label>
        <label><span>Role</span><select value={player.role} onChange={e => setPlayer({ ...player, role: e.target.value })}>{ROLES.map(role => <option key={role}>{role}</option>)}</select></label>
        <label><span>Batting</span><select value={player.battingStyle} onChange={e => setPlayer({ ...player, battingStyle: e.target.value })}>{BAT_STYLES.map(style => <option key={style}>{style}</option>)}</select></label>
        <label><span>Bowling</span><select value={player.bowlingStyle} onChange={e => setPlayer({ ...player, bowlingStyle: e.target.value })}>{BOWL_STYLES.map(style => <option key={style}>{style}</option>)}</select></label>
        <label className="reserve-option"><input type="checkbox" checked={player.reserve} onChange={e => setPlayer({ ...player, reserve: e.target.checked })} /> Reserve</label>
        <button className="primary" onClick={addPlayer}>Add player</button>
      </div>
      {team.players.length === 0 ? <p className="muted-copy">Add your playing squad and bench players here.</p> : (
        <div className="squad-list">
          {team.players.map((item, index) => (
            <div className="squad-row" key={item.id}>
              <span className="squad-number">{String(index + 1).padStart(2, '0')}</span>
              <input aria-label={`${item.name} player name`} value={item.name} onChange={e => setPlayerField(item.id, 'name', e.target.value)} />
              <select aria-label={`${item.name} role`} value={item.role} onChange={e => setPlayerField(item.id, 'role', e.target.value)}>{ROLES.map(role => <option key={role}>{role}</option>)}</select>
              <label className={`squad-type ${item.isReserve ? 'reserve' : ''}`}><input type="checkbox" checked={!!item.isReserve} onChange={e => setPlayerField(item.id, 'isReserve', e.target.checked)} /><span>{item.isReserve ? 'Reserve' : 'Squad'}</span></label>
              <button className="small danger" aria-label={`Remove ${item.name}`} onClick={() => onChange({ ...team, players: team.players.filter(p => p.id !== item.id) })}>×</button>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function LineupModal({ fixture, teams, onClose, onStart }) {
  const first = teams.find(team => team.id === fixture.team1Id);
  const second = teams.find(team => team.id === fixture.team2Id);
  const defaultXI = team => {
    const regular = team.players.filter(player => !player.isReserve);
    return (regular.length ? regular : team.players).slice(0, 11).map(player => player.id);
  };
  const [lineups, setLineups] = useState(() => ({ [first?.id]: defaultXI(first || { players: [] }), [second?.id]: defaultXI(second || { players: [] }) }));
  const [tossWinner, setTossWinner] = useState(first?.id || '');
  const [tossDecision, setTossDecision] = useState('bat');
  const toggle = (team, id) => setLineups(previous => {
    const current = previous[team.id] || [];
    if (current.includes(id)) return { ...previous, [team.id]: current.filter(item => item !== id) };
    if (current.length >= 11) return previous;
    return { ...previous, [team.id]: [...current, id] };
  });
  const valid = first && second && (lineups[first.id]?.length || 0) >= 2 && (lineups[second.id]?.length || 0) >= 2;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal league-start-modal" role="dialog" aria-modal="true" aria-labelledby="start-fixture-title" onClick={e => e.stopPropagation()}>
        <span className="eyebrow">MATCH DAY · {dateLabel(fixture.dateTime)}</span>
        <h3 id="start-fixture-title">Confirm playing XIs</h3>
        <p className="muted-copy">Regular squad players are selected automatically. Choose up to 11 players per side; reserves start unchecked.</p>
        <div className="lineup-columns">
          {[first, second].filter(Boolean).map(team => (
            <fieldset className="lineup-team" key={team.id}>
              <legend>{team.name} <span>{lineups[team.id]?.length || 0}/11</span></legend>
              {team.players.length === 0 && <p className="muted-copy">Add players to this squad before starting.</p>}
              {team.players.map(player => (
                <label className="lineup-player" key={player.id}>
                  <input type="checkbox" checked={(lineups[team.id] || []).includes(player.id)} disabled={!(lineups[team.id] || []).includes(player.id) && (lineups[team.id] || []).length >= 11} onChange={() => toggle(team, player.id)} />
                  <span>{player.name || 'Unnamed player'}<small>{player.role}{player.isReserve ? ' · Reserve' : ''}</small></span>
                </label>
              ))}
            </fieldset>
          ))}
        </div>
        <div className="lineup-toss">
          <label><span>Toss won by</span><select value={tossWinner} onChange={e => setTossWinner(e.target.value)}><option value={first?.id}>{first?.name}</option><option value={second?.id}>{second?.name}</option></select></label>
          <label><span>Choose to</span><select value={tossDecision} onChange={e => setTossDecision(e.target.value)}><option value="bat">Bat first</option><option value="bowl">Bowl first</option></select></label>
        </div>
        {(!valid) && <p className="lineup-warning">Select at least 2 players for each playing XI.</p>}
        <div className="modal-actions"><button onClick={onClose}>Cancel</button><button className="primary" disabled={!valid} onClick={() => onStart({ lineups, tossWinner, tossDecision })}>Start match</button></div>
      </div>
    </div>
  );
}

export default function LeagueView({ leagues, setLeagues, teams, setTeams, matches, setMatches, setActiveId, onGoScore, onGoCard }) {
  const [activeLeagueId, setActiveLeagueId] = useState(leagues[0]?.id || '');
  const league = leagues.find(item => item.id === activeLeagueId) || leagues[0] || null;
  const [view, setView] = useState('overview');
  const [leagueForm, setLeagueForm] = useState(emptyLeagueForm);
  const [showCreateLeague, setShowCreateLeague] = useState(false);
  const [teamNameInput, setTeamNameInput] = useState('');
  const [existingTeamId, setExistingTeamId] = useState('');
  const [fixtureForm, setFixtureForm] = useState(emptyFixtureForm);
  const [launchFixture, setLaunchFixture] = useState(null);
  const [notice, setNotice] = useState('');

  const updateLeague = (id, update) => setLeagues(previous => previous.map(item => item.id === id ? update(item) : item));
  const leagueTeams = useMemo(() => league ? league.teamIds.map(id => teams.find(team => team.id === id)).filter(Boolean) : [], [league, teams]);
  const standings = useMemo(() => league ? buildStandings(league, teams, matches) : [], [league, teams, matches]);
  const fixtures = useMemo(() => league ? [...league.fixtures].sort((a, b) => new Date(a.dateTime || 0) - new Date(b.dateTime || 0)) : [], [league]);
  const played = fixtures.filter(fixture => matches.find(match => match.id === fixture.matchId)?.status === 'completed').length;
  const liveCount = fixtures.filter(fixture => matches.find(match => match.id === fixture.matchId)?.status === 'live').length;

  useEffect(() => {
    setLeagues(previous => {
      let changed = false;
      const next = previous.map(item => ({
        ...item,
        fixtures: (item.fixtures || []).map(fixture => {
          const match = matches.find(entry => entry.id === fixture.matchId);
          if (!match) return fixture;
          const status = match.status === 'completed' ? 'completed' : match.status === 'live' ? 'live' : fixture.status;
          if (status === fixture.status) return fixture;
          changed = true;
          return { ...fixture, status };
        }),
      }));
      return changed ? next : previous;
    });
  }, [matches, setLeagues]);

  const createLeague = () => {
    if (!leagueForm.name.trim()) return setNotice('Give your league a name to continue.');
    const created = { id: newId(), name: leagueForm.name.trim(), season: leagueForm.season.trim(), overs: Number(leagueForm.overs) || 20, teamIds: [], fixtures: [] };
    setLeagues(previous => [created, ...previous]);
    setActiveLeagueId(created.id);
    setLeagueForm(emptyLeagueForm);
    setShowCreateLeague(false);
    setNotice('League created. Add teams and build your schedule.');
  };

  const linkTeam = id => {
    if (!id || league.teamIds.includes(id)) return;
    updateLeague(league.id, current => ({ ...current, teamIds: [...current.teamIds, id] }));
    setExistingTeamId('');
  };

  const addTeam = () => {
    const name = teamNameInput.trim();
    if (!name) return;
    if (teams.some(team => team.name.toLowerCase() === name.toLowerCase())) return setNotice('A team with that name already exists. Add the saved team to this league instead.');
    const team = createTeam(name, []);
    setTeams(previous => [...previous, team]);
    updateLeague(league.id, current => ({ ...current, teamIds: [...current.teamIds, team.id] }));
    setTeamNameInput('');
  };

  const addFixture = () => {
    if (!fixtureForm.team1Id || !fixtureForm.team2Id || fixtureForm.team1Id === fixtureForm.team2Id) return setNotice('Choose two different teams for the fixture.');
    if (!fixtureForm.dateTime) return setNotice('Choose a match day and start time.');
    const fixture = { id: newId(), ...fixtureForm, overs: Number(fixtureForm.overs) || league.overs || 20, status: 'scheduled', matchId: '' };
    updateLeague(league.id, current => ({ ...current, fixtures: [...current.fixtures, fixture] }));
    setFixtureForm({ ...emptyFixtureForm, overs: league.overs || 20, team1Id: '', team2Id: '' });
    setNotice('Fixture added to the schedule.');
  };

  const openFixture = fixture => {
    const existingMatch = matches.find(match => match.id === fixture.matchId);
    if (existingMatch) { setActiveId(existingMatch.id); (existingMatch.status === 'completed' ? onGoCard : onGoScore)(); }
    else setLaunchFixture(fixture);
  };

  const startMatch = ({ lineups, tossWinner, tossDecision }) => {
    const fixture = launchFixture;
    const roster1 = teams.find(team => team.id === fixture.team1Id);
    const roster2 = teams.find(team => team.id === fixture.team2Id);
    if (!roster1 || !roster2) return;
    const playing1 = roster1.players.filter(player => lineups[roster1.id]?.includes(player.id));
    const playing2 = roster2.players.filter(player => lineups[roster2.id]?.includes(player.id));
    const roundName = fixture.round ? ` · ${fixture.round}` : '';
    const match = refreshResult(createMatch({
      team1: { ...roster1, players: playing1 }, team2: { ...roster2, players: playing2 },
      venue: fixture.venue, dateTime: fixture.dateTime, overs: fixture.overs,
      tossWinner: tossWinner === roster2.id ? roster2.name : roster1.name,
      tossDecision, name: `${roster1.name} vs ${roster2.name}${roundName}`,
    }));
    match.leagueId = league.id; match.leagueName = league.name; match.fixtureId = fixture.id; match.round = fixture.round;
    setMatches(previous => [match, ...previous]);
    updateLeague(league.id, current => ({ ...current, fixtures: current.fixtures.map(item => item.id === fixture.id ? { ...item, status: 'live', matchId: match.id } : item) }));
    setLaunchFixture(null);
    setActiveId(match.id);
    onGoScore();
  };

  if (!league) return (
    <section className="league-page">
      <div className="league-hero"><span className="eyebrow">GAME ORGANIZER</span><h2>Build your league.<br /><em>Bring everyone together.</em></h2><p>Register teams, track full squads and reserves, set match days, then start each fixture with the lineups already in place.</p></div>
      <div className="panel league-create-panel">
        <div><span className="eyebrow">YOUR FIRST COMPETITION</span><h3>Create a league</h3><p className="muted-copy">Leagues and schedules are saved in this browser. Create one to get started.</p></div>
        <div className="league-create-form">
          <label><span>League name</span><input value={leagueForm.name} onChange={e => setLeagueForm({ ...leagueForm, name: e.target.value })} placeholder="e.g. Summer Premier League" /></label>
          <label><span>Season</span><input value={leagueForm.season} onChange={e => setLeagueForm({ ...leagueForm, season: e.target.value })} placeholder="2026" /></label>
          <label><span>Overs per side</span><input type="number" min="1" max="50" value={leagueForm.overs} onChange={e => setLeagueForm({ ...leagueForm, overs: e.target.value })} /></label>
          <button className="primary" onClick={createLeague}>Create league</button>
        </div>
        {notice && <p className="league-notice">{notice}</p>}
      </div>
    </section>
  );

  return (
    <section className="league-page">
      <div className="league-topline"><div><span className="eyebrow">LEAGUE CONTROL ROOM</span><h2>{league.name}<span>{league.season}</span></h2><p>Teams, matchday schedules and competition stats in one place.</p></div>
        <div className="league-top-actions"><div className="league-select-wrap"><label htmlFor="league-select">Active league</label><select id="league-select" value={league.id} onChange={e => { const nextLeague = leagues.find(item => item.id === e.target.value); setActiveLeagueId(e.target.value); setFixtureForm(current => ({ ...current, overs: nextLeague?.overs || 20 })); }}>{leagues.map(item => <option key={item.id} value={item.id}>{item.name} · {item.season}</option>)}</select></div><button onClick={() => setShowCreateLeague(value => !value)}>＋ New league</button></div>
      </div>
      {showCreateLeague && <div className="panel league-create-inline"><label><span>League name</span><input value={leagueForm.name} onChange={e => setLeagueForm({ ...leagueForm, name: e.target.value })} placeholder="Competition name" /></label><label><span>Season</span><input value={leagueForm.season} onChange={e => setLeagueForm({ ...leagueForm, season: e.target.value })} /></label><label><span>Overs</span><input type="number" min="1" max="50" value={leagueForm.overs} onChange={e => setLeagueForm({ ...leagueForm, overs: e.target.value })} /></label><button className="primary" onClick={createLeague}>Create league</button></div>}
      <nav className="league-nav" aria-label="League sections">{[['overview', 'Overview'], ['teams', 'Teams & squads'], ['schedule', 'Schedule']].map(([id, label]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>{label}</button>)}</nav>
      {notice && <div className="notice info league-inline-notice" role="status">{notice}<button aria-label="Dismiss" onClick={() => setNotice('')}>×</button></div>}

      {view === 'overview' && <>
        <div className="league-metrics"><div><span>REGISTERED TEAMS</span><strong>{leagueTeams.length}</strong></div><div><span>SCHEDULED FIXTURES</span><strong>{fixtures.length}</strong></div><div><span>PLAYED</span><strong>{played}</strong></div><div><span>LIVE NOW</span><strong className={liveCount ? 'metric-live' : ''}>{liveCount}</strong></div></div>
        <div className="league-overview-grid"><div className="panel standings-panel"><div className="section-title-row"><div><span className="eyebrow">COMPETITION TABLE</span><h3>League standings</h3></div><span className="points-note">Win 2 pts · Tie 1 pt</span></div>
          {standings.length ? <div className="table-scroll"><table className="stats league-table"><thead><tr><th>#</th><th>Team</th><th className="num">P</th><th className="num">W</th><th className="num">L</th><th className="num">T</th><th className="num">RF / RA</th><th className="num">Pts</th></tr></thead><tbody>{standings.map((row, index) => <tr key={row.id}><td><span className={`rank-badge ${index === 0 && row.played ? 'leader' : ''}`}>{index + 1}</span></td><td><b>{row.name}</b></td><td className="num">{row.played}</td><td className="num">{row.won}</td><td className="num">{row.lost}</td><td className="num">{row.tied}</td><td className="num">{row.runsFor} / {row.runsAgainst}</td><td className="num"><b>{row.points}</b></td></tr>)}</tbody></table></div> : <p className="muted-copy empty-state-copy">Add teams and complete a match to see your table take shape.</p>}
        </div><div className="panel next-fixtures-panel"><div className="section-title-row"><div><span className="eyebrow">UP NEXT</span><h3>Matchday schedule</h3></div><button className="small" onClick={() => setView('schedule')}>Manage</button></div>
          {fixtures.length ? fixtures.slice(0, 4).map(fixture => <FixtureRow key={fixture.id} fixture={fixture} teams={teams} matches={matches} onOpen={() => openFixture(fixture)} />) : <p className="muted-copy empty-state-copy">No fixtures yet. Build the first matchday.</p>}
        </div></div>
      </>}

      {view === 'teams' && <div className="league-section">
        <div className="section-title-row league-section-title"><div><span className="eyebrow">REGISTERED SQUADS</span><h3>Teams & player lists</h3><p className="muted-copy">Flag reserve players so the starting XI is ready to pick on match day.</p></div></div>
        <div className="add-team-bar"><label><span>Add an existing team</span><div className="add-team-controls"><select value={existingTeamId} onChange={e => setExistingTeamId(e.target.value)}><option value="">Choose a saved team…</option>{teams.filter(team => !league.teamIds.includes(team.id)).map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select><button onClick={() => linkTeam(existingTeamId)} disabled={!existingTeamId}>Add team</button></div></label><span className="or-divider">or</span><label><span>Create a team</span><div className="add-team-controls"><input value={teamNameInput} onChange={e => setTeamNameInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTeam()} placeholder="Team name" /><button className="primary" onClick={addTeam}>Create team</button></div></label></div>
        {leagueTeams.length ? <div className="squad-grid">{leagueTeams.map(team => <RosterCard key={team.id} team={team} onChange={next => setTeams(previous => previous.map(item => item.id === team.id ? next : item))} />)}</div> : <div className="panel empty-state-copy"><p>Add or create the first team to start building your league squads.</p></div>}
      </div>}

      {view === 'schedule' && <div className="league-section">
        <div className="section-title-row league-section-title"><div><span className="eyebrow">FIXTURE BUILDER</span><h3>Schedule a match</h3><p className="muted-copy">Choose the teams, match day and start time. Lineups are confirmed when the fixture starts.</p></div></div>
        {leagueTeams.length < 2 ? <div className="panel empty-state-copy"><p>Add at least two teams to create your first fixture.</p><button className="primary" onClick={() => setView('teams')}>Go to teams</button></div> : <div className="panel fixture-form-panel">
          <div className="fixture-form-grid"><label><span>Team one</span><select value={fixtureForm.team1Id} onChange={e => setFixtureForm({ ...fixtureForm, team1Id: e.target.value, team2Id: fixtureForm.team2Id === e.target.value ? '' : fixtureForm.team2Id })}><option value="">Select a team</option>{leagueTeams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><span className="fixture-vs">VS</span><label><span>Team two</span><select value={fixtureForm.team2Id} onChange={e => setFixtureForm({ ...fixtureForm, team2Id: e.target.value, team1Id: fixtureForm.team1Id === e.target.value ? '' : fixtureForm.team1Id })}><option value="">Select a team</option>{leagueTeams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><label><span>Match day & start time</span><input type="datetime-local" value={fixtureForm.dateTime} onChange={e => setFixtureForm({ ...fixtureForm, dateTime: e.target.value })} /></label><label><span>Venue</span><input value={fixtureForm.venue} onChange={e => setFixtureForm({ ...fixtureForm, venue: e.target.value })} placeholder="Ground, city" /></label><label><span>Round / matchday</span><input value={fixtureForm.round} onChange={e => setFixtureForm({ ...fixtureForm, round: e.target.value })} placeholder="e.g. Matchday 1" /></label><label><span>Overs per side</span><input type="number" min="1" max="50" value={fixtureForm.overs} onChange={e => setFixtureForm({ ...fixtureForm, overs: e.target.value })} /></label></div><div className="fixture-submit-row"><span>Match format defaults to {league.overs} overs.</span><button className="primary" onClick={addFixture}>＋ Add fixture</button></div>
        </div>}
        <div className="panel schedule-list-panel"><div className="section-title-row"><div><span className="eyebrow">SEASON CALENDAR</span><h3>All fixtures <span className="count-chip">{fixtures.length}</span></h3></div></div>
          {fixtures.length ? fixtures.map(fixture => <FixtureRow key={fixture.id} fixture={fixture} teams={teams} matches={matches} onOpen={() => openFixture(fixture)} onRemove={() => { if (fixture.matchId) return setNotice('Fixtures with a started match can’t be removed from the schedule.'); updateLeague(league.id, current => ({ ...current, fixtures: current.fixtures.filter(item => item.id !== fixture.id) })); }} />) : <p className="muted-copy empty-state-copy">Your schedule is empty. Add a fixture above.</p>}
        </div>
      </div>}

      {launchFixture && <LineupModal fixture={launchFixture} teams={teams} onClose={() => setLaunchFixture(null)} onStart={startMatch} />}
    </section>
  );
}

function FixtureRow({ fixture, teams, matches, onOpen, onRemove }) {
  const match = matches.find(item => item.id === fixture.matchId);
  const status = match?.status === 'completed' ? 'completed' : match?.status === 'live' ? 'live' : fixture.status;
  const label = status === 'completed' ? (match?.result || 'Completed') : status === 'live' ? 'Live now' : 'Scheduled';
  return <article className="fixture-row"><div className="fixture-date"><strong>{fixture.dateTime ? new Intl.DateTimeFormat(undefined, { day: '2-digit' }).format(new Date(fixture.dateTime)) : '—'}</strong><span>{fixture.dateTime ? new Intl.DateTimeFormat(undefined, { month: 'short', weekday: 'short' }).format(new Date(fixture.dateTime)) : 'TBD'}</span></div><div className="fixture-details"><div className="fixture-teams"><b>{teamName(teams, fixture.team1Id)}</b><span>vs</span><b>{teamName(teams, fixture.team2Id)}</b></div><span>{dateLabel(fixture.dateTime)} · {fixture.venue || 'Venue TBD'} · {fixture.overs} overs {fixture.round ? `· ${fixture.round}` : ''}</span>{match?.result && <small>{match.result}</small>}</div><div className="fixture-actions"><span className={`tag ${status === 'live' ? 'green' : status === 'completed' ? 'blue' : 'yellow'}`}>{label}</span><button className="small" onClick={onOpen}>{status === 'scheduled' ? 'Start match' : status === 'live' ? 'Resume' : 'Open card'}</button>{onRemove && status === 'scheduled' && <button className="small danger" onClick={onRemove} aria-label="Remove fixture">×</button>}</div></article>;
}

