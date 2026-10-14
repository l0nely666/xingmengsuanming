"""分析历史查询接口。"""

from typing import Literal

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app import db
from app.deps import get_current_user
from app.schemas import HistoryDetail, HistoryDetailResponse, HistoryListResponse
from app.services.analysis_service import to_history_detail, to_history_item

router = APIRouter(prefix="/api/history", tags=["分析历史"])

AnalysisType = Literal["horoscope", "dream"]


@router.get("/{analysis_type}", response_model=HistoryListResponse)
def list_history(
    analysis_type: AnalysisType, user: dict = Depends(get_current_user)
) -> HistoryListResponse:
    """返回当前用户该类型最近 5 条历史。"""
    rows = db.list_analyses(user["id"], analysis_type)
    items = [to_history_item(r) for r in rows]
    return HistoryListResponse(success=True, items=items, error=None)


@router.get("/{analysis_type}/{item_id}", response_model=HistoryDetailResponse)
def history_detail(
    analysis_type: AnalysisType,
    item_id: int,
    user: dict = Depends(get_current_user),
) -> HistoryDetailResponse | JSONResponse:
    """返回完整 input 与 result_text；仅限本人记录，越权或不存在返回 404。"""
    row = db.get_analysis_by_id(user["id"], item_id)
    if row is None or row["analysis_type"] != analysis_type:
        body = HistoryDetailResponse(success=False, item=None, error="历史记录不存在")
        return JSONResponse(status_code=404, content=body.model_dump())
    return HistoryDetailResponse(
        success=True, item=HistoryDetail(**to_history_detail(row)), error=None
    )
