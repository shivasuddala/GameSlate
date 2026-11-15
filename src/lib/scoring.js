// Event-sourced cricket scoring engine.
// All innings data is DERIVED from the ball-event log, so undo/redo and
// Excel round-trips stay consistent automatically.

export const EXTRA_TYPES = ['', 'wd', 'nb', 'b', 'lb', 'p'];
export const DISMISSALS = [
  'bowled', 'caught', 'lbw', 'run out', 'stumped', 'hit wicket',
  'caught & bowled', 'obstructing', 'retired out',
];

let _id = 0;
export const newId = () => `id${Date.now().toString(36)}${(_id++).toString(36)}`;

export const createPlayer = (name, role = 'All-rounder', battingStyle = 'RHB', bowlingStyle = '') =>
  ({ id: newId(), name, role, battingStyle, bowlingStyle });

export const createTeam = (name, players = []) => ({ id: newId(), name, players });

export function createMatch({
  team1, team2, venue = '', dateTime = '', overs = 20,
  tossWinner = '', tossDecision = 'bat', name = '',
}) {
  return {
    id: newId(),
    name: name || `${team1.name} vs ${team2.name}`,
    venue, dateTime,
    overs: Number(overs) || 20,
    team1: { name: team1.name, players: team1.players },
    team2: { name: team2.name, players: team2.players },
    tossWinner, tossDecision,
    status: 'live',            // live | innings-break | completed
    result: '',
    events: [],                // ball log for both innings
    currentInnings: 1,
  };
}

export const legalBalls = (events) => events.filter(
  e => e.extraType !== 'wd' && e.extraType !== 'nb').length;

export const oversText = (legalCount) =>
  `${Math.floor(legalCount / 6)}.${legalCount % 6}`;

export const ballInOverText = (legalCount) =>
  `Ov ${Math.floor(legalCount / 6) + 1}, Ball ${(legalCount % 6) + 1}`;

export function eventsOfInnings(match, inningsNo) {
  return match.events.filter(e => e.innings === inningsNo);
}

const emptyBat = (name) => ({
  name, runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0,
  out: false, notOutBatted: false, dismissal: '', strikeRate: '0.00',
});

const emptyBowl = (name) => ({
  name, balls: 0, runs: 0, wickets: 0, maidens: 0, dots: 0,
  wides: 0, noBalls: 0, economy: '0.00',
});

/**
 * Derive a full innings view from its ball events.
 * Returns totals, batting/bowling cards, per-over history and extras.
 */
