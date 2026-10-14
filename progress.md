# 星梦智能助手 · 开发进度

> 项目较大，分批次开发，每批次完成后更新本文件。

## 批次计划

| 批次 | 内容 | 状态 |
|---|---|---|
| 1 | 项目初始化与规范定义（目录、脚手架、依赖、视觉规范、空路由） | ✅ 已完成 |
| 2 | 前端三个页面 UI（主页、星座分析测算、周公解梦，含跳转/返回/结果展示占位） | ✅ 已完成 |
| 3 | 后端业务接口（表单接收、提示词优化、DeepSeek 调用、结果返回） | ✅ 已完成 |
| 4 | 前后端联调与测试（接口打通、数据展示、问题修复） | ✅ 已完成 |
| 5 | 可选增强（姓名彩蛋、结果区工具、加载动画、历史记录） | ✅ 已完成 |
| 6 | 大模型切换：DeepSeek → 小米 MiMo 2.6 Flash | ✅ 已完成 |
| 7 | 登录 / 注册 / 认证后端（sqlite3 用户、会话、分析记录表） | ✅ 已完成 |
| 8 | 分析强制登录 + 结果落库 + 同参缓存 + 每类型 5 条历史上限 + 历史接口 | ✅ 已完成 |
| 9 | 前端登录 / 注册 / 认证状态管理 / 路由保护 / 主页登录状态条 | ✅ 已完成 |
| 10 | 前端历史改后端 + 缓存命中提示 + 点击查看完整结果 | ✅ 已完成 |
| 11 | 登录 / 持久化 / 缓存 / 历史全链路联调测试 | ✅ 已完成 |

## 已完成

### 批次 1：项目初始化与规范定义

- [x] 创建 `xingmeng-assistant` 目录：`frontend` / `backend` / `docs` / `README.md` / `progress.md`
- [x] `docs/` 收录需求文档 `xingmeng.txt` 与三张效果图
- [x] 前端脚手架：Vite 8 + React 19 + TypeScript + Tailwind CSS 4 + React Router 7 + Axios
- [x] Vite 代理：`/api` → `http://localhost:8000`，固定端口 5173
- [x] 后端 uv 项目：fastapi、uvicorn、openai、pydantic-settings、python-dotenv（清华镜像已写入 `pyproject.toml`）
- [x] `backend/.env` 写入 DeepSeek API Key / 模型 / Base URL 配置（仅配置，无业务代码）
- [x] 全局视觉规范：深蓝背景、科技蓝、切角 HUD 卡片、发光边框、透明底青边输入框（`frontend/src/index.css`）
- [x] 空路由占位：`/`、`/horoscope`、`/dream`
- [x] axios 实例预留：`frontend/src/api/client.ts`（baseURL = `/api`）
- [x] 后端健康检查 `GET /api/health`（非业务接口，仅验证链路）
- [x] README 启动方式

### 批次 2：前端页面 UI（全部完成）

- [x] 主页面《星梦智能助手》：纯色深蓝 `#020617` 背景、发光大标题、两侧对称装饰横线+菱形、两个切角大按钮（双重边框 + 深蓝渐变 + hover 增亮/光效增强 + 入场动画）
- [x] 主页面跳转接线：「星座星盘分析」→ `/horoscope`，「周公解梦」→ `/dream`（Playwright 真实浏览器自检通过，无控制台报错）
- [x] 星座分析测算页 `/horoscope`：`#050a1f`+微弱网格背景、HUD 切角发光卡片 + 玻璃拟态、标题两侧科技装饰线、右上角发光 X 返回主页、7 字段受控表单（字段与效果图一致）、「立即解析」宽大切角按钮 + `handleAnalyze` 预留 axios 调用位置（暂不请求后端）、页面下方解析结果占位区（Playwright 自检 4/4 通过）
- [x] 周公解梦页 `/dream`：与星座页一致的 HUD 视觉语言、标题上方电路板纹路装饰、7 字段受控表单（梦境内容、做梦时间、性别/年龄同行各占 50%、职业、近期状态、解梦关注点）、「立即解梦」+ `handleAnalyze` 预留 axios 调用位置（暂不请求后端）、下方解梦结果占位区、X 返回主页（Playwright 自检 6/6 通过）
- [x] 前端 API 层与表单交互完善：
  - `api/client.ts`：baseURL 优先 `VITE_API_BASE_URL`（默认 `/api`）、60s 超时、统一响应类型 `ApiResponse { success, result, error }`、`getErrorMessage` 友好错误转换
  - `api/horoscope.ts` / `api/dream.ts`：表单 camelCase → 接口 snake_case 映射（`emotionStatus→relationship_status`、`dreamContent→dream_content` 等），封装 `POST /horoscope/analyze`、`POST /dream/analyze`
  - 两页接入：必填红字校验（7 字段全必填、输入即消、不发请求）、loading 按钮禁用（「解析中...」/「解梦中...」）、成功结果换行展示（`whitespace-pre-line`）、失败友好提示（后端未连接 / 超时 / HTTP 错误）
  - Playwright 自检：星座页 8/8、周公页 8/8 通过（覆盖 mock 成功换行、真实 404、连接中断、proxy 500 HTML 各分支）
- [x] 前端已具备完整 API 调用与错误处理能力（后端接口已在批次 3 补齐）

### 批次 3：后端业务接口（星座分析 + 周公解梦）✅

