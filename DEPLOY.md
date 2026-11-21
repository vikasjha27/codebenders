# Deploying TutorDesk

## Build

```bash
npm install
npm run build
```

The static site is written to `dist/`.

## Vercel

1. Import the repository in Vercel.
2. Framework preset: **Vite** (or **Other**).
3. Build command: `npm run build`
4. Output directory: `dist`
5. `vercel.json` handles SPA rewrites, so deep links load `index.html`.

## Netlify

1. Build command: `npm run build`
2. Publish directory: `dist`
3. `public/_redirects` handles SPA rewrites (copied into `dist/` at build time).

## GitHub Pages

GitHub Pages serves the site from a subpath (`https://<user>.github.io/<repo-name>/`), so it is **not configured by default**. To deploy there:

1. Set `base: '/<repo-name>/'` in `vite.config.ts`.
2. Copy `dist/index.html` to `dist/404.html` so unknown routes fall back to the app.

## Data note

All data lives in each browser's `localStorage`. There is no server-side storage.

- Clearing site data or browser storage erases it.
- Data does not sync between browsers or devices.
- The app shows a recovery banner if the stored data is corrupt.
