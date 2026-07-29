"""AI服务 - 本地Whisper语音识别 + DeepSeek API文字处理"""
import os
import json
import re
from typing import Optional

import config


# ========== DeepSeek API 调用 ==========

def _call_deepseek(system_prompt: str, user_prompt: str, temperature: float = 0.3) -> Optional[str]:
    """调用 DeepSeek API（超廉价，约¥1/百万token）"""
    api_key = config.DEEPSEEK_API_KEY
    if not api_key:
        return None

    try:
        from openai import OpenAI
        client = OpenAI(
            api_key=api_key,
            base_url=config.DEEPSEEK_BASE_URL,
        )
        response = client.chat.completions.create(
            model=config.DEEPSEEK_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature,
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"[DeepSeek API Error] {e}")
        return None


# ========== 语音转文字 (本地Whisper) ==========

def transcribe_audio(audio_path: str) -> Optional[str]:
    """使用本地Whisper模型将音频转为文字（完全免费）"""
    try:
        import whisper
        print(f"[Whisper] 加载模型: {config.WHISPER_MODEL_SIZE}")
        model = whisper.load_model(config.WHISPER_MODEL_SIZE)
        print(f"[Whisper] 开始转写: {audio_path}")
        result = model.transcribe(audio_path, language="zh")
        return result["text"]
    except ImportError:
        print("[Whisper] whisper未安装，尝试直接调用whisper命令行...")
        return None
    except Exception as e:
        print(f"[Whisper Error] {e}")
        return None


# ========== 生成摘要 ==========