- [x] `backend/app/schemas.py`：`HoroscopeRequest` 7 字段 Pydantic 校验（必填非空 + `YYYY-MM-DD` / `HH:MM` 格式）+ `AnalyzeResponse` 统一响应结构
- [x] `backend/app/services/deepseek_service.py`：pydantic-settings 读 `.env`（API Key 不硬编码）、专业占星系统提示词（按指定原文）、OpenAI SDK 调 DeepSeek（timeout 60s、temperature 0.7）、异常分类（Key 401 / 限流 429 / 超时 504 / 模型 502 / 兜底 500）
- [x] `backend/app/routers/horoscope.py`：`POST /api/horoscope/analyze` → 统一结构
- [x] `backend/app/main.py`：CORS 允许 `http://localhost:5173`、参数错误 422 也返回统一结构、保留 `GET /api/health`
- [x] `backend/.env.example` 配置模板（Key 为占位符，不落真实值）
- [x] 模型名联调更正：`deepseek-v4.1flash` → `deepseek-flash`（官方 API 实测仅支持 `deepseek-flash` / `deepseek-v4-pro`，按「用 flash 不用 pro」要求映射，改 `.env` 即可换）
- [x] curl 实测通过：health `{"status":"ok"}`、analyze `success=true` 返回 1652 字专业分析、非法日期 → 422 统一错误结构；测试命令已写入 README
- [x] `backend/app/routers/dream.py`：`POST /api/dream/analyze`（与星座接口完全对称，复用 `.env` 配置 / 异常分类 / 统一响应结构）；解梦系统提示词按指定原文（周公解梦 + 荣格心理学）
- [x] curl 实测：dream `success=true` 返回 1204 字（核心意象 / 情绪与心理映射 / 现实提醒 / 行动建议）、空字段 → 422 统一错误结构、**星座接口真实回归通过**（1745 字，未被破坏）；测试命令已写入 README
- [x] 环境备注：本环境 uvicorn `--reload` 改代码后不可靠，需手动重启后端（已在 README 注明）

### 批次 4：前后端联调与测试 ✅

- [x] 链路验证：`/api/health` 直连 8000 与经 5173 Vite proxy 均 200；CORS `allow-origin: http://localhost:5173`；前端 200
- [x] **修复：大模型超时** —— 实测星座生成 87~121s，原前端 axios 60s 必超时；前端 `client.ts` 与后端 `deepseek_service.py` 超时统一放宽至 **180s**
- [x] 浏览器 E2E（真实 DeepSeek）：星座 全流程 3211 字 / 87s、周公 全流程 1203 字 / 19s，均含 loading 禁用 → 结果区换行展示 → X 返回，无控制台错误
- [x] curl 经 5173 代理：星座 `success=true` 2088 字、周公 1248 字；参数错误 422 统一结构（两接口均验证）
- [x] 分支回归全绿：主页 3/3、星座页 8/8（必填/loading/成功换行/404/断连/proxy 500）、周公页 8/8（性别年龄 50% 实测 49%）
- [x] `npm run build` 类型检查通过；联调验收步骤已写入 README

### 批次 5：可选增强 ✅

- [x] 必填红字校验（批次 2 已内置，本轮验收复核：7 条红字 + 零请求 + 输入即消）
- [x] **姓名彩蛋**：两页新增选填「你的名字」（7 个必填字段与效果图保持不变）；后端两 schema 加可选 `name`；触发词 `你好基友的名字` 时向 messages 追加轻松化补充指令（原系统提示词不动，尊重不冒犯）；curl 实测生效（2238 字，给星座谈外号「人形多标签浏览器」等）；不带 name 的旧请求向后兼容（1425 字）
- [x] **结果区三工具按钮**：复制（clipboard + 「已复制」1.5s 反馈）/ 清空 / 重新解析（复用当前表单再请求），仅结果或错误存在时显示，`.hud-tool` 切角小按钮
- [x] **HUD 加载动画**：结果区 loading 态 = 发光菱形脉冲 + 青色扫描线 + 「AI 推演中」（纯 CSS，`index.css` 新增 keyframes）
- [x] **历史记录**：localStorage 键 `xm_history`，成功自动保存（类型/时间/表单摘要/结果），整体最近 5 条、按页过滤展示、点击回填结果区、「清空历史」按钮
- [x] **流式输出**：实测 DeepSeek `stream=True` 可用（`deepseek-flash` 为推理模型，content/reasoning 双路分片），因需改前后端协议、为不破坏已验收主链路**本轮不接入**，列入扩展方向
- [x] 自测全绿：主页 3/3、星座分支 10/10（含 name 入请求体、动画、三按钮、历史累计/回填/清空）、周公 9/9、真实 E2E 3/3（星座 1663 字/101s + 周公 1169 字/23s）；`npm run build` 通过
- [x] 环境修复：项目迁移至 `jieduan2` 目录后 `.venv` 内嵌旧路径失效（`uv trampoline failed to canonicalize script path`）→ `uv sync --reinstall-package uvicorn` 重建启动器修复

### 批次 6：大模型切换 DeepSeek → 小米 MiMo 2.6 Flash ✅

- [x] `backend/.env`：改用 `MIMO_API_KEY` / `MIMO_BASE_URL=https://api.xiaomimimo.com/v1` / `MIMO_MODEL=mimo-v2.6-flash`；原 `DEEPSEEK_*` 三行注释掉保留
- [x] `backend/.env.example`：同步改为 MiMo 占位模板
- [x] `app/services/deepseek_service.py` → **重命名** `app/services/llm_service.py`，改为通用 `LLMService` 类：
  - 配置从 `MIMO_API_KEY` / `MIMO_BASE_URL` / `MIMO_MODEL` 读取（pydantic-settings，Key 不硬编码）；`base_url` 默认 `https://api.xiaomimimo.com/v1`、`model` 默认 `mimo-v2.6-flash`
  - `chat(system_prompt, user_content, extra_messages=None)`：OpenAI SDK `chat.completions.create`，**强制 `extra_body={"thinking": {"type": "disabled"}}` 关闭思考模式**，返回 `response.choices[0].message.content`
  - 原有系统提示词（占星 / 周公解梦）与字段拼装、姓名彩蛋、异常分类**原文保留**，仅函数随服务层迁移
