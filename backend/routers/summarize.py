"""摘要生成路由 - 使用DeepSeek API（异步处理，避免 15s 超时）"""
import asyncio
from fastapi import APIRouter, HTTPException

from services.storage import get_recording, update_recording
from services.ai_service import generate_summary

router = APIRouter()


@router.post("/api/recordings/{recording_id}/summarize")
async def api_summarize(recording_id: str):
    """提交摘要生成任务（异步），前端轮询状态"""
    rec = get_recording(recording_id)
    if not rec:
        raise HTTPException(status_code=404, detail="会议记录不存在")

    if not rec.get("transcript"):
        raise HTTPException(status_code=400, detail="请先完成语音转文字")

    update_recording(recording_id, {"status": "summarizing"})
    asyncio.create_task(_run_summarize(recording_id))
    return {"status": "summarizing", "message": "摘要生成任务已提交"}


async def _run_summarize(recording_id: str):
    rec = get_recording(recording_id)
    transcript = rec.get("transcript", "")
    result = await asyncio.to_thread(generate_summary, transcript)
    update_recording(recording_id, {
        "summary": result["summary"],
        "key_points": result["key_points"],
        "status": "summarized"
    })
