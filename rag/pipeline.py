"""The two flows: a document going in, and a question coming back as a grounded answer."""
import hashlib
import shutil
import time
from collections.abc import Iterator
from pathlib import Path

from .config import UPLOADS, load_settings
from .ingest import IngestError, read_pages, split
from .llm import LLMError, stream
from .prompt import REFUSAL, build_messages, is_refusal
from .store import store


def ms_since(start: float) -> int:
    return round((time.perf_counter() - start) * 1000)


# ── Document in ──
def ingest_bytes(name: str, data: bytes) -> Iterator[dict]:
    """Save an upload under a content hash, so its filename is only ever display text."""
    name = name.replace("\\", "/").rsplit("/", 1)[-1][:120]
    suffix = Path(name).suffix.lower()
    if suffix not in (".pdf", ".txt"):
        raise IngestError("Please choose a PDF or TXT file.")
    if suffix == ".pdf" and not data.startswith(b"%PDF"):
        raise IngestError("This file is named .pdf but is not a PDF.")
    if not data.strip():
        raise IngestError("This file is empty.")
    doc_id = hashlib.sha256(data).hexdigest()[:16]
    UPLOADS.mkdir(parents=True, exist_ok=True)
    (UPLOADS / f"{doc_id}{suffix}").write_bytes(data)
    yield from ingest_doc(doc_id, name, suffix, len(data))


def ingest_doc(doc_id: str, name: str, suffix: str, size: int) -> Iterator[dict]:
    """Extract → chunk → embed → store. Every stage reports real numbers for the UI to animate."""
    settings = load_settings()
    path = UPLOADS / f"{doc_id}{suffix}"
    yield {"stage": "start", "doc": name, "size": size}

    start = time.perf_counter()
    pages = read_pages(path)
    yield {"stage": "extract", "pages": len(pages), "chars": sum(map(len, pages)), "ms": ms_since(start)}

    start = time.perf_counter()
    chunks = split(pages, settings.chunk_size, settings.chunk_overlap)
    yield {"stage": "chunk", "chunks": len(chunks), "size": settings.chunk_size,
           "overlap": settings.chunk_overlap, "ms": ms_since(start)}

    start = time.perf_counter()
    vectors = store.embed([chunk["text"] for chunk in chunks])
    yield {"stage": "embed", "vectors": len(vectors), "dim": int(vectors.shape[1]), "ms": ms_since(start)}

    start = time.perf_counter()
    doc = {"id": doc_id, "name": name, "suffix": suffix, "size": size, "pages": len(pages),
           "chunks": len(chunks), "added": time.time()}
    store.add(doc, chunks, vectors)
    yield {"stage": "store", "total": store.index.ntotal, "ms": ms_since(start)}
    yield {"stage": "done", "doc": doc}


def ingest_sample(sample: Path) -> Iterator[dict]:
    data = sample.read_bytes()
    doc_id = hashlib.sha256(data).hexdigest()[:16]
    UPLOADS.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(sample, UPLOADS / f"{doc_id}{sample.suffix}")
    yield from ingest_doc(doc_id, sample.name, sample.suffix, len(data))


def reindex() -> Iterator[dict]:
    """Rebuild every document with the current chunk settings."""
    for doc in list(store.docs.values()):
        yield from ingest_doc(doc["id"], doc["name"], doc["suffix"], doc["size"])


def remove_doc(doc_id: str) -> None:
    doc = store.docs.get(doc_id)
    store.remove(doc_id)
    if doc:
        (UPLOADS / f"{doc_id}{doc['suffix']}").unlink(missing_ok=True)


# ── Question out ──
def retrieve(question: str, history: list[dict], k: int) -> tuple[list[dict], object]:
    """Find passages. A very short follow-up also searches with the previous question."""
    query = question
    # ponytail: word count is a naive follow-up test. Use model-based query rewriting if it misfires.
    previous = next((m["content"] for m in reversed(history) if m["role"] == "user"), "")
    if previous and len(question.split()) <= 4:
        query = f"{previous} {question}"
    return store.search(query, k)


def ask(question: str, history: list[dict], language: str) -> Iterator[dict]:
    """Retrieve, gate, build the prompt, stream the answer. Yields events the UI animates from."""
    settings = load_settings()
    question = question.strip()[:2000]
    if not question:
        yield {"type": "error", "code": "empty", "message": "Please type a question."}
        return
    if not store.chunks:
        yield {"type": "error", "code": "no_docs", "message": "No document yet.",
               "hint": "Upload a PDF or TXT first, or use the sample."}
        return

    began = time.perf_counter()
    if not store.ready:
        yield {"type": "stage", "stage": "warming"}
    hits, _ = retrieve(question, history, settings.top_k)
    yield {"type": "stage", "stage": "search", "ms": ms_since(began), "searched": len(store.chunks)}

    # Guard 1: if nothing is similar enough, the document cannot answer. Do not even ask the model.
    for hit in hits:
        hit["used"] = hit["score"] >= settings.min_score
    used = [hit for hit in hits if hit["used"]]
    yield {"type": "sources", "hits": hits, "threshold": settings.min_score, "passed": bool(used)}

    if not used:
        refusal = REFUSAL.get(language, REFUSAL["english"])
        yield {"type": "token", "text": refusal}
        yield {"type": "done", "refused": True, "guard": "score", "answer": refusal,
               "ms": ms_since(began), "stats": {}, "model": "not called"}
        return

    # Guard 2: the prompt tells the model to use only these passages or refuse.
    messages = build_messages(question, used, history[-6:], language, settings.system_prompt)
    yield {"type": "prompt", "messages": messages, "model": settings.model, "provider": settings.provider,
           "temperature": settings.temperature}

    answer, stats, first_token = "", {}, None
    try:
        for part in stream(messages, settings):
            if "token" in part:
                first_token = first_token or ms_since(began)
                answer += part["token"]
                yield {"type": "token", "text": part["token"]}
            else:
                stats = part["stats"]
    except LLMError as err:
        yield {"type": "error", "code": err.code, "message": err.message, "hint": err.hint, "model": settings.model}
        return

    refused = is_refusal(answer)
    yield {"type": "done", "refused": refused, "guard": "prompt" if refused else None, "answer": answer,
           "ms": ms_since(began), "first_token_ms": first_token, "stats": stats, "model": settings.model}
