import chromadb

client = chromadb.PersistentClient(path="./chroma_db_v3")

try:
    collection = client.get_collection("course_materials")
    count = collection.count()

    print(f"✅ Veritabanında toplam {count} adet parça var.")

    if count > 0:
        print("\n--- Rastgele 10 Kayıt (Kontrol İçin) ---")
        results = collection.peek(limit=10)

        for i, doc in enumerate(results['documents']):
            source = results['metadatas'][i].get('source', 'Bilinmiyor')
            print(f"\n[{i + 1}. Parça] - Kaynak: {source}")
            print(doc[:150] + "...")
            print("-" * 30)

    else:
        print("Veritabanı boş.")

except Exception as e:
    print(f"Hata: {e}")