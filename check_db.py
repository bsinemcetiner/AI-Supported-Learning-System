"""
check_db.py
───────────
ChromaDB'deki verileri kontrol etmek için yardımcı script.
Kullanım: python check_db.py
"""

import chromadb

DB_PATH = "./chroma_db"  # rag_manager.py ile aynı path

client = chromadb.PersistentClient(path=DB_PATH)

try:
    collection = client.get_collection("course_materials")
    count = collection.count()

    print(f"\n{'='*50}")
    print(f"  ChromaDB Durum Raporu")
    print(f"{'='*50}")
    print(f"  📦 Toplam chunk sayısı : {count}")

    if count > 0:
        # Kaynak bazlı özet
        all_data = collection.get(include=["metadatas"])
        source_map = {}
        for meta in all_data["metadatas"]:
            src = meta.get("source", "Bilinmiyor")
            source_map[src] = source_map.get(src, 0) + 1

        print(f"  📚 Yüklü kaynak sayısı : {len(source_map)}")
        print(f"\n{'─'*50}")
        print("  Kaynak Detayları:")
        print(f"{'─'*50}")
        for src, chunk_count in sorted(source_map.items()):
            print(f"  • {src:<40} {chunk_count:>4} chunk")

        # Örnek kayıtlar
        print(f"\n{'─'*50}")
        print("  Örnek 5 Chunk:")
        print(f"{'─'*50}")
        results = collection.peek(limit=5)
        for i, doc in enumerate(results["documents"]):
            source = results["metadatas"][i].get("source", "Bilinmiyor")
            chunk_i = results["metadatas"][i].get("chunk_index", "?")
            print(f"\n  [{i+1}] Kaynak : {source}  |  Chunk #{chunk_i}")
            print(f"       Metin  : {doc[:120]}...")
    else:
        print("\n  ⚠️  Veritabanı boş. Henüz PDF yüklenmemiş.")

    print(f"\n{'='*50}\n")

except Exception as e:
    print(f"\n❌ Hata: {e}")
    print("   'course_materials' koleksiyonu bulunamadı.")
    print("   Uygulamayı açıp bir PDF yükleyin.\n")