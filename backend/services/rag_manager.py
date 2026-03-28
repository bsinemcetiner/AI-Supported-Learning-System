import chromadb
from chromadb.utils import embedding_functions
from typing import Optional
import uuid
import re
import hashlib
from datetime import datetime

DB_PATH = "./chroma_db"
SIMILARITY_THRESHOLD = 1.2  # lower = more relevant


class RAGManager:
    def __init__(self, collection_name: str = "course_materials"):
        self.client = chromadb.PersistentClient(path=DB_PATH)
        self.embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2",
            device="cpu",
        )
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            embedding_function=self.embedding_fn,
            metadata={"hnsw:space": "l2"}
        )

    def add_document(
        self,
        text: str,
        source_name: str,
        course_id: str,
        teacher_username: str
    ) -> dict:
        """
        Adds a document to the vector DB with course-aware metadata.

        Returns:
            {
                "added": int,
                "skipped": bool,
                "chunks": int,
                "reason": str | None
            }
        """
        clean_text = text.strip()
        if not clean_text:
            return {
                "added": 0,
                "skipped": True,
                "chunks": 0,
                "reason": "empty_content"
            }

        file_hash = self._hash_text(clean_text)

        if self._is_duplicate(course_id=course_id, file_hash=file_hash):
            print(f"⚠️ '{source_name}' already exists in course '{course_id}', skipping.")
            return {
                "added": 0,
                "skipped": True,
                "chunks": 0,
                "reason": "duplicate_in_course"
            }

        chunks = self._smart_chunk(clean_text, chunk_size=800, overlap=120)
        if not chunks:
            return {
                "added": 0,
                "skipped": True,
                "chunks": 0,
                "reason": "no_valid_chunks"
            }

        timestamp = datetime.now().isoformat()
        ids = []
        metadatas = []

        for i, chunk in enumerate(chunks):
            ids.append(str(uuid.uuid4()))
            metadatas.append({
                "source": source_name,
                "course_id": course_id,
                "teacher_username": teacher_username,
                "file_hash": file_hash,
                "chunk_index": i,
                "chunk_total": len(chunks),
                "timestamp": timestamp,
                "char_count": len(chunk),
            })

        batch_size = 100
        added = 0

        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i + batch_size]
            self.collection.add(
                documents=batch,
                metadatas=metadatas[i:i + batch_size],
                ids=ids[i:i + batch_size],
            )
            added += len(batch)

        print(f"✅ '{source_name}' added to '{course_id}' with {added} chunks.")
        return {
            "added": added,
            "skipped": False,
            "chunks": len(chunks),
            "reason": None
        }

    def query_context(
        self,
        question: str,
        n_results: int = 8,
        course_id: Optional[str] = None,
        source_name: Optional[str] = None,
        score_threshold: float = SIMILARITY_THRESHOLD,
    ) -> str:
        """
        Returns relevant context filtered by course and optionally source.
        """
        if self.collection.count() == 0:
            return ""

        where = self._build_where_filter(course_id=course_id, source_name=source_name)

        try:
            results = self.collection.query(
                query_texts=[question],
                n_results=min(n_results, self.collection.count()),
                where=where,
                include=["documents", "metadatas", "distances"],
            )
        except Exception as e:
            print(f"Query error: {e}")
            return ""

        if not results.get("documents") or not results["documents"][0]:
            return ""

        docs = results["documents"][0]
        distances = results["distances"][0]
        metadatas = results["metadatas"][0]

        filtered = [
            (doc, meta, dist)
            for doc, meta, dist in zip(docs, metadatas, distances)
            if dist <= score_threshold
        ]

        if not filtered:
            filtered = sorted(
                zip(docs, metadatas, distances),
                key=lambda x: x[2]
            )[:3]

        context_parts = []
        for doc, meta, dist in filtered:
            source = meta.get("source", "Unknown source")
            chunk_i = meta.get("chunk_index", "?")
            chunk_t = meta.get("chunk_total", "?")
            course = meta.get("course_id", "Unknown course")

            header = f"[Course: {course} | Source: {source} | Chunk {chunk_i + 1}/{chunk_t}]"
            context_parts.append(f"{header}\n{doc}")

        return "\n\n---\n\n".join(context_parts)

    def delete_document(self, source_name: str, course_id: Optional[str] = None) -> int:
        """
        Deletes all chunks belonging to a source.
        If course_id is provided, deletion is restricted to that course.
        """
        where = self._build_where_filter(course_id=course_id, source_name=source_name)

        try:
            results = self.collection.get(where=where)
        except Exception as e:
            print(f"Delete lookup error: {e}")
            return 0

        if not results.get("ids"):
            return 0

        self.collection.delete(ids=results["ids"])
        print(f"🗑️ Deleted '{source_name}' ({len(results['ids'])} chunks).")
        return len(results["ids"])

    def list_sources(self, course_id: Optional[str] = None) -> list[dict]:
        """
        Lists distinct sources, optionally restricted to a course.
        """
        if self.collection.count() == 0:
            return []

        where = self._build_where_filter(course_id=course_id, source_name=None)

        try:
            results = self.collection.get(where=where, include=["metadatas"])
        except Exception as e:
            print(f"List sources error: {e}")
            return []

        source_map: dict[str, dict] = {}

        for meta in results.get("metadatas", []):
            src = meta.get("source", "?")
            key = f"{meta.get('course_id', '')}::{src}"

            if key not in source_map:
                source_map[key] = {
                    "source": src,
                    "course_id": meta.get("course_id", ""),
                    "teacher_username": meta.get("teacher_username", ""),
                    "chunks": 0,
                    "timestamp": meta.get("timestamp", ""),
                }

            source_map[key]["chunks"] += 1

        return sorted(
            source_map.values(),
            key=lambda x: x["timestamp"],
            reverse=True
        )

    def _build_where_filter(
        self,
        course_id: Optional[str] = None,
        source_name: Optional[str] = None
    ):
        filters = []

        if course_id:
            filters.append({"course_id": course_id})

        if source_name:
            filters.append({"source": source_name})

        if not filters:
            return None

        if len(filters) == 1:
            return filters[0]

        return {"$and": filters}

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

        chunks = [c for c in chunks if len(c) >= 50]
        return chunks

    def _hash_text(self, text: str) -> str:
        return hashlib.md5(text.encode("utf-8")).hexdigest()

    def _is_duplicate(self, course_id: str, file_hash: str) -> bool:
        try:
            results = self.collection.get(
                where={
                    "$and": [
                        {"course_id": course_id},
                        {"file_hash": file_hash}
                    ]
                },
                limit=1,
            )
            return len(results.get("ids", [])) > 0
        except Exception:
            return False