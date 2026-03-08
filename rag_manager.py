import chromadb
from chromadb.utils import embedding_functions
from typing import Optional
import uuid
import re
import hashlib
from datetime import datetime

DB_PATH = "./chroma_db"
SIMILARITY_THRESHOLD = 1.2  # ChromaDB L2 distance — düşük = daha alakalı


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

    # ──────────────────────────────────────────────────────────────────────────
    # PUBLIC: Belge ekle
    # ──────────────────────────────────────────────────────────────────────────
    def add_document(self, text: str, source_name: str) -> dict:
        """
        PDF metnini akıllıca chunk'lara böler ve ChromaDB'ye ekler.
        Aynı dosya daha önce eklendiyse atlar (duplicate koruması).
        
        Returns:
            dict: { "added": int, "skipped": bool, "chunks": int }
        """
        # 1. Duplicate kontrolü — dosya hash'i ile
        file_hash = self._hash_text(text)
        if self._is_duplicate(file_hash):
            print(f"⚠️  '{source_name}' zaten eklenmiş, atlanıyor.")
            return {"added": 0, "skipped": True, "chunks": 0}

        # 2. Akıllı chunk'lama
        chunks = self._smart_chunk(text, chunk_size=800, overlap=120)

        if not chunks:
            print(f"⚠️  '{source_name}' boş içerik, atlanıyor.")
            return {"added": 0, "skipped": True, "chunks": 0}

        # 3. ID, metadata, embedding hazırla
        timestamp = datetime.now().isoformat()
        ids = []
        metadatas = []

        for i, chunk in enumerate(chunks):
            ids.append(str(uuid.uuid4()))
            metadatas.append({
                "source":      source_name,
                "file_hash":   file_hash,
                "chunk_index": i,
                "chunk_total": len(chunks),
                "timestamp":   timestamp,
                "char_count":  len(chunk),
            })

        # 4. Batch olarak ekle (büyük dosyalar için 100'lük gruplar)
        batch_size = 100
        added = 0
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i+batch_size]
            self.collection.add(
                documents=batch,
                metadatas=metadatas[i:i+batch_size],
                ids=ids[i:i+batch_size],
            )
            added += len(batch)

        print(f"✅  '{source_name}' → {added} chunk eklendi.")
        return {"added": added, "skipped": False, "chunks": len(chunks)}

    # ──────────────────────────────────────────────────────────────────────────
    # PUBLIC: Soru ile ilgili bağlam getir
    # ──────────────────────────────────────────────────────────────────────────
    def query_context(
        self,
        question: str,
        n_results: int = 8,
        source_filter: Optional[str] = None,
        score_threshold: float = SIMILARITY_THRESHOLD,
    ) -> str:
        """
        Soruya en alakalı chunk'ları getirir.

        Args:
            question:         Kullanıcı sorusu
            n_results:        Maksimum chunk sayısı
            source_filter:    Sadece belirli bir PDF'ten ara (None = hepsi)
            score_threshold:  Bu değerin üzerindeki (alakasız) chunk'ları at

        Returns:
            Birleştirilmiş bağlam metni
        """
        if self.collection.count() == 0:
            return ""

        where = {"source": source_filter} if source_filter else None

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

        docs      = results["documents"][0]
        distances = results["distances"][0]
        metadatas = results["metadatas"][0]

        # Skor filtresi — alakasız chunk'ları at
        filtered = [
            (doc, meta, dist)
            for doc, meta, dist in zip(docs, metadatas, distances)
            if dist <= score_threshold
        ]

        if not filtered:
            # Threshold çok sıkıysa en iyi 3'ü yine de döndür
            filtered = sorted(
                zip(docs, metadatas, distances),
                key=lambda x: x[2]
            )[:3]

        # Kaynağa göre grupla ve formatla
        context_parts = []
        for doc, meta, dist in filtered:
            source = meta.get("source", "Bilinmeyen kaynak")
            chunk_i = meta.get("chunk_index", "?")
            chunk_t = meta.get("chunk_total", "?")
            header = f"[Kaynak: {source} | Bölüm {chunk_i+1}/{chunk_t}]"
            context_parts.append(f"{header}\n{doc}")

        return "\n\n---\n\n".join(context_parts)

    # ──────────────────────────────────────────────────────────────────────────
    # PUBLIC: Belge sil
    # ──────────────────────────────────────────────────────────────────────────
    def delete_document(self, source_name: str) -> int:
        """Belirli bir kaynağa ait tüm chunk'ları siler."""
        results = self.collection.get(where={"source": source_name})
        if not results["ids"]:
            return 0
        self.collection.delete(ids=results["ids"])
        print(f"🗑️  '{source_name}' silindi ({len(results['ids'])} chunk).")
        return len(results["ids"])

    # ──────────────────────────────────────────────────────────────────────────
    # PUBLIC: Yüklü kaynakları listele
    # ──────────────────────────────────────────────────────────────────────────
    def list_sources(self) -> list[dict]:
        """
        Koleksiyondaki tüm kaynakları özetler.
        Returns: [{ "source": str, "chunks": int, "timestamp": str }]
        """
        if self.collection.count() == 0:
            return []

        results = self.collection.get(include=["metadatas"])
        source_map: dict[str, dict] = {}

        for meta in results["metadatas"]:
            src = meta.get("source", "?")
            if src not in source_map:
                source_map[src] = {
                    "source":    src,
                    "chunks":    0,
                    "timestamp": meta.get("timestamp", ""),
                }
            source_map[src]["chunks"] += 1

        return sorted(source_map.values(), key=lambda x: x["timestamp"], reverse=True)

    # ──────────────────────────────────────────────────────────────────────────
    # PRIVATE: Akıllı chunk'lama
    # ──────────────────────────────────────────────────────────────────────────
    def _smart_chunk(self, text: str, chunk_size: int = 800, overlap: int = 120) -> list[str]:
        """
        Metni cümle sınırlarına göre böler.
        Kelime ortasından asla kesmez.
        """
        # Normalize whitespace
        text = re.sub(r'\n{3,}', '\n\n', text.strip())
        text = re.sub(r'[ \t]+', ' ', text)

        # Cümlelere böl (Türkçe + İngilizce noktalama)
        sentences = re.split(r'(?<=[.!?])\s+', text)
        sentences = [s.strip() for s in sentences if s.strip()]

        chunks = []
        current_chunk = ""
        current_len   = 0

        for sentence in sentences:
            sen_len = len(sentence)

            # Tek cümle bile chunk_size'dan büyükse zorla böl
            if sen_len > chunk_size:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    current_chunk = ""
                    current_len   = 0
                # Kelime bazlı böl
                words = sentence.split()
                temp  = ""
                for word in words:
                    if len(temp) + len(word) + 1 <= chunk_size:
                        temp += (" " if temp else "") + word
                    else:
                        if temp:
                            chunks.append(temp.strip())
                        temp = word
                if temp:
                    current_chunk = temp
                    current_len   = len(temp)
                continue

            if current_len + sen_len + 1 > chunk_size:
                if current_chunk:
                    chunks.append(current_chunk.strip())

                # Overlap: son N karakteri bir sonrakine taşı
                overlap_text  = current_chunk[-overlap:] if len(current_chunk) > overlap else current_chunk
                current_chunk = overlap_text + " " + sentence
                current_len   = len(current_chunk)
            else:
                current_chunk += (" " if current_chunk else "") + sentence
                current_len   += sen_len + 1

        if current_chunk.strip():
            chunks.append(current_chunk.strip())

        # Çok kısa chunk'ları filtrele (< 50 karakter)
        chunks = [c for c in chunks if len(c) >= 50]
        return chunks

    # ──────────────────────────────────────────────────────────────────────────
    # PRIVATE: Hash & duplicate
    # ──────────────────────────────────────────────────────────────────────────
    def _hash_text(self, text: str) -> str:
        return hashlib.md5(text.encode("utf-8")).hexdigest()

    def _is_duplicate(self, file_hash: str) -> bool:
        try:
            results = self.collection.get(
                where={"file_hash": file_hash},
                limit=1,
            )
            return len(results["ids"]) > 0
        except Exception:
            return False