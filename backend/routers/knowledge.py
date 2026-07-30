"""知识图谱生成路由（异步处理，避免 15s 超时）"""
import asyncio
from fastapi import APIRouter, HTTPException

from services.storage import get_recording, update_recording
from services.ai_service import generate_knowledge_graph

router = APIRouter()


@router.post("/api/recordings/{recording_id}/knowledge-graph")
async def api_knowledge_graph(recording_id: str):
    """提交知识图谱生成任务（异步），前端轮询 status=knowledge_ready"""
    rec = get_recording(recording_id)
    if not rec:
        raise HTTPException(status_code=404, detail="会议记录不存在")

    if not rec.get("summary"):
        raise HTTPException(status_code=400, detail="请先完成摘要生成")

    update_recording(recording_id, {"status": "knowledgeing"})
    asyncio.create_task(_run_knowledge(recording_id))
    return {"status": "knowledgeing", "message": "知识图谱生成任务已提交"}


async def _run_knowledge(recording_id: str):
    rec = get_recording(recording_id)
    transcript = rec.get("transcript", "")
    summary = rec.get("summary", "")
    key_points = rec.get("key_points", [])
    kg_data = await asyncio.to_thread(generate_knowledge_graph, transcript, summary, key_points)
    update_recording(recording_id, {"knowledge_graph_data": kg_data, "status": "knowledge_ready"})
