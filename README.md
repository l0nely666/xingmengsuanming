# 星梦智能助手

星座分析 + 周公解梦 前后端练习项目，AI 能力由小米 MiMo 2.6 Flash 提供。

## 技术栈

| 端 | 技术 |
|---|---|
| 前端 | React 19 + Vite 8 + TypeScript + Tailwind CSS 4 + React Router 7 + Axios |
| 后端 | Python + FastAPI + uv + OpenAI SDK（调用小米 MiMo） |
| 大模型 | 小米 MiMo 2.6 Flash（`mimo-v2.6-flash`），API Key 配置于 `backend/.env` |
| 数据库 | Python 自带 `sqlite3`（文件 `backend/data/xingmeng.db`，自动建库建表，无第三方 ORM） |

- 前端端口 **5173**，后端端口 **8000**
- 前端所有 `/api` 请求经 Vite proxy 转发到 `http://localhost:8000`

## 功能清单

| 模块 | 功能 |
|---|---|
| 主页面 `/` | 发光大标题、对称装饰线+菱形、两个切角大按钮跳转对应页面 |
| 星座分析 `/horoscope` | 7 必填字段（与效果图一致）+ 选填「你的名字」；必填红字校验（输入即消、不发请求）；「解析中...」禁用 + HUD 推演动画；真实 MiMo 分析（保留换行）；复制 / 清空 / 重新解析；「最近分析」列表（时间/摘要/预览，点击查看完整结果） |
| 周公解梦 `/dream` | 与星座页对称（性别/年龄同行各 50%、标题电路板纹路装饰、loading「解梦中...」） |
| 后端接口 | `POST /api/horoscope/analyze`、`POST /api/dream/analyze`（**需登录**；Pydantic 校验 + 统一响应 `{success, result, error, cached, history_id}` + 异常分类 401/429/504/502/500）；`GET /api/health`；CORS 放行 5173 |
| 登录注册认证 | `POST /api/auth/register`、`POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/me`；PBKDF2-SHA256（10 万次）加盐存密码；`secrets.token_urlsafe(32)` 会话 token，7 天有效；`Authorization: Bearer <token>` 鉴权 |
| 结果缓存与历史 | 分析结果持久化到 SQLite `analyses`；同用户 + 同类型 + 同输入直接命中缓存秒回（`cached:true`，不调大模型）；每账号每类型最多 5 条，超出自动删除最早；`GET /api/history/{type}` 列表 + `GET /api/history/{type}/{id}` 详情（仅本人） |
| 前端登录 UI | `/login` `/register` 页（HUD 风格）；token 存 `localStorage.xingmeng_token`；`AuthContext` 提供 login/register/logout/user/isLoggedIn；刷新经 `GET /api/auth/me` 恢复登录态；axios 拦截器自动带 `Authorization: Bearer <token>`，401 清 token 并跳 `/login?redirect=...`；`/horoscope` `/dream` 路由保护 |
| 缓存命中提示 | 结果区徽标：`cached=true` →「来自历史缓存，未消耗大模型 token」；`cached=false` →「新解析完成」；点击历史回填 →「来自历史记录」 |
| 姓名彩蛋 | 「你的名字」填入 `你好基友的名字` → 分析中加入轻松调侃元素（起外号、朋友语气，尊重不冒犯） |
| 健壮性 | 后端未连接 / 超时 / HTTP 错误 / 参数错误 → 全部友好中文提示，页面不崩溃 |

## 目录结构

```
xingmeng-assistant/
├── README.md        # 本文件：启动方式
├── progress.md      # 批次计划与进度
├── docs/            # 需求文档 xingmeng.txt 与三张效果图
├── frontend/        # 前端（Vite + React + TS + Tailwind）
│   ├── src/api/         # client（拦截器）/ auth / horoscope / dream / history
│   ├── src/context/     # AuthContext（token / user / login / register / logout）
│   ├── src/components/  # AuthGuard（路由保护）/ HistoryPanel（共用历史区）
│   ├── src/pages/       # Home / Horoscope / Dream / Login / Register
│   └── scripts/         # 自检脚本（integration / history / auth / pages / flow）
└── backend/         # 后端（FastAPI + uv）
    ├── app/
    │   ├── db.py    # sqlite3 建库建表、密码哈希、用户/会话/分析记录访问
    │   ├── deps.py  # get_current_user 依赖（Bearer token 校验）
    │   ├── services/llm_service.py + analysis_service.py
    │   └── routers/ # auth / horoscope / dream / history
    ├── scripts/     # api_integration_test.py（API 层联调）
    └── data/        # xingmeng.db（自动生成，勿提交真实用户数据）
```

