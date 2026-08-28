# VerseKeep

Christian **Scripture memory** games in the browser, grouped by theme.

**[Play VerseKeep](https://alphaeusng.github.io/VerseKeep/)** · [Portfolio](https://alphaeusng.github.io/) · also [ChristoDay](https://alphaeusng.github.io/ChristoDay/)

The live site *is* the demo. Pick a theme, pick a mode, practice a verse.

## Try it

1. Open **[VerseKeep](https://alphaeusng.github.io/VerseKeep/)**.
2. Choose a theme (for example Trusting in God, The gospel, or Identity in Christ).
3. Start with **Study**, then try **Fill blanks** or **Type it**.
4. Keyboard: `1`–`5` switch modes · `N`/`B` next/back · `R` reveal · `Enter` check.

Progress (mastery, streaks, accuracy) stays in `localStorage` on this device. Edit verses in `docs/data/verses.json`.

## Modes

1. **Study** — read the verse
2. **Fill blanks** — missing words
3. **Type it** — free recall (fuzzy match) plus first-letter hint
4. **Order words** — rebuild the sequence
5. **Which verse?** — pick the reference

## Also in the app

- **Worship** — curated YouTube and Spotify stations (Spotify may need a free login)
- **Live Bible text** — ESV (default), NIV, NKJV when Live text is on; bundled `verses.json` always works offline
- **Wallpapers** — daily creation photos, desktop/phone sizes, hearts, offline classics under `docs/assets/wallpapers/`

Starter wording is ESV-style for study. Confirm against your preferred translation before printing or teaching.

## Develop

Static HTML/CSS/JS. The site lives under `docs/`. GitHub Pages: `main` / `docs`.

```bash
python3 -m http.server 8080 --directory docs
# http://127.0.0.1:8080/

npm ci
npx playwright install chromium
npm run test:browser
```