- [x] `app/routers/horoscope.py` / `dream.py`：改为 `from app.services.llm_service import LLMService`，实例化后 `llm.chat(...)`；**接口契约、字段名、返回结构、历史记录逻辑零改动**
- [x] `app/main.py`：顶部补 `from dotenv import load_dotenv; load_dotenv()`
- [x] `pyproject.toml`：`openai>=3.29.0` 已满足 `>=1.0.0`，无需改动
- [x] curl 实测（真实 MiMo）：
  - `POST /api/horoscope/analyze` → HTTP 200 / 15.9s / 1005 字，结构含核心性格、事业与财富、情感关系等，`success=true`
  - `POST /api/dream/analyze` → HTTP 200 / 22.3s / 1075 字，结构含核心意象、情绪与心理映射等，`success=true`
  - 空字段 → HTTP 422 统一错误结构 `{"success":false,"error":"参数不能为空：dream_content"}`（契约未破坏）
  - 缓存逻辑确认：后端无缓存层，每次请求都真实调用 MiMo（对应 cached=false）；cached=true 为前端 localStorage 历史回填，走 `handleRestore` 纯本地 `setResult`，**不发请求、不调 MiMo**
- [x] 变更文件清单：
  | 文件 | 操作 |
  |---|---|
  | `backend/.env` | 改（MiMo 配置，DeepSeek 注释保留） |
  | `backend/.env.example` | 改（MiMo 模板） |
  | `backend/app/services/llm_service.py` | 新增（原 deepseek_service 重命名改造） |
  | `backend/app/services/deepseek_service.py` | 删除 |
  | `backend/app/routers/horoscope.py` | 改（换 LLMService 调用） |
  | `backend/app/routers/dream.py` | 改（换 LLMService 调用） |
  | `backend/app/main.py` | 改（加 load_dotenv） |
  | `progress.md` | 改（本批次记录） |
  - 未触碰：前端、数据库、认证、`schemas.py`、接口契约

### 批次 7：登录 / 注册 / 认证后端（sqlite3）✅

- [x] `backend/app/db.py`（新增）：**仅用 Python 自带 `sqlite3`**，零第三方 ORM / 数据库服务
  - 库文件 `backend/data/xingmeng.db`，按 `Path(__file__)` 解析路径（不依赖启动时 cwd），首次启动自动 `mkdir` 建目录
  - 建表 `users` / `sessions` / `analyses`（字段按指定 DDL 原样落地）+ 索引 `idx_user_type_hash`（UNIQUE）与 `idx_user_type_created`（`created_at DESC`），全部 `IF NOT EXISTS` 幂等
  - 连接每次独立开闭、`check_same_thread=False` + `Row` 工厂（同步接口跑线程池，避免共享连接）
  - **密码安全**：`hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100_000)`，`salt = secrets.token_bytes(16)`；库里只存 `password_hash`(hex) + `salt`(hex)，**不存明文**；校验用 `secrets.compare_digest` 防时序攻击
  - **会话 token**：`secrets.token_urlsafe(32)`，有效期 **7 天**，存 `sessions` 表
- [x] `backend/app/deps.py`（新增）：`get_current_user` 依赖 —— 读 `Authorization: Bearer <token>` → 查 `sessions` + `users` → 校验 `expires_at`；无效 / 过期均返回 **401**（过期顺带清理该 session），通过则返回 `{id, username}`
- [x] `backend/app/routers/auth.py`（新增）：四个接口
  | 接口 | 鉴权 | 成功返回 |
  |---|---|---|
  | `POST /api/auth/register` | 无 | `{success, token, user:{id,username}, error}`（成功即签发 token） |
  | `POST /api/auth/login` | 无 | 同上 |
  | `POST /api/auth/logout` | Bearer | `{success, message:"已退出登录", error}` |
  | `GET /api/auth/me` | Bearer | `{success, user:{id,username}, error}` |
  - 状态码：参数不合法 422（复用 main.py 既有统一校验处理器）／用户名已存在 **409**／用户名或密码错误 **401**（不泄露账号是否存在）／token 无效或过期 **401**
- [x] `backend/app/schemas.py`：**只追加** `AuthRequest`（username 2–32、password 6–64）、`UserOut`、`AuthResponse`、`UserResponse`、`LogoutResponse`；`HoroscopeRequest` / `DreamRequest` / `AnalyzeResponse` **零改动**
- [x] `backend/app/main.py`：启动时 `db.init_db()` 建库建表 + `include_router(auth.router)` + `AuthError` 异常处理器转统一 `{success:false, error}` 结构；CORS / 422 处理 / health / 星座 / 周公路由 **零改动**
- [x] curl 实测 11 项全绿：
  | # | 用例 | 结果 |
  |---|---|---|
  | 1 | 注册 | 200，返回 token + user |
  | 2 | 同名再注册 | 409「该用户名已被注册」 |
  | 3 | 弱密码（<6 位） | 422 统一错误结构 |
  | 4 | 登录（正确密码） | 200，返回 token + user |
  | 5 | 登录（错误密码） | 401「用户名或密码错误」 |
  | 6 | 登录（用户不存在） | 401 同上（不泄露账号是否存在） |
  | 7 | `GET /me` 带 token | 200，返回 user |
  | 8 | `GET /me` 不带 token | 401 |
  | 9 | `GET /me` 带假 token | 401 |
  | 10 | `POST /logout` | 200，session 删除 |
  | 11 | `GET /me` 用已注销 token | 401 |
  - 数据库安全复核：`users` 表 salt 32 hex / hash 64 hex、**不含明文**；`analyses` 表 0 行（本批只建表）；两索引 DDL 正确；session 7 天有效期核对（10-14 → 10-21）正确
