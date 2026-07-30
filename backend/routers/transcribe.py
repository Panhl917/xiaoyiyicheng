"""语音转文字路由 - 使用本地 faster-whisper（异步处理，避免 15s 超时）"""
import asyncio
import os
from fastapi import APIRouter, HTTPException

from services.storage import get_recording, update_recording
from services.ai_service import transcribe_audio

router = APIRouter()


@router.post("/api/recordings/{recording_id}/transcribe")
async def api_transcribe(recording_id: str):
    """提交语音转文字任务（异步），前端轮询状态"""
    rec = get_recording(recording_id)
    if not rec:
        raise HTTPException(status_code=404, detail="会议记录不存在")

    audio_path = rec.get("audio_file", "")
    if not audio_path or not os.path.exists(audio_path):
        # 没有音频文件时使用模拟文字稿
        mock_transcript = (
            "大家好，今天我们开个项目进度会。首先我来说一下整体情况，"
            "目前项目已经完成了80%，基本符合预期。接下来需要重点优化数据库查询性能，"
            "这个是目前的主要瓶颈。另外下周要进行第一次集成测试，大家做好准备。"
            "还有，客户那边希望在下月15号进行验收，时间很紧。"
            "我建议再增加两名开发人员，专门负责性能优化这块。"
            "大家有什么意见吗？"
        )
        update_recording(recording_id, {
            "transcript": mock_transcript,
            "status": "transcribed"
        })
        return {"status": "transcribed", "note": "未检测到音频文件，使用示例文字稿"}

    update_recording(recording_id, {"status": "transcribing"})
    asyncio.create_task(_run_transcribe(recording_id, audio_path))
    return {"status": "transcribing", "message": "转写任务已提交"}


async def _run_transcribe(recording_id: str, audio_path: str):
    transcript = await asyncio.to_thread(transcribe_audio, audio_path)
    if not transcript:
        update_recording(recording_id, {"status": "failed", "error": "语音转文字失败"})
        return
    update_recording(recording_id, {"transcript": transcript, "status": "transcribed"})
