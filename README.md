# VerseKeep

Christian **Scripture memory** games in the browser — by theme.

**Play:** https://alphaeusng.github.io/VerseKeep/  
**Portfolio:** https://alphaeusng.github.io/  
**Related:** [Seeking Biblical Truth](https://alphaeusng.github.io/pages/seeking-biblical-truth/) · [AlpArcade](https://alphaeusng.github.io/AlpArcade/)

## Themes

- Trusting in God  
- God's character  
- Reality of sin  
- The gospel  
- Nourish & cherish your wife  
- Apologetic anchors  
- Prayer & the Word  
- Strength in trials  
- Identity in Christ  

Edit / extend verses in `data/verses.json`. Progress (mastery, streaks, accuracy) is stored in `localStorage` on this device.

## Modes

1. **Study** — read the verse  
2. **Fill blanks** — missing words  
3. **Type it** — free recall (fuzzy match) + first-letter hint  
4. **Order words** — rebuild sequence  
5. **Which verse?** — pick the reference  

Keyboard: `1`–`5` modes · `N`/`B` next/back · `R` reveal · `C` copy · `S` shuffle · `Enter` check  


## Worship music

Curated **YouTube** and **Spotify** embeds in the Worship section — tap a station to play. Spotify may require a free login. Preferences stick in `localStorage`.

## Live Bible text

| Option | Notes |
|--------|--------|
| **ESV** (default), **NIV**, **NKJV** | Live text via `js/bible-live.js` when “Live text” is on |
| **Bundled** `data/verses.json` | Always available offline / if live fetch fails |

Optional: set `esvApiKey` in `js/bible-config.js` if you route official ESV API through a proxy.

## Wallpapers

- **Daily suggestions** — six calm creation photos each day (Unsplash CDN; no API key), plus **New suggestions** to reshuffle.
- **Classics** — bundled HD images under `assets/wallpapers/` (work offline).
- **Hearts** — ♥ a wallpaper; counts try to sync globally (counter API, best-effort). The **most loved** wallpaper is featured in the hero and wallpaper section.
- First visit / “Use today’s” follows the daily wallpaper; picking one locks your choice until you change it.

## Stack

Static HTML / CSS / JS. No build step. GitHub Pages from `main` root.

## Local

```bash
python3 -m http.server 8080
# http://127.0.0.1:8080/
```

## GitHub Pages

Repo **Settings → Pages → Deploy from branch → `main` / root**

## Note on translation

Starter wording is ESV-style for study. Confirm against your preferred translation before printing or teaching.
