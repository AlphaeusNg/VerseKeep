# AGENTS.md — VerseKeep

**Live:** https://alphaeusng.github.io/VerseKeep/  
**Repo:** https://github.com/AlphaeusNg/VerseKeep  
**Local:** `/home/alph/projects/VerseKeep`  
**Hub:** `/home/alph/projects/AGENTS.md`  
**Related:** Biblical Truth viewer on portfolio · AlpArcade

## Purpose

Christian **Scripture meditation** first (verse · context · application · prayer), with optional **memory drill** by topic. Worship music, calm wallpapers, live verse text, device-local progress.

## Structure

```text
index.html
css/style.css
js/
  meditate.js       # Primary UX: daily/topic meditation card
  app.js            # Topics, memory modes, practice stage, stats, phone header hide
  ambient.js        # Music: autoplay, left-edge dock
  wallpapers.js     # Daily remote + bundled classics + hearts
  bible-live.js
  bible-config.js
data/
  verses.json       # Themes + verses with context/application/prayer
  playlists.json    # Spotify / YouTube stations
  wallpapers.json
  remote-wallpapers.json
assets/wallpapers/
manifest.webmanifest
```

## Meditation

- On load: today’s verse (date-seeded) with context, application, prayer.
- Topic chips + topic cards filter meditation; **Drill** opens memory practice.
- **Amen** tracks a local daily streak; **Focus** dims the rest of the page.
- Keys (when not in practice): `←`/`→` · `S` shuffle · `C` copy · `L` listen · `F` focus · `A` Amen.
- Swipe the card (touch): left = next, right = prev.
- Live text: ESV / NIV / NKJV with session cache + prefetch; bundled JSON fallback.
- Do **not** surface third-party content-source branding in the UI.

## Practice modes

| mode | UX |
|---|---|
| `study` | Read / hide flashcard |
| `blank` | Fill blanks |
| `type` | Free recall (fuzzy) |
| `order` | Rebuild word order |
| `quiz` | Pick reference |

Keyboard (when not typing): `1`–`5` modes · `N`/`B` next/back · `R` reveal · `C` copy · `S` shuffle · `Enter` check · `L` read-aloud · `H` study hide.

Stats prefs: `localStorage` keys `versekeep-stats-v1`, `versekeep-prefs-v1`.

## Music

- Autoplay on load: last station (`versekeep-music`) or default Spotify **God’s encouragement** (`alph-gods-encouragement`).
- **Left-edge dock** (`#worship`): vertical tab opens/closes the panel; open state in `versekeep-music-ui-v5`.
- Player shell stays **inside the dock slot only** (no free-float / drag). Iframe stays mounted when closed so audio never cuts. Nav **Music** toggles the dock.
- Playlist metadata: `data/playlists.json` (categories; “From Alphaeus” first).

## Wallpapers

- Daily Unsplash CDN suggestions + bundled offline classics.
- Hearts / most-loved: best-effort remote counter (see `js/wallpapers.js`).

## Live Bible

- Default translation: **ESV** (also **NIV**, **NKJV** in the UI select).
- Live fetch in `js/bible-live.js`; bundled `data/verses.json` is always the offline fallback.
- Optional official ESV API key in `js/bible-config.js` (`esvApiKey`) if you add a proxy.

## Phone UX

- Sticky `.topbar` auto-hides on scroll-down (≤720px); external http nav links hidden on small screens.

## Commands

```bash
cd /home/alph/projects/VerseKeep
python3 -m http.server 8081
# http://127.0.0.1:8081/

node --check js/app.js
node --check js/ambient.js
node --check js/wallpapers.js
```

Footer version string is set in `js/app.js` (e.g. `v2026.07.18.1`) — **bump on deploy**.

## Conventions

- Zero-build static site; gold/cream dark theme.
- Prefer editing `data/verses.json` / `data/playlists.json` for content, not hardcoding lists in JS.
- Keep music dock independent of practice; closed dock must not stop audio.
- Don’t commit API keys.

## Deploy

GitHub Pages: **`main` / root**.

```bash
git add -A && git status
git commit -m "Describe VerseKeep change"
git push origin main
```

## Commit and push discipline

- Commit and push every completed user-requested change promptly after validation; do not leave finished work only in the local checkout.
- During longer work, make and push coherent checkpoint commits regularly so progress is safely available on the remote.
- Keep commits scoped and descriptive. If a push is blocked by authentication, failing checks, or an explicit local-only request, report that clearly instead of silently leaving changes unpushed.

## Agent checklist

1. Confirm change is VerseKeep (not portfolio vault viewer or AlpArcade).
2. After content JSON edits, spot-check theme load + one practice mode.
3. After music/CSS changes, verify left player + dock on narrow viewport.
4. Bump footer version; push this remote only.
