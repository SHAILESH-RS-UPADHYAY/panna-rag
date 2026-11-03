"""Document processing: read a PDF or TXT, clean it, split it into overlapping chunks."""
import bisect
import re
from pathlib import Path

from pypdf import PdfReader
from pypdf.errors import PyPdfError


class IngestError(ValueError):
    """A problem with the document that the user can understand and fix."""


def read_pages(path: Path) -> list[str]:
    """Return the cleaned text of each page. A TXT file is one page unless it has form feeds."""
    if path.suffix.lower() == ".pdf":
        try:
            reader = PdfReader(path)
            if reader.is_encrypted:
                raise IngestError("This PDF is password protected. Remove the password and try again.")
            pages = [page.extract_text() or "" for page in reader.pages]
        except PyPdfError as err:
            raise IngestError(f"This PDF could not be read: {err}") from err
    else:
        raw = path.read_bytes()
        try:
            text = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = raw.decode("cp1252", errors="replace")
        pages = text.split("\f")

    pages = [clean(page) for page in pages]
    if not any(pages):
        raise IngestError("No readable text found. Scanned PDFs need OCR first, or use a TXT file.")
    return pages


def clean(text: str) -> str:
    """Undo the line wrapping PDFs add, keeping paragraphs and sentence ends."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t ]+", " ", text)
    text = re.sub(r" ?\n ?", "\n", text)
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)  # re-join hy-\nphenated words
    text = re.sub(r"(?<![.:;!?\n])\n(?![\n\-•*\d])", " ", text)  # a wrapped line, not a real break
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split(pages: list[str], size: int, overlap: int) -> list[dict]:
    """Slide a window over the text, ending each chunk at the most natural break it can find.

    Each chunk records its page and how many characters it shares with the previous chunk,
    so the Chunk Explorer can show the overlap.
    """
    full, page_starts = "", []
    for page in pages:
        page_starts.append(len(full))
        full += page + "\n\n"
    page_of = lambda offset: bisect.bisect_right(page_starts, offset)

    chunks, start, previous_end = [], 0, 0
    while start < len(full):
        end = _best_break(full, start, size)
        window = full[start:end]
        left = start + len(window) - len(window.lstrip())
        text = window.strip()
        if text:
            right = left + len(text)
            chunks.append({
                "text": text,
                "page": page_of(left),
                "page_end": page_of(right - 1),
                "overlap": max(0, previous_end - left),
            })
            previous_end = right
        if end >= len(full):
            break
        start = _word_start(full, max(end - overlap, start + 1), end)
    return chunks


def _best_break(text: str, start: int, size: int) -> int:
    """The end of a chunk: a paragraph break if possible, then a sentence, then a word."""
    limit = start + size
    if limit >= len(text):
        return len(text)
    earliest = start + int(size * 0.6)
    for separators in (("\n\n",), (". ", "? ", "! ", ".\n", "?\n", "!\n"), ("\n",), (" ",)):
        best = max(text.rfind(sep, earliest, limit) for sep in separators)
        if best != -1:
            return best + 1
    return limit


def _word_start(text: str, position: int, end: int) -> int:
    """Start the next chunk at a sentence if the overlap holds one, else at a word, never mid-word."""
    breaks = [found + 2 for sep in (". ", "? ", "! ", ".\n", "?\n", "!\n") if (found := text.find(sep, position, end - 2)) != -1]
    if breaks:
        return min(breaks)
    while position < end and not text[position - 1].isspace():
        position += 1
    return position