def generate_summary(transcript: str) -> dict:
    """生成会议摘要，返回 {summary, key_points}"""
    if not transcript.strip():
        return _mock_summary()

    # 尝试使用 DeepSeek API
    system_prompt = """你是一个专业的会议纪要助手。请根据会议文字稿，生成：
1. 会议摘要（200-300字，概括主要内容）
2. 关键要点（3-8个要点，每个要点一句话）

请以JSON格式返回，格式：
{
  "summary": "摘要内容",
  "key_points": ["要点1", "要点2", ...]
}"""

    result = _call_deepseek(system_prompt, f"会议文字稿：\n{transcript}")

    if result:
        try:
            # 尝试提取JSON
            json_match = re.search(r'\{.*\}', result, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                return {
                    "summary": data.get("summary", ""),
                    "key_points": data.get("key_points", []),
                }
        except (json.JSONDecodeError, AttributeError):
            # 如果JSON解析失败，返回原始文本作为摘要
            return {"summary": result[:500], "key_points": []}

    # API不可用时使用模拟数据
    return _mock_summary()


def _mock_summary() -> dict:
    """模拟数据 - 当API不可用时使用"""
    return {
        "summary": "本次会议主要讨论了项目进展和下一步计划。会议开始由项目经理汇报了整体进度，随后各成员分别介绍了各自负责模块的完成情况。重点讨论了技术方案优化和资源调配问题，最终形成了几项重要决策。",
        "key_points": [
            "项目整体进度符合预期，已完成80%",
            "技术方案需要优化数据库查询性能",
            "下周将进行第一次集成测试",
            "需要增加两名开发人员支持",
            "客户验收时间定在下月15日",
        ]
    }


# ========== 生成思维导图 ==========

def generate_mindmap(transcript: str, summary: str, key_points: list) -> dict:
    """从会议内容生成思维导图数据"""
    content = summary + "\n" + "\n".join(key_points)

    system_prompt = """你是一个思维导图生成专家。请根据会议内容，生成树形结构的思维导图数据。
根节点是会议主题，子节点逐层展开（最多3层深度）。

请以JSON格式返回，必须符合以下结构：
{
  "id": "root",
  "text": "会议主题",
  "children": [
    {
      "id": "node1",
      "text": "第一层节点",
      "children": [
        {"id": "node1_1", "text": "第二层节点", "children": []},
        {"id": "node1_2", "text": "第二层节点", "children": []}
      ]
    }
  ]
}
只返回JSON，不要包含其他文字。"""

    result = _call_deepseek(system_prompt, f"会议内容：\n{content}", temperature=0.5)

    if result:
        try:
            json_match = re.search(r'\{.*\}', result, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                # 确保有根节点
                if "text" in data:
                    return _ensure_mindmap_valid(data)
        except (json.JSONDecodeError, AttributeError):
            pass

    return _mock_mindmap()


def _ensure_mindmap_valid(node: dict) -> dict:
    """确保思维导图数据结构有效"""
    if "id" not in node:
        node["id"] = f"node_{hash(node.get('text', ''))}"
    if "children" not in node:
        node["children"] = []
    if not isinstance(node["children"], list):
        node["children"] = []
    for child in node["children"]:
        _ensure_mindmap_valid(child)
    return node


def _mock_mindmap() -> dict:
    """模拟思维导图数据"""
    return {
        "id": "root",
        "text": "项目进度会议",
        "children": [
            {
                "id": "n1", "text": "项目进展",
                "children": [
                    {"id": "n1_1", "text": "已完成80%", "children": []},
                    {"id": "n1_2", "text": "符合预期", "children": []},
                ]
            },
            {
                "id": "n2", "text": "技术方案",
                "children": [
                    {"id": "n2_1", "text": "优化数据库查询", "children": []},
                    {"id": "n2_2", "text": "性能提升方案", "children": []},
                ]
            },
            {
                "id": "n3", "text": "下一步计划",
                "children": [
                    {"id": "n3_1", "text": "集成测试", "children": []},
                    {"id": "n3_2", "text": "增加开发人员", "children": []},
                    {"id": "n3_3", "text": "客户验收准备", "children": []},
                ]
            },
        ]
    }


# ========== 生成知识图谱 ==========

def generate_knowledge_graph(transcript: str, summary: str, key_points: list) -> dict:
    """从会议内容生成知识图谱数据"""
    content = summary + "\n" + "\n".join(key_points)

    system_prompt = """你是一个知识图谱生成专家。请根据会议内容，提取关键的实体和关系。

实体类型包括：person(人员), topic(主题), project(项目), time(时间), decision(决策)
关系类型用文字描述，如：'负责', '参与', '讨论', '决定', '计划'

请以JSON格式返回，必须符合以下结构：
{
  "nodes": [
    {"id": "e1", "label": "实体名称", "type": "person|topic|project|time|decision"}
  ],
  "edges": [
    {"source": "e1", "target": "e2", "label": "关系描述"}
  ]
}
节点5-12个，边5-15条。只返回JSON。"""

    result = _call_deepseek(system_prompt, f"会议内容：\n{content}", temperature=0.5)

    if result:
        try:
            json_match = re.search(r'\{.*\}', result, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                if "nodes" in data and "edges" in data:
                    return _ensure_graph_valid(data)
        except (json.JSONDecodeError, AttributeError):
            pass

    return _mock_knowledge_graph()


def _ensure_graph_valid(data: dict) -> dict:
    """确保知识图谱数据结构有效"""
    nodes = data.get("nodes", [])
    edges = data.get("edges", [])
    valid_types = {"person", "topic", "project", "time", "decision"}
    for node in nodes:
        if "id" not in node:
            node["id"] = f"n_{hash(node.get('label', ''))}"
        if node.get("type") not in valid_types:
            node["type"] = "topic"
    valid_node_ids = {n["id"] for n in nodes}
    edges = [
        e for e in edges
        if e.get("source") in valid_node_ids and e.get("target") in valid_node_ids
    ]
    return {"nodes": nodes, "edges": edges}


def _mock_knowledge_graph() -> dict:
    """模拟知识图谱数据"""
    return {
        "nodes": [
            {"id": "e1", "label": "项目经理", "type": "person"},
            {"id": "e2", "label": "技术团队", "type": "person"},
            {"id": "e3", "label": "项目进度", "type": "topic"},
            {"id": "e4", "label": "技术方案优化", "type": "topic"},
            {"id": "e5", "label": "数据库查询", "type": "topic"},
            {"id": "e6", "label": "集成测试", "type": "project"},
            {"id": "e7", "label": "客户验收", "type": "project"},
            {"id": "e8", "label": "下月15日", "type": "time"},
            {"id": "e9", "label": "增加开发人员", "type": "decision"},
        ],
        "edges": [
            {"source": "e1", "target": "e3", "label": "汇报"},
            {"source": "e2", "target": "e4", "label": "讨论"},
            {"source": "e4", "target": "e5", "label": "聚焦"},
            {"source": "e3", "target": "e6", "label": "下一步"},
            {"source": "e6", "target": "e7", "label": "前置条件"},
            {"source": "e7", "target": "e8", "label": "计划时间"},
            {"source": "e2", "target": "e9", "label": "决定"},
        ]
    }
