"""思维导图生成路由"""
from fastapi import APIRouter, HTTPException

from services.storage import get_recording, update_recording
from services.ai_service import generate_mindmap

router = APIRouter()


@router.post("/api/recordings/{recording_id}/mindmap")
async def api_mindmap(recording_id: str):
    """生成思维导图数据"""
    rec = get_recording(recording_id)
    if not rec:
        raise HTTPException(status_code=404, detail="会议记录不存在")

    transcript = rec.get("transcript", "")
    summary = rec.get("summary", "")
    key_points = rec.get("key_points", [])

    mindmap_data = generate_mindmap(transcript, summary, key_points)
    update_recording(recording_id, {"mindmap_data": mindmap_data})

    return mindmap_data
