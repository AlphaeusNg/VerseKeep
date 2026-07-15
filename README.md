# VerseKeep

Christian **Scripture memory** games in the browser — by theme.

**Play:** https://alphaeusng.github.io/VerseKeep/  
**Portfolio:** https://alphaeusng.github.io/  
**Related:** [Seeking Biblical Truth](https://alphaeusng.github.io/pages/seeking-biblical-truth/) · [AlpArcade](https://alphaeusng.github.io/AlpArcade/)

## Themes (starter set)

- Trusting in God  
- God's character  
- Reality of sin  
- The gospel  
- Nourish & cherish your wife  
- Apologetic anchors  
- Prayer & the Word  

Edit / extend verses in `data/verses.json`.

## Modes

1. **Study** — read the verse  
2. **Fill blanks** — missing words  
3. **Type it** — free recall (fuzzy match)  
4. **Order words** — rebuild sequence  
5. **Which verse?** — pick the reference  

## Worship music

Curated **YouTube** and **Spotify** embeds in the Worship section — tap a station to play. Spotify may require a free login. Preferences stick in `localStorage`.

## Live Bible text

| Source | Status on static GitHub Pages |
|--------|--------------------------------|
| **bible-api.com** (WEB/KJV/…) | Works in-browser, no key, CORS OK — default |
| **Bundled** `data/verses.json` | Always available offline |
| **ESV API** | Free key at [api.esv.org](https://api.esv.org/) — often **blocked by CORS** in pure browser apps; needs a tiny proxy/server to use reliably |
| **YouVersion** | Official API needs an app key from [platform.youversion.com](https://platform.youversion.com/) — not suitable for a public static client key |

Optional: set `esvApiKey` and `preferred: "esv"` in `js/bible-config.js` if you add a proxy.

## Wallpapers (1920×1080)

Christian-themed HD backgrounds under `assets/wallpapers/`. Tap to apply; **Download 1920×1080** for desktop use.

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
