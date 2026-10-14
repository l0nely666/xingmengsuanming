"""星梦智能助手后端 — 基础业务 + 星座分析接口。"""

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import db
from app.deps import AuthError
from app.routers import auth, dream, history, horoscope
from app.schemas import AnalyzeResponse

load_dotenv()
db.init_db()

app = FastAPI(title="星梦智能助手", version="0.2.0")

# CORS：允许前端开发服务器跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _first_validation_error(exc: RequestValidationError) -> str:
    """取第一个校验错误，转成中文提示。"""
    for err in exc.errors():
        loc = [str(x) for x in err.get("loc", []) if x != "body"]
        field = loc[-1] if loc else "请求体"
        err_type = err.get("type", "")
        if err_type == "missing":
            return f"缺少参数：{field}"
        if err_type == "string_pattern_mismatch":
            return f"参数格式不正确：{field}"
        if err_type in ("string_too_short", "string_whitespace"):
            return f"参数不能为空：{field}"
        return f"参数校验失败：{field}"
    return "参数错误"


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:  # noqa: ARG001
    """参数校验错误 → 统一错误结构（与其他错误保持一致）。"""
    message = _first_validation_error(exc)
    body = AnalyzeResponse(success=False, result="", error=message)
    return JSONResponse(status_code=422, content=body.model_dump())


@app.exception_handler(AuthError)
async def auth_error_handler(
    request: Request, exc: AuthError
) -> JSONResponse:  # noqa: ARG001
    """认证失败 → 统一 {success:false, error} 结构。"""
    body = {"success": False, "error": exc.detail}
    return JSONResponse(status_code=exc.status_code, content=body)


@app.get("/api/health")
def health() -> dict:
    """连通性检查：验证前端 Vite proxy → 后端链路是否畅通。"""
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(horoscope.router)
app.include_router(dream.router)
app.include_router(history.router)
