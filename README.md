# GameSlate

GameSlate is a cricket scoreboard and match manager. It includes local match
setup, ball-by-ball scoring, scorecards, player stats, and Excel import/export.

The League page lets you create competitions, register teams, manage full squads
and reserves, schedule fixtures with date/time, round and venue, confirm each
playing XI and toss, and launch scoring from a fixture. Completed league matches
feed the league standings. League setup and schedules are saved in this browser
and are also included in workbook export/import.

## Live scores

The Live Matches tab reads fixtures and scores from ESPN's publicly accessible
cricket header and match summary feeds. No account or API key is required. The
feed refreshes every minute while the tab is open. These endpoints are
undocumented, so ESPN may change or restrict them and coverage can vary. When
the source is unavailable, the app displays an error instead of presenting
sample scores as real matches. Your locally scored matches remain available
offline.

League fixtures are saved in the Excel workbook's `Leagues`, `League Teams` and
`Fixtures` sheets. The Teams sheet marks reserve players, and Matches records the
playing XI selected for each match.

## Run locally

```bash
npm install
npm run dev
```

## Deploy to GitHub Pages

Push to `main` and enable GitHub Actions as the Pages source. The included
workflow builds the Vite app and deploys its `dist` directory.

