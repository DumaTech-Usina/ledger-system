# CLAUDE.md

Instructions for Claude when working on this project. The goal is to modernize the front-end (currently a single `index.html`), reorganizing the structure, updating the stack, and rebuilding the visuals with a new design concept.

## Editing scope

- **Never** modify any file outside `treasury/src/presentation/web/client`.
- All front-end code, assets, and configuration must live inside that directory.

## Stack

- **Build tool / framework:** Vite + React.
- **Styling:** Tailwind CSS. Do not introduce other UI/CSS libraries (e.g. Bootstrap, MUI, Chakra) unless explicitly requested.

## Browser support / responsiveness

- The app must work well on both **desktop and mobile**. Every screen/component must be built responsively from the start, not adapted after the fact.

## Architecture

- `src/components/` — reusable UI components (Button, Modal, Table, etc.)
- `src/features/` — feature modules (auth, dashboard, settings), each with its own components, hooks, and API calls
- `src/hooks/` — shared custom hooks
- `src/api/` — API client and typed request/response definitions
- `src/types/` — shared TypeScript types and interfaces
- `src/utils/` — pure utility functions

## Mandatory skill

- Invoke the `frontend-design` skill **before** writing any front-end code, in **every** session, with no exceptions — even if it was already invoked in a previous session.

## Workflow with visual references

**If a reference image is provided:**
- Match the layout, spacing, typography, and color exactly.
- Replace only the placeholder content (`https://placehold.co/` images, generic copy) with the real content.
- Do not improve, add extra styling, or add anything that isn't in the reference.

**If no reference image is provided:**
- Design from scratch with high quality, following the design guardrails below.

## Visual validation process

1. Take a screenshot of your output.
2. Compare it against the reference (when available).
3. Fix any mismatches found.
4. Take a new screenshot and compare again.
5. Repeat this cycle for **at least 2 rounds** of comparison.
6. Only stop once there are no noticeable visual differences, or the user says they're satisfied.
7. **⚠️ ALL SCREENSHOTS ARE TEMPORARY. NEVER save, commit, or leave screenshots inside the project. They exist only for your own comparison during the session and must be discarded afterward — the project directory must never contain screenshot files.**

## Design consistency

- Reuse existing effects, animations, and styles from the project whenever possible.
- Exceptions: when explicitly asked to (a) replicate something without adaptation, or (b) create something entirely from scratch.
- Always create both light and dark theme variants for any new component or screen.

## Autonomy

- Avoid asking for unnecessary permissions just to write code within the defined scope (`treasury/src/presentation/web/client`). Proceed directly.
