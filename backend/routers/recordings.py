"""会议记录CRUD路由"""
import os
import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse

from services.storage import (
    create_recording, get_recording, update_recording,
    list_recordings, delete_recording
)
from config import AUDIO_DIR

router = APIRouter()


@router.get("/api/recordings")
async def api_list_recordings():
    """获取所有会议记录列表"""
    return list_recordings()


@router.post("/api/recordings")
async def api_create_recording(data: dict):
    """创建新会议记录"""
    title = data.get("title", "")
    return create_recording(title)


@router.get("/api/recordings/{recording_id}")
async def api_get_recording(recording_id: str):
    """获取单个会议记录详情"""
    rec = get_recording(recording_id)
    if not rec:
        raise HTTPException(status_code=404, detail="会议记录不存在")
    return rec


@router.put("/api/recordings/{recording_id}")
async def api_update_recording(recording_id: str, data: dict):
    """更新会议记录（标题、文稿、摘要等）"""
    rec = get_recording(recording_id)
    if not rec:
        raise HTTPException(status_code=404, detail="会议记录不存在")
    return update_recording(recording_id, data)


@router.delete("/api/recordings/{recording_id}")
async def api_delete_recording(recording_id: str):
    """删除会议记录"""
    if not delete_recording(recording_id):
        raise HTTPException(status_code=404, detail="会议记录不存在")
    return {"message": "删除成功"}


@router.post("/api/recordings/{recording_id}/upload")
async def api_upload_audio(recording_id: str, request: Request, ext: str = ".aac"):
    """上传音频文件（接收二进制流，兼容 wx.cloud.callContainer 和 wx.request）"""
    rec = get_recording(recording_id)
    if not rec:
        raise HTTPException(status_code=404, detail="会议记录不存在")

    # 保存音频文件
    os.makedirs(AUDIO_DIR, exist_ok=True)
    ext = ext.strip().lower()
    if not ext.startswith("."):
        ext = "." + ext
    ext = "".join(c for c in ext if c.isalnum() or c == ".") or ".aac"
    audio_path = os.path.join(AUDIO_DIR, f"{recording_id}{ext}")

    content = await request.body()
    if not content:
        raise HTTPException(status_code=400, detail="缺少音频数据")

    with open(audio_path, "wb") as f:
        f.write(content)

    update_recording(recording_id, {
        "audio_file": audio_path,
        "status": "uploaded"
    })

    return {"message": "上传成功", "audio_path": audio_path}


@router.post("/api/recordings/{recording_id}/upload-url")
async def api_upload_audio_url(recording_id: str, data: dict):
    """接收云存储临时下载 URL，后端下载音频文件到本地"""
    rec = get_recording(recording_id)
    if not rec:
        raise HTTPException(status_code=404, detail="会议记录不存在")

    url = data.get("url", "")
    ext = data.get("ext", ".aac")
    if not url:
        raise HTTPException(status_code=400, detail="缺少音频下载链接")

    os.makedirs(AUDIO_DIR, exist_ok=True)
    ext = ext.strip().lower()
    if not ext.startswith("."):
        ext = "." + ext
    ext = "".join(c for c in ext if c.isalnum() or c == ".") or ".aac"
    audio_path = os.path.join(AUDIO_DIR, f"{recording_id}{ext}")

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=30.0)
            resp.raise_for_status()
            with open(audio_path, "wb") as f:
                f.write(resp.content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"下载音频失败: {e}")

    update_recording(recording_id, {
        "audio_file": audio_path,
        "status": "uploaded"
    })

    return {"message": "上传成功", "audio_path": audio_path}


@router.get("/api/recordings/{recording_id}/audio")
async def api_get_audio(recording_id: str):
    """获取会议录音音频文件（供小程序播放）"""
    rec = get_recording(recording_id)
    if not rec:
        raise HTTPException(status_code=404, detail="会议记录不存在")
    audio_file = rec.get("audio_file", "")
    if not audio_file or not os.path.exists(audio_file):
        raise HTTPException(status_code=404, detail="音频文件不存在")
    ext = os.path.splitext(audio_file)[1].lower()
    media_type = {
        '.aac': 'audio/aac',
        '.mp3': 'audio/mpeg',
        '.m4a': 'audio/mp4',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
    }.get(ext, 'application/octet-stream')
    return FileResponse(audio_file, media_type=media_type)