## 启动方式

### 1. 启动后端（端口 8000）

```bash
cd backend
uv sync                                   # 首次运行，安装依赖（已配置清华镜像）
cp .env.example .env                      # 首次运行：复制配置模板并填入真实 API Key
uv run uvicorn app.main:app --reload --port 8000
```

### 2. 启动前端（端口 5173）

```bash
cd frontend
npm install                                # 首次运行，安装依赖
npm run dev
```

### 3. 跑自动化联调（可选）

```bash
# API 层（36 项：注册/登录/me/退出/缓存/历史上限/多用户隔离/SQLite 落库）
cd backend && uv run python scripts/api_integration_test.py

# 前端 UI 层（26 项：注册跳转/登录保持/路由保护/缓存徽标/多用户隔离/退出）
cd frontend && node scripts/integration-check.mjs

# 回归套件
cd frontend && node scripts/history-check.mjs    # 28 项历史+缓存
cd frontend && node scripts/auth-check.mjs       # 29 项认证
cd frontend && node scripts/pages-check.mjs      # 19 项视觉回归
cd frontend && node scripts/flow-check.mjs       #  5 项真实大模型主流程
```

### 4. 验证链路

| 检查项 | 地址 |
|---|---|
| 后端健康检查 | http://localhost:8000/api/health |
| 经前端代理 | http://localhost:5173/api/health |

两者均返回 `{"status":"ok"}` 即前后端链路畅通。

### 5. 接口测试（curl）

```bash
# 4.1 健康检查 → {"status":"ok"}
curl http://localhost:8000/api/health

# 4.2 星座分析（需登录；首次真实调用大模型，需数秒）
curl -X POST http://localhost:8000/api/horoscope/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"birth_date":"1999-06-15","birth_time":"08:30","birth_place":"上海","gender":"男","relationship_status":"恋爱","occupation":"学生","focus":"事业"}'
# → {"success":true,"result":"...","error":null,"cached":false,"history_id":1}

# 4.3 参数错误示例 → HTTP 422，返回统一错误结构（不带 token 则先 401）
curl -X POST http://localhost:8000/api/horoscope/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"birth_date":"bad-date"}'

# 4.4 周公解梦（需登录；首次真实调用大模型）
curl -X POST http://localhost:8000/api/dream/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"dream_content":"梦见自己在天上飞","dream_time":"凌晨三点","gender":"男","age":"26-35岁","occupation":"学生","recent_status":"最近经常加班","focus":"事业"}'

# 4.5 注册（成功即返回 token，7 天有效）
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"demo_user","password":"secret123"}'
# → {"success":true,"token":"...","user":{"id":1,"username":"demo_user"},"error":null}

# 4.6 同名再注册 → HTTP 409 {"success":false,...,"error":"该用户名已被注册"}
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"demo_user","password":"secret123"}'

# 4.7 登录（用户不存在 / 密码错误统一 401「用户名或密码错误」）
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo_user","password":"secret123"}'
# → {"success":true,"token":"...","user":{"id":1,"username":"demo_user"},"error":null}

# 4.8 当前用户（把 <TOKEN> 换成上面返回的 token）
curl http://localhost:8000/api/auth/me -H "Authorization: Bearer <TOKEN>"
# → {"success":true,"user":{"id":1,"username":"demo_user"},"error":null}
# 不带 / 带假 token → HTTP 401 {"success":false,"error":"未登录或登录已失效"}

# 4.9 退出登录（删除 session，之后该 token 立即失效）
curl -X POST http://localhost:8000/api/auth/logout -H "Authorization: Bearer <TOKEN>"
# → {"success":true,"message":"已退出登录","error":null}

# 4.10 同参缓存：与 4.2 完全相同内容再发一次 → cached:true 且秒回，不再调大模型
curl -X POST http://localhost:8000/api/horoscope/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"birth_date":"1999-06-15","birth_time":"08:30","birth_place":"上海","gender":"男","relationship_status":"恋爱","occupation":"学生","focus":"事业"}'
# → {"success":true,"result":"...","error":null,"cached":true,"history_id":1}

# 4.11 历史列表（该类型最近 5 条，超出自动删除最早记录）
curl http://localhost:8000/api/history/horoscope -H "Authorization: Bearer <TOKEN>"
# → {"success":true,"items":[{"id":1,"analysis_type":"horoscope","input":{...},"result_preview":"前 100 字...","created_at":"..."}],"error":null}

# 4.12 历史详情（完整 input + result_text；仅本人记录，他人/不存在 → 404）
curl http://localhost:8000/api/history/horoscope/1 -H "Authorization: Bearer <TOKEN>"
# → {"success":true,"item":{"id":1,"analysis_type":"horoscope","input":{...},"result_text":"完整结果","created_at":"..."},"error":null}

# 4.13 非法类型 → HTTP 422；不带 token → HTTP 401
curl http://localhost:8000/api/history/tarot -H "Authorization: Bearer <TOKEN>"
```

