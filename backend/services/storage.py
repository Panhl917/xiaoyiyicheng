"""本地文件存储服务 - 使用JSON文件存储会议数据"""
import json
import os
import uuid
from datetime import datetime
from typing import Optional

from config import DATA_DIR


def _get_recordings_file() -> str:
    return os.path.join(DATA_DIR, "recordings.json")


def _load_recordings() -> list:
    path = _get_recordings_file()
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_recordings(recordings: list) -> None:
    path = _get_recordings_file()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(recordings, f, ensure_ascii=False, indent=2)


def create_recording(title: str = "") -> dict:
    """创建新的会议记录"""
    recordings = _load_recordings()
    now = datetime.now().isoformat()
    recording = {
        "id": str(uuid.uuid4()),
        "title": title or f"会议 {len(recordings) + 1}",
        "created_at": now,
        "updated_at": now,
        "status": "created",  # created, transcribed, summarized
        "audio_file": "",
        "transcript": "",
        "summary": "",
        "key_points": [],
        "mindmap_data": None,
        "knowledge_graph_data": None,
    }
    recordings.insert(0, recording)
    _save_recordings(recordings)
    return recording


def get_recording(recording_id: str) -> Optional[dict]:
    """获取单个会议记录"""
    recordings = _load_recordings()
    for r in recordings:
        if r["id"] == recording_id:
            return r
    return None


def update_recording(recording_id: str, updates: dict) -> Optional[dict]:
    """更新会议记录"""
    recordings = _load_recordings()
    for i, r in enumerate(recordings):
        if r["id"] == recording_id:
            updates["updated_at"] = datetime.now().isoformat()
            recordings[i].update(updates)
            _save_recordings(recordings)
            return recordings[i]
    return None


def list_recordings() -> list:
    """获取所有会议记录列表"""
    return _load_recordings()


def delete_recording(recording_id: str) -> bool:
    """删除会议记录"""
    recordings = _load_recordings()
    for i, r in enumerate(recordings):
        if r["id"] == recording_id:
            # 删除关联的音频文件
            audio_file = r.get("audio_file", "")
            if audio_file and os.path.exists(audio_file):
                try:
                    os.remove(audio_file)
                except OSError:
                    pass
            recordings.pop(i)
            _save_recordings(recordings)
            return True
    return False
