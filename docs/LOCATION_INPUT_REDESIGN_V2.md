# Location Input Maps-Style Redesign

**Date**: October 24, 2025  
**Status**: ✅ **Shipped**  
**Scope**: Birth City + Current Residence editors (`TabDetails`)  
**Owner**: Frontend Platform

---

## Executive Summary

The location picker now mirrors a lightweight Google/Apple Maps experience. Users type directly into a single search box, receive live suggestions, and must select an item before the field commits. The UI is intentionally minimal: no category pills, no loaders, no helper subtitles. Country flags give instant visual context, and selection rules guarantee we store either a Saudi city or a foreign country—never free text.

### What Changed
- **Minimal surface**: one text field with an inline clear button and a slim dropdown. No chips, no skeletons, no “warning” banners.
- **Fast suggestions**: requests debounce at 180 ms and reuse the existing `search_place_autocomplete` RPC without exposing any backend details to the UI.
- **Selection-required**: the field keeps uncommitted text after blur, but it stays highlighted and invalid until a suggestion is chosen (normalized payload remains `null`).
- **Saudi specificity**: selecting a Saudi suggestion keeps the city; anything else collapses to the country the RPC returns.
- **Visual affordances**: rows show the country flag emoji (🇸🇦 for Saudi cities, ISO flag for other countries). When the flag is unavailable we fall back to a neutral location glyph.

---

## Interaction Model

```
Idle
  │ focus
Typing ──┬─> Query queued (≥1 char)
         │       │ debounce (180 ms)
         │       ▼
         │   Autocomplete request
         │       │ response
         ▼       ▼
   Suggestions visible
         │
         ├─ select row → Commit selection → Dropdown closes → Field keeps Arabic label
         │
         └─ blur w/out selection → Clear input + normalized payload → Back to Idle
```

### Key Behaviours
- **No spinner**: the list simply updates when new data arrives. Previous results remain visible during round-trips.
- **Helper hint**: a single subdued line (`اختر موقعاً من القائمة لإتمام الحفظ`) appears whenever text exists without a committed selection, even after blur.
- **Clear button**: resets both the visible string and the normalized payload, cancelling any in-flight requests.
- **Keyboard**: `returnKeyType="done"`; we blur the field once a suggestion is selected.

---

## Data Contract

| Scenario | Display Text | Stored `normalized_data` |
|----------|--------------|---------------------------|
| Saudi city (`region === 'saudi'` & `place_type === 'city'`) | `display_name` (Arabic city) | original object with `city` + `country` (defaults applied if RPC omits pieces) |
| Non-Saudi result (city or country) | Country Arabic name (`country_name` fallback) | `{ original, country }` only — city key omitted |

Additional rules:
- Input clears existing selections immediately by sending `onNormalizedChange(null)` on any keystroke.
- The dropdown renders at most **8** items even if the RPC returns more.
- Normalized payloads always keep `confidence` (default `1`) to preserve downstream analytics.

---

## Implementation Checklist

- [x] New minimal component in `src/components/admin/fields/LocationInput.js`
  - Debounce + stale-request guard (sequence counter)
  - Flag emoji helper `countryCodeToEmoji`
  - Blur handler clears uncommitted input
- [x] Consumer wiring (`TabDetails`) left untouched – API remained `(value, onChange, normalizedValue, onNormalizedChange)`
- [x] Jest suite updated to the new UX contract (`LocationInput.test.js`)
- [x] Docs refreshed (this file) to explain rationale + data flow

---

## Testing Notes

- **Unit**: covers debounce, Saudi selection, foreign selection collapse, and blur-clearing behaviour.
- **Manual**: verified on iOS simulator (RTL) and Android emulator for keyboard dismissal, dropdown scroll, and emoji rendering. Ensure system font supports flag glyphs; fallback icon handles older Android builds lacking emoji flags.
- **Edge Cases**:
  - Blank/whitespace queries: does not trigger RPC.
  - Rapid typing: only the latest query resolves thanks to a sequence guard.
  - Slow network: previous suggestions remain until new results load (no flashing).

---

## Future Considerations

1. **Recent history** – optionally cache the last 3 picks per profile for quicker re-use.
2. **Offline fallback** – show a localized message if RPC fails repeatedly instead of silently clearing the list.
3. **Analytics** – log dropped free-text attempts to quantify friction.