- 分析接口成功：`{"success": true, "result": "大模型分析文本", "error": null, "cached": false, "history_id": 123}`
- 失败：`{"success": false, "result": "", "error": "中文错误提示"}`（未登录 401 / 参数错误 422 / Key 无效 401 / 超时 504 / 模型配置 502 / 兜底 500）
- **同参缓存**：`input_hash` 按 `sha256(canonical JSON)` 计算（含选填 `name`），命中直接返回 `cached:true`，不调用大模型
- **历史上限**：每账号每业务类型最多保留 5 条，插入新记录后自动删除更早的
- **大模型失败不落库**：调用出错时不写 `analyses` 表
- Windows Git Bash 若中文 body 报 `There was an error parsing the body`：把 JSON 存为 UTF-8 文件，改用 `--data-binary @req.json`
- 模型名默认 `mimo-v2.6-flash`（`MIMO_BASE_URL=https://api.xiaomimimo.com/v1`），修改 `backend/.env` 后需重启后端
- 两个接口均需真实调用大模型（已约束输出约 800 字以内，实测约 10~40s，超时上限 240s）；Windows 下改动后端代码后 `--reload` 可能不生效，建议手动重启后端

## 联调验收清单（批次 11 · 登录/持久化/缓存/历史全链路）

| # | 验收项 | 结果 |
|---|---|---|
| 1 | 启动后端 `uv run uvicorn app.main:app --reload --port 8000` + 前端 `npm run dev` | ✅ |
| 2 | 注册新用户 → 自动登录并跳转目标页，token 写入 `localStorage.xingmeng_token` | ✅ |
| 3 | 同名再注册 409；弱密码 422；错误密码 401；登录成功 200 | ✅ |
| 4 | `GET /api/auth/me` 带 token 200 / 假 token 401 | ✅ |
| 5 | 刷新页面登录态保持（`/api/auth/me` 恢复，token 仍在） | ✅ |
| 6 | 未登录访问 `/horoscope` `/dream` → 跳 `/login?redirect=...`；登录后跳回原页 | ✅ |
| 7 | 星座分析：填表 →「立即解析」→ 结果展示；`cached=false`；返回 `history_id` | ✅ |
| 8 | 结果写入 SQLite `analyses`（`input_hash` / `result_text` / `created_at` 完整） | ✅ |
| 9 | 同参再提交：`cached=true`、秒回（0.05s vs 22.3s）、结果与 `history_id` 一致、**未重复落库** | ✅ |
| 10 | 前端徽标「新解析完成」/「来自历史缓存，未消耗大模型 token」/「来自历史记录」 | ✅ |
| 11 | 周公解梦同套流程（`cached=false`→`true`，秒回 0.06s vs 31.0s） | ✅ |
| 12 | 每账号每类型最多 5 条：6 条不同输入后 `GET /api/history/{type}` 恰 5 条，最早被删，倒序 | ✅ |
| 13 | 多用户隔离：B 看不到 A 的历史；B 访问 A 的记录 404；A 的历史不被 B 影响 | ✅ |
| 14 | 退出登录：session 删除、token 失效（`/me` `/analyze` `/history` 全 401） | ✅ |
| 15 | 退出后访问受保护页跳登录；前端 token 清除、主页回「登录」入口 | ✅ |
| 16 | 点击历史条目 → 完整结果展示 + 徽标「来自历史记录」；历史列表解析后自动刷新 | ✅ |
| 17 | 表单字段与 HUD 视觉零破坏；无控制台报错 | ✅ |

**自动化结果**：API 层 `api_integration_test.py` **36/36**；前端 UI 层 `integration-check.mjs` **26/26**。

**测试命令**：
```bash
cd backend  && uv run python scripts/api_integration_test.py
cd frontend && node scripts/integration-check.mjs
```

## 联调验收步骤

