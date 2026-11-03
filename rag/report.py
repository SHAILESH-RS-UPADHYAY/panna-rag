"""The Testing and Demonstration evidence: five questions and what the model really answered."""
import re
import time

from .config import REPORT_FILE
from .prompt import page_label

# Designed for samples/haveli-library-handbook.pdf. `expect` patterns must appear in a passing answer.
# `answerable: False` is the question the document cannot answer, so the bot must refuse it.
QUESTIONS = [
    {"q": "How many books can a member borrow at one time, and for how many days?", "answerable": True, "expect": ["4|four", "21"]},
    {"q": "What is the fine for returning a book late?", "answerable": True, "expect": ["2"]},
    {"q": "When is the Rare Books Room open, and what do I need to enter it?", "answerable": True, "expect": ["saturday", "card|deposit"]},
    {"q": "How much does a student membership cost per year?", "answerable": True, "expect": ["150"]},
    {"q": "Does the library have a swimming pool?", "answerable": False, "expect": []},
]


def verdict(question: dict, answer: str, refused: bool) -> bool:
    """Answerable: must answer with the expected facts. Unanswerable: must refuse."""
    if not question.get("answerable", True):
        return refused
    if refused:
        return False
    text = answer.lower()
    return all(re.search(pattern, text) for pattern in question.get("expect", []))


def write_report(results: list[dict], model: str) -> str:
    """Write submission/test_results.md from real results and return its text."""
    lines = [
        "# Test results", "",
        f"- **Model:** {model}",
        f"- **Run at:** {time.strftime('%d %b %Y, %H:%M')}",
        f"- **Passed:** {sum(bool(r['passed']) for r in results)} of {len(results)}", "",
    ]
    for i, result in enumerate(results, 1):
        kind = "should answer" if result.get("answerable", True) else "not in the document, should refuse"
        lines += [
            f"## Question {i} ({kind})", "",
            f"**Q:** {result['q']}", "",
            f"**A:** {str(result['answer']).strip()}", "",
            f"**Result:** {'PASS' if result['passed'] else 'FAIL'}"
            + (f" (refused by the {result['guard']} guard)" if result.get("guard") else ""), "",
        ]
        if result.get("sources"):
            lines.append("**Source text used:**\n")
            for hit in result["sources"]:
                snippet = " ".join(hit["text"].split())
                lines.append(f"> {hit['doc']}, {page_label(hit)}, score {hit['score']:.2f}: {snippet[:280]}\n")
    text = "\n".join(lines)
    REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
    REPORT_FILE.write_text(text, "utf-8")
    return text
