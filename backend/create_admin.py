from database import SessionLocal
from models.admin import Admin
import hashlib

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

db = SessionLocal()
existing = db.query(Admin).filter(Admin.username == "admin").first()
if existing:
    existing.hashed_password = hash_password("admin123")
    db.commit()
    print("Şifre güncellendi:", existing.hashed_password)
else:
    admin = Admin(username="admin", hashed_password=hash_password("admin123"))
    db.add(admin)
    db.commit()
    print("Admin oluşturuldu")
db.close()