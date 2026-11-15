# GameSlate

GameSlate is a cricket scoreboard and match manager. It includes local match
setup, ball-by-ball scoring, scorecards, player stats, and Excel import/export.

## Live scores

The Live Matches tab reads fixtures and scores from ESPN's publicly accessible
cricket header and match summary feeds. No account or API key is required. The
feed refreshes every minute while the tab is open. These endpoints are
undocumented, so ESPN may change or restrict them and coverage can vary. When
the source is unavailable, the app displays an error instead of presenting
sample scores as real matches. Your locally scored matches remain available
offline.

## Run locally

```bash
npm install
npm run dev
```

## Deploy to GitHub Pages

Push to `main` and enable GitHub Actions as the Pages source. The included
workflow builds the Vite app and deploys its `dist` directory.

