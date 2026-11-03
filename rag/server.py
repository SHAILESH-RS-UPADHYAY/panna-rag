"""Chatbot interface: a Gradio Server. Gradio runs the app and the chat queue; web/ is the custom frontend."""
import json
import os
import threading
from collections.abc import Iterator

import gradio as gr
from fastapi import HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ValidationError
from starlette.middleware.trustedhost import TrustedHostMiddleware

from . import llm, pipeline
from .config import EMBED_MODEL, HOST, MAX_UPLOAD_BYTES, PORT, REPORT_FILE, SAMPLE_PDF, WEB, Settings, load_settings, save_settings
from .ingest import IngestError
from .prompt import SYSTEM_PROMPT
from .report import QUESTIONS, verdict, write_report
from .store import store

server = gr.Server(title="Panna", docs_url=None, redoc_url=None, openapi_url=None)
# The app only ever runs on this machine. This stops other websites reaching it through DNS rebinding.
server.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost"])


def clean_history(history: list) -> list[dict]:
    """The browser sends the conversation. Keep only well-formed turns, within a sane size."""
    turns = [
        {"role": turn["role"], "content": str(turn["content"])[:4000]}
        for turn in history if isinstance(turn, dict) and turn.get("role") in ("user", "assistant") and turn.get("content")
    ]
    return turns[-6:]


@server.api(name="ask", concurrency_limit=1)
def ask(question: str, history: list, language: str) -> dict:
    """Answer a question from the uploaded documents. Runs through Gradio's queue, one at a time."""
    yield from pipeline.ask(question, clean_history(history), language)


# ── The page ──
@server.get("/", include_in_schema=False)
def index():
    return FileResponse(WEB / "index.html", headers={"Cache-Control": "no-cache"})


class NoCacheStatic(StaticFiles):
    """Always revalidate, so an edited stylesheet or module is never served stale."""

    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-cache"
        return response


server.mount("/web", NoCacheStatic(directory=WEB), name="web")


# ── Status and settings ──
@server.get("/api/status")
def status():
    settings = load_settings()
    return {
        "llm": {**llm.ollama_status(), "provider": settings.provider, "model": settings.model},
        "embed": {"model": EMBED_MODEL, "dim": store.dim, "ready": store.ready},
        "index": {"type": "FAISS IndexFlatIP", "vectors": len(store.chunks), "docs": len(store.docs)},
        "report": REPORT_FILE.exists(),
    }


@server.get("/api/settings")
def get_settings():
    return {**load_settings().model_dump(), "default_system_prompt": SYSTEM_PROMPT}


@server.post("/api/settings")
def set_settings(changes: dict):
    merged = {**load_settings().model_dump(), **changes}
    try:
        settings = Settings(**merged)
    except ValidationError as err:
        raise HTTPException(422, err.errors()[0]["msg"]) from err
    save_settings(settings)
    return settings.model_dump()


# ── Documents ──
def ndjson(events: Iterator[dict]) -> StreamingResponse:
    """Stream events as lines of JSON. A failure becomes a readable last line, not a broken stream."""
    def lines():
        try:
            for event in events:
                yield json.dumps(event) + "\n"
        except IngestError as err:
            yield json.dumps({"stage": "error", "message": str(err)}) + "\n"
    return StreamingResponse(lines(), media_type="application/x-ndjson")


@server.get("/api/docs")
def list_docs():
    return sorted(store.docs.values(), key=lambda doc: doc["added"])


@server.post("/api/docs")
async def upload(file: UploadFile):
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "That file is over 25 MB.")
    return ndjson(pipeline.ingest_bytes(file.filename or "document.txt", data))


@server.post("/api/docs/sample")
def use_sample():
    return ndjson(pipeline.ingest_sample(SAMPLE_PDF))


@server.delete("/api/docs/{doc_id}")
def delete_doc(doc_id: str):
    pipeline.remove_doc(doc_id)
    return {"ok": True}


