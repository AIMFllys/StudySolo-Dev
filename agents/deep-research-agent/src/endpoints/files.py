from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from src.middleware.auth import verify_api_key

router = APIRouter(tags=["files"])


@router.get("/v1/files/{file_id}")
async def get_file(file_id: str, _: None = Depends(verify_api_key)):
    return JSONResponse(
        status_code=404,
        content={
            "error": {
                "message": "File not found.",
                "type": "invalid_request_error",
                "code": "file_not_found",
            }
        },
    )
