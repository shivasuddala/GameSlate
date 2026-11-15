import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// For GitHub Pages project sites the app lives under /<repo-name>/.
// Override with `npm run build -- --base=/` for custom domains / user pages.
const repoName = process.env.GITHUB_REPOSITORY
  ? process.env.GITHUB_REPOSITORY.split('/')[1]
  : (process.env.VITE_BASE || '/GameSlate/');

export default defineConfig({
  plugins: [react()],
  base: repoName.startsWith('/') ? repoName : `/${repoName}/`,
});
