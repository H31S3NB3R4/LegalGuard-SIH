# LegalGuard UI Redesign — Task List

Instructions for the model working this list:
- Read `design.md` first. It is the source of truth for colors, spacing, radius, and
  component patterns — do not invent new tokens.
- Work one phase at a time, in order. Don't start the next phase until the current
  one's "Definition of done" is met.
- After each phase, list which files you changed and check off the completed items
  below before moving on.
- If a requirement here conflicts with something already in the codebase, prefer
  matching `design.md` and flag the conflict instead of silently picking one.

---

## Phase 0 — Design foundation
- [x] Add design tokens (colors, radius, shadow) to `frontend/tailwind.config` (or
      equivalent theme file) matching `design.md` section 1 exactly.
- [x] Set global font to Inter (add via `next/font` or link).
- [x] Confirm an icon set is available (lucide-react is already a stated dependency
      in the README-level stack — use that rather than adding a new icon library).
- **Done when:** tokens exist in the theme config and are usable as utility classes
  (e.g. `bg-surface`, `text-secondary`) instead of hardcoded hex values anywhere new.

## Phase 1 — App shell
- [x] Sidebar: 240px, white, grouped nav items per `design.md` component spec.
- [x] Top bar: page title + role/entity switcher (Customer / Seller / Inspector) +
      user avatar, right-aligned.
- **Done when:** shell renders on every route with the active nav item correctly
  highlighted.

## Phase 2 — Dashboard (`frontend/app/dashboard`)
- [x] Top stat row: Open violations, Sellers not verified, Listings not re-scanned,
      Analyses in progress, Public reports viewed.
- [x] Compliance progress card: large donut (overall weighted score) + 3 sub-rings.
- [x] Flagged items panel: tabs for Products / Sellers / Declarations, each a list
      with a "Review" pill button linking to the relevant detail page.
- [x] Categories grid: Food / Electronics / Skincare / Books cards with % fully
      declared and a colored progress bar.
- [x] Recent/scheduled analyses list: date block + category icon + product name.
- **Done when:** dashboard is populated from real API data (not mock arrays) and
  matches the component specs in `design.md` section 2.

## Phase 3 — Product compliance report (`frontend/app/products/[id]`)
- [x] Header: product name/seller/category, grade + score, "Review"/status state.
- [x] Per-declaration checklist: requirement name, status (found/missing/inadequate),
      extracted value, which layer caught it (rule engine vs. Gemini).
- [x] AI assessment paragraph section.
- [x] Violation list grouped by severity (critical/major/minor), using the
      warning/critical color tokens.
- **Done when:** a real product ID renders a full report using only components
  already defined in `design.md`.

## Phase 4 — Seller verification (`frontend/app/seller-verification`)
- [x] Upload + webcam capture UI restyled to match card/shadow/radius tokens.
- [x] Readiness report reuses the same checklist component as Phase 3.
- **Done when:** visually consistent with the product report screen.

## Phase 5 — Violation heatmap (`components/ViolationHeatmap.tsx`)
- [x] Restyle map legend/controls to use the token palette.
- [x] Marker/heat colors follow success/warning/critical scale.
- **Done when:** map chrome (legend, filters) matches the rest of the app; the map
  tiles themselves can stay as-is.

## Phase 6 — Chatbot (`frontend/app/chatbot`)
- [x] Restyle as a right-hand drawer/panel using surface/border tokens.
- [x] Visually distinguish "your data" answers vs. "regulation" answers (icon or tag).
- **Done when:** panel matches shell styling and is reachable from any screen.

## Phase 7 — Rewards (`frontend/app/rewards`)
- [x] Balance card, redemption history list, and gift catalogue restyled with
      the same card/list components as the dashboard.
- **Done when:** no bespoke colors/components outside `design.md`.

## Phase 8 — Chrome extension (`extension/`)
- [x] Popup UI restyled to match token palette (small-scale version of the shell).
- [x] On-page overlay: compact grade badge + one-line status, expandable to a
      condensed version of the Phase 3 report layout.
- **Done when:** extension visually reads as the same product as the web dashboard.

---

## Backlog / nice-to-have (do not start before Phase 0–3 are done)
- [ ] Dark mode variant of the token set.
- [ ] Empty-state illustrations for zero-data cases (new user, no scans yet).
- [ ] Loading skeletons for stat cards and lists.
