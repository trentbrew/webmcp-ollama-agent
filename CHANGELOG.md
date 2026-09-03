# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1] - 2026-09-02

Release readiness pass for the Chrome Web Store submission.

### Fixed
- **Shimmer label invisible while streaming** — the `Thinking…` label used
  `currentColor` in its gradient but set `color: transparent`, so the text
  rendered fully transparent. Painted the fill transparent via
  `-webkit-text-fill-color` instead so `currentColor` stays the real text color.
- **Chat background was a cool hue** — the daisyUI `dark` base tokens had a blue
  cast (`#1c1c1e`, `#252528`, `#141416`, `#d4d4d8`). Neutralized to pure grays
  (`#1c1c1c`, `#252525`, `#141414`, `#d4d4d4`) so the panel reads true neutral.
- **Empty-state dot matrix didn't render** — implemented the shared
  `.surface-dot-matrix` utility, painting dots on a `::before` so the radial
  vignette fades only the texture and never the centered content. Vignette
  inverted (dots dense at center, fade outward). Applied to the MCP, Traces, and
  Evals empty states only — not Chat.

### Added
- **MCP tool search** — a search field at the top of the MCP tab that filters
  tools by name/title/description, with a matched/total count badge, a clear
  (×) control, and a "No matching tools" state.
- **Store assets script** — `scripts/store-assets.mjs` (+ `just store-assets`)
  validates screenshots are 1280×800/640×400 and generates upload copies and
  promo tiles **without ever modifying the source files** (`sips --out`).
- **Web Store listing + justification** — `docs/webstore-listing.md` with the
  single purpose, description, per-permission rationale, and a no-login / no-cloud
  note. Privacy policy refreshed for the active-tab-only scope.

### Changed
- **Default split swapped** — the chat (left) pane is now the wider pane when
  split (56/44).
- **Active-tab scoping** — removed the cross-tab tool/trace badge aggregation
  (`nav-summary`) so the extension no longer reports how many tools/traces exist
  on other tabs; it is scoped exclusively to the active tab.
- **Content-script perf** — the `modelContext` poll only runs its long loop when
  the accessor trap can't be installed; startup tab injection uses a bounded
  concurrency pool instead of scripting every tab at once.

### Store readiness
- Packaged `extension.zip` (1.0.1) with no `.map`, `DS_Store`, or test fixtures.

---

## [1.0.0] - 2025-10-19

### Added

#### License & Attribution
- **MIT License** (`LICENSE.md`) - Open source license for the project
- **Author attribution** in README with Ko-fi and GitHub links
- **Ko-fi support integration** throughout the UI

#### Ko-fi Support Features
- **Help Page Support Card** - Prominent gradient card with:
  - Orange-to-pink gradient background
  - Coffee and Heart icons
  - Call-to-action button linking to ko-fi.com/trentbrew
  - Thank you message
  
- **Footer Component** (`/src/lib/components/Footer.svelte`) with:
  - "Made with ❤️ by Trent Brew" attribution
  - Copyright notice with MIT License
  - "Buy me a coffee" link with coffee icon
  - Animated heart icon
  - Clean, minimal design that works with all themes
  
- **README Support Section** with:
  - Ko-fi button badge
  - Support link
  - Author information with Ko-fi and GitHub links

#### Theme System
- **33 DaisyUI themes** available via Theme Controller
- **LocalStorage persistence** for theme preference
- **Theme categories** (Light & Dark) in dropdown
- **Visual indicators** for active theme

#### Navigation
- **4-page navigation** system with dock icons
- **Components page** added to navbar
- **Active state highlighting** in navigation

#### Dialog System
- **3 dialog types**: Basic Modal, Confirmation Dialog, Form Dialog
- **Real-time form validation** in Form Dialog
- **Dynamic button states** based on validation
- **Success alerts** for completed forms

#### Icon System
- **Lucide Svelte icons** integrated (30+ icons)
- **Coffee and Heart icons** for Ko-fi support
- **Chrome CSP compliant** SVG icons
- **Theme-aware** with currentColor support

### Modified
- Updated README with support section and author info
- Enhanced Help page with Ko-fi support card
- Added Footer to HomePage
- Expanded icon registry with Coffee and Heart icons

### Technical Details
- All Ko-fi links open in new tab with `target="_blank"`
- Security: `rel="noopener noreferrer"` on external links
- Accessibility: Proper ARIA labels and semantic HTML
- Responsive: Works on all screen sizes
- Theme compatible: Looks great on all 33 themes

---

## Support the Project

If you find this project helpful, please consider:
- ⭐ Starring the repository
- ☕ [Buying me a coffee on Ko-fi](https://ko-fi.com/trentbrew)
- 🐛 Reporting bugs and suggesting features
- 📢 Sharing with others

Thank you for your support! ❤️

---

**Author**: Trent Brew  
**License**: MIT  
**Ko-fi**: [ko-fi.com/trentbrew](https://ko-fi.com/trentbrew)
