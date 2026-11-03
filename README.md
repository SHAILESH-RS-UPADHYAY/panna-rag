# Panna

A local RAG chatbot in the body of a thick old register. It answers only from your document and shows the source text. No paid API key.

## Run it on a new laptop (Windows)

Install these once, with internet:

1. **Python 3.13** from python.org. Tick "Add python.exe to PATH". Python 3.14 may also work, 3.13 is what was tested.
2. **Ollama** from ollama.com/download.

Then open a terminal in this folder:

```
ollama pull llama3.2
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

The browser opens at http://127.0.0.1:7860. The first start downloads the embedding model (about 90 MB).

Downloads total about 3 to 4 GB. After that it works offline. A laptop with 8 GB RAM or more is best.

To show it again later:

```
.venv\Scripts\activate
python run.py
```

## Tests

```
python tests/test_rag.py
python tests/five_questions.py
```

The second one needs Ollama running. It writes the real answers to `submission/test_results.md`.