1. **启动**：按上方「启动方式」分别启动后端（8000）与前端（5173）。
2. **链路检查**：
   - http://localhost:8000/api/health → `{"status":"ok"}`
   - http://localhost:5173/api/health → `{"status":"ok"}`（经 Vite proxy 转发）
3. **自动化验收**：执行上方「3. 跑自动化联调」全部脚本（API 36 项 + UI 26 项 + 回归 81 项）。
4. **curl 验证**：执行上方「5. 接口测试」4.1–4.13 —— 两分析接口返回 `success:true` 且带 `cached` / `history_id`；非法参数返回 422 统一错误结构。
5. **浏览器手动验证**（真实大模型）：
   - 注册 → 自动登录跳转；主页右上角「你好，{用户}」；F5 刷新登录态保持
   - 未登录访问 `/horoscope` → 跳 `/login?redirect=...` → 登录后跳回
   - 星座页填满 7 字段 →「立即解析」→ 按钮变**「解析中...」且禁用**、结果区出现**HUD 推演动画** → 徽标**「新解析完成」** + 完整分析
   - **同参再点** → 徽标**「来自历史缓存，未消耗大模型 token」**，秒回
   - 「最近分析」区点击条目 → 完整结果 + 徽标**「来自历史记录」**
   - 周公解梦同套流程（标题为「最近解梦」）
   - 「退出登录」→ token 清除 → 再访问 `/dream` 跳登录
6. **异常分支**（可选）：空表单提交 → 7 个字段下方红字且不发请求；停掉后端再提交 → 「后端服务未连接，请先启动后端」；历史区显示红色错误 + 「重试」按钮。
7. **彩蛋**：「你的名字」填 `你好基友的名字` 再解析 → 结果语气变轻松、会给你起外号。

## 已知问题与限制

- **大模型耗时波动**：MiMo 输出受提示词约束约 800 字以内，实测约 10~40s，但生成长度与耗时仍有波动；前后端超时 240s 兜底，偶发超时稍候重试即可
- **Windows 环境**：改动后端代码后 `--reload` 可能不生效，需手动重启后端；若项目目录迁移后报 `uv trampoline failed to canonicalize script path`，执行 `uv sync --reinstall-package uvicorn` 修复
- **Git Bash 下 curl 中文**：中文 body 直接 `-d` 可能编码错乱，改用 `--data-binary @utf8文件`
- **token 存 localStorage**：防 XSS 能力弱于 httpOnly cookie，练习项目按需求约定实现；生产环境建议换 httpOnly Cookie 或后端 session
- **会话不可续期**：token 固定 7 天过期，无滑动续期与主动吊销列表
- **历史无删除接口**：后端仅有 5 条上限自动淘汰，用户不能主动删除单条
- **单机 sqlite3**：无并发写优化，多实例部署需换数据库
- **流式输出未接入**：需改前后端协议，为不破坏已验收的 JSON 主链路暂不接入

## 下一阶段建议

1. **会话与账号增强**：会话滑动续期、密码修改、忘记密码、登录设备管理、主动吊销 token
2. **历史管理**：后端补 `DELETE /api/history/{type}/{id}`，前端历史条目加删除按钮；历史分页 / 筛选
3. **分析体验优化**：流式输出（`/api/*/analyze_sse`）+ 逐字渲染；多轮追问（携带上下文）；更多测算类型（八字、塔罗、紫微）
4. **安全加固**：token 改 httpOnly Cookie、登录失败限速、敏感操作二次验证
5. **部署上线**：后端 Docker 化、前端 build 静态托管、HTTPS + 域名、数据库迁移脚本

## 视觉规范（全局）

| 规范项 | 取值 |
|---|---|
| 主页面背景 | `#020617` |
| 内页背景 | `#050a1f` |
| 科技蓝 | `#00f0ff` |
| 文字 | 白色 `#ffffff` / 淡灰 `#cbd5e1` |
| 卡片 | 切角 HUD + 发光边框（`.hud-card` / `.hud-card-body`） |
| 按钮 | 切角发光 + 深蓝渐变（`.hud-btn`） |
| 输入框 | 透明底 + 青色细边框（`.hud-input` / `.hud-select`） |
| 标题 | 白光 + 青光外发光（`.glow-title`） |
| 内页底纹 | 微弱网格（`.bg-grid`） |

组件类定义于 `frontend/src/index.css`，颜色令牌注册在 Tailwind `@theme` 中（`bg-deep` / `bg-panel` / `text-tech` / `text-dim`）。

## 批次进度

见 [progress.md](./progress.md)。
