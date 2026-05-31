"""
storage_manager.py
──────────────────
MinIO (S3-uyumlu) ile dosya yükleme/indirme servisi.

Ortam değişkenleri (.env veya Railway Variables):
    MINIO_ENDPOINT      örn: "your-vps-ip:9000"  (https olmadan)
    MINIO_ACCESS_KEY    MinIO kullanıcı adı
    MINIO_SECRET_KEY    MinIO şifre
    MINIO_BUCKET        örn: "lassie-materials"
    MINIO_SECURE        "false" (HTTP için) veya "true" (HTTPS için)
"""

import os
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError


def _get_client():
    """boto3 S3 client döndürür — MinIO S3-uyumlu olduğu için direkt çalışır."""
    endpoint = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    secure = os.getenv("MINIO_SECURE", "false").lower() == "true"
    scheme = "https" if secure else "http"

    return boto3.client(
        "s3",
        endpoint_url=f"{scheme}://{endpoint}",
        aws_access_key_id=os.getenv("MINIO_ACCESS_KEY", "minioadmin"),
        aws_secret_access_key=os.getenv("MINIO_SECRET_KEY", "minioadmin"),
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",  # MinIO için zorunlu ama değeri önemli değil
    )


def _get_bucket() -> str:
    return os.getenv("MINIO_BUCKET", "lassie-materials")


def ensure_bucket_exists():
    """Bucket yoksa oluşturur. Uygulama başlarken bir kez çağır."""
    client = _get_client()
    bucket = _get_bucket()
    try:
        client.head_bucket(Bucket=bucket)
    except ClientError:
        client.create_bucket(Bucket=bucket)
        print(f"[MinIO] Bucket oluşturuldu: {bucket}")


def upload_pdf(content: bytes, object_name: str) -> str:
    """
    PDF içeriğini MinIO'ya yükler.

    Args:
        content:     Dosyanın byte içeriği
        object_name: MinIO'daki yol, örn: "courses/math101_abc123.pdf"

    Returns:
        object_name (DB'ye kaydedilecek key)
    """
    import io
    client = _get_client()
    bucket = _get_bucket()

    client.put_object(
        Bucket=bucket,
        Key=object_name,
        Body=io.BytesIO(content),
        ContentType="application/pdf",
        ContentLength=len(content),
    )
    return object_name


def get_presigned_url(object_name: str, expires_in: int = 3600) -> str:
    """
    Geçici erişim URL'i üretir (1 saat geçerli).
    Frontend'e bu URL'i gönder — kullanıcı direkt MinIO'dan indirir.

    Args:
        object_name: MinIO'daki dosya yolu
        expires_in:  Kaç saniye geçerli (default: 1 saat)

    Returns:
        Geçici URL string
    """
    client = _get_client()
    bucket = _get_bucket()

    url = client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": object_name},
        ExpiresIn=expires_in,
    )
    return url


def delete_pdf(object_name: str) -> bool:
    """MinIO'dan dosyayı siler. Materyal silinince çağır."""
    try:
        client = _get_client()
        client.delete_object(Bucket=_get_bucket(), Key=object_name)
        return True
    except ClientError as e:
        print(f"[MinIO] Silme hatası: {e}")
        return False