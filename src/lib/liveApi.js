// Live-match data via free cricket APIs (user supplies a free-tier key;
// it is stored only in this browser). Falls back to clearly-marked demo data.

export const PROVIDERS = {
  cricapi: {
    label: 'CricAPI (cricapi.com — free key, ~100 req/day)',
    current: (key) => `https://api.cricapi.com/v1/currentMatches?apikey=${encodeURIComponent(key)}&offset=0`,
    info: (key, id) => `https://api.cricapi.com/v1/match_info?apikey=${encodeURIComponent(key)}&id=${encodeURIComponent(id)}`,
    parseCurrent: (data) => (data.data || []).map(mapCricapi),
  },
  cricketdata: {
    label: 'CricketData.org (free key)',
    current: (key) => `https://api.cricdata.com/api/v1/currentMatches?apikey=${encodeURIComponent(key)}&offset=0`,
    info: (key, id) => `https://api.cricdata.com/api/v1/match_info?apikey=${encodeURIComponent(key)}&id=${encodeURIComponent(id)}`,
    parseCurrent: (data) => (data.data || data.matches || []).map(mapCricapi),
  },
};

function mapCricapi(m = {}) {
  return {
    id: m.id || '',
    name: m.name || '',
    matchType: m.matchType || '',
    status: m.status || '',
    venue: m.venue || '',
    date: m.dateTimeGMT || '',
    teams: m.teams || [],
    teamInfo: m.teamInfo || [],
    score: (m.score || []).map(s => ({
      team: s.inning || '', runs: s.r ?? '', wickets: s.w ?? '', overs: s.o ?? '',
    })),
    live: true,
  };
}

export async function fetchCurrentMatches(providerKey, apiKey) {
  const provider = PROVIDERS[providerKey] || PROVIDERS.cricapi;
  const res = await fetch(provider.current(apiKey));
  if (!res.ok) throw new Error(`API error ${res.status} ${res.statusText}`);
  const data = await res.json();
  if (data.status && data.status !== 'success' && !data.data) {
    throw new Error(data.reason || data.error || 'API returned an error');
  }
  return provider.parseCurrent(data);
}

export async function fetchMatchInfo(providerKey, apiKey, matchId) {
  const provider = PROVIDERS[providerKey] || PROVIDERS.cricapi;
  const res = await fetch(provider.info(apiKey, matchId));
  if (!res.ok) throw new Error(`API error ${res.status} ${res.statusText}`);
  return res.json();
}

export const DEMO_MATCHES = [
  {
    id: 'demo-1', name: 'India vs Australia, 3rd T20I (DEMO)', matchType: 'T20',
    status: 'India need 42 runs in 30 balls', venue: 'MCG, Melbourne',
    date: new Date().toISOString(), teams: ['India', 'Australia'],
    score: [
      { team: 'Australia Innings', runs: 178, wickets: 6, overs: 20 },
      { team: 'India Innings', runs: 137, wickets: 3, overs: 15 },
    ], live: false, demo: true,
  },
  {
    id: 'demo-2', name: 'England vs Pakistan, ODI (DEMO)', matchType: 'ODI',
    status: 'England won by 5 wickets', venue: 'Lord\'s, London',
    date: new Date().toISOString(), teams: ['England', 'Pakistan'],
    score: [
      { team: 'Pakistan Innings', runs: 274, wickets: 8, overs: 50 },
      { team: 'England Innings', runs: 275, wickets: 5, overs: 47.3 },
    ], live: false, demo: true,
  },
];
