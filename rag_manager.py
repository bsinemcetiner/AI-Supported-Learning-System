import chromadb
from chromadb.utils import embedding_functions
import uuid

DB_PATH = "./chroma_db"

class RAGManager:
    def __init__(self):
        self.client = chromadb.PersistentClient(path=DB_PATH)
        self.embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )
        self.collection = self.client.get_or_create_collection(
            name="course_materials",
            embedding_function=self.embedding_fn
        )

    def add_document(self, text, source_name):
        chunks = self.split_text(text, chunk_size=1000, overlap=100)
        ids = [str(uuid.uuid4()) for _ in chunks]
        metadatas = [{"source": source_name} for _ in chunks]

        self.collection.add(documents=chunks, metadatas=metadatas, ids=ids)
        print(f"{len(chunks)} chunks added from: {source_name}")

    def query_context(self, question, n_results=15):
        results = self.collection.query(
            query_texts=[question],
            n_results=n_results
        )
        if results["documents"]:
            return "\n\n---\n\n".join(results["documents"][0])
        return ""

    def split_text(self, text, chunk_size=1000, overlap=100):
        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunks.append(text[start:end])
            start += chunk_size - overlap
        return chunks