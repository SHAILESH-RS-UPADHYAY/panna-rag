# PRD: Panna

*A cute little robot that reads your old register.*
A local, free, document-grounded RAG chatbot wearing the body of a thick, battered, torn old register.

| | |
|---|---|
| **Source brief** | `MAJOR PRACTICAL ASSIGNMENT` (Prompt Engineering, Python, 20 marks, no paid API keys) |
| **Status** | In progress. See `PLAN.md` for phase status |
| **Name** | "Panna" means page. Rename it in Studio, Companion |

## 1. Problem

The assignment needs a working mini RAG chatbot. Most submissions will look the same: a default Gradio box.
This one has to do two jobs at once:

1. **Score every mark**, and make each mark easy to demonstrate to an examiner in seconds.
2. **Look unforgettable**: cute, pretty, and clearly not AI-generated, as if a design agency spent months on it.

## 2. Users

| User | Needs |
|---|---|
| **Student presenting (primary)** | Run it, show every rubric item fast, explain the backend confidently |
| **Examiner** | See upload, chunks, retrieval, sources, the no-invention rule and tests working |
| **Anyone with a document** | Ask questions and trust the answer because the source is shown |
| **People who care about aesthetics** | Bubblegum and other looks, font choice, personal style |

## 3. Requirements from the brief (must, all graded)

| ID | Requirement | Where it is shown |
|---|---|---|
| A1 | Chatbot interface using Streamlit or Gradio | `gradio.Server` runs the app. `/classic` is a stock Gradio chat on the same RAG |
| A2 | Upload one PDF or TXT with at least 2 pages | Papers tab (drag and drop) |
| A3 | Extract text and split into chunks | Papers tab: live stages and Chunk Explorer |
| A4 | Embeddings with a free Sentence Transformers model | Engine tab: model, dimension, vector strip |
| A5 | Store and retrieve with FAISS or ChromaDB | FAISS `IndexFlatIP`; Engine tab: Retrieval Lab |
| A6 | Free local LLM through Ollama | Default provider, status light on every page |
| A7 | Generate answers from retrieved content | Streamed answers with `[n]` citations |
| A8 | Display the source text for each answer | Source slips under each answer, on the left page and in the Folio column |
| A9 | Prompt that forbids inventing information | Engine tab shows the exact prompt; refusals get a red stamp |
| A10 | Test with 5+ questions, including 1 unanswerable | Marks tab: Test Bench, saved to `submission/test_results.md` |

**Submission:** Python source, sample document, screenshots, five test questions with generated answers.

## 4. Product requirements (from the owner)

### 4.1 The register (default look)
- R1. A **thick, very old, torn register**: stacked page edges visible from the side, stains, tears, repairs.
- R2. **New chat turns pages** like a real hand turning paper: curved, shaded, clean.
- R3. Reference only. **Nothing may look or read like Vettly**: no shared code, no punch holes, no washi tape strip, no floating panel, no shared look names.
- R4. Index tabs on the page edge (from the case-file reference image), with paper clips and aged slips.

### 4.2 Motion everywhere it means something
- R5. Typing a question animates. Sending animates. Answering animates (several styles).
- R6. Auto-detected date and time, animated, on the bot's page. Every entry is timestamped.
- R7. Reduced-motion users get a calm version that still works.

### 4.3 Choice
- R8. Many looks, including **Bubblegum** and other aesthetic looks made for girls who love cute stationery.
- R9. Many fonts, ink colours, paper types, desks, entry styles, answer animations, page-turn styles, layouts.
- R10. Settings organised in clear sections, in a Studio (idea borrowed from Vettly's settings, design is new).

### 4.4 Understanding
- R11. Onboarding tour of **5 pages**: pages 1-2 how to chat and how it works; pages 3-5 the RAG backend and the chatbot backend.
- R12. RAG panels: pipeline, chunks, retrieval lab, prompt.
- R13. **Marks page**: each rubric row with live evidence and a "Show me" button that opens the proof.

### 4.5 API keys
- R14. **No key is needed.** The brief forbids paid keys, so Ollama stays the default.
- R15. A separate, heavily animated key panel for optional providers, with step-by-step guidance. Keys never go back to the browser.

### 4.6 Engineering
- R16. Clean, simple repository, the way a big company's product repo looks.
- R17. Works offline once installed. Fonts are bundled.

## 5. Non-goals

- Accounts, multi-user, cloud hosting.
- OCR for scanned PDFs (we explain the failure instead).
- DOCX, CSV and other formats: the brief asks for PDF or TXT.
- Sound effects: nobody asked, and they could not be judged without ears.

## 6. Success measures

| Measure | Target |
|---|---|
| Rubric rows demonstrable from one screen | 5 of 5 |
| Unanswerable question | Refuses, every time, in the test run |
| Answerable questions | Correct with a source shown |
| Time from "Show me" to proof on screen | Under 2 seconds |
| Page turn | Smooth on a 16 GB laptop with integrated graphics |
| Paid services needed | 0 |

## 7. Risks

| Risk | Mitigation |
|---|---|
| Examiner says "this is not Gradio" | Code imports and launches Gradio; chat runs through Gradio's queue; `/classic` shows a stock Gradio chat |
| Small local model invents answers | Two guards: a retrieval score gate before the LLM, then the prompt rule |
| Ollama not installed or not running | Friendly guide inside the app, with the exact commands |
| Handwriting fonts hurt reading | Default fonts checked for legibility; a reading font is one click away |
| Heavy decoration slows the page | Textures rasterised once; motion uses transforms; canvas pauses when hidden |
