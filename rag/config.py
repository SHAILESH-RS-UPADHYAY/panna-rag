"""Paths, constants and the settings that shape retrieval and answers."""
import json
import os
from pathlib import Path

from pydantic import BaseModel, Field, model_validator

ROOT = Path(__file__).resolve().parent.parent
DATA = Path(os.environ.get("PANNA_DATA", ROOT / "data"))
UPLOADS = DATA / "uploads"
SETTINGS_FILE = DATA / "settings.json"
KEYS_FILE = DATA / "keys.json"
WEB = ROOT / "web"
SAMPLE_PDF = ROOT / "samples" / "haveli-library-handbook.pdf"
REPORT_FILE = ROOT / "submission" / "test_results.md"

EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
MAX_UPLOAD_BYTES = 25 * 1024 * 1024
HOST, PORT = "127.0.0.1", int(os.environ.get("PANNA_PORT", 7860))


class Settings(BaseModel):
    chunk_size: int = Field(500, ge=200, le=2000)
    chunk_overlap: int = Field(80, ge=0, le=500)
    top_k: int = Field(4, ge=1, le=10)
    min_score: float = Field(0.15, ge=0, le=1)
    temperature: float = Field(0.1, ge=0, le=1.5)
    provider: str = "ollama"
    model: str = "llama3.2"
    system_prompt: str = Field("", max_length=4000)  # empty means the default in prompt.py

    @model_validator(mode="after")
    def overlap_fits(self):
        if self.chunk_overlap > self.chunk_size // 2:
            raise ValueError("Overlap can be at most half the chunk size.")
        return self


def load_settings() -> Settings:
    try:
        return Settings(**json.loads(SETTINGS_FILE.read_text("utf-8")))
    except (OSError, ValueError):
        return Settings()


def save_settings(settings: Settings) -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    SETTINGS_FILE.write_text(settings.model_dump_json(indent=2), "utf-8")