- [x] **主流程回归未破坏**：`/api/health` 200；星座 analyze 200 / 30.8s / 827 字；周公 analyze 200 / 12.3s / 869 字；两接口返回字段仍为 `{success, result, error}`；空字段 422 统一结构
- [x] curl 测试命令已写入 README（4.5–4.9）
- [x] 变更文件清单：
  | 文件 | 操作 |
  |---|---|
  | `backend/app/db.py` | 新增（sqlite3 数据层） |
  | `backend/app/deps.py` | 新增（get_current_user） |
  | `backend/app/routers/auth.py` | 新增（4 个认证接口） |
  | `backend/app/schemas.py` | 改（仅追加认证模型） |
  | `backend/app/main.py` | 改（init_db + auth 路由 + AuthError 处理） |
  | `README.md` | 改（认证 curl 4.5–4.9、技术栈、目录结构） |
  | `progress.md` | 改（本批次记录） |
  - 未触碰：前端全部代码、`routers/horoscope.py`、`routers/dream.py`、`services/llm_service.py`、既有接口契约
- [x] 约束核对：**未引入** SQLAlchemy / Peewee / Tortoise / MongoDB / Redis / MySQL / PostgreSQL；`pyproject.toml` 零新增依赖，仅标准库 `sqlite3` + 既有 FastAPI

### 批次 8：分析强制登录 + 结果落库 + 同参缓存 + 5 条历史上限 ✅

- [x] `backend/app/db.py`：追加 `analyses` 读写
  - `find_analysis`：按 `user_id + analysis_type + input_hash` 查缓存（`SELECT … LIMIT 1`）
  - `save_analysis`：`INSERT OR IGNORE`（同 hash 不重复插入）→ 同事务执行清理 SQL（`ORDER BY created_at DESC, id DESC LIMIT -1 OFFSET 5`，保留最新 5 条）→ 回读返回记录
  - `list_analyses`：该用户该类型最近 5 条（`created_at DESC, id DESC`）
  - `get_analysis_by_id`：带 `user_id` 条件，天然隔离他人记录
  - 新增常量 `HISTORY_LIMIT = 5`
- [x] `backend/app/services/analysis_service.py`（新增）：统一流程
  - `compute_input_hash`：`canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(',',':'))` → `sha256` hex（64 位）；键序无关、可复现
  - **payload 含选填 `name`**（命中彩蛋会改变输出，不进 hash 会串缓存拿到错结果）
  - `run_analysis`：命中缓存 → 直接返回 `{result, cached:True, history_id}`，**不调大模型**；未命中 → 调大模型 → **成功才落库**（失败不写库）→ 返回 `{result, cached:False, history_id}`
- [x] `backend/app/schemas.py`：`AnalyzeResponse` **追加** `cached` / `history_id` 两字段（前端忽略未知字段，向后兼容）；新增 `HistoryItem` / `HistoryDetail` / `HistoryListResponse` / `HistoryDetailResponse`
- [x] `backend/app/routers/horoscope.py` / `dream.py`：改用 `get_current_user` **强制登录**；请求字段不变（7 必填 + 选填 `name`）；`analysis_type` 分别为 `horoscope` / `dream`；统一响应 `{success, result, error, cached, history_id}`
- [x] `backend/app/routers/history.py`（新增）：
  | 接口 | 说明 |
  |---|---|
  | `GET /api/history/{analysis_type}` | 该用户该类型最近 5 条：`{success, items:[{id, analysis_type, input, result_preview, created_at}], error}` |
  | `GET /api/history/{analysis_type}/{id}` | 完整 `input` + `result_text`；仅本人，越权/不存在/类型不符 → 404 |
  - `analysis_type` 用 `Literal["horoscope","dream"]`，非法值走 main.py 既有 422 统一结构
  - `result_preview` = 前 100 字，超长补 `…`
- [x] `backend/app/main.py`：注册 history 路由
- [x] curl 实测 13 项全绿：
  | # | 用例 | 结果 |
  |---|---|---|
  | A | 不带 token 调 analyze | 401「未登录或登录已失效」 |
  | B | 首次调星座 | 200 / 18.2s / 777 字，`cached=false, history_id=1` |
  | C | **同参再发** | 200 / **0.26s**，`cached=true, history_id=1`，result 与首次完全一致（未调模型） |
  | — | 6 条不同内容 | history_id 依次 1→6，全部 `cached=false` |
  | — | 历史列表 | **恰好 5 条**，ids=`[6,5,4,3,2]`，**id=1 已被自动删除** |
  | D | 周公首次 | 200 / 13.3s，`cached=false, history_id=7` |
  | E | 周公同参 | 200 / **0.24s**，`cached=true, history_id=7` |
  | F | 周公不同内容 | `cached=false, history_id=8` |
  | G | 周公历史列表 | 2 条，ids=`[8,7]` |
  | H | 历史详情 id=7 | 200，input 8 键完整，result_text 793 字 |
  | I | 类型不符（dream id 查 horoscope） | 404 |
  | J | 不存在的 id | 404 |
  | K | 越权（换用户查他人记录） | 404（不泄露他人数据） |
  | L | 非法 `analysis_type=tarot` | 422 统一结构 |
  | M | 历史接口不带 token | 401 |
  - 数据库复核：user=2 horoscope **恰好 5 条**（id 2~6）、dream 2 条（id 7~8）；无明文密码落库
