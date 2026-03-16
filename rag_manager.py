import chromadb
from chromadb.utils import embedding_functions
from typing import Optional
import uuid
import re
import hashlib
from datetime import datetime

DB_PATH = "./chroma_db"
SIMILARITY_THRESHOLD = 1.2


class RAGManager:
    def __init__(self, collection_name: str = "course_materials"):
        self.client = chromadb.PersistentClient(path=DB_PATH)
        self.embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
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
        course_id: str = "unknown",
        teacher_username: str = "unknown"
    ) -> dict:
        file_hash = self._hash_text(text)

        if self._is_duplicate(file_hash, course_id):
            return {"added": 0, "skipped": True, "reason": "duplicate_in_course", "chunks": 0}

        chunks = self._smart_chunk(text, chunk_size=800, overlap=120)

        if not chunks:
            return {"added": 0, "skipped": True, "reason": "empty_content", "chunks": 0}

        timestamp = datetime.now().isoformat()
        ids = []
        metadatas = []

        for i, chunk in enumerate(chunks):
            ids.append(str(uuid.uuid4()))
            metadatas.append({
                "source": source_name,
                "course_id": course_id,
                "teacher": teacher_username,
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

        print(f"✅ '{source_name}' → {added} chunk eklendi ({course_id}).")
        return {"added": added, "skipped": False, "reason": "", "chunks": len(chunks)}

    def query_context(
        self,
        question: str,
        n_results: int = 8,
        course_id: Optional[str] = None,
        score_threshold: float = SIMILARITY_THRESHOLD,
    ) -> str:
        if self.collection.count() == 0:
            return ""

        where = {"course_id": course_id} if course_id else None

        try:
            results = self.collection.query(
                query_texts=[question],
                n_results=min(n_results, self.collection.count()),
                where=where,
                include=["documents", "metadatas", "distances"],
            )
        except Exception as e:
            print(f"Query hatası: {e}")
            return ""

        if not results["documents"] or not results["documents"][0]:
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
            source = meta.get("source", "Bilinmeyen kaynak")
            chunk_i = meta.get("chunk_index", 0)
            chunk_t = meta.get("chunk_total", "?")
            header = f"[Kaynak: {source} | Bölüm {chunk_i + 1}/{chunk_t}]"
            context_parts.append(f"{header}\n{doc}")

        return "\n\n---\n\n".join(context_parts)

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

    def _hash_text(self, text: str) -> str:
        return hashlib.md5(text.encode("utf-8")).hexdigest()

    def _is_duplicate(self, file_hash: str, course_id: Optional[str] = None) -> bool:
        try:
            where = {"file_hash": file_hash}
            if course_id:
                where = {
                    "$and": [
                        {"file_hash": file_hash},
                        {"course_id": course_id}
                    ]
                }

            results = self.collection.get(where=where, limit=1)
            return len(results["ids"]) > 0
        except Exception:
            return False