# 🍼 Baby Checklist

A modern, mobile-first baby essentials checklist for first-time parents.

![Baby Checklist Icon](concept_c_transparent.png)

## Features

- **Category Dashboard** — visual grid of category cards with progress tracking
- **Drill-Down Drawer** — tap a card to see and check off items (slides from right on desktop, bottom sheet on mobile)
- **Section Tabs** — switch between Newborn Essentials and Hospital Bag
- **Smart Filters** — search + filter by priority (Essential, Recommended, Nice to Have) or status (Pending)
- **Real-Time Progress** — animated hero ring, per-card progress bars, and "Essentials Left" callout
- **Offline-Ready** — localStorage persistence, PWA manifest, works without internet
- **Responsive** — desktop (4-col grid), tablet (2–3 col), mobile (2-col + bottom sheet drawer)

## Tech Stack

Pure vanilla — zero dependencies:
- **HTML5** / **CSS3** (custom properties, CSS Grid, animations)
- **JavaScript** (ES6+, IIFE module pattern)
- **localStorage** for persistence (Google Sheets sync coming soon)

## Getting Started

Just open `index.html` in a browser. No build step needed.

## Roadmap

- [ ] Google Sheets API integration (OAuth 2.0)
- [ ] Multi-user support (shared sheet, per-user state)
- [ ] Dark mode toggle
- [ ] Confetti on 100% category completion

## License

MIT
