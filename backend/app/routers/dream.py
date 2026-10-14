"""周公解梦业务接口。"""

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.deps import get_current_user
from app.schemas import AnalyzeResponse, DreamRequest
from app.services.analysis_service import run_analysis
from app.services.llm_service import (
    DREAM_SYSTEM_PROMPT,
    build_dream_user_message,
    classify_exception,
)

router = APIRouter(prefix="/api/dream", tags=["周公解梦"])


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(
    form: DreamRequest, user: dict = Depends(get_current_user)
) -> AnalyzeResponse | JSONResponse:
    """生成解梦分析（需登录）：同参命中缓存直接返回，否则调大模型并落库。"""
    try:
        out = run_analysis(
            user=user,
            analysis_type="dream",
            payload=form.model_dump(),
            system_prompt=DREAM_SYSTEM_PROMPT,
            user_content=build_dream_user_message(form),
            name=form.name,
        )
    except Exception as exc:  # noqa: BLE001 — 统一兜底为错误响应（失败不写库）
        status, message = classify_exception(exc)
        body = AnalyzeResponse(
            success=False, result="", error=message, cached=False, history_id=None
        )
        return JSONResponse(status_code=status, content=body.model_dump())
    return AnalyzeResponse(
        success=True,
        result=out["result"],
        error=None,
        cached=out["cached"],
        history_id=out["history_id"],
    )
