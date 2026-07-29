"""摘要生成路由 - 使用DeepSeek API"""
from fastapi import APIRouter, HTTPException

from services.storage import get_recording, update_recording
from services.ai_service import generate_summary

router = APIRouter()


@router.post("/api/recordings/{recording_id}/summarize")
async def api_summarize(recording_id: str):
    """生成会议摘要"""
    rec = get_recording(recording_id)
    if not rec:
        raise HTTPException(status_code=404, detail="会议记录不存在")

    transcript = rec.get("transcript", "")
    result = generate_summary(transcript)

    update_recording(recording_id, {
        "summary": result["summary"],
        "key_points": result["key_points"],
        "status": "summarized"
    })

    return result
