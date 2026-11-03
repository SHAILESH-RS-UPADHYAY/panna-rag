"""Embeddings and retrieval: Sentence Transformers vectors in a FAISS index.

Vectors are normalised, so FAISS inner product (IndexFlatIP) is exactly cosine similarity.
"""
import json
import threading

import faiss
import numpy as np

from .config import DATA, EMBED_MODEL

INDEX_FILE = DATA / "index.faiss"
CHUNKS_FILE = DATA / "chunks.json"


class Store:
    def __init__(self):
        self.lock = threading.RLock()
        self.docs: dict[str, dict] = {}
        self.chunks: list[dict] = []  # position i in this list is vector i in the index
        self.index = None
        self._model = None
        self._model_lock = threading.Lock()
        self.dim = 384
        self._load()

    @property
    def ready(self) -> bool:
        return self._model is not None

    def model(self):
        with self._model_lock:
            if self._model is None:
                from sentence_transformers import SentenceTransformer  # slow import, only when needed
                self._model = SentenceTransformer(EMBED_MODEL)
                self.dim = self._model.get_embedding_dimension()
        return self._model

    def embed(self, texts: list[str]) -> np.ndarray:
        vectors = self.model().encode(texts, normalize_embeddings=True, convert_to_numpy=True)
        return vectors.astype("float32")

    def add(self, doc: dict, chunks: list[dict], vectors: np.ndarray) -> None:
        with self.lock:
            self._drop(doc["id"])
            if self.index is None:
                self.index = faiss.IndexFlatIP(vectors.shape[1])
            self.index.add(vectors)
            self.chunks += [{**chunk, "doc_id": doc["id"], "doc": doc["name"]} for chunk in chunks]
            self.docs[doc["id"]] = doc
            self._save()

    def remove(self, doc_id: str) -> None:
        with self.lock:
            self._drop(doc_id)
            self.docs.pop(doc_id, None)
            self._save()

    def _drop(self, doc_id: str) -> None:
        keep = [i for i, chunk in enumerate(self.chunks) if chunk["doc_id"] != doc_id]
        if len(keep) == len(self.chunks):
            return
        vectors = self.vectors()[keep]
        self.chunks = [self.chunks[i] for i in keep]
        self.index = faiss.IndexFlatIP(self.index.d)
        if keep:
            self.index.add(vectors)

    def vectors(self) -> np.ndarray:
        return self.index.reconstruct_n(0, self.index.ntotal)

    def search(self, query: str, k: int) -> tuple[list[dict], np.ndarray]:
        """Return the k nearest chunks, best first, and the query vector."""
        vector = self.embed([query])
        with self.lock:
            if self.index is None or self.index.ntotal == 0:
                return [], vector[0]
            scores, ids = self.index.search(vector, min(k, self.index.ntotal))
            hits = [
                {**self.chunks[i], "id": int(i), "rank": rank + 1, "score": round(float(score), 4)}
                for rank, (score, i) in enumerate(zip(scores[0], ids[0]))
            ]
        return hits, vector[0]

    def map(self, query_vector: np.ndarray | None = None) -> dict:
        """Project every chunk to 2D with PCA so the index can be drawn as a map."""
        with self.lock:
            count = 0 if self.index is None else self.index.ntotal
            if count == 0:
                return {"points": [], "query": None}
            vectors, chunks = self.vectors(), list(self.chunks)
        mean = vectors.mean(axis=0)
        centred = vectors - mean
        # ponytail: full SVD is O(n * d^2), fine for handbooks. Switch to randomized PCA past ~20k chunks.
        basis = np.linalg.svd(centred, full_matrices=False)[2][:2]
        coords = centred @ basis.T
        scale = float(np.abs(coords).max()) or 1.0
        points = [
            {"id": i, "x": round(float(x / scale), 4), "y": round(float(y / scale), 4),
             "doc": chunk["doc"], "page": chunk["page"]}
            for i, ((x, y), chunk) in enumerate(zip(coords, chunks))
        ]
        query = None
        if query_vector is not None:
            qx, qy = (query_vector - mean) @ basis.T
            query = {"x": round(float(qx / scale), 4), "y": round(float(qy / scale), 4)}
        return {"points": points, "query": query}

    def _save(self) -> None:
        DATA.mkdir(parents=True, exist_ok=True)
        if self.index is not None:
            # serialize instead of faiss.write_index: its C++ fopen fails on non-ASCII Windows paths
            INDEX_FILE.write_bytes(faiss.serialize_index(self.index).tobytes())
        CHUNKS_FILE.write_text(json.dumps({"docs": self.docs, "chunks": self.chunks}), "utf-8")

    def _load(self) -> None:
        try:
            saved = json.loads(CHUNKS_FILE.read_text("utf-8"))
            index = faiss.deserialize_index(np.frombuffer(INDEX_FILE.read_bytes(), dtype="uint8"))
        except (OSError, ValueError):
            return
        if index.ntotal == len(saved["chunks"]):  # a mismatch means a torn write: start clean
            self.index, self.docs, self.chunks = index, saved["docs"], saved["chunks"]
            self.dim = index.d


store = Store()
