"""Checks that need no language model: chunking, retrieval, the score gate, key masking.
    python tests/test_rag.py
"""
import os
import sys
import tempfile
from pathlib import Path

os.environ["PANNA_DATA"] = tempfile.mkdtemp(prefix="panna-test-")  # never touch real data
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from rag import llm, pipeline  # noqa: E402
from rag.config import SAMPLE_PDF, Settings  # noqa: E402
from rag.ingest import IngestError, clean, split  # noqa: E402
from rag.prompt import REFUSAL, build_messages, is_refusal  # noqa: E402
from rag.report import QUESTIONS, verdict  # noqa: E402
from rag.store import store  # noqa: E402


def test_clean_rejoins_wrapped_lines():
    assert clean("a wrapped\nline. Next hy-\nphen") == "a wrapped line. Next hyphen"
    assert clean("First sentence.\nSecond.") == "First sentence.\nSecond."


def test_chunks_cover_text_with_overlap_and_right_pages():
    pages = [" ".join(f"Page one sentence {i}." for i in range(80)), " ".join(f"Page two sentence {i}." for i in range(80))]
    chunks = split(pages, 300, 60)
    assert len(chunks) > 5
    assert all(len(chunk["text"]) <= 300 for chunk in chunks)
    assert chunks[0]["overlap"] == 0 and all(chunk["overlap"] > 0 for chunk in chunks[1:])
    assert chunks[0]["page"] == 1 and chunks[-1]["page"] == 2
    for sentence in ("Page one sentence 79.", "Page two sentence 0.", "Page two sentence 79."):
        assert any(sentence in chunk["text"] for chunk in chunks), sentence
    assert all(not chunk["text"][0].isspace() for chunk in chunks)
    second = chunks[1]  # the shared text really is shared
    assert second["text"][:second["overlap"]].strip() in chunks[0]["text"]


def test_chunking_terminates_on_text_with_no_spaces():
    assert len(split(["x" * 5000], 200, 100)) > 5


def test_overlap_limit_is_validated():
    try:
        Settings(chunk_size=200, chunk_overlap=150)
    except ValueError:
        return
    raise AssertionError("overlap above half the chunk size must be rejected")


def test_bad_files_get_readable_errors():
    for name, data in (("a.exe", b"x"), ("a.pdf", b"not a pdf"), ("a.txt", b"   ")):
        try:
            list(pipeline.ingest_bytes(name, data))
        except IngestError:
            continue
        raise AssertionError(name)


def test_filename_is_never_a_path():
    events = list(pipeline.ingest_bytes("..\\..\\evil.txt", b"Plain text about nothing in particular."))
    doc = events[-1]["doc"]
    assert doc["name"] == "evil.txt"
    assert doc["id"].isalnum()
    pipeline.remove_doc(doc["id"])


def test_prompt_carries_the_rule_and_the_passages():
    hits = [{"doc": "h.pdf", "page": 2, "text": "Fine is Rs 2."}]
    system, user = build_messages("Fine?", hits, [], "english")
    assert "only" in system["content"] and REFUSAL["english"] in system["content"]
    assert "[1] (h.pdf, page 2)" in user["content"] and "QUESTION: Fine?" in user["content"]
    assert is_refusal(REFUSAL["hinglish"]) and not is_refusal("The fine is Rs 2 [1].")


def test_report_verdicts():
    answerable = {"answerable": True, "expect": ["21"]}
    assert verdict(answerable, "21 days", False) and not verdict(answerable, "20 days", False)
    assert not verdict(answerable, "21", True)
    assert verdict({"answerable": False}, "...", True) and not verdict({"answerable": False}, "Yes", False)
    assert len(QUESTIONS) >= 5 and any(not q["answerable"] for q in QUESTIONS)


def test_keys_are_masked_and_validated():
    llm.save_key("groq", "gsk_supersecretvalue1234")
    masked = llm.masked_keys()["groq"]
    assert masked["saved"] and masked["last4"] == "1234" and "key" not in masked
    assert "supersecret" not in str(llm.masked_keys())
    for bad in ("short", "has spaces in it"):
        try:
            llm.save_key("groq", bad)
        except llm.LLMError:
            continue
        raise AssertionError(bad)
    try:
        llm.save_key("custom", "abcdefgh1234", "http://evil.example/v1")
    except llm.LLMError:
        pass
    else:
        raise AssertionError("plain http must be rejected for keys")
    llm.remove_key("groq")


def test_full_flow_on_the_sample():
    events = list(pipeline.ingest_sample(SAMPLE_PDF))
    assert [e["stage"] for e in events] == ["start", "extract", "chunk", "embed", "store", "done"]
    assert events[1]["pages"] >= 2
    assert events[3]["dim"] == 384

    # the right passage comes first
    hits, _ = store.search("What is the fine for returning a book late?", 4)
    assert "fine" in hits[0]["text"].lower()
    assert hits == sorted(hits, key=lambda hit: -hit["score"])

    # Guard 1: a question far from the document is refused without calling any model
    refusals = list(pipeline.ask("Who won the cricket world cup in 2011?", [], "english"))
    assert refusals[-1]["type"] == "done" and refusals[-1]["refused"] and refusals[-1]["guard"] == "score"
    assert refusals[-1]["model"] == "not called"

    # removing the document really removes its vectors
    doc_id = events[-1]["doc"]["id"]
    pipeline.remove_doc(doc_id)
    assert not store.chunks and store.index.ntotal == 0


if __name__ == "__main__":
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    for test in tests:
        test()
        print(f"ok  {test.__name__}")
    print(f"\nAll {len(tests)} passed.")
