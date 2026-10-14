# VerseKeep UI sizing audit

Audited 2026-10-14. Release: `2026.10.14.2`.

## Method

Chromium at 320, 375, 768 and 1280 CSS pixels, plus 375px with computed font sizes doubled and 768px at 200% page zoom. Each pass opens meditation, saved verses, practice modes, review, wallpaper formats, the background preview and the music dock. Document scroll width, clipped control labels and wallpaper actions leaving their cards are asserted in `tools/browser/sizing.spec.mjs`.

## Findings and fixes

Wallpaper phone-crop preview text and the fixed-size preview image could extend a 375px page by 4px when text was doubled. The preview image now stays within its grid column, and the crop description wraps.

Compact wallpaper actions, topic titles and saved-verse rows keep a 24px minimum where they sit beside other targets, and they wrap inside the card when the card is narrow. Topic chips stay in their own horizontal scroller. The wallpaper summary can clip its secondary line; that disclosure is excluded from the clipped-label check because the full label remains on the summary's accessible name and the panel opens in place.

## Validation

Six sizing configurations passed. All seven Node gates passed. Inline verse controls, the music embed and intentional chip scrolling were left as they are.
