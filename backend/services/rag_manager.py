import uuid
import re
import hashlib
from datetime import datetime
from typing import Optional

from qdrant_client import QdrantClient
from qdrant_client.models import (
    VectorParams,
    Distance,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
)
from sentence_transformers import SentenceTransformer

from core.config import settings

COLLECTION_NAME = "course_materials"
VECTOR_SIZE = 384          # all-MiniLM-L6-v2 output dimension
SIMILARITY_THRESHOLD = 0.3  # cosine similarity — higher is more relevant


class RAGManager:
    def __init__(self, collection_name: str = COLLECTION_NAME):
        self.collection_name = collection_name
        self._client = None
        self._encoder = None

    @property
    def client(self):
        if self._client is None:
            self._client = QdrantClient(
                url=settings.qdrant_url,
                api_key=settings.qdrant_api_key or None,
            )
            self._ensure_collection()
        return self._client

    @property
    def encoder(self):
        if self._encoder is None:
            self._encoder = SentenceTransformer("all-MiniLM-L6-v2")
        return self._encoder

    # ─────────────────────────────────────────────
    # Internal helpers
    # ─────────────────────────────────────────────

    def _ensure_collection(self):
        existing = {c.name for c in self._client.get_collections().collections}
        if self.collection_name not in existing:
            self._client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
            )

    def _encode(self, text: str) -> list[float]:
        return self.encoder.encode(text).tolist()

    def _count(self) -> int:
        return self.client.count(collection_name=self.collection_name).count

    def _build_filter(
        self,
        course_id: Optional[str] = None,
        source_name: Optional[str] = None,
    ) -> Optional[Filter]:
        conditions = []
        if course_id:
            conditions.append(FieldCondition(key="course_id", match=MatchValue(value=course_id)))
        if source_name:
            conditions.append(FieldCondition(key="source", match=MatchValue(value=source_name)))
        return Filter(must=conditions) if conditions else None

    def _hash_text(self, text: str) -> str:
        return hashlib.md5(text.encode("utf-8")).hexdigest()

    def _is_duplicate(self, course_id: str, file_hash: str) -> bool:
        try:
            results, _ = self.client.scroll(
                collection_name=self.collection_name,
                scroll_filter=Filter(
                    must=[
                        FieldCondition(key="course_id", match=MatchValue(value=course_id)),
                        FieldCondition(key="file_hash", match=MatchValue(value=file_hash)),
                    ]
                ),
                limit=1,
                with_payload=False,
                with_vectors=False,
            )
            return len(results) > 0
        except Exception:
            return False

    def _smart_chunk(self, text: str, chunk_size: int = 800, overlap: int = 120) -> list[str]:
        text = re.sub(r'\n{3,}', '\n\n', text.strip())
        text = re.sub(r'[ \t]+', ' ', text)

        sentences = re.split(r'(?<=[.!?])\s+', text)
        sentences = [s.strip() for s in sentences if s.strip()]

        chunks = []
        current_chunk = ""
        current_len = 0

        for sentence in sentences:
            sen_len = len(sentence)

            if sen_len > chunk_size:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    current_chunk = ""
                    current_len = 0

                words = sentence.split()
                temp = ""

                for word in words:
                    if len(temp) + len(word) + 1 <= chunk_size:
                        temp += (" " if temp else "") + word
                    else:
                        if temp:
                            chunks.append(temp.strip())
                        temp = word

                if temp:
                    current_chunk = temp
                    current_len = len(temp)
                continue

            if current_len + sen_len + 1 > chunk_size:
                if current_chunk:
                    chunks.append(current_chunk.strip())

                overlap_text = current_chunk[-overlap:] if len(current_chunk) > overlap else current_chunk
                current_chunk = overlap_text + " " + sentence
                current_len = len(current_chunk)
            else:
                current_chunk += (" " if current_chunk else "") + sentence
                current_len += sen_len + 1

        if current_chunk.strip():
            chunks.append(current_chunk.strip())

        return [c for c in chunks if len(c) >= 50]

    # ─────────────────────────────────────────────
    # Public API
    # ─────────────────────────────────────────────

    def add_document(
        self,
        text: str,
        source_name: str,
        course_id: str,
        teacher_username: str,
    ) -> dict:
        clean_text = text.strip()
        if not clean_text:
            return {"added": 0, "skipped": True, "chunks": 0, "reason": "empty_content"}

        file_hash = self._hash_text(clean_text)

        if self._is_duplicate(course_id=course_id, file_hash=file_hash):
            print(f"⚠️ '{source_name}' already exists in course '{course_id}', skipping.")
            return {"added": 0, "skipped": True, "chunks": 0, "reason": "duplicate_in_course"}

        chunks = self._smart_chunk(clean_text, chunk_size=800, overlap=120)
        if not chunks:
            return {"added": 0, "skipped": True, "chunks": 0, "reason": "no_valid_chunks"}

        timestamp = datetime.now().isoformat()
        points = []

        for i, chunk in enumerate(chunks):
            vector = self._encode(chunk)
            points.append(
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vector,
                    payload={
                        "source": source_name,
                        "course_id": course_id,
                        "teacher_username": teacher_username,
                        "file_hash": file_hash,
                        "chunk_index": i,
                        "chunk_total": len(chunks),
                        "timestamp": timestamp,
                        "char_count": len(chunk),
                        "text": chunk,
                    },
                )
            )

        batch_size = 100
        added = 0
        for i in range(0, len(points), batch_size):
            batch = points[i:i + batch_size]
            self.client.upsert(collection_name=self.collection_name, points=batch)
            added += len(batch)

        print(f"✅ '{source_name}' added to '{course_id}' with {added} chunks.")
        return {"added": added, "skipped": False, "chunks": len(chunks), "reason": None}

    def query_context(
        self,
        question: str,
        n_results: int = 8,
        course_id: Optional[str] = None,
        source_name: Optional[str] = None,
        score_threshold: float = SIMILARITY_THRESHOLD,
    ) -> str:
        if self._count() == 0:
            return ""

        query_vector = self._encode(question)
        query_filter = self._build_filter(course_id=course_id, source_name=source_name)

        try:
            # Qdrant >= 1.7: use query_points; fallback to search for older versions
            try:
                response = self.client.query_points(
                    collection_name=self.collection_name,
                    query=query_vector,
                    query_filter=query_filter,
                    limit=n_results,
                    with_payload=True,
                )
                results = response.points
            except AttributeError:
                results = self.client.search(
                    collection_name=self.collection_name,
                    query_vector=query_vector,
                    query_filter=query_filter,
                    limit=n_results,
                    with_payload=True,
                )
        except Exception as e:
            print(f"Query error: {e}")
            return ""

        if not results:
            return ""

        filtered = [r for r in results if r.score >= score_threshold]

        # Fallback: return top 3 even if below threshold
        if not filtered:
            filtered = sorted(results, key=lambda r: r.score, reverse=True)[:3]

        context_parts = []
        for r in filtered:
            p = r.payload
            source = p.get("source", "Unknown source")
            chunk_i = p.get("chunk_index", "?")
            chunk_t = p.get("chunk_total", "?")
            course = p.get("course_id", "Unknown course")
            doc = p.get("text", "")

            header = f"[Course: {course} | Source: {source} | Chunk {chunk_i + 1}/{chunk_t}]"
            context_parts.append(f"{header}\n{doc}")

        return "\n\n---\n\n".join(context_parts)

    def delete_document(self, source_name: str, course_id: Optional[str] = None) -> int:
        delete_filter = self._build_filter(course_id=course_id, source_name=source_name)
        if not delete_filter:
            return 0

        # Count before deleting
        results, _ = self.client.scroll(
            collection_name=self.collection_name,
            scroll_filter=delete_filter,
            limit=10000,
            with_payload=False,
            with_vectors=False,
        )

        if not results:
            return 0

        ids = [str(r.id) for r in results]
        self.client.delete(
            collection_name=self.collection_name,
            points_selector=ids,
        )
        print(f"🗑️ Deleted '{source_name}' ({len(ids)} chunks).")
        return len(ids)

    def list_sources(self, course_id: Optional[str] = None) -> list[dict]:
        if self._count() == 0:
            return []

        scroll_filter = self._build_filter(course_id=course_id)

        try:
            all_points = []
            offset = None
            while True:
                batch, offset = self.client.scroll(
                    collection_name=self.collection_name,
                    scroll_filter=scroll_filter,
                    limit=1000,
                    offset=offset,
                    with_payload=True,
                    with_vectors=False,
                )
                all_points.extend(batch)
                if offset is None:
                    break
        except Exception as e:
            print(f"List sources error: {e}")
            return []

        source_map: dict[str, dict] = {}

        for point in all_points:
            p = point.payload
            src = p.get("source", "?")
            key = f"{p.get('course_id', '')}::{src}"

            if key not in source_map:
                source_map[key] = {
                    "source": src,
                    "course_id": p.get("course_id", ""),
                    "teacher_username": p.get("teacher_username", ""),
                    "chunks": 0,
                    "timestamp": p.get("timestamp", ""),
                }

            source_map[key]["chunks"] += 1

        return sorted(source_map.values(), key=lambda x: x["timestamp"], reverse=True)