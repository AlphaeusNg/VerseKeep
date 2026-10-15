# AGENTS.md — VerseKeep

**Live:** https://alphaeusng.github.io/VerseKeep/  
**Repo:** https://github.com/AlphaeusNg/VerseKeep  
**Local:** `/home/alph/projects/VerseKeep`  
**Hub:** `/home/alph/projects/AGENTS.md`  
**Related faith projects:** ChristoDay · Biblical Truth viewer on portfolio

## Purpose

Christian **Scripture meditation** first (verse · context · application · prayer), with optional **memory drill** by topic. Worship music, calm wallpapers, live verse text, device-local progress.

## Structure

```text
docs/                       # GitHub Pages deployment root
  index.html
  404.html
  assets/
    css/style.css
    js/
      meditate.js           # Primary UX: daily/topic meditation card
      app.js                # Topics, memory modes, practice stage, stats
      data-core.js          # Playlist + remote-wallpaper data contracts
      ambient.js            # Music: autoplay, left-edge dock
      wallpapers.js         # Daily remote + bundled classics + hearts
      bible-live.js
      bible-config.js
    wallpapers/
  data/
    verses.json             # Themes + verses with context/application/prayer
    playlists.json          # Spotify / YouTube stations
    wallpapers.json
    remote-wallpapers.json
  manifest.webmanifest
tools/test-site.mjs         # Structural and local-reference validation
```

## Meditation

- On load: today’s verse (date-seeded), unless `?v=` names a catalog reference.
  Context, application, and prayer stay in a collapsed Reflect disclosure on
  the card (closed again each time the verse renders). Topic chips, live text,
  translation, and the one-line keys hint sit in **Topic & translation**,
  closed until opened. `?t=` selects a topic and opens that disclosure; `?tr=`
  selects ESV/NIV/NKJV. Unknown values fall back to today/prefs. Navigation
  `replaceState`s the canonical query so the address bar matches the card.
  Open/closed state is not stored.
- Topic chips + topic cards filter meditation. **Practice this verse**, **Drill**,
  and **Focus** live under More. Practice opens Fill blanks for the card only;
  Drill opens the topic playlist. Topics, Bible books, and Memorize bodies start
  collapsed; Progress & tools is nested inside Topics. Nav links and in-page
  jumps open a collapsed section before scrolling to or focusing inside it.
- **Amen** tracks a local daily streak. **Focus** hides More and the music
  dock so the verse, Amen, and Prev/Next stay primary, and leaves Exit focus
  one tap away. Music keeps playing.
- Share / Copy link encode that URL so a partner can reopen the same verse.
- More → **Save verse** toggles the current reference. **Saved verses** reopens passages with the selected translation and offers Remove. Only bundled catalog references are retained in stats `savedVerses`; backup/import and Reset progress include the collection. Blocked writes are visit-only and exportable.
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

Feature research and next priorities: `docs/FEATURE_ROADMAP.md`.

## Bible books

Add a book with a new entry in `docs/data/verses.json` → `books`, using the same fields as a theme. Cards render from data only; book drills do not change Themes done.

## Music

- Autoplay on load: last station (`versekeep-music`) or default Spotify **God’s encouragement** (`alph-gods-encouragement`).
- **Left-edge dock** (`#worship`): vertical tab opens/closes the panel; open state in `versekeep-music-ui-v5`.
- Player shell stays **inside the dock slot only** (no free-float / drag). Iframe stays mounted when closed so audio never cuts. Nav **Music** toggles the dock.
- Playlist metadata: `docs/data/playlists.json` (categories; “From Alphaeus” first).

## Wallpapers

- Daily Unsplash CDN suggestions + bundled offline classics.
- Hearts / most-loved: best-effort remote counter (see `docs/assets/js/wallpapers.js`).
- Bible-truth sets ship in three looks: **lo-fi** (`lofi-`, `style: lofi`), **masculine / realistic** (`masc-`, `style: realistic`), and **minimal** (`min-`, `style: minimal`). Each theme needs desktop 16:9 plus `phone/<id>-phone.jpg`.
- Daily generation playbook: `/home/alph/projects/.grok/schedules/versekeep-wallpapers.md`. New themes must be a real biblical passage, never extra-biblical legend.

## Live Bible

- Default translation: **ESV** (also **NIV**, **NKJV** in the UI select).
- Live fetch in `docs/assets/js/bible-live.js`; bundled `docs/data/verses.json` is always the offline fallback.
- Optional official ESV API key in `docs/assets/js/bible-config.js` (`esvApiKey`) if you add a proxy.

## Header UX

- Sticky `.topbar` auto-hides on scroll-down at every viewport size and returns on scroll-up; external http nav links remain hidden on small screens.

## Commands

```bash
cd /home/alph/projects/VerseKeep
python3 -m http.server 8081 --directory docs
# http://127.0.0.1:8081/

node tools/test-site.mjs
node tools/test-data-core.mjs
node --check docs/assets/js/app.js
node --check docs/assets/js/ambient.js
node --check docs/assets/js/wallpapers.js
npm run test:browser
```

Footer version string comes from `docs/assets/js/version.js` — bump its
`SITE_VERSION.id` once per deploy.

## Conventions

- Zero-build static site; gold/cream dark theme.
- Prefer editing `docs/data/verses.json` / `docs/data/playlists.json` for content, not hardcoding lists in JS.
- Keep music dock independent of practice; closed dock must not stop audio.
- Don’t commit API keys.
- Keep header cross-links limited to ChristoDay, Biblical Truth, and the
  portfolio. Source code stays in the footer.

## Deploy

GitHub Pages: **`main` / `docs`**.

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

- Icon control rule: use the shared inline SVG set in icons.js (24px, currentColor, stroke 2), never glyph icons or CSS chevrons. Visual buttons are 40px squares with 12px radius, 48px effective tap targets and 8px gaps. Keep practice actions in one row at 320px; fold panels open below triggers. Use aria-label and shared #vk-tip on hover, keyboard focus, and touch tap (1500ms); omit duplicate titles. Keep disclosure headings and ambiguous mode labels visible, and Check primary with text.
