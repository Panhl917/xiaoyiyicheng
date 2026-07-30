"""会议数据存储服务
支持两种模式（按优先级）：
1. MySQL（CloudBase 环境自带，MYSQL_ADDRESS 等环境变量存在时）- 生产推荐，容器重启数据不丢
2. 本地 JSON 文件 - 本地调试/测试 fallback
"""
import json
import os
import threading
import uuid
from datetime import datetime
from typing import Optional

from config import DATA_DIR

MYSQL_ADDRESS = os.getenv("MYSQL_ADDRESS", "")
MYSQL_USERNAME = os.getenv("MYSQL_USERNAME", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
MYSQL_DB = os.getenv("MYSQL_DATABASE", "xiaoyiyicheng")

_lock = threading.Lock()


def _parse_mysql_address() -> tuple:
    host, _, port = MYSQL_ADDRESS.rpartition(":")
    return host, int(port) if port else 3306


def _connect():
    """返回一个新的 MySQL 连接（每次调用新建，避免多线程共享连接）"""
    import pymysql
    host, port = _parse_mysql_address()
    client = pymysql.connect(
        host=host,
        port=port,
        user=MYSQL_USERNAME,
        password=MYSQL_PASSWORD,
        charset="utf8mb4",
        connect_timeout=5,
    )
    # 自动建库（仅首次）
    client.cursor().execute(f"CREATE DATABASE IF NOT EXISTS `{MYSQL_DB}`")
    client.commit()
    client.select_db(MYSQL_DB)
    with _lock:
        client.cursor().execute(
            """
            CREATE TABLE IF NOT EXISTS recordings (
                id VARCHAR(64) PRIMARY KEY,
                title VARCHAR(255) NOT NULL DEFAULT '',
                status VARCHAR(32) NOT NULL DEFAULT 'created',
                created_at VARCHAR(32) NOT NULL DEFAULT '',
                updated_at VARCHAR(32) NOT NULL DEFAULT '',
                data LONGTEXT NOT NULL
            )
            """
        )
    client.commit()
    return client


def _use_mysql() -> bool:
    return bool(MYSQL_ADDRESS)


def _row_to_data(row) -> dict:
    if row is None:
        return None
    if isinstance(row, dict):
        data = row.get("data")
    else:
        data = row[5]
    return json.loads(data) if data else None


def _ensure_recording_shape(rec: dict) -> dict:
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
    defaults.update(rec or {})
    return defaults


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


def create_recording(title: str = "") -> dict:
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

    if _use_mysql():
        conn = _connect()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO recordings (id, title, status, created_at, updated_at, data) VALUES (%s,%s,%s,%s,%s,%s)",
                    (recording["id"], recording["title"], recording["status"], now, now, json.dumps(recording, ensure_ascii=False)),
                )
            conn.commit()
        finally:
            conn.close()
        return recording

    recordings = _load_recordings()
    recording["title"] = title or f"会议 {len(recordings) + 1}"
    recordings.insert(0, recording)
    _save_recordings(recordings)
    return recording


def get_recording(recording_id: str) -> Optional[dict]:
    if _use_mysql():
        conn = _connect()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT id,title,status,created_at,updated_at,data FROM recordings WHERE id=%s", (recording_id,))
                row = cur.fetchone()
        finally:
            conn.close()
        data = _row_to_data(row)
        return _ensure_recording_shape(data) if data else None

    for r in _load_recordings():
        if r["id"] == recording_id:
            return _ensure_recording_shape(r)
    return None


def update_recording(recording_id: str, updates: dict) -> Optional[dict]:
    updates["updated_at"] = datetime.now().isoformat()

    if _use_mysql():
        conn = _connect()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT data FROM recordings WHERE id=%s", (recording_id,))
                row = cur.fetchone()
                if not row:
                    return None
                rec = _row_to_data(row)
                rec.update(updates)
                cur.execute(
                    "UPDATE recordings SET title=%s, status=%s, updated_at=%s, data=%s WHERE id=%s",
                    (rec.get("title", ""), rec.get("status", ""), rec.get("updated_at", ""), json.dumps(rec, ensure_ascii=False), recording_id),
                )
            conn.commit()
        finally:
            conn.close()
        return _ensure_recording_shape(rec)

    recordings = _load_recordings()
    for i, r in enumerate(recordings):
        if r["id"] == recording_id:
            recordings[i].update(updates)
            _save_recordings(recordings)
            return _ensure_recording_shape(recordings[i])
    return None


def list_recordings() -> list:
    if _use_mysql():
        conn = _connect()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT id,title,status,created_at,updated_at,data FROM recordings ORDER BY created_at DESC")
                rows = cur.fetchall()
        finally:
            conn.close()
        return [_ensure_recording_shape(_row_to_data(r)) for r in rows if _row_to_data(r)]

    return [_ensure_recording_shape(r) for r in _load_recordings()]


def delete_recording(recording_id: str) -> bool:
    if _use_mysql():
        conn = _connect()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT data FROM recordings WHERE id=%s", (recording_id,))
                row = cur.fetchone()
                if row:
                    rec = _row_to_data(row)
                    audio_file = rec.get("audio_file", "")
                    if audio_file and os.path.exists(audio_file):
                        try:
                            os.remove(audio_file)
                        except OSError:
                            pass
                cur.execute("DELETE FROM recordings WHERE id=%s", (recording_id,))
            conn.commit()
        finally:
            conn.close()
        return True

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
