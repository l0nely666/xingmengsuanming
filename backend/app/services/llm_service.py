"""通用大模型调用服务：配置读取、对话封装、提示词构建、异常分类。"""

from functools import lru_cache

import openai
from openai import OpenAI
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.schemas import DreamRequest, HoroscopeRequest


class Settings(BaseSettings):
    """从 backend/.env 读取 MiMo 配置（API Key 不硬编码）。"""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mimo_api_key: str
    mimo_base_url: str = "https://api.xiaomimimo.com/v1"
    mimo_model: str = "mimo-v2.6-flash"


@lru_cache
def get_settings() -> Settings:
    return Settings()


class LLMService:
    """通用 LLM 封装：默认读取 MiMo 配置，走 OpenAI 兼容 chat 接口。"""

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
    ) -> None:
        settings = get_settings()
        self.api_key = api_key or settings.mimo_api_key
        self.base_url = base_url or settings.mimo_base_url
        self.model = model or settings.mimo_model
        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            # 大模型生成可能耗时较久，与前端超时对齐留余量
            timeout=240.0,
        )

    def chat(
        self,
        system_prompt: str,
        user_content: str,
        extra_messages: list[dict] | None = None,
    ) -> str:
        """单轮对话：返回模型文本内容（异常向上抛，由路由层分类处理）。"""
        messages: list[dict] = [{"role": "system", "content": system_prompt}]
        if extra_messages:
            messages.extend(extra_messages)
        messages.append({"role": "user", "content": user_content})
        resp = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.7,
            # 关闭思考模式，节省 token 与生成时间
            extra_body={"thinking": {"type": "disabled"}},
        )
        content = resp.choices[0].message.content
        if not content:
            raise RuntimeError("大模型返回内容为空")
        return content


# ---------- 选填姓名与彩蛋 ----------
EASTER_EGG_NAME = "你好基友的名字"

EASTER_EGG_NOTE = (
    "补充说明：这位用户是开发者的好朋友（好基友）。请在保持专业分析的同时，"
    "适当加入一些轻松友好的调侃与小恶搞元素——例如给星座谈或梦境起个好玩的外号、"
    "用朋友间开玩笑的语气点缀；但必须尊重对方、不低俗、不冒犯，"
    "整体仍以准确有用的分析为主。"
)


def build_extra_messages(name: str) -> list[dict]:
    """姓名彩蛋：命中触发词时追加一条轻松化补充指令（不修改原系统提示词）。"""
    if name.strip() == EASTER_EGG_NAME:
        return [{"role": "system", "content": EASTER_EGG_NOTE}]
    return []


SYSTEM_PROMPT = (
    "你是一位资深占星师，精通西方占星、本命盘、太阳/月亮/上升、十二宫、元素与模式。"
    "请根据用户的出生日期、时间、地点、性别、情感状态、职业身份、关注点，"
    "输出专业但易懂的星座分析。结构包括：核心性格、事业与财富、情感关系、近期建议、风险提醒。"
    "避免绝对宿命论，不要提供医疗、法律、投资保证。"
)


def build_user_message(form: HoroscopeRequest) -> str:
    """把请求字段拼成中文用户消息（填写姓名时附上称呼）。"""
    lines = [
        f"出生日期：{form.birth_date}",
        f"出生时间：{form.birth_time}",
        f"出生地点：{form.birth_place}",
        f"性别：{form.gender}",
        f"情感状态：{form.relationship_status}",
        f"职业身份：{form.occupation}",
        f"测算关注点：{form.focus}",
    ]
    if form.name.strip():
        lines.append(f"称呼：{form.name.strip()}")
    # 控制输出长度：缩短生成时间，避免前端等待超时
    lines.append("请将分析控制在 800 字以内，突出重点，避免冗长。")
    return "\n".join(lines)


DREAM_SYSTEM_PROMPT = (
    "你是一位融合周公解梦、传统文化象征与荣格心理学的解梦顾问。"
    "请根据用户的梦境内容、做梦时间、性别、年龄、职业、近期状态、解梦关注点，"
    "输出温和、专业、可行动的分析。结构包括：核心意象、情绪与心理映射、现实提醒、行动建议。"
    "不要制造恐慌，不要做绝对预言。"
)


def build_dream_user_message(form: DreamRequest) -> str:
    """把解梦请求字段拼成中文用户消息（填写姓名时附上称呼）。"""
    lines = [
        f"梦境内容：{form.dream_content}",
        f"做梦时间：{form.dream_time}",
        f"性别：{form.gender}",
        f"年龄：{form.age}",
        f"职业：{form.occupation}",
        f"近期状态：{form.recent_status}",
        f"解梦关注点：{form.focus}",
    ]
    if form.name.strip():
        lines.append(f"称呼：{form.name.strip()}")
    # 控制输出长度：缩短生成时间，避免前端等待超时
    lines.append("请将分析控制在 800 字以内，突出重点，避免冗长。")
    return "\n".join(lines)


def classify_exception(exc: Exception) -> tuple[int, str]:
    """把异常分类为 (HTTP 状态码, 中文错误提示)。"""
    if isinstance(exc, openai.AuthenticationError):
        return 401, "API Key 无效或已过期，请检查后端配置"
    if isinstance(exc, openai.RateLimitError):
        return 429, "大模型服务繁忙或额度不足，请稍后重试"
    if isinstance(exc, (openai.APITimeoutError, openai.APIConnectionError)):
        return 504, "大模型服务连接超时，请稍后重试"
    if isinstance(exc, openai.BadRequestError):
        return 502, "模型配置错误，请检查 MIMO_MODEL 是否正确"
    if isinstance(exc, openai.APIStatusError):
        return 502, f"大模型服务返回异常（HTTP {exc.status_code}）"
    if isinstance(exc, RuntimeError):
        return 500, str(exc)
    return 500, "服务内部错误，请稍后重试"