export function deriveInnings(events) {
  const batting = new Map();   // name -> card
  const bowling = new Map();   // name -> card
  const overs = [];            // [{no, balls:[...], runs, wickets, maiden}]
  const fallOfWickets = [];    // [{wkt, runs, over, batter}]
  const extras = { wd: 0, nb: 0, b: 0, lb: 0, p: 0, total: 0 };

  let legal = 0, runs = 0, wkts = 0, striker = null, nonStriker = null, bowler = null;
  let lastEvent = null;

  const strikeSwap = () => { const t = striker; striker = nonStriker; nonStriker = t; };

  for (const e of events) {
    striker = e.striker || striker;
    nonStriker = e.nonStriker || nonStriker;
    bowler = e.bowler || bowler;
    if (!batting.has(e.striker)) batting.set(e.striker, emptyBat(e.striker));
    if (!batting.has(e.nonStriker)) batting.set(e.nonStriker, emptyBat(e.nonStriker));
    if (!bowling.has(e.bowler)) bowling.set(e.bowler, emptyBowl(e.bowler));

    const bat = batting.get(e.striker);
    const bowl = bowling.get(e.bowler);
    const isLegal = e.extraType !== 'wd' && e.extraType !== 'nb';
    const extra = e.extraRuns || 0;
    const offBat = e.runsOffBat || 0;
    let overNo = Math.floor(legal / 6);
    let over = overs[overNo];
    if (isLegal && legal % 6 === 0) {
      over = { no: overNo + 1, balls: [], runs: 0, wickets: 0, bowler: e.bowler };
      overs[overNo] = over;
    }
    if (!over) { over = { no: overNo + 1, balls: [], runs: 0, wickets: 0, bowler: e.bowler }; overs[overNo] = over; }

    // credit runs
    runs += offBat + extra;
    over.runs += offBat + extra;
    if (e.extraType) extras[e.extraType] += extra, extras.total += extra;

    if (offBat > 0) {
      bat.runs += offBat;
      bowl.runs += offBat;
      if (offBat === 4) bat.fours += 1;
      if (offBat === 6) bat.sixes += 1;
    } else if (isLegal) {
      bat.dots += 1;
      bowl.dots += 1;
    }
    if (['wd', 'nb'].includes(e.extraType)) bowl.runs += extra;

    if (isLegal) {
      bat.balls += 1;
      bowl.balls += 1;
      over.balls.push(e);
      legal += 1;
      if (e.extraType === 'b' || e.extraType === 'lb' || e.extraType === 'p') {
        // byes/leg-byes: legal ball faced, runs to team only (already added)
      }
      if (legal % 6 === 0) {
        // maiden check: no off-bat runs and no wd/nb in the over
        const maiden = over.balls.every(b =>
          (b.runsOffBat || 0) === 0 && !['wd', 'nb'].includes(b.extraType) && !b.wicket);
        over.maiden = maiden && over.runs === over.balls.reduce(
          (s, b) => s + (b.extraType === 'b' || b.extraType === 'lb' ? (b.extraRuns || 0) : 0), 0);
        if (over.maiden) bowl.maidens += 1;
        strikeSwap(); // end of over
      } else if (offBat % 2 === 1) {
        strikeSwap();
      }
    }

    if (e.wicket) {
      wkts += 1;
      over.wickets += 1;
      bowl.wickets += 1;
      const outBat = batting.get(e.wicket.playerOut || e.striker);
      if (outBat) {
        outBat.out = true;
        outBat.dismissal = e.wicket.type +
          (e.wicket.fielder && e.wicket.type.includes('caught') ? ` (${e.wicket.fielder})` : '') +
          (e.wicket.type === 'run out' && e.wicket.playerOut && e.wicket.playerOut !== e.striker ? '' : '');
        outBat.notOutBatted = false;
      }
      fallOfWickets.push({ wkt: wkts, runs, over: oversText(legal), batter: e.wicket.playerOut || e.striker });
      if (e.wicket.playerOut && e.wicket.playerOut === striker) {
        // next batter comes in at the striker end by default; UI lets you swap
      }
    }
    lastEvent = e;
  }

  for (const b of batting.values()) {
    b.strikeRate = b.balls ? ((b.runs / b.balls) * 100).toFixed(2) : '0.00';
  }
  for (const b of bowling.values()) {
    b.overs = oversText(b.balls);
    b.economy = b.balls ? ((b.runs / b.balls) * 6).toFixed(2) : '0.00';
  }

  const runRate = legal ? (runs / (legal / 6)).toFixed(2) : '0.00';

  return {
    events, runs, wickets: wkts, legalBalls: legal,
    overs: oversText(legal), runRate,
    batting: [...batting.values()],
    bowling: [...bowling.values()],
    oversList: overs.filter(Boolean),
    fallOfWickets, extras,
    striker, nonStriker, bowler, lastEvent,
  };
}

export function currentInningsView(match) {
  return deriveInnings(eventsOfInnings(match, match.currentInnings));
}

/** True when the first innings is complete (overs done or all out). */
export function firstInningsComplete(match) {
  const inn = deriveInnings(eventsOfInnings(match, 1));
  const battingTeam = battingTeamFor(match, 1) === match.team1.name ? match.team1 : match.team2;
  const wicketsToFall = Math.max((battingTeam.players || []).length - 1, 1);
  return inn.legalBalls >= match.overs * 6 || inn.wickets >= wicketsToFall;
}

export const teamSize = (match) => Math.max(
  match.team1.players?.length || 0, match.team2.players?.length || 0, 1);

/** Which team bats in the given innings, based on the toss. */
export function battingTeamFor(match, inningsNo) {
  const tosserBatsFirst = match.tossDecision === 'bat';
  const first = tosserBatsFirst
    ? (match.tossWinner || match.team1.name)
    : (match.tossWinner === match.team1.name ? match.team2.name : match.team1.name);
  return inningsNo === 1
    ? first
    : (first === match.team1.name ? match.team2.name : match.team1.name);
}

