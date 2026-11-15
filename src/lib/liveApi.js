// ESPN's public cricket feed works without an account or API key. These are
// undocumented endpoints, so parsing is deliberately defensive and the UI
// always shows when the feed cannot be reached.
const HEADER_URL = 'https://site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket&region=in&tz=Asia%2FCalcutta';

async function getJson(url, signal) {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Score source returned ${response.status}`);
  return response.json();
}

function first(...values) {
  return values.find(value => value !== undefined && value !== null && value !== '');
}

function competitionOf(event) {
  return event?.competitions?.[0] || event?.competition || {};
}

function statusText(event, competition) {
  const status = competition?.status || event?.status || {};
  const type = status.type || {};
  return first(type.detail, type.shortDetail, status.detail, status.displayClock, type.name, status.name, 'Match details unavailable');
}

function extractScores(event, summary = {}) {
  const headerEvent = summary?.header?.competitions?.[0] || {};
  const competition = competitionOf(event);
  const competitors = first(
    headerEvent.competitors,
    competition.competitors,
    event?.competitors,
    summary?.competitions?.[0]?.competitors,
  ) || [];
  const scores = competitors.map(team => {
    const info = team.team || team;
    const name = first(info.displayName, info.name, info.shortDisplayName, team.displayName, team.name, team.abbreviation, 'Team');
    const lines = Array.isArray(team.linescores) ? team.linescores : (team.linescores?.items || []);
    const parsedLine = lines.map(line => ({
      runs: first(line.runs, line.value, line.score),
      wickets: first(line.wickets, line.overs?.wickets),
      overs: first(line.overs?.displayValue, line.overs, line.displayValue),
    }));
    const score = first(team.score, team.scoreDisplay, team.displayScore);
    return {
      team: name,
      runs: score ?? '',
      wickets: '',
      overs: '',
      innings: parsedLine,
    };
  }).filter(team => team.team);

  const scorecards = summary?.matchcards || summary?.scorecard || [];
  if (!scores.some(team => team.runs !== '') && Array.isArray(scorecards)) {
    scorecards.forEach((card, index) => {
      const teamName = first(card.team?.displayName, card.team?.name, card.teamName, card.displayName, card.name, `Innings ${index + 1}`);
      const total = card.totals || card.teamScore || card.score || {};
      const runs = first(total.runs, total.score, card.runs, card.scoreValue, '');
      if (runs !== '') scores.push({ team: teamName, runs, wickets: first(total.wickets, card.wickets, ''), overs: first(total.overs, card.overs, ''), innings: [] });
    });
  }
  return scores;
}

function flattenHeader(data) {
  const sports = data?.sports || [];
  const leagues = sports.flatMap(sport => sport.leagues || []);
  const seen = new Set();
  return leagues.flatMap(league => (league.events || []).map(event => {
    const id = String(event.id || event.eventId || '');
    if (!id || seen.has(id)) return null;
    seen.add(id);
    return { event, league };
  }).filter(Boolean));
}

function mapEvent(event, league, summary = {}) {
  const competition = competitionOf(event);
  const headerCompetition = summary?.header?.competitions?.[0] || {};
  const mergedEvent = { ...event, status: first(headerCompetition.status, event.status) };
  const teams = (headerCompetition.competitors || competition.competitors || event.competitors || [])
    .map(team => first(team.team?.displayName, team.team?.name, team.displayName, team.name, team.abbreviation))
    .filter(Boolean);
  const details = summary?.gameInfo || {};
  const scores = extractScores(event, summary);
  const status = statusText(mergedEvent, headerCompetition);
  const state = String(first(mergedEvent.status?.type?.state, headerCompetition.status?.type?.state, '')).toLowerCase();
  return {
    id: String(event.id),
    name: first(event.name, event.shortName, [league.name, teams.join(' vs ')].filter(Boolean).join(' · '), 'Cricket match'),
    matchType: first(event.season?.name, league.abbreviation, league.shortName, 'CRICKET'),
    status: statusText(mergedEvent, headerCompetition),
    venue: first(details.venue?.fullName, details.venue, competition.venue?.fullName, competition.venue?.address?.city, ''),
    date: first(event.date, event.startDate, ''),
    teams,
    score: scores,
    live: state === 'in' || /\blive\b|in progress|\d+(st|nd|rd|th) innings/i.test(status),
    source: 'ESPN public feed',
  };
}

export async function fetchCurrentMatches({ signal } = {}) {
  const header = await getJson(HEADER_URL, signal);
  const matches = flattenHeader(header);
  if (!matches.length) return [];

  // The header provides the active series and events. Fetch compact match
  // summaries for scorecards because the header does not always include runs.
  const summaries = await Promise.all(matches.slice(0, 16).map(async ({ event, league }) => {
    try {
      const url = `https://site.web.api.espn.com/apis/site/v2/sports/cricket/${encodeURIComponent(league.id)}/summary?event=${encodeURIComponent(event.id)}&lang=en&region=in`;
      return await getJson(url, signal);
    } catch {
      return {};
    }
  }));

  return matches.slice(0, 16).map(({ event, league }, index) => mapEvent(event, league, summaries[index]));
}

