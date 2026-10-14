"""请求 / 响应 Pydantic 模型（前后端接口契约）。"""

from pydantic import BaseModel, Field


class HoroscopeRequest(BaseModel):
    """星座分析请求：7 字段全部必填。"""

    birth_date: str = Field(
        min_length=1, pattern=r"^\d{4}-\d{2}-\d{2}$", description="出生年月日 YYYY-MM-DD"
    )
    birth_time: str = Field(
        min_length=1, pattern=r"^\d{2}:\d{2}$", description="出生时间 HH:MM"
    )
    birth_place: str = Field(min_length=1, description="出生地点")
    gender: str = Field(min_length=1, description="性别")
    relationship_status: str = Field(min_length=1, description="情感状态：单身/恋爱/已婚")
    occupation: str = Field(min_length=1, description="职业身份")
    focus: str = Field(min_length=1, description="测算关注点")
    name: str = Field(default="", max_length=50, description="你的名字（选填）")


class DreamRequest(BaseModel):
    """周公解梦请求：7 字段全部必填（做梦时间为自由文本，仅校验非空）。"""

    dream_content: str = Field(min_length=1, description="梦境内容")
    dream_time: str = Field(min_length=1, description="做梦时间")
    gender: str = Field(min_length=1, description="性别")
    age: str = Field(min_length=1, description="年龄")
    occupation: str = Field(min_length=1, description="职业")
    recent_status: str = Field(min_length=1, description="近期状态")
    focus: str = Field(min_length=1, description="解梦关注点")
    name: str = Field(default="", max_length=50, description="你的名字（选填）")


class AnalyzeResponse(BaseModel):
    """统一响应结构：成功 result 有值，失败 error 有值。"""

    success: bool
    result: str = ""
    error: str | None = None
    cached: bool = False
    history_id: int | None = None


# ---------- 登录 / 注册 / 认证 ----------


class AuthRequest(BaseModel):
    """注册 / 登录请求。"""

    username: str = Field(min_length=2, max_length=32, description="用户名")
    password: str = Field(min_length=6, max_length=64, description="密码")


class UserOut(BaseModel):
    """对外暴露的用户信息（不含密码与盐）。"""

    id: int
    username: str


class AuthResponse(BaseModel):
    """注册 / 登录响应：成功带 token + user，失败 error 有值。"""

    success: bool
    token: str | None = None
    user: UserOut | None = None
    error: str | None = None


class UserResponse(BaseModel):
    """当前用户信息响应。"""

    success: bool
    user: UserOut | None = None
    error: str | None = None


class LogoutResponse(BaseModel):
    """退出登录响应。"""

    success: bool
    message: str = ""
    error: str | None = None


# ---------- 分析历史 ----------


class HistoryItem(BaseModel):
    """历史列表项：input 为完整表单，result 仅前 100 字预览。"""

    id: int
    analysis_type: str
    input: dict
    result_preview: str
    created_at: str


class HistoryDetail(BaseModel):
    """历史详情：完整 input 与 result_text。"""

    id: int
    analysis_type: str
    input: dict
    result_text: str
    created_at: str


class HistoryListResponse(BaseModel):
    """历史列表响应。"""

    success: bool
    items: list[HistoryItem] = []
    error: str | None = None


class HistoryDetailResponse(BaseModel):
    """历史详情响应。"""

    success: bool
    item: HistoryDetail | None = None
    error: str | None = None
