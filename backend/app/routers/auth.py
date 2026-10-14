"""登录 / 注册 / 认证接口。"""

import sqlite3

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app import db
from app.deps import get_current_token, get_current_user
from app.schemas import AuthRequest, AuthResponse, LogoutResponse, UserOut, UserResponse

router = APIRouter(prefix="/api/auth", tags=["认证"])

USER_EXISTS = "该用户名已被注册"
BAD_CREDENTIALS = "用户名或密码错误"


def _auth_fail(status: int, message: str) -> JSONResponse:
    body = AuthResponse(success=False, token=None, user=None, error=message)
    return JSONResponse(status_code=status, content=body.model_dump())


@router.post("/register", response_model=AuthResponse)
def register(form: AuthRequest) -> AuthResponse | JSONResponse:
    """注册：成功即签发 token（7 天有效）并返回用户信息。"""
    if db.get_user_by_username(form.username) is not None:
        return _auth_fail(409, USER_EXISTS)
    try:
        user = db.create_user(form.username, form.password)
    except sqlite3.IntegrityError:
        return _auth_fail(409, USER_EXISTS)
    token = db.create_session(user["id"])
    return AuthResponse(
        success=True,
        token=token,
        user=UserOut(id=user["id"], username=user["username"]),
        error=None,
    )


@router.post("/login", response_model=AuthResponse)
def login(form: AuthRequest) -> AuthResponse | JSONResponse:
    """登录：用户不存在与密码错误统一提示，不泄露账号是否存在。"""
    user = db.get_user_by_username(form.username)
    if user is None or not db.verify_password(
        form.password, user["salt"], user["password_hash"]
    ):
        return _auth_fail(401, BAD_CREDENTIALS)
    token = db.create_session(user["id"])
    return AuthResponse(
        success=True,
        token=token,
        user=UserOut(id=user["id"], username=user["username"]),
        error=None,
    )


@router.post("/logout", response_model=LogoutResponse)
def logout(token: str = Depends(get_current_token)) -> LogoutResponse:
    """退出登录：删除当前 session。"""
    db.delete_session(token)
    return LogoutResponse(success=True, message="已退出登录", error=None)


@router.get("/me", response_model=UserResponse)
def me(user: dict = Depends(get_current_user)) -> UserResponse:
    """返回当前登录用户信息。"""
    return UserResponse(
        success=True, user=UserOut(id=user["id"], username=user["username"]), error=None
    )
