# ARD: Panna architecture

## 1. System at a glance

```
 Browser (web/)                      Python (rag/)                      Local services
┌───────────────────┐   HTTP    ┌──────────────────────────┐
│ The register UI   │──────────▶│ gradio.Server (server.py)│
│ Vanilla JS + CSS  │           │  /api/*  FastAPI routes  │
│                   │◀─NDJSON───│  upload progress         │
│                   │           │                          │
│                   │──call────▶│  ask  (Gradio queue)     │
│                   │◀──SSE─────│    pipeline.py           │
└───────────────────┘           │      │                   │
                                │      ├─ ingest.py  PDF/TXT → chunks
 /classic  stock Gradio chat ──▶│      ├─ store.py   MiniLM + FAISS
                                │      ├─ prompt.py  the no-invention rule
                                │      └─ llm.py ───────────────────▶ Ollama :11434
                                └──────────────────────────┘
 Everything on disk lives in data/ (gitignored): uploads, index, chunks, settings, keys.
```

## 2. The two flows

**Ingest:** upload → validate → extract pages (`pypdf`) → clean → split into overlapping chunks → embed (`all-MiniLM-L6-v2`, 384 dims, normalised) → add to FAISS → persist. Each stage streams a real event with timings, and the UI animates from those events.

**Ask:** question → embed → FAISS top-k → **score gate** → build prompt → stream from Ollama → source slips and citations → done, or a refusal stamp.

## 3. Decisions

| # | Decision | Why | Rejected |
|---|---|---|---|
| D1 | **`gradio.Server`** with a custom frontend | The brief demands Gradio or Streamlit, the owner demands a unique UI. Server mode is Gradio's own supported route to both. Chat runs through Gradio's queue and SSE | Plain Gradio Blocks (cannot look like this), Streamlit (reruns the script, fights animation) |
| D2 | **`/classic` stock Gradio chat** on the same pipeline | About 15 lines. Removes any doubt from an examiner and acts as a fallback | |
| D3 | **FAISS `IndexFlatIP`** on normalised vectors | Inner product on unit vectors is cosine similarity. Exact and simple, and easy to explain in a viva. Small documents do not need approximate search | ChromaDB (heavier, hides the mechanics), IVF/HNSW (pointless at this size) |
| D4 | **`all-MiniLM-L6-v2`** | Free, about 90 MB, fast on CPU, the standard teaching model | Larger models (slower, no visible gain on a handbook) |
| D5 | **Own chunker, no LangChain** | About 40 lines. The student can explain every line, which earns Document Processing marks | LangChain (a large dependency for one function) |
| D6 | **Two refusal guards** | Small local models sometimes ignore instructions. A score gate before the LLM makes "not in the document" reliable. The prompt rule covers the rest | Prompt only (unreliable on a 2 GB model) |
| D7 | **`llama3.2` default** | About 2 GB, fits the 4 GB RTX 3050 Ti, good enough for grounded answers. Any pulled model can be chosen in the app | `llama3` (about 4.7 GB, spills out of VRAM on this laptop) |
| D8 | **Vanilla JS modules, no build step, no UI framework** | Nothing to compile on exam day. CSS and the Web Animations API cover all of this. Double-click simple | React plus bundler (toolchain risk, no gain), GSAP (not needed for transforms and timelines this size) |
| D9 | **Page turn built from nested 3D strips** | Real curvature and shading, no canvas, and the page text stays real text while turning | Rotating one flat div (looks cheap), WebGL (overkill) |
| D10 | **Fonts bundled in `web/fonts`** | Exam labs can be offline. The browser downloads a font only when it is used | Google Fonts CDN |
| D11 | **Chats and look preferences in `localStorage`; settings on the server** | Single local user. Preferences belong to the browser; settings shape the index | Database |
| D12 | **API keys server-side in `data/keys.json`** (gitignored) | The browser only sees the last 4 characters. Never logged. Server binds to `127.0.0.1` and rejects foreign `Host` headers (blocks DNS rebinding) | Keeping keys in the browser |

## 4. Repository layout

```
panna-rag/
├─ run.py            one command to start everything
├─ requirements.txt
├─ README.md
├─ docs/             PRD, ARD, PLAN, MARKS (viva guide)
├─ rag/              the Python backend, one file per concern
│  ├─ config.py        paths and settings
│  ├─ ingest.py        extract and chunk          → Document Processing (4)
│  ├─ store.py         embeddings and FAISS       → Embeddings and Retrieval (5)
│  ├─ prompt.py        the RAG prompt             → RAG Prompt and Response (5)
│  ├─ llm.py           Ollama and optional keys   → RAG Prompt and Response (5)
│  ├─ pipeline.py      question → answer
│  ├─ report.py        test results file          → Testing and Demonstration (3)
│  └─ server.py        Gradio Server and routes   → Chatbot Interface (3)
├─ web/              the frontend, no build step
│  ├─ index.html
│  ├─ css/
│  ├─ js/
│  └─ fonts/
├─ samples/          the sample document
├─ tests/            test_rag.py, five_questions.py
├─ submission/       generated test results and screenshots
└─ data/             runtime only, gitignored
```

## 5. API

| Route | Purpose |
|---|---|
| `POST /gradio_api/call/ask` then `GET .../{id}` | Chat through Gradio's queue, as SSE events: `stage`, `sources`, `prompt`, `token`, `done`, `error` |
| `GET /api/status` | LLM, embedder, index and settings |
| `GET/POST /api/docs`, `DELETE /api/docs/{id}`, `POST /api/docs/sample` | Documents. Uploads stream NDJSON stage events |
| `GET /api/docs/{id}/chunks` | Chunk Explorer |
| `POST /api/search`, `GET /api/map` | Retrieval Lab and the 2D chunk map |
| `GET/POST /api/settings`, `POST /api/reindex` | RAG settings |
| `POST /api/pull` | Pull an Ollama model with progress |
| `GET /api/keys`, `POST/DELETE /api/keys/{p}`, `POST /api/keys/{p}/test` | Key Locker. Never returns a full key |
| `POST /api/report` | Writes `submission/test_results.md` |

## 6. Frontend architecture

`<html data-*>` holds every look choice. CSS reads those attributes and tokens; JS never sets colours.

| Module | Job |
|---|---|
| `prefs.js` | Look data, preference storage, applies attributes |
| `book.js` | The book: stacks, tabs, tears, section routing |
| `flip.js` | Page-turn engine (nested strips, shading, riffle) |
| `chat.js`, `ink.js` | Conversation; typing and answer animation |
| `clock.js`, `mascot.js`, `decor.js` | Rolling date stamp, companion, floating decoration |
| `papers.js`, `engine.js`, `keys.js`, `marks.js`, `studio.js`, `tour.js` | One section each |

## 7. Security

- Binds to `127.0.0.1` only; `TrustedHostMiddleware` allows `127.0.0.1` and `localhost`.
- Uploads: extension allow-list, size cap, PDF signature check. The user's filename is display text only; files are stored under a content hash.
- All model and document text reaches the DOM through `textContent`, so a hostile PDF cannot inject script.
- Prompt injection in documents is limited by context labelling and the system rule. There are no tools for it to abuse.
- Keys: masked in responses, never logged, gitignored.

## 8. Failure behaviour

| Failure | User sees |
|---|---|
| Ollama down | Status light goes out; the answer area shows the exact command to run |
| Model missing | "Pull this model" button with a progress bar |
| Scanned PDF | "No readable text found", plus what to do |
| No documents | Chat page invites an upload or the sample |
| Reduced motion | Cross-fades replace page turns; text appears at once |