- [x] **大模型失败不落库**：`run_analysis` 仅在 `llm.chat` 成功返回后才调 `save_analysis`；异常路径直接抛出由路由层分类返回，全程不碰 `analyses` 表
- [x] curl 测试命令已写入 README（4.2–4.4 加 `Authorization` 头；新增 4.10–4.13 缓存与历史用例）
- [x] 变更文件清单：
  | 文件 | 操作 |
  |---|---|
  | `backend/app/db.py` | 改（analyses 读写 + 5 条清理） |
  | `backend/app/services/analysis_service.py` | 新增（input_hash + 缓存/落库统一流程） |
  | `backend/app/schemas.py` | 改（AnalyzeResponse 加 cached/history_id；新增历史模型） |
  | `backend/app/routers/horoscope.py` | 改（强制登录 + 统一流程） |
  | `backend/app/routers/dream.py` | 改（同上） |
  | `backend/app/routers/history.py` | 新增（历史列表 + 详情） |
  | `backend/app/main.py` | 改（注册 history 路由） |
  | `README.md` | 改（curl 4.2–4.4 / 4.10–4.13、功能清单、已知问题） |
  | `progress.md` | 改（本批次记录） |
  - 未触碰：前端全部代码、`services/llm_service.py`、`deps.py`、`routers/auth.py`
- [x] **前端影响说明（已与需求确认）**：两 analyze 接口改为强制登录后，前端在接入登录 UI 前调用会收到 401，现有前端主流程暂时中断 —— 这是「必须登录才能分析」的必然结果，下一批接登录 UI 后恢复

### 批次 9：前端登录 / 注册 / 认证状态管理 ✅

- [x] `frontend/src/api/auth.ts`（新增）：`login` / `register` / `logout` / `fetchMe` 四个接口封装 + `AuthUser` / `AuthResponse` / `MeResponse` 类型
- [x] `frontend/src/context/AuthContext.tsx`（新增）：
  - token 存 **localStorage key `xingmeng_token`**
  - 提供 `login` / `register` / `logout` / `user` / `token` / `isLoggedIn` / `loading`
  - **刷新恢复**：挂载时本地有 token → 调 `GET /api/auth/me` 恢复 `user`；失败或 401 → 清 token
  - `loading` 区分「恢复中」与「确未登录」，避免闪跳
  - `safeRedirectPath`：只放行以 `/` 开头的站内路径，防开放重定向
- [x] `frontend/src/api/client.ts`（改）：
  - **请求拦截器**：自动加 `Authorization: Bearer <token>`
  - **响应拦截器**：401 → 清 token → 跳 `/login?redirect=<当前路径>`
  - **白名单**：`/auth/login` `/auth/register` `/auth/me` `/auth/logout` 自身的 401 不触发跳转（否则登录失败被弹走、启动恢复会闪跳）
  - `getErrorMessage` 补充：普通 `Error` 用其 `message`（业务层主动抛出的提示）
- [x] `frontend/src/components/AuthGuard.tsx`（新增）：未登录 → `Navigate` 到 `/login?redirect=...`；恢复中 → HUD 风格「校验登录中」（脉冲菱形 + 扫描线）
- [x] `frontend/src/pages/Login.tsx`（新增）：`bg-panel bg-grid` + `hud-card` 切角卡片 + `hud-input` + `hud-btn`；用户名 / 密码 / 登录按钮 / 去注册链接；字段红字 + 顶部红色错误条；右上角 ✕ 回主页；登录成功跳 `redirect` 或主页
- [x] `frontend/src/pages/Register.tsx`（新增）：同视觉骨架；用户名 / 密码 / 确认密码 / 注册按钮 / 去登录链接；校验用户名 2–32、密码 6–64、两次密码一致（与后端口径对齐）
- [x] `frontend/src/router/index.tsx`：新增 `/login` `/register`；`/horoscope` `/dream` 包 `AuthGuard`
- [x] `frontend/src/App.tsx`：`BrowserRouter > AuthProvider > AppRouter`
- [x] `frontend/src/pages/Home.tsx`：**仅加右上角 `AuthBar`**（绝对定位，不占文档流）
  - 未登录：`登录 / 注册`（`hud-tool` 小按钮）
  - 已登录：`你好，{username}` + `退出登录`（调 `POST /api/auth/logout` + 清 token）
  - 恢复中：`…`
  - **大标题、装饰线、两个大按钮、入场动画零改动**
- [x] 自检脚本（`frontend/scripts/`）：`auth-check.mjs` / `pages-check.mjs` / `flow-check.mjs`
  - 环境备注：本机 playwright 由 npx 临时拉取，版本与 `ms-playwright` 内核不匹配 → 脚本自动从 npx 缓存解析 + 显式指向已有 Chromium 可执行文件
- [x] `npm run build`（tsc + vite）通过
- [x] **auth-check 29/29 全绿**：
  | 分组 | 用例 |
  |---|---|
  | 路由保护 | 未登录访问 `/horoscope` `/dream` → 跳 `/login?redirect=...`（redirect 参数正确） |
  | 登录页 | 标题 / 用户名 / 密码 / 去注册链接齐全 |
  | 登录校验 | 空表单红字 ×2；错误密码显示红色「用户名或密码错误」 |
  | 注册页 | 标题 / 确认密码 / 去登录链接齐全 |
  | 注册校验 | 两次密码不一致红字；弱密码红字 |
  | 注册成功 | 带 `redirect=/horoscope` → 跳回星座页；`xingmeng_token` 已写入 |
  | 状态恢复 | 刷新后主页显示「你好，xxx」；显示「退出登录」；不再显示「登录/注册」入口 |
  | 退出登录 | token 清除；主页回到「登录」；再访问 `/dream` 跳登录 |
  | 控制台 | 无报错 |
