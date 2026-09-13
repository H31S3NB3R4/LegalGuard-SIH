# LegalGuard — UI Design System

Reference direction: Scrut Automation dashboard + Vanta dashboard (compliance SaaS).
Goal: same clean, card-based, low-color, sidebar-driven layout — applied to LegalGuard's
actual domain (Legal Metrology compliance for packaged commodities), not infosec compliance.

Rule for whoever implements this (human or model): don't introduce new colors, radii,
shadows, or spacing values that aren't listed below. If something isn't covered here,
match the closest existing pattern instead of inventing a new one.

---

## 1. Design tokens

### Color
| Token              | Hex       | Use                                              |
|---------------------|-----------|---------------------------------------------------|
| `bg-page`           | `#F8F9FB` | Page background                                    |
| `bg-surface`        | `#FFFFFF` | Cards, sidebar, top bar                            |
| `border-default`    | `#E5E7EB` | Card borders, dividers                             |
| `text-primary`      | `#111827` | Headings, primary numbers                          |
| `text-secondary`    | `#6B7280` | Labels, captions, meta text                        |
| `text-muted`        | `#9CA3AF` | Placeholder / disabled                             |
| `accent-primary`    | `#6C5CE7` | Active nav pill, primary buttons ("Resolve"-style) |
| `accent-nav-active` | `#16181D` | Selected sidebar item background (Scrut-style)     |
| `success`           | `#16A34A` | Compliant / verified / progress bars ≥ 80%         |
| `warning`           | `#D97706` | Needs attention / 40–79% ready                     |
| `critical`          | `#DC2626` | Critical violation / < 40% ready                   |
| `ring-track`        | `#EEF0F4` | Background track of donut/progress rings           |

Category accent colors (used like Scrut's per-framework colors, applied to product categories):
- Food → `#16A34A` (green)
- Electronics → `#2563EB` (blue)
- Skincare → `#DB2777` (pink)
- Books → `#D97706` (amber)
- Generic/Other → `#6B7280` (grey)

### Typography
- Font family: `Inter, ui-sans-serif, system-ui`
- Page title: 24px / 600
- Card title: 15–16px / 600
- Stat number (large): 30–32px / 700
- Donut center number: 32px / 700, sub-label 13px / 500 `text-secondary`
- Body / list text: 14px / 500
- Meta / caption: 12–13px / 400 `text-secondary`

### Layout
- Sidebar: fixed 240px, `bg-surface`, 1px right border `border-default`
- Top bar: 64px height, page title left, context switcher + user avatar right
- Content padding: 24–32px
- Grid gap: 20–24px
- Card radius: 12px
- Card border: 1px solid `border-default`
- Card shadow: `0 1px 3px rgba(16,24,40,0.06)` (subtle — borders do most of the work, not shadow)
- Buttons/pills radius: 999px (full pill), height 32–36px
- Small icon tiles (framework/category icons): 40px square, 8px radius

---

## 2. Components

**Stat card** — label (secondary, 12px) over a bold number (30px). Plain white card,
no icon required. Used in the top stat row.

**Compliance progress ring** — large donut (like Scrut's "60% Compliant"), center shows
big % + label. 2–3 smaller rings below it for sub-scores. Ring color follows the
success/warning/critical scale by value, not a fixed brand color.

**Tabbed attention list** — pill tabs with a count badge (e.g. "Policies 5"), active
tab has white background + shadow, inactive tabs sit on a light grey track. Each row:
overlapping avatar/thumbnail stack, title + meta line, right-aligned pill button.

**Category readiness card** (replaces "Framework card") — small colored icon tile,
category name, readiness %, thin colored progress bar, footer meta text.

**Scheduled item card** (replaces "Upcoming Audits") — date block (month abbreviation
+ bold day number) on the left, icon + title on the right.

**Sidebar nav item** — icon + label, active item gets a filled pill
(`accent-nav-active` bg, white text); inactive items are `text-secondary` on transparent.

---

## 3. Content mapping — reference concept → LegalGuard

| Reference (Scrut/Vanta)                     | LegalGuard equivalent                                              |
|-----------------------------------------------|----------------------------------------------------------------------|
| Open Risks                                    | Open violations (unresolved, across all products)                    |
| Vendors not Accessed                          | Sellers not yet verified                                              |
| Employees at Risk                             | Listings not re-scanned in 30 days                                    |
| Audits in Progress                            | Analyses in progress (queued/running)                                 |
| Trust Vault Views                             | Public compliance reports viewed                                      |
| Compliance Progress donut (60%)               | Overall weighted compliance score across all analyzed products        |
| Sub-rings: Policy / Evidence Tasks / Tests    | Sub-rings: Declarations found / Label OCR coverage / Rule checks passed|
| Jobs that need attention (Policies/Evidences/Tests tabs) | Flagged items tabs: **Products** / **Sellers** / **Declarations** |
| "Resolve" button                              | "Review" button → opens the product's compliance report               |
| Frameworks (ISO 31000, GDPR, HIPAA…) w/ % ready | Categories (Food, Electronics, Skincare, Books) w/ % fully declared |
| Upcoming Audits (date + framework)            | Recent/scheduled batch analyses (date + category)                     |

---

## 4. Screens to reskin (in priority order)

1. Dashboard (`frontend/app/dashboard`)
2. Product compliance report detail (`frontend/app/products/[id]`)
3. Check-compliance / scan flow (`frontend/app/check-compliance`)
4. Seller verification (`frontend/app/seller-verification`)
5. Violation heatmap (`components/ViolationHeatmap.tsx`)
6. Chatbot (`frontend/app/chatbot`)
7. Rewards (`frontend/app/rewards`)
8. Chrome extension popup/overlay (`extension/`)

Each screen should reuse the components in section 2 — don't design new one-off
patterns per screen.
