"""Run the five test questions against the real local model and write submission/test_results.md.
    python tests/five_questions.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from rag import llm, pipeline  # noqa: E402
from rag.config import SAMPLE_PDF, load_settings  # noqa: E402
from rag.report import QUESTIONS, verdict, write_report  # noqa: E402
from rag.store import store  # noqa: E402


def main() -> int:
    settings = load_settings()
    if settings.model.startswith("stand-in"):
        print("The stand-in model cannot produce a real report. Choose a real model first.")
        return 1
    status = llm.ollama_status()
    if settings.provider == "ollama" and not status["up"]:
        print("Ollama is not running. Start it and try again.")
        return 1
    if settings.provider == "ollama" and not any(name.split(":")[0] == settings.model.split(":")[0] for name in status["models"]):
        print(f"The model is not downloaded yet. Run: ollama pull {settings.model}")
        return 1
    if not store.chunks:
        print("Indexing the sample document...")
        for _ in pipeline.ingest_sample(SAMPLE_PDF):
            pass

    results = []
    for question in QUESTIONS:
        print(f"\nQ: {question['q']}")
        answer, sources, refused, guard = "", [], False, None
        for event in pipeline.ask(question["q"], [], "english"):
            if event["type"] == "sources":
                sources = [hit for hit in event["hits"] if hit["used"]]
            elif event["type"] == "error":
                print(f"Stopped: {event['message']} {event.get('hint', '')}")
                return 1
            elif event["type"] == "done":
                answer, refused, guard = event["answer"], event["refused"], event["guard"]
        passed = verdict(question, answer, refused)
        print(f"A: {answer.strip()}\n{'PASS' if passed else 'FAIL'}")
        results.append({**question, "answer": answer, "passed": passed, "guard": guard, "sources": sources})

    write_report(results, settings.model)
    print(f"\nPassed {sum(r['passed'] for r in results)} of {len(results)}. Wrote submission/test_results.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