- [x] **pages-check 19/19 全绿（视觉回归）**：主页大标题 / 两个大按钮 / `bg-deep` / 发光 text-shadow 均保留；星座页标题 / `hud-card` / `hud-input` / 「立即解析」/ 历史区 / `bg-panel bg-grid` 正常；周公页同理；登录页 `hud-card` / `hud-input` / 深蓝渐变按钮正常；无控制台报错
- [x] **flow-check 5/5 全绿（主流程恢复）**：注册后跳回 `/horoscope` → 填表 → **星座解析 736 字真实结果** → 周公解梦 **915 字真实结果** → 无控制台报错 —— **批次 8 中断的前端主流程已恢复**
- [x] 变更文件清单：
  | 文件 | 操作 |
  |---|---|
  | `frontend/src/api/auth.ts` | 新增 |
  | `frontend/src/context/AuthContext.tsx` | 新增 |
  | `frontend/src/components/AuthGuard.tsx` | 新增 |
  | `frontend/src/pages/Login.tsx` | 新增 |
  | `frontend/src/pages/Register.tsx` | 新增 |
  | `frontend/src/api/client.ts` | 改（拦截器 + token 存取 + 401 处理） |
  | `frontend/src/router/index.tsx` | 改（新增 2 路由 + 路由保护） |
  | `frontend/src/App.tsx` | 改（包 AuthProvider） |
  | `frontend/src/pages/Home.tsx` | 改（仅加右上角 AuthBar） |
  | `frontend/scripts/{auth,pages,flow}-check.mjs` | 新增（自检脚本） |
  | `progress.md` | 改（本批次记录） |
  - 未触碰：后端全部代码、`pages/Horoscope.tsx` 与 `pages/Dream.tsx` 的表单/结果/历史逻辑、`index.css`（复用现有 HUD 类）、`utils/history.ts`
- [x] 约束核对：**未实现历史记录列表**（仍为 localStorage，留待批次 10）；**未改后端业务逻辑**

### 批次 10：前端历史改后端 + 缓存命中提示 ✅

- [x] `frontend/src/api/history.ts`（新增）：`fetchHistory(type)` → `GET /api/history/{type}`；`fetchHistoryDetail(type, id)` → `GET /api/history/{type}/{id}`；类型 `HistoryItem` / `HistoryDetail` 与后端模型对齐
- [x] `frontend/src/components/HistoryPanel.tsx`（新增）：两页共用历史区（标题 / 空态文案 / 条目摘要由 props 传入）
  - **四态**：加载中（脉冲菱形 + 扫描线「加载历史中」）／空（「暂无历史分析」/「暂无历史解梦」）／错误（红色原因 + 「重试」按钮）／列表
  - 条目展示：**时间**（UTC ISO → 本地可读）+ **输入摘要** + **结果预览**（后端 `result_preview` 前 100 字）+ 类型标签 `[星座]`/`[解梦]`
  - 当前展示中的条目高亮（青色描边 + 光晕）
- [x] `frontend/src/api/client.ts`：`ApiResponse` 补 `cached` / `history_id` 两可选字段（与后端 `AnalyzeResponse` 对齐）
- [x] `frontend/src/api/horoscope.ts` / `dream.ts`：注释标明返回含 `cached` / `history_id`（类型已由 `ApiResponse` 覆盖）
- [x] `frontend/src/pages/Horoscope.tsx` / `Dream.tsx`：
  - **历史来源**：localStorage → 后端 `fetchHistory(type)`；解析成功后 `void loadHistories()` 刷新列表
  - **缓存徽标**（结果区标题行）：`cached=true` →「来自历史缓存，未消耗大模型 token」；`cached=false` →「新解析完成」；点击历史回填 →「来自历史记录」（灰色，与前两者区分）
  - **点击历史条目**：`fetchHistoryDetail(type, id)` → 结果区展示完整 `result_text` + 徽标「来自历史记录」+ 条目高亮
  - **摘要**：星座 `{birth_place} · {birth_date} · {focus}`；周公 `{dream_content 前 14 字}… · {focus}`
  - 表单字段、必填校验、复制/清空/重新解析、HUD 动画、视觉**零改动**
- [x] **移除 localStorage 历史**：两页不再引用 `utils/history.ts`（文件保留未删，避免误伤其他引用）；不再有「清空历史」按钮（后端历史上限由服务端维护）
- [x] **后端接口契约零改动**：仅前端消费已有 `GET /api/history/*` 与 `cached`/`history_id` 字段
- [x] `npm run build`（tsc + vite）通过
- [x] **history-check 28/28 全绿**（真实大模型）：
  | 分组 | 用例 |
  |---|---|
  | 空态 | 新用户历史区显示「暂无历史分析」；标题「最近分析」 |
  | 新解析 | 首次解析 990 字；徽标「新解析完成」；历史列表 1 条 |
  | 列表内容 | 条目含时间 / 输入摘要（江苏南京）/ 结果预览 |
  | 缓存命中 | 同参再解析 990 字；徽标「来自历史缓存，未消耗大模型 token」；**历史仍 1 条**（未重复插入） |
  | 点击历史 | 完整结果 990 字；徽标「来自历史记录」 |
  | 5 条上限 | 6 条不同内容后历史恰好 5 条 |
  | 周公页 | 标题「最近解梦」+ 空态「暂无历史解梦」；新解析 813 字 + 徽标；历史 1 条；同参缓存徽标；点击历史完整结果 + 徽标 |
  | 视觉回归 | 表单字段齐全、「立即解析」在、`hud-card` / `bg-panel bg-grid` 保留、无控制台报错 |
