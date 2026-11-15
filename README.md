# 🏟️ GameSlate — Live Scoreboard & Match Stats

Ball-by-ball scoring, full scorecards, player profiles & career stats, an Excel
workbook as the database, and live match data from free APIs. **Multi-sport
ready** — built cricket-first, designed to grow into football, hockey, kabaddi,
esports and more.

Deployed as a static app on GitHub Pages — no backend required.

## Features

- **Match Setup** — two teams with player names, roles, batting/bowling styles;
  venue, date/time, overs, toss. Team rosters can be loaded from an Excel/CSV file.
- **Live Scoring** — ball-by-ball input with a proper wicket modal (all dismissal
  types + fielder), extras modals (wides, no-balls, byes, leg-byes), striker
  rotation, swap ends, retire batter, undo last ball, over-by-over strip with
  colour-coded balls, fall of wickets, current partnership, ball-by-ball
  commentary, target/required-rate in the 2nd innings, bowler-repeat warning,
  end-innings control and automatic results.
- **Scorecard** — full batting card (R, B, 4s, 6s, SR, dismissal) and bowling card
  (O, M, R, W, Econ, dots) per innings.
- **Players & Career** — career aggregates (matches, runs, HS, average, SR, 50s,
  100s, wickets, best bowling, economy) computed live from the whole database;
  editable batting/bowling style; per-team Excel export.
- **Excel as Database** — one `gameslate-db-*.xlsx` workbook holds README, Matches,
  Teams, Deliveries, State and Career sheets. Export to save/migrate; import on
  any platform to continue exactly where you left off (the ball log is
  event-sourced, so scorecards are rebuilt from Deliveries).
- **Live Matches** — pulls current matches from free APIs (CricAPI / CricketData.org
  free keys, stored only in your browser), with clearly-marked demo data as fallback.
- **Persistence** — session state auto-saved to localStorage so a refresh never
  loses a ball.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
```

## Deploy to GitHub Pages

1. Create a repo named `gameslate` and push this project to `main`.
2. The included workflow (`.github/workflows/deploy.yml`) builds and deploys on
   every push.
3. In the repo: **Settings → Pages → Source: GitHub Actions**.

The Vite base path is derived from `GITHUB_REPOSITORY` in CI automatically (and
defaults to `/gameslate/` locally). For a different repo name:

```bash
npm run build -- --base=/<repo-name>/
```

## Excel database format

| Sheet | Columns |
|---|---|
| Matches | id, name, date, venue, overs, team1, team2, tossWinner, tossDecision, status, result |
| Teams | team, player, role, battingStyle, bowlingStyle |
| Deliveries | matchId, innings, over, ball, striker, nonStriker, bowler, runsOffBat, extraType (wd/nb/b/lb), extraRuns, wicketType, playerOut, fielder |
| State | matchId, currentInnings, uiState (crease info JSON) |

Importing rebuilds matches and scorecards from the Deliveries log — take the
workbook to Excel, Google Sheets or any platform, edit, and re-import.

## Free live-score APIs

- [cricapi.com](https://www.cricapi.com/) — free key, ~100 requests/day
- [cricketdata.org](https://cricketdata.org/) — free key

Save your key with the 🔑 button (localStorage only). The app falls back to demo
data until a key is provided.

## Roadmap — multi-sport

The scoring core is sport-agnostic (teams, players, events, periods, results).
Planned additions: football (goals/cards/possession), hockey, kabaddi (raids/tackles),
badminton & table tennis (set scores), esports. Same Excel-DB and live-API plumbing.
