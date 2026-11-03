# Build plan

Each phase has one aim, the MCPs and skills to load, and an exit check that must pass before moving on.

| Status | Meaning |
|---|---|
| ✅ | Done and verified |
| ⏳ | Waiting on something outside the code |
| ⬜ | Not built yet |

## Phase 0: Discovery and documents ✅
**Aim:** understand the brief, the marks and the references before writing code.
- **Skills:** `pdf`, `frontend-design`, `make-interfaces-feel-better`
- **MCPs:** `context7` (Gradio Server mode)
- **Work:** read the PDF and rubric, study Vettly's settings idea (read-only), spike Gradio Server streaming, write PRD, ARD, PLAN, MARKS.
- **Exit:** every rubric row maps to a feature. Gradio streaming proven in a spike.

## Phase 1: RAG core ✅
**Aim:** document in, grounded answer out, with no UI.
- **Skills:** `async-python-patterns` only if needed, `verification-before-completion`
- **MCPs:** `context7` (FAISS, sentence-transformers)
- **Work:** `ingest.py`, `store.py`, `prompt.py`, `llm.py`, `pipeline.py`, sample PDF, `tests/test_rag.py`.
- **Exit:** tests pass. Chunk boundaries, retrieval ranking and the refusal gate all checked.

## Phase 2: Server ✅
**Aim:** the whole backend reachable from a browser, through Gradio.
- **Skills:** `fastapi-pro`, `security-auditor`
- **MCPs:** `context7`
- **Work:** `server.py`, `/classic`, upload validation, key storage, Host check.
- **Exit:** each route exercised over HTTP.

## Phase 3: The book and the page turn ✅
**Aim:** the thing people remember. A thick, torn register that turns pages like paper.
- **Skills:** `frontend-design`, `make-interfaces-feel-better`, `web-perf`
- **MCPs:** `playwright` (screenshots, frame checks), `better-icons`
- **Work:** desk, stacks, tears, gutter, tabs, routing, `flip.js`.
- **Exit:** screenshots show visible page edges. New page turns with real curvature, frame by frame.

## Phase 4: Chat ✅ (tested with a stand-in model only)
**Aim:** typing, sending and answering are all a pleasure to watch.
- **Skills:** `make-interfaces-feel-better`, `react-best-practices` not needed (no React)
- **MCPs:** `playwright`
- **Work:** composer ink, send flight, retrieval checklist, answer reveal, source slips, Folio column, refusal stamp, date stamp, companion.
- **Exit:** full question to answer on screen against a stand-in model. Source text displayed.

## Phase 5: Looks and Studio ✅
**Aim:** many real choices, each one well made.
- **Skills:** `frontend-design`, `tailwind-design-system` for token thinking only (no Tailwind)
- **MCPs:** `playwright` (screenshot every look)
- **Work:** 8 looks, fonts, paper, ink, entries, animations, layout, companion, Surprise me.
- **Exit:** every look screenshotted and readable.

## Phase 6: RAG panels ✅
**Aim:** make the invisible backend visible, for marks.
- **Skills:** `dataviz`
- **MCPs:** `playwright`
- **Work:** Papers (stages, Chunk Explorer), Engine (pipeline, vector strip, map, Retrieval Lab, prompt).
- **Exit:** real numbers from the real index on screen.

## Phase 7: Key Locker ✅
**Aim:** the separate, animated API key panel.
- **Skills:** `security-auditor`
- **MCPs:** `playwright`
- **Work:** key tags, lock-and-seal animation, guide steps, save, test, remove, provider switch.
- **Exit:** full key never returned by the API. Provider flow proven against a local stand-in.

## Phase 8: Tour ✅
**Aim:** five pages that teach the product and the backend.
- **Skills:** `artifact-diagramming` (diagram thinking)
- **MCPs:** `playwright`
- **Work:** 2 pages on use, 3 pages on backend, each with a live animation. Auto-opens on first visit.
- **Exit:** all five pages screenshotted.

## Phase 9: Marks page ✅
**Aim:** show the examiner every mark in seconds.
- **Skills:** `webapp-testing`
- **MCPs:** `playwright`
- **Work:** rubric with live evidence, Show me with a red-pencil circle, Test Bench, saved report.
- **Exit:** each Show me lands on its proof.

## Phase 10: Hardening and submission ⏳
**Aim:** ready to hand in.
- **Skills:** `wcag-audit-patterns`, `ui-visual-validator`, `verification-before-completion`, `production-audit`
- **MCPs:** `playwright`, `chrome-devtools` if a performance question appears
- **Work:** reduced motion, keyboard, phone layout, console clean, README, screenshots.
- **Waiting on:** Ollama installed on this laptop. Then run `python tests/five_questions.py` so `submission/test_results.md` holds real model answers.
- **Exit:** the five real answers exist. No generated answer is ever written by hand.

## MCPs considered and left out on purpose

| MCP | Why not |
|---|---|
| `magicui`, `21st-dev`, `shadcn` | Component kits look like component kits. That is the generic output this project avoids |
| `stitch`, `figma` | Generated screens would average out the idea, and no Figma file exists |
| `gsap-master`, `threejs` | CSS 3D and the Web Animations API cover it, without a dependency |
| `next-devtools` | No Next.js here |
