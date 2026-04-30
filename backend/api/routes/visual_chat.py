from fastapi import APIRouter, File, UploadFile, HTTPException

from services.ocr_service import ocr_service


router = APIRouter(
    prefix="/visual-chat",
    tags=["Visual Chat"]
)


ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}


@router.post("/ocr-test")
async def ocr_test(image: UploadFile = File(...)):
    if image.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPEG, PNG, and WEBP image files are allowed."
        )

    file_bytes = await image.read()

    extracted_text = ocr_service.extract_text(
        file_bytes=file_bytes,
        filename=image.filename or "uploaded_image.png"
    )

    return {
        "filename": image.filename,
        "content_type": image.content_type,
        "extracted_text": extracted_text
    }