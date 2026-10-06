# HireTrail — Design Plan

## How Might We Questions

1. **HMW** help job seekers quickly see where each application stands without digging through spreadsheets?
2. **HMW** reduce the anxiety of "did I follow up?" by surfacing stale applications?
3. **HMW** make adding a new application feel so lightweight that users actually do it?
4. **HMW** celebrate progress (e.g., moving to Interview) so the tracker feels motivating, not clinical?
5. **HMW** keep the interface usable on a phone during a networking event when someone asks "where are you in the process with us?"

---

## Empathy Map — Job Seeker (Primary Persona: "Tolu")

| Quadrant | Insights |
|----------|----------|
| **Says** | "I applied to so many places I lost track." / "Did I already email them?" / "I need one place to see everything." |
| **Thinks** | *Am I being ghosted?* / *Should I follow up again?* / *I hope I don't double-apply.* |
| **Does** | Checks email constantly. Maintains a messy Notes app list. Forgets to update statuses. Screenshots rejection emails. |
| **Feels** | Overwhelmed by volume. Anxious about silence. Small wins (interview invite) feel huge. Guilty about disorganization. |

---

## ASCII Grayscale Wireframe — Mobile-First (320px)

```
┌──────────────────────────────────┐
│ [≡] HireTrail          (header)  │  ← logo + hamburger
├──────────────────────────────────┤
│ Track every application,         │  ← hero
│ land the right role.             │
│ [ ＋ Add Application ]            │
├──────────────────────────────────┤
│ ┌──────────────────────────────┐ │
│ │ STATS                        │ │  ← aside (collapsible)
│ │ To Contact: 3  Contacted: 5  │ │
│ │ Interview: 2   Offer: 1      │ │
│ │ Closed: 4                    │ │
│ │ [Search company...]          │ │
│ │ [Filter: All Stages ▾]       │ │
│ └──────────────────────────────┘ │
├──────────────────────────────────┤
│ STAGE TABS:                      │
│ [To Contact|Contacted|Intvw|...] │  ← tab bar for stages
├──────────────────────────────────┤
│ ┌──────────────────────────────┐ │
│ │ Acme Corp                    │ │  ← article card
│ │ Frontend Developer           │ │
│ │ Contact: Jane (j@acme.com)   │ │
│ │ Applied: Oct 1, 2026         │ │
│ │ Stage: [Contacted ▾]         │ │
│ │ [Edit] [Delete]              │ │
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ Globex Inc                   │ │
│ │ ...                          │ │
│ └──────────────────────────────┘ │
├──────────────────────────────────┤
│ HireTrail © 2026       (footer) │
└──────────────────────────────────┘
```

### Tablet (768px) — Two-Column Stage Grid

```
┌──────────────────────────────────────────┐
│ HireTrail    [To Contact|Contacted|...]  │  ← inline nav
├──────────────────────────────────────────┤
│ Track every application, land the right  │
│ role.                  [＋ Add App]       │
├──────────────┬───────────────────────────┤
│ STATS        │ ┌─────────┐ ┌─────────┐   │
│ TC: 3  C: 5  │ │Card     │ │Card     │   │  ← 2-col grid
│ IV: 2  O: 1  │ │         │ │         │   │
│ CL: 4        │ └─────────┘ └─────────┘   │
│ [Search...]  │ ┌─────────┐ ┌─────────┐   │
│ [Filter ▾]   │ │Card     │ │Card     │   │
│              │ └─────────┘ └─────────┘   │
├──────────────┴───────────────────────────┤
│ HireTrail © 2026                         │
└──────────────────────────────────────────┘
```

### Desktop (1024px+) — Sidebar + Board

```
┌──────────────────────────────────────────────────────┐
│ HireTrail   [To Contact] [Contacted] [Intvw] [Offer] │
├──────────────┬───────────────────────────────────────┤
│ STATS        │ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│              │ │Card      │ │Card      │ │Card      ││
│ [Search...]  │ │          │ │          │ │          ││
│              │ └──────────┘ └──────────┘ └──────────┘│
│ [Filter ▾]   │ ┌──────────┐ ┌──────────┐            │
│              │ │Card      │ │Card      │            │
│              │ └──────────┘ └──────────┘            │
├──────────────┴───────────────────────────────────────┤
│ HireTrail © 2026                                     │
└──────────────────────────────────────────────────────┘
```

---

## Design Tokens (CSS Custom Properties)

| Token | Value | Usage |
|-------|-------|-------|
| `--color-mocha` | `#A58A6F` | Accents, borders, primary buttons |
| `--color-mocha-dark` | `#8B7355` | Button hover states |
| `--color-ethereal` | `#A0D4E0` | Highlights, focus, secondary buttons |
| `--color-ethereal-dark` | `#7DB8C6` | Secondary button hover |
| `--color-bg` | `#F2F0EA` | Page background (Moonlit Grey) |
| `--color-text` | `#3E2F23` | Body text (dark brown, 4.5:1+ on bg) |
| `--color-text-light` | `#6B5D52` | Secondary/muted text |
| `--color-white` | `#FFFFFF` | Card backgrounds |
| `--color-danger` | `#C0392B` | Delete actions |
| `--color-success` | `#2E7D32` | Offer stage highlight |
| `--font-heading` | `'Montserrat', sans-serif` | Headlines |
| `--font-body` | `'Open Sans', sans-serif` | Body text |
| `--radius` | `0.5rem` | Border radius |
| `--shadow` | `0 2px 8px rgba(62,47,35,0.1)` | Card shadow |

## Breakpoints

- **Default (mobile)**: 0–767px — single column, stage tabs, hamburger menu
- **Tablet**: 768px–1023px — two-column stage grid, inline nav
- **Desktop**: 1024px+ — sidebar + multi-column board

## Contrast Verification (WCAG AA)

| Foreground | Background | Ratio | Pass? |
|-----------|-----------|-------|-------|
| `#3E2F23` (text) | `#F2F0EA` (bg) | ~8.5:1 | ✅ AAA |
| `#3E2F23` (text) | `#FFFFFF` (card) | ~10.8:1 | ✅ AAA |
| `#FFFFFF` (btn text) | `#A58A6F` (mocha) | ~3.2:1 | ⚠️ Only for large text |
| `#3E2F23` (btn text) | `#A58A6F` (mocha) | ~4.6:1 | ✅ AA |
| `#3E2F23` (text) | `#A0D4E0` (ethereal) | ~5.8:1 | ✅ AA |

**Decision**: Use dark brown (`#3E2F23`) text on mocha buttons instead of white to ensure AA compliance. Reserve white text only for the danger (delete) button with its darker background.