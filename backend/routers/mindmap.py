"""思维导图生成路由（异步处理，避免 15s 超时）"""
import asyncio
from fastapi import APIRouter, HTTPException

from services.storage import get_recording, update_recording
from services.ai_service import generate_mindmap

router = APIRouter()


@router.post("/api/recordings/{recording_id}/mindmap")
async def api_mindmap(recording_id: str):
    """提交思维导图生成任务（异步），前端轮询 status=mindmap_ready"""
    rec = get_recording(recording_id)
    if not rec:
        raise HTTPException(status_code=404, detail="会议记录不存在")

    if not rec.get("summary"):
        raise HTTPException(status_code=400, detail="请先完成摘要生成")

    update_recording(recording_id, {"status": "mindmaping"})
    asyncio.create_task(_run_mindmap(recording_id))
    return {"status": "mindmaping", "message": "思维导图生成任务已提交"}


async def _run_mindmap(recording_id: str):
    rec = get_recording(recording_id)
    transcript = rec.get("transcript", "")
    summary = rec.get("summary", "")
    key_points = rec.get("key_points", [])
    mindmap_data = await asyncio.to_thread(generate_mindmap, transcript, summary, key_points)
    update_recording(recording_id, {"mindmap_data": mindmap_data, "status": "mindmap_ready"})
