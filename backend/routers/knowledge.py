"""知识图谱生成路由"""
from fastapi import APIRouter, HTTPException

from services.storage import get_recording, update_recording
from services.ai_service import generate_knowledge_graph

router = APIRouter()


@router.post("/api/recordings/{recording_id}/knowledge-graph")
async def api_knowledge_graph(recording_id: str):
    """生成知识图谱数据"""
    rec = get_recording(recording_id)
    if not rec:
        raise HTTPException(status_code=404, detail="会议记录不存在")

    transcript = rec.get("transcript", "")
    summary = rec.get("summary", "")
    key_points = rec.get("key_points", [])

    kg_data = generate_knowledge_graph(transcript, summary, key_points)
    update_recording(recording_id, {"knowledge_graph_data": kg_data})

    return kg_data
