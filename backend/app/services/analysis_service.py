"""分析统一流程：input_hash 计算、缓存命中、调大模型、结果落库。"""

import hashlib
import json
from typing import Any

from app import db
from app.services.llm_service import LLMService, build_extra_messages

ANALYSIS_TYPES = ("horoscope", "dream")


def compute_input_hash(payload: dict) -> str:
    """按约定口径计算输入哈希：canonical JSON → sha256 hex。"""
    canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def run_analysis(
    *,
    user: dict,
    analysis_type: str,
    payload: dict,
    system_prompt: str,
    user_content: str,
    name: str = "",
) -> dict:
    """命中缓存直接返回；未命中调大模型，成功才落库。失败不写库，异常向上抛。

    返回 {result, cached, history_id}。
    """
    input_hash = compute_input_hash(payload)
    input_json = json.dumps(payload, ensure_ascii=False, sort_keys=True)

    cached = db.find_analysis(user["id"], analysis_type, input_hash)
    if cached is not None:
        return {"result": cached["result_text"], "cached": True, "history_id": cached["id"]}

    llm = LLMService()
    result = llm.chat(
        system_prompt,
        user_content,
        extra_messages=build_extra_messages(name),
    )

    row = db.save_analysis(
        user_id=user["id"],
        analysis_type=analysis_type,
        input_hash=input_hash,
        input_json=input_json,
        result_text=result,
    )
    return {"result": result, "cached": False, "history_id": row["id"]}


def preview_text(text: str, limit: int = 100) -> str:
    """历史列表用的结果预览：前 N 字，超长补省略号。"""
    if len(text) <= limit:
        return text
    return text[:limit] + "…"


def to_history_item(row: dict[str, Any]) -> dict:
    """把 analyses 行转成历史列表项。"""
    return {
        "id": row["id"],
        "analysis_type": row["analysis_type"],
        "input": json.loads(row["input_json"]),
        "result_preview": preview_text(row["result_text"]),
        "created_at": row["created_at"],
    }


def to_history_detail(row: dict[str, Any]) -> dict:
    """把 analyses 行转成历史详情项（含完整 input 与 result_text）。"""
    return {
        "id": row["id"],
        "analysis_type": row["analysis_type"],
        "input": json.loads(row["input_json"]),
        "result_text": row["result_text"],
        "created_at": row["created_at"],
    }
