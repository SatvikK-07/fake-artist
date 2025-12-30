# Fake Artist

Single-page React game for the party drawing/guessing classic. Built for one shared device with pass-and-play flows, canvas drawing, and round-by-round scoring.

## Quick start

```bash
npm install
npm run dev
# build & serve static bundle
npm run build && npm run preview
# publish to GitHub Pages
npm run deploy
```

No external UI libraries or CDN assets are used; once built, the `dist/` bundle runs offline.

## Gameplay flow
- Lobby: 5–10 players, editable names/colors, pick or randomize the moderator.
- Moderator picks a theme + secret word, generates cards.
- One-at-a-time card reveals to show the word or the “FAKE ARTIST” card.
- Drawing: each player gets exactly two strokes on the shared canvas using their color; undo/clear tools gated for the moderator.
- Voting: public or private voting, dramatic reveal, moderator tie-break.
- Reveal & scoring: fake’s guess if caught, scoreboard persists across rounds; buttons for next round, change moderator, or new game.

## Notes
- Built with Vite + React hooks; JSX and canvas for drawing.
- CSS uses a custom palette and is tuned for laptop and mobile.
- All words live in `src/words.js`; extend themes or lists as needed.

## Deploy to GitHub Pages
- Repo settings: ensure your repo is named `fake-artist` (or adjust `base` in `vite.config.js` to match the repo name).
- Install deps: `npm install`
- Deploy: `npm run deploy` (builds to `dist/` then publishes via `gh-pages` to the `gh-pages` branch)
- On GitHub: Settings → Pages → Source → `Deploy from a branch`, pick `gh-pages` and root.