- [x] **pages-check 19/19 全绿**：主页 / 星座 / 周公 / 登录视觉未破坏（历史区断言同步更新为「最近分析」）
- [x] 变更文件清单：
  | 文件 | 操作 |
  |---|---|
  | `frontend/src/api/history.ts` | 新增 |
  | `frontend/src/components/HistoryPanel.tsx` | 新增 |
  | `frontend/src/api/client.ts` | 改（ApiResponse 加 cached/history_id） |
  | `frontend/src/api/horoscope.ts` | 改（注释） |
  | `frontend/src/api/dream.ts` | 改（注释） |
  | `frontend/src/pages/Horoscope.tsx` | 改（后端历史 + 缓存徽标） |
  | `frontend/src/pages/Dream.tsx` | 改（同上） |
  | `frontend/scripts/history-check.mjs` | 新增（自检脚本） |
  | `frontend/scripts/pages-check.mjs` | 改（历史区断言更新） |
  | `progress.md` | 改（本批次记录） |
  - 未触碰：后端全部代码、`index.css`、`utils/history.ts`、`AuthContext`/`AuthGuard`、表单字段与校验逻辑

### 批次 11：登录 / 持久化 / 缓存 / 历史全链路联调测试 ✅

- [x] **启动验证**：后端 `uv run uvicorn app.main:app --port 8000`（`/api/health` → `{"status":"ok"}`）+ 前端 `npm run dev`（5173 → HTTP 200，`/api/health` 经 proxy 通）
- [x] 新增自动化联调脚本：
  | 脚本 | 范围 | 结果 |
  |---|---|---|
  | `backend/scripts/api_integration_test.py` | API 层 36 项 | ✅ **36/36** |
  | `frontend/scripts/integration-check.mjs` | 前端 UI 层 26 项 | ✅ **26/26** |
- [x] **API 层测试明细**（36/36）：
  | 分组 | 用例与结果 |
  |---|---|
  | 注册 | 用户 A 注册 200；同名再注册 **409**；弱密码 **422** |
  | 登录 | 错误密码 **401**（业务层，非 Pydantic 拦截）；正确登录 200 |
  | token | `/me` 带 token 200；假 token **401** |
  | 路由保护 | analyze 不带 token **401** |
  | 星座分析 | 首次 200 / **22.3s** / 843 字 / `cached=false` / `history_id=22` |
  | SQLite 落库 | `analyses` 行数=1；`input_hash` 64 位 hex、`result_text` 843 字、`created_at` 完整 |
  | 同参缓存 | `cached=true`、`history_id` 一致、结果完全一致、**0.05s 秒回**（vs 22.3s）、**未重复落库** |
  | 周公解梦 | 首次 200 / **31.0s** / 991 字；同参 `cached=true` / **0.06s** / `history_id` 一致 |
  | 5 条上限 | 6 条不同输入后星座历史**恰好 5 条**（ids=`[28,27,26,25,24]` 倒序）；**最早 id=22 已删**；周公同样 5 条 |
  | 历史详情 | 200，`result_text` 674 字 |
  | 多用户隔离 | B 看不到 A 的历史（0 条）；B 访问 A 的记录 **404**；A 的历史不被 B 影响（仍 5 条） |
  | 退出登录 | 200；之后 `/me` `/analyze` `/history` **全 401** |
- [x] **前端 UI 层测试明细**（26/26）：
  | 分组 | 用例与结果 |
  |---|---|
  | 注册 | 自动登录并跳转 `/horoscope`；token 写入 `xingmeng_token` |
  | 路由保护 | 未登录访问 `/horoscope` `/dream` → 跳 `/login?redirect=...`（redirect 保留）；登录后跳回 `/dream` |
  | 登录保持 | 主页「你好，xxx」；**F5 刷新后状态与 token 均保持** |
  | 星座分析 | 结果 929 字；徽标「新解析完成」；历史 1 条 |
  | 缓存命中 | 同参结果一致 929 字；徽标**「来自历史缓存，未消耗大模型 token」**；历史仍 1 条 |
  | 历史回填 | 点击条目 → 完整结果；徽标「来自历史记录」 |
  | 周公解梦 | 结果 793 字；新解析 + 缓存徽标；历史 1 条 |
  | 退出 | token 清除（null）；主页回「登录」入口；再访问 `/horoscope` 跳登录 |
  | 多用户 | 用户 B 注册后历史区空态（看不到 A 的历史） |
  | 控制台 | 无报错 |
- [x] **测试脚本自身问题修复**（非产品 bug）：
  | 问题 | 原因 | 修复 |
  |---|---|---|
  | 「错误密码 → 401」得 422 | 测试填了 `wrong`（5 位），被 Pydantic `min_length=6` 先拦截 | 改用 `wrongpass`（9 位）测到业务层 401 |
  | 周公请求超时 | 脚本 `timeout=120`，大模型生成 31s+ 加排队偶发超限 | 调至 `timeout=240`（与后端 LLM timeout 对齐） |
