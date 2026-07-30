"""会议数据存储服务
支持两种模式（按优先级）：
1. MongoDB（MONGODB_URI 环境变量存在时）- 生产/云托管推荐，容器重启数据不丢
2. 本地 JSON 文件 - 本地调试/测试 fallback
"""
import json
import os
import uuid
from datetime import datetime
from typing import Optional

from config import DATA_DIR

MONGODB_URI = os.getenv("MONGODB_URI", "")
_mongo_client = None
_mongo_collection = None


def _init_mongo():
    """延迟初始化 MongoDB 连接"""
    global _mongo_client, _mongo_collection
    if _mongo_collection is not None:
        return _mongo_collection

    from pymongo import MongoClient
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    db_name = os.getenv("MONGODB_DB", "xiaoyiyicheng")
    collection_name = os.getenv("MONGODB_COLLECTION", "recordings")
    _mongo_client = client
    _mongo_collection = client[db_name][collection_name]
    return _mongo_collection


def _use_mongo() -> bool:
    return bool(MONGODB_URI)


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
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(recordings, f, ensure_ascii=False, indent=2)


def _ensure_recording_shape(rec: dict) -> dict:
    """保证记录字段完整，兼容旧数据"""
    defaults = {
        "id": "",
        "title": "",
        "created_at": "",
        "updated_at": "",
        "status": "created",
        "audio_file": "",
        "audio_file_id": "",
        "transcript": "",
        "summary": "",
        "key_points": [],
        "mindmap_data": None,
        "knowledge_graph_data": None,
        "error": "",
    }
    defaults.update(rec)
    return defaults


def create_recording(title: str = "") -> dict:
    """创建新的会议记录"""
    now = datetime.now().isoformat()
    recording = {
        "id": str(uuid.uuid4()),
        "title": title or "未命名会议",
        "created_at": now,
        "updated_at": now,
        "status": "created",
        "audio_file": "",
        "audio_file_id": "",
        "transcript": "",
        "summary": "",
        "key_points": [],
        "mindmap_data": None,
        "knowledge_graph_data": None,
        "error": "",
    }

    if _use_mongo():
        _init_mongo().insert_one(recording)
        return recording

    recordings = _load_recordings()
    recording["title"] = title or f"会议 {len(recordings) + 1}"
    recordings.insert(0, recording)
    _save_recordings(recordings)
    return recording


def get_recording(recording_id: str) -> Optional[dict]:
    """获取单个会议记录"""
    if _use_mongo():
        rec = _init_mongo().find_one({"id": recording_id}, {"_id": 0})
        return _ensure_recording_shape(rec) if rec else None

    for r in _load_recordings():
        if r["id"] == recording_id:
            return _ensure_recording_shape(r)
    return None


def update_recording(recording_id: str, updates: dict) -> Optional[dict]:
    """更新会议记录"""
    updates["updated_at"] = datetime.now().isoformat()

    if _use_mongo():
        _init_mongo().update_one({"id": recording_id}, {"$set": updates})
        return get_recording(recording_id)

    recordings = _load_recordings()
    for i, r in enumerate(recordings):
        if r["id"] == recording_id:
            recordings[i].update(updates)
            _save_recordings(recordings)
            return _ensure_recording_shape(recordings[i])
    return None


def list_recordings() -> list:
    """获取所有会议记录列表"""
    if _use_mongo():
        return [_ensure_recording_shape(r) for r in _init_mongo().find({}, {"_id": 0}).sort("created_at", -1)]

    return [_ensure_recording_shape(r) for r in _load_recordings()]


def delete_recording(recording_id: str) -> bool:
    """删除会议记录"""
    if _use_mongo():
        result = _init_mongo().delete_one({"id": recording_id})
        return result.deleted_count > 0

    recordings = _load_recordings()
    for i, r in enumerate(recordings):
        if r["id"] == recording_id:
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
