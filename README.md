# VerseKeep

Christian **Scripture meditation** in the browser, with optional memory drills by topic or Bible book.

**[Play VerseKeep](https://alphaeusng.github.io/VerseKeep/)** · [Portfolio](https://alphaeusng.github.io/) · also [ChristoDay](https://alphaeusng.github.io/ChristoDay/)

The live site *is* the demo. Read the meditation card, or open a topic or book for memory practice.

## Try it

1. Open **[VerseKeep](https://alphaeusng.github.io/VerseKeep/)**.
2. Read today’s meditation, or choose a topic (for example Trusting in God, The Gospel, or Identity in Christ) or Bible book for a drill.
3. Start with **Study**, then try **Fill blanks** or **Type it**.
4. Keyboard: `1`–`5` switch modes · `N`/`B` next/back · `R` reveal · `Enter` check.

## Themes

- Trusting in God
- God's Character
- Reality of Sin
- The Gospel
- Nourish & Cherish Your Wife
- Apologetic Anchors
- Prayer & the Word
- Strength in Trials
- Identity in Christ
- Sovereignty & Providence
- Justification by Grace
- Union with Christ
- Repentance & Holiness
- Assurance of Salvation
- The Holy Spirit
- Worship & Adoration
- Humility & Service

Progress (mastery, streaks, accuracy) stays in `localStorage` on this device. Edit verses in `docs/data/verses.json`.

## Bible books

Open **Bible books** and choose **Drill Proverbs** for 18 passages in book order.
Book drills use the same practice modes and do not add to Themes done. The last
drill shortcuts reopen either a topic or a book after reload. Reopening a book
starts at its first verse; an exact verse position is not saved.

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