- [x] **用户要求排查的 7 类问题逐项确认**（均无问题）：
  | 排查项 | 结论 |
  |---|---|
  | sqlite3 连接 | ✅ 正常，落库字段完整、无锁死 |
  | token 过期 / 未带 Authorization | ✅ 401 正确触发，退出后立即失效 |
  | 前端 401 跳转 | ✅ 跳 `/login?redirect=...` 且登录后跳回 |
  | input_hash 不一致导致缓存不命中 | ✅ 同参稳定命中（键序无关 canonical JSON） |
  | 删除最早 5 条逻辑 | ✅ 6 条后恰好 5 条，最早被删，倒序正确 |
  | 历史列表未刷新 | ✅ 解析成功后列表自动刷新 |
  | 缓存命中仍调用大模型 | ✅ 0.05s / 0.06s 秒回，未重复落库 |
- [x] **文档更新**：`README.md` 技术栈改 MiMo、功能清单补登录 UI 与缓存徽标、目录结构更新、新增「3. 跑自动化联调」、章节重编号（验证链路→4、接口测试→5）、新增「联调验收清单」17 项全绿、已知问题与下一阶段建议全面改写；`progress.md` 本批次记录

## 未完成

- 会话续期、密码修改、忘记密码
- 个人中心页（查看 / 管理自己的分析历史）
- 历史记录删除（后端未提供删除接口，当前仅靠 5 条上限自动淘汰）
- token 改 httpOnly Cookie（当前存 localStorage，防 XSS 能力较弱）

## 下一批建议

1. **批次 12：会话与账号增强** —— 会话滑动续期、密码修改、忘记密码、登录设备管理、主动吊销 token
2. **批次 13：历史管理增强** —— 后端补 `DELETE /api/history/{type}/{id}`，前端历史条目加删除按钮；历史分页 / 筛选
3. **批次 14：分析结果体验优化** —— 流式输出（`/api/*/analyze_sse`）+ 逐字渲染；多轮追问；更多测算类型
4. **批次 15：安全加固与部署** —— token 改 httpOnly Cookie、登录失败限速、Docker 化、HTTPS + 域名

## 验收步骤（批次 11 · 全链路联调）

### 完整启动命令

```bash
# 终端 1：后端（端口 8000）
cd backend
uv sync                                   # 首次运行安装依赖
cp .env.example .env                      # 首次运行填入真实 API Key
uv run uvicorn app.main:app --reload --port 8000

# 终端 2：前端（端口 5173）
cd frontend
npm install                               # 首次运行安装依赖
npm run dev
```

### 测试命令

```bash
# API 层联调（36 项）
cd backend && uv run python scripts/api_integration_test.py

# 前端 UI 层联调（26 项）
cd frontend && node scripts/integration-check.mjs

# 回归套件（可选）
cd frontend && node scripts/history-check.mjs    # 28 项历史+缓存
cd frontend && node scripts/auth-check.mjs       # 29 项认证
cd frontend && node scripts/pages-check.mjs      # 19 项视觉回归
cd frontend && node scripts/flow-check.mjs       #  5 项真实大模型主流程

# 手动 curl（token 从注册/登录响应取）
curl http://localhost:8000/api/health
curl -X POST http://localhost:8000/api/auth/register -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"secret123"}'
curl http://localhost:8000/api/history/horoscope -H "Authorization: Bearer <TOKEN>"
```

### 验收清单

| # | 验收项 | 实测结果 |
|---|---|---|
| 1 | 后端 `/api/health` + 前端 5173 + Vite proxy 链路 | ✅ |
| 2 | 注册 → 自动登录跳转，token 存 `xingmeng_token` | ✅ |
| 3 | 同名 409 / 弱密码 422 / 错误密码 401 / 登录 200 | ✅ |
| 4 | `/me` 带 token 200，假 token 401 | ✅ |
| 5 | F5 刷新登录态保持 | ✅ |
| 6 | 未登录访问 `/horoscope` `/dream` 跳登录，登录后跳回 | ✅ |
| 7 | 星座解析：`cached=false` + `history_id` + 结果展示 | ✅ |
| 8 | 结果写入 SQLite `analyses` | ✅ |
| 9 | 同参缓存：`cached=true` 秒回、不重复落库 | ✅ |
| 10 | 前端三种徽标（新解析/缓存/历史） | ✅ |
| 11 | 周公解梦同套流程 + 缓存生效 | ✅ |
| 12 | 每账号每类型 5 条上限，最早被删，倒序 | ✅ |
| 13 | 多用户隔离（B 看不到 A，越权 404） | ✅ |
| 14 | 退出登录 token 失效（/me /analyze /history 全 401） | ✅ |
| 15 | 退出后访问受保护页跳登录 | ✅ |
| 16 | 点击历史展示完整结果，解析后历史自动刷新 | ✅ |
| 17 | 表单字段与 HUD 视觉零破坏，无控制台报错 | ✅ |

**自动化汇总**：API 36/36 + UI 26/26 全绿；回归套件 history 28/28、auth 29/29、pages 19/19、flow 5/5。

## 备注

- 接口契约已固化在 `frontend/src/api/horoscope.ts` / `dream.ts`：请求字段 snake_case、统一响应 `{ success, result, error }`，批次 3 后端按此实现即可对通
- 大模型已切换为小米 MiMo（批次 6）：`MIMO_MODEL=mimo-v2.6-flash`，`MIMO_BASE_URL=https://api.xiaomimimo.com/v1`，思考模式已通过 `extra_body={"thinking":{"type":"disabled"}}` 关闭；修改 `backend/.env` 后需重启后端生效
- （历史）DeepSeek 联调结论：官方 API 仅支持 `deepseek-flash` / `deepseek-v4-pro`，当时定为 `deepseek-flash`；现已弃用
- 效果图实际位于项目根目录（`主页面.png` / `星座分析测算.png` / `周公解梦.png`），已复制进 `docs/`
- 下载依赖规则：优先 uv；下载慢立即切清华镜像（已固化到 `backend/pyproject.toml`）
