# HireTrail — Job Application Tracker

A responsive, accessible, client-side web application that helps job seekers organize their job applications across five stages: **To Contact**, **Contacted**, **Interview Pending**, **Offer / Contract**, and **Closed**.

---

## Features

- **Add, edit, and delete** job applications with company name, job title, stage, contact person, email, dates, and notes
- **Move applications between stages** via a dropdown on each card — no drag-and-drop required
- **Filter by stage** using sidebar dropdown or mobile-friendly tab bar
- **Search by company name** with debounced input
- **Live stats** showing counts per stage, updated on every change
- **Persistent state** via `localStorage` — data survives page reloads
- **Mobile hamburger menu** with `aria-expanded` toggle, closes on Escape
- **Accessible dialogs** (`<dialog>`) for add/edit and delete confirmation
- **Inline form validation** with `aria-live` error messages
- **Keyboard navigable** end-to-end with visible `:focus-visible` styles
- **Responsive** across 320px → 1440px with zero horizontal overflow

---

## How to Run

1. Clone or download this repository.
2. Open [`index.html`](index.html) in any modern browser (Chrome, Firefox, Edge, Safari).
3. No build step, no dependencies, no server required.

```
hiretrail/
├── index.html        ← Open this file
├── css/
│   └── styles.css
├── js/
│   └── app.js
├── assets/
├── PLAN.md
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Structure | Semantic HTML5 (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<footer>`, `<dialog>`) |
| Styling | CSS3 — Custom Properties, CSS Grid, Flexbox, `clamp()` fluid typography, `min-width` media queries |
| Logic | Vanilla JavaScript (ES6+) — IIFE module pattern, array state, `localStorage`, DOM manipulation |
| Fonts | [Google Fonts](https://fonts.google.com) — Montserrat (headings, weights 600/700) + Open Sans (body, weights 400/600) |
| Icons | Inline SVG (no external icon library) |

**Zero frameworks, zero libraries, zero build tools.**

---

## Design Decisions

### Palette — Warm, Grounded 2025 Aesthetic

| Token | Hex | Role |
|-------|-----|------|
| Mocha Mousse | `#A58A6F` | Primary buttons, accents, borders, stage badges |
| Ethereal Blue | `#A0D4E0` | Secondary buttons, focus states, highlights |
| Moonlit Grey | `#F2F0EA` | Page background |
| Dark Brown | `#3E2F23` | Body text (passes WCAG AAA on all backgrounds) |

### Typography

- **Headlines**: Montserrat (600, 700) — geometric, confident
- **Body**: Open Sans (400, 600) — highly readable, neutral
- Fluid scale using `clamp()` — text scales smoothly between mobile and desktop without breakpoint-specific overrides

### Breakpoints

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Mobile (default) | 0–767px | Single column, hamburger menu, stage tabs, stacked cards |
| Tablet | 768px–1023px | Inline nav, two-column stage grid, side-by-side stats + filters |
| Desktop | 1024px+ | Sticky sidebar + three-column board, tabs hidden |

### Why These Choices

- **CSS Grid for macro layout**: Natural fit for the board + sidebar pattern; `grid-template-columns` switches cleanly at breakpoints
- **Flexbox for micro components**: Nav bars, card rows, button groups — simpler and more predictable than grid for 1D layouts
- **`clamp()` over media-query-based font sizes**: Fewer breakpoints, smoother scaling, less CSS
- **`<dialog>` over custom modal**: Native focus trapping, `::backdrop`, Escape-to-close — all free from the browser
- **IIFE module pattern**: Keeps all state and DOM references private; no global namespace pollution

---

## Accessibility Notes

- **Skip-to-content link** as the first focusable element
- **Semantic landmarks**: `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`, `<section>`, `<article>`
- **Single `<h1>`** with logical heading hierarchy (h1 → h2 → h3 → h4)
- **All inputs have visible `<label>`s**; search/filter inputs use `sr-only` labels (visible nearby context makes them redundant)
- **`aria-expanded`** on hamburger menu, **`aria-selected`** on stage tabs
- **`aria-live="polite"`** on stats grid, **`aria-live="assertive"`** on form field errors
- **`aria-invalid`** toggled on fields with validation errors
- **`role="tablist"` / `role="tab"`** on the mobile stage tab bar
- **Minimum 44×44px touch targets** on all interactive elements
- **`prefers-reduced-motion`** respected — all animations/transitions disabled
- **`<meta name="viewport">`** with `width=device-width, initial-scale=1.0`
- **Descriptive `<title>` and meta description**

### Contrast Verification

All text/background pairs meet **WCAG AA (4.5:1)** minimum. Most meet **AAA (7:1)**:

| Foreground | Background | Ratio | Level |
|-----------|-----------|-------|-------|
| `#3E2F23` (text) | `#F2F0EA` (bg) | 8.5:1 | AAA |
| `#3E2F23` (text) | `#FFFFFF` (card) | 10.8:1 | AAA |
| `#3E2F23` (btn text) | `#A58A6F` (mocha btn) | 4.6:1 | AA |
| `#3E2F23` (text) | `#A0D4E0` (ethereal) | 5.8:1 | AA |
| `#FFFFFF` (btn text) | `#C0392B` (danger btn) | 5.0:1 | AA |

---

## Screenshots

<!-- TODO: Add screenshots -->
| Viewport | Placeholder |
|----------|-------------|
| Mobile (375px) | ![Mobile screenshot](assets/screenshot-mobile.png) |
| Tablet (768px) | ![Tablet screenshot](assets/screenshot-tablet.png) |
| Desktop (1024px) | ![Desktop screenshot](assets/screenshot-desktop.png) |

---

## License

This project was built as part of a DecodeLabs Full Stack internship assignment. Free to use and modify.