/** Compute/refresh match status + result text from the event log. */
export function refreshResult(match) {
  const i1 = deriveInnings(eventsOfInnings(match, 1));
  const i2 = deriveInnings(eventsOfInnings(match, 2));
  const firstTeam = battingTeamFor(match, 1) === match.team1.name ? match.team1 : match.team2;
  const secondTeam = battingTeamFor(match, 2) === match.team1.name ? match.team1 : match.team2;
  const firstWicketsToFall = Math.max((firstTeam.players || []).length - 1, 1);
  const secondWicketsToFall = Math.max((secondTeam.players || []).length - 1, 1);

  if (i1.legalBalls === 0) return { ...match };

  if (i2.legalBalls === 0) {
    // still first innings (or just starting second)
    if (i1.legalBalls >= match.overs * 6 || i1.wickets >= firstWicketsToFall) {
      return { ...match, currentInnings: 2, status: match.status === 'completed' ? 'completed' : 'live' };
    }
    return { ...match };
  }

  const target = i1.runs + 1;
  const ballsLeft = match.overs * 6 - i2.legalBalls;
  const chasingAllOut = i2.wickets >= secondWicketsToFall;
  const oversDone = i2.legalBalls >= match.overs * 6;

  if (i2.runs >= target) {
    return { ...match, status: 'completed',
      result: `${battingTeamFor(match, 2)} won by ${secondWicketsToFall - i2.wickets} wickets (${ballsLeft} balls left) — target ${target}` };
  }
  if (i2.runs === i1.runs && (oversDone || chasingAllOut)) {
    return { ...match, status: 'completed', result: 'Match tied!' };
  }
  if (i1.runs > i2.runs && (oversDone || chasingAllOut)) {
    return { ...match, status: 'completed',
      result: `${battingTeamFor(match, 1)} won by ${i1.runs - i2.runs} runs` };
  }
  return { ...match };
}

/** Career stats for one player across all matches in a list. */
export function careerStats(playerName, matches) {
  const c = { player: playerName, matches: 0, innings: 0, runs: 0, balls: 0,
    fours: 0, sixes: 0, hs: 0, fifties: 0, hundreds: 0, outs: 0, notOuts: 0,
    ballsBowled: 0, runsConceded: 0, wickets: 0, bestW: 0, bestR: 999 };

  for (const m of matches) {
    let played = false;
    for (const inn of [1, 2]) {
      const view = deriveInnings(eventsOfInnings(m, inn));
      const bat = view.batting.find(b => b.name === playerName);
      const bowl = view.bowling.find(b => b.name === playerName);
      if (bat) {
        played = true;
        if (bat.balls > 0 || bat.out) {
          c.innings += 1;
          c.runs += bat.runs; c.balls += bat.balls;
          c.fours += bat.fours; c.sixes += bat.sixes;
          if (bat.runs >= 50 && bat.runs < 100) c.fifties += 1;
          if (bat.runs >= 100) c.hundreds += 1;
          c.hs = Math.max(c.hs, bat.runs);
          if (bat.out) c.outs += 1; else c.notOuts += 1;
        }
      }
      if (bowl && bowl.balls > 0) {
        played = true;
        c.ballsBowled += bowl.balls;
        c.runsConceded += bowl.runs;
        c.wickets += bowl.wickets;
        if (bowl.wickets > c.bestW || (bowl.wickets === c.bestW && bowl.runs < c.bestR)) {
          c.bestW = bowl.wickets; c.bestR = bowl.runs;
        }
      }
    }
    if (played) c.matches += 1;
  }
  c.battingAvg = c.outs ? (c.runs / c.outs).toFixed(2) : c.runs ? '∞' : '-';
  c.battingSR = c.balls ? ((c.runs / c.balls) * 100).toFixed(2) : '-';
  c.bowlingEcon = c.ballsBowled ? ((c.runsConceded / c.ballsBowled) * 6).toFixed(2) : '-';
  c.best = c.bestW || c.bestR < 999 ? `${c.bestW}/${c.bestR === 999 ? 0 : c.bestR}` : '-';
  return c;
}


