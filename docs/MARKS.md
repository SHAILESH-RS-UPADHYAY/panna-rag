# Marks guide: viva ke liye

The rubric is 20 marks. Open the **Marks** tab in the app: every row below has a **Show me** button that opens the proof and circles it in red pencil.

| Parameter | Marks | Show | Code |
|---|---:|---|---|
| Chatbot Interface | 3 | Chat tab; `/classic` for stock Gradio | `rag/server.py` |
| Document Processing | 4 | Papers tab: stages and Chunk Explorer | `rag/ingest.py` |
| Embeddings and Retrieval | 5 | Engine tab: vector strip, map, Retrieval Lab | `rag/store.py` |
| RAG Prompt and Response Generation | 5 | Engine tab: Prompt; a refusal stamp in chat | `rag/prompt.py`, `rag/pipeline.py`, `rag/llm.py` |
| Testing and Demonstration | 3 | Marks tab: Test Bench | `tests/`, `submission/test_results.md` |
| **Total** | **20** | | |

## Demo script (about 3 minutes)

1. **Start:** `python run.py`. Point out the Ollama status light: local, free, no paid key.
2. **Upload:** Papers tab, drop `samples/haveli-library-handbook.pdf`. Watch extract, chunk, embed, store with real numbers.
3. **Chunks:** open Chunk Explorer. Overlap is highlighted.
4. **Ask:** "How many books can a member borrow at a time?" Point at the retrieval checklist, the answer, the `[1]` citation and the source slip.
5. **Refuse:** "Does the library have a swimming pool?" The red stamp: *not in the document*.
6. **Backend:** Engine tab. Show the vector strip, the map, the score bars and the exact prompt.
7. **Tests:** Marks tab, Run all five, Save report.

## Likely viva questions

**RAG kya hai?**
Retrieval-Augmented Generation. Pehle document se relevant text dhoondte hain, phir wahi text LLM ko dete hain, taaki answer document se aaye, model ki memory se nahi.

**Chunking kyun? Overlap kyun?**
Embedding model chhote text par best kaam karta hai, aur LLM ko poora document nahi de sakte. Overlap isliye ki koi sentence do chunks ke beech kat jaye to bhi ek chunk mein poora mile.

**Embedding kya hai?**
Text ko numbers ki list mein badalna, yahan 384 numbers. Same meaning wale text ke vectors paas-paas aate hain.

**FAISS kya karta hai? `IndexFlatIP` kyun?**
Vectors store karta hai aur sabse milte-julte dhoondta hai. Vectors normalised hain, isliye inner product hi cosine similarity hai. Flat matlab exact search: chhote document ke liye perfect.

**Bot jhooth kyun nahi bolta?**
Do guards hain. Pehla: agar best score threshold se kam hai to LLM ko bulate hi nahi. Doosra: prompt saaf kehta hai sirf CONTEXT se jawab do, warna fixed refusal sentence bolo.

**Paid API ke bina kaise?**
Ollama model ko isi laptop par chalata hai. Embeddings bhi local hain. Internet sirf pehli baar download ke liye chahiye tha.

**Gradio kahan hai? UI to custom lagta hai.**
`gradio.Server` Gradio ka official Server mode hai: backend, queue aur streaming Gradio ke, frontend hamara. `rag/server.py` dikhao. Chat `ask` endpoint se Gradio ke queue se chalta hai. `/classic` par stock Gradio chat bhi isi pipeline par chalta hai.

## Submission checklist

- [ ] Python source: this repository
- [ ] Sample document: `samples/haveli-library-handbook.pdf`
- [ ] Screenshots: `submission/screenshots/`
- [ ] Five test questions with generated answers: run `python tests/five_questions.py`, it writes `submission/test_results.md`

Never type the answers by hand. They must come from the model.
