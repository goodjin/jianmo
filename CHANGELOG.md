# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.7.1] - 2026-05-02

### Added

- `exportErrors.formatExportFailure` for PDF/HTML export user-facing errors; tests in `exportErrors.test.ts`.
- Diagnostics `doc.docBaselineTier` (xs–xl) for document size baseline (M₈).
- Image paste: toast when compressing over threshold and when file nears max size; `compressThreshold` follows workspace config.

### Changed

- Rich focus restoration: `queueRichFocus` uses double `requestAnimationFrame`; find-match activation refocuses Rich.
- Outline scroll spy throttled (120ms) with timer cleanup on unmount.
- Rich tables: scrollable max-height in editor (`style.css`).
- A11y: app root `role="application"`, toolbar `role="toolbar"`, `ToolbarButton` `aria-label`.
- Docs: M₄₅/M₄₆ Rich vs Source table; README Shiki, release checklist, UI test pointer; milestones M₁–M₅₀ all satisfied in matrix.

## [1.7.0] - 2026-05-02

### Added

- PDF export: workspace-driven margins/format/TOC/header-footer via `pdfExportOptionsFromPdfConfig`; print-oriented CSS for tables, code blocks, and block math.
- PDF export: pre-flight warning when local image refs are missing; `<base>` for relative assets.
- AI assist: `rewriteSelection` host path with mock and OpenAI-compatible provider, SecretStorage API key, timeout, and error snippet redaction; extension tests.
- Plans and roadmap updates for M38–M47 (`docs/m38`–`m47`, `product-roadmap-2026.md`).
- Stable gate script documentation: `npm run gates:stable` and UI test guidance in README / `m46-stable-gates-plan.md`.

### Changed

- README configuration table expanded for PDF, HTML theme, and AI rewrite settings.
