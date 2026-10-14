"""认证依赖：从 Authorization 头解析 Bearer token 并校验会话。"""

from fastapi import Header, HTTPException

from app import db

AUTH_FAIL = "未登录或登录已失效"
AUTH_EXPIRED = "登录已过期，请重新登录"


class AuthError(HTTPException):
    """认证失败：统一 401，由 main.py 的异常处理器转成 {success:false, error} 结构。"""

    def __init__(self, message: str = AUTH_FAIL) -> None:
        super().__init__(status_code=401, detail=message)


def _resolve(authorization: str) -> tuple[str, dict]:
    """校验 Authorization 头，返回 (token, user)；无效或过期抛 AuthError。"""
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise AuthError()
    token = token.strip()

    session = db.get_session(token)
    if session is None:
        raise AuthError()
    if db.is_expired(session["expires_at"]):
        db.delete_session(token)
        raise AuthError(AUTH_EXPIRED)

    user = db.get_user_by_id(session["user_id"])
    if user is None:
        db.delete_session(token)
        raise AuthError()
    return token, {"id": user["id"], "username": user["username"]}


def get_current_token(authorization: str = Header(default="")) -> str:
    """依赖：返回当前会话 token（供 logout 删除会话使用）。"""
    token, _ = _resolve(authorization)
    return token


def get_current_user(authorization: str = Header(default="")) -> dict:
    """依赖：返回当前用户 {id, username}；无效或过期返回 401。"""
    _, user = _resolve(authorization)
    return user
