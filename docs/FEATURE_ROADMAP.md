# VerseKeep feature roadmap

Research date: 2026-10-14 (Asia/Singapore).

## Implemented: saved meditation verses

Visitors can favorite a topic, resume yesterday's meditation, and review practiced verses, but cannot keep a particular meditation passage for later. Saving a reference gives them a small personal collection without making practice the primary experience.

Evidence: [YouVersion's official Saved Verses guide](https://help.youversion.com/l/en/article/8rj5udr7le-saved-verses-android) describes saving passages to return to and viewing them together. This supports the need; it is not evidence that VerseKeep visitors requested this feature. [W3C's button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/) specifies a stable label and `aria-pressed` for toggle buttons.

Scope: a Save verse toggle in More; a compact Saved verses disclosure with reference buttons and Remove actions; references only, kept locally with existing practice statistics. Reopening uses the existing meditation navigation and selected translation. No account, cloud sync, passage text copies, labels or notes.

Acceptance:

- Save/remove the current reference; duplicates across topics produce one entry.
- Reopen a saved reference with its context, application and prayer; canonical URL matches and translation stays selected.
- Existing backup export/import carries saved references. Older backups restore an empty collection. Reset progress clears the collection.
- Only references in the bundled catalog can be saved, restored or opened. Invalid persisted/imported reference keys are discarded.
- Denied writes retain the collection during this visit and clearly disclose that it was not saved on the device; export includes that visit's references.
- Native buttons expose their state to assistive technology. Focus mode hides collection chrome, and phone layouts remain compact.
- Regression checks cover reload, remove, backup restore, reset, denied storage and canonical navigation; all existing Node/browser gates pass.

## Next priorities

1. Practice a chosen subset of saved verses, using existing bounded review controls; first observe whether visitors use the collection.
2. Optional private reflection notes, after deciding retention, backup limits and the distinction from the owner's supplied application/prayer.
3. Labels for larger saved collections, following evidence of a navigation need; keep the initial collection simple.

These are proposals, not shipped capabilities. Saved verses remains device-local and clearing browser data removes it unless a backup was exported.