@server.get("/api/docs/{doc_id}/chunks")
def doc_chunks(doc_id: str):
    if doc_id not in store.docs:
        raise HTTPException(404, "No such document.")
    return [chunk for chunk in store.chunks if chunk["doc_id"] == doc_id]


@server.post("/api/reindex")
def reindex():
    return ndjson(pipeline.reindex())


# ── Retrieval Lab ──
class SearchBody(BaseModel):
    q: str
    k: int = 8


@server.post("/api/search")
def search(body: SearchBody):
    settings = load_settings()
    hits, vector = store.search(body.q[:2000], min(max(body.k, 1), 20))
    return {
        "hits": hits, "threshold": settings.min_score, "top_k": settings.top_k,
        "vector": [round(float(x), 3) for x in vector], "map": store.map(vector),
    }


@server.get("/api/map")
def chunk_map():
    return store.map()


# ── Models and keys ──
class PullBody(BaseModel):
    model: str


@server.post("/api/pull")
def pull(body: PullBody):
    return ndjson(llm.pull(body.model[:100]))


class KeyBody(BaseModel):
    key: str
    base: str = ""


@server.get("/api/keys")
def get_keys():
    return llm.masked_keys()


@server.post("/api/keys/{provider}")
def save_key(provider: str, body: KeyBody):
    try:
        llm.save_key(provider, body.key, body.base)
    except llm.LLMError as err:
        return JSONResponse({"ok": False, "message": err.message, "hint": err.hint}, status_code=422)
    return {"saved": True, **llm.test_key(provider)}


@server.delete("/api/keys/{provider}")
def delete_key(provider: str):
    llm.remove_key(provider)
    settings = load_settings()
    if settings.provider == provider:  # never leave the app pointing at a provider with no key
        save_settings(settings.model_copy(update={"provider": "ollama", "model": "llama3.2"}))
    return {"ok": True}


@server.post("/api/keys/{provider}/test")
def test_key(provider: str):
    return llm.test_key(provider)


# ── Testing ──
@server.get("/api/questions")
def questions():
    return QUESTIONS


class VerdictBody(BaseModel):
    question: dict
    answer: str
    refused: bool


@server.post("/api/verdict")
def check(body: VerdictBody):
    return {"passed": verdict(body.question, body.answer, body.refused)}


class ReportBody(BaseModel):
    results: list[dict]
    model: str


@server.post("/api/report")
def report(body: ReportBody):
    return {"text": write_report(body.results, body.model), "path": str(REPORT_FILE)}


# ── Stock Gradio chat on the same pipeline, for anyone who wants to see plain Gradio ──
def classic_reply(message: str, history: list) -> Iterator[str]:
    turns = [{"role": turn["role"], "content": str(turn["content"])} for turn in history]
    answer, sources = "", []
    for event in pipeline.ask(message, turns[-6:], "english"):
        if event["type"] == "sources":
            sources = [hit for hit in event["hits"] if hit["used"]]
        elif event["type"] == "token":
            answer += event["text"]
            yield answer
        elif event["type"] == "error":
            yield f"{event['message']} {event.get('hint', '')}"
            return
        elif event["type"] == "done" and sources and not event["refused"]:
            quoted = "\n\n".join(f"> **{h['doc']}, page {h['page']}** ({h['score']:.2f})\n> {h['text'][:300]}" for h in sources)
            yield f"{answer}\n\n---\n**Source text used**\n\n{quoted}"


with gr.Blocks(title="Panna (classic Gradio view)") as classic:
    gr.ChatInterface(classic_reply, title="Panna", description="The same RAG pipeline in a stock Gradio chat.")
gr.mount_gradio_app(server, classic, path="/classic")


def main() -> None:
    threading.Thread(target=store.model, daemon=True).start()  # warm up so the first question is quick
    print(f"Panna is open at http://{HOST}:{PORT}")
    server.launch(server_name=HOST, server_port=PORT, inbrowser=os.environ.get("PANNA_NO_BROWSER") is None,
                  quiet=True, show_error=True)
