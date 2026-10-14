import { useCallback, useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyzeHoroscope } from '../api/horoscope'
import type { HoroscopeForm } from '../api/horoscope'
import { fetchHistory, fetchHistoryDetail } from '../api/history'
import type { HistoryItem } from '../api/history'
import { getErrorMessage } from '../api/client'
import HistoryPanel from '../components/HistoryPanel'

/**
 * 星座分析测算页
 * 视觉参考 docs/星座分析测算.png：科技 HUD 风格
 * 必填校验 + loading + 结果展示 + 友好错误 + 复制/清空/重新解析
 * 历史记录走后端 GET /api/history/horoscope（含缓存命中提示）
 */

const INITIAL_FORM: HoroscopeForm = {
  birthDate: '',
  birthTime: '',
  birthPlace: '',
  gender: '',
  emotionStatus: '',
  occupation: '',
  focus: '',
  name: '',
}

/** 字段错误集合（无错误的字段为 undefined） */
type FieldErrors = Partial<Record<keyof HoroscopeForm, string>>

/** 必填字段与提示文案（7 个效果图字段必填，name 选填不在此列） */
const REQUIRED: { name: keyof HoroscopeForm; label: string; select?: boolean }[] = [
  { name: 'birthDate', label: '出生年月日' },
  { name: 'birthTime', label: '出生时间' },
  { name: 'birthPlace', label: '出生地点' },
  { name: 'gender', label: '性别' },
  { name: 'emotionStatus', label: '情感状态', select: true },
  { name: 'occupation', label: '职业身份' },
  { name: 'focus', label: '测算关注点' },
]

/** 左侧标签统一样式（右对齐成列） */
const LABEL_CLS =
  'w-28 shrink-0 text-right text-sm font-medium tracking-wider text-white md:text-base'

/** 字段下方红色错误提示（无错误时不渲染），缩进对齐输入框 */
function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="mt-1 pl-[7.75rem] text-xs text-red-500">
      {message}
    </p>
  )
}

/** 标题一侧的科技装饰线 + 菱形，mirror 时整体水平镜像 */
function TitleDecor({ mirror = false }: { mirror?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`hidden flex-1 items-center justify-end gap-3 sm:flex ${
        mirror ? '-scale-x-100' : ''
      }`}
    >
      <div className="flex flex-col gap-1.5">
        <span className="h-px w-16 bg-gradient-to-r from-transparent to-tech/60" />
        <span className="h-px w-28 bg-gradient-to-r from-transparent to-tech" />
        <span className="h-px w-20 bg-gradient-to-r from-transparent to-tech/40" />
      </div>
      <span className="h-2 w-2 rotate-45 bg-tech shadow-[0_0_8px_#00f0ff]" />
    </div>
  )
}

/** AI 推演中动画：发光菱形脉冲 + 青色扫描线（科技 HUD 风） */
function LoadingAnim() {
  return (
    <div className="flex items-center gap-3 py-2" role="status" aria-label="AI 推演中">
      <span className="xm-pulse-diamond h-3 w-3 bg-tech shadow-[0_0_10px_#00f0ff]" />
      <div className="relative h-1 flex-1 overflow-hidden bg-tech/10">
        <div className="xm-scan-bar absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-tech to-transparent" />
      </div>
      <span className="text-sm tracking-[0.3em] text-tech">AI 推演中</span>
    </div>
  )
}

/** 结果来源：新解析 / 命中缓存 / 来自历史记录 */
type ResultSource = 'new' | 'cached' | 'history'

/** 三种来源对应的徽标文案与样式 */
const SOURCE_BADGE: Record<ResultSource, { text: string; cls: string }> = {
  new: { text: '新解析完成', cls: 'border-tech/70 text-tech' },
  cached: {
    text: '来自历史缓存，未消耗大模型 token',
    cls: 'border-tech/70 text-tech',
  },
  history: { text: '来自历史记录', cls: 'border-dim/40 text-dim' },
}

/** 输入摘要（历史列表展示用） */
function makeBrief(input: Record<string, string>): string {
  return `${input.birth_place || ''} · ${input.birth_date || ''} · ${input.focus || ''}`
}

export default function Horoscope() {
  const navigate = useNavigate()
  const [form, setForm] = useState<HoroscopeForm>(INITIAL_FORM)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [result, setResult] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [copied, setCopied] = useState<boolean>(false)
  const [source, setSource] = useState<ResultSource | null>(null)
  const [activeHistoryId, setActiveHistoryId] = useState<number | null>(null)

  // 后端历史：最近 5 条（含加载 / 错误态）
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState<boolean>(true)
  const [historyError, setHistoryError] = useState<string>('')

  /** 拉取后端历史列表 */
  const loadHistories = useCallback(async () => {
    setHistoryLoading(true)
    setHistoryError('')
    try {
      setHistoryItems(await fetchHistory('horoscope'))
    } catch (err) {
      setHistoryError(getErrorMessage(err))
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadHistories()
  }, [loadHistories])

  /** 受控组件统一变更处理，同时清除该字段的红字提示 */
  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  /** 必填校验：缺失字段显示红字，返回是否通过 */
  const validate = (): boolean => {
    const errs: FieldErrors = {}
    for (const { name, label, select } of REQUIRED) {
      if (!form[name].trim()) {
        errs[name] = select ? `请选择${label}` : `请输入${label}`
      }
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  /** 立即解析：校验 → 调用后端 → 展示结果 + 缓存徽标，成功后刷新历史 */
  const handleAnalyze = async () => {
    if (!validate()) return // 必填缺失：仅红字提示，不发请求
    setLoading(true)
    setError('')
    setResult('')
    setCopied(false)
    setSource(null)
    setActiveHistoryId(null)
    try {
      const data = await analyzeHoroscope(form)
      if (data.success && typeof data.result === 'string') {
        setResult(data.result)
        setSource(data.cached ? 'cached' : 'new')
        setActiveHistoryId(data.history_id ?? null)
        void loadHistories()
      } else {
        setError(data.error || '解析失败，请稍后重试')
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void handleAnalyze()
  }

  /** 复制结果到剪贴板，按钮短暂反馈「已复制」 */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setError('复制失败，请手动选择文本复制')
    }
  }

  /** 清空结果区（不影响表单与历史） */
  const handleClear = () => {
    setResult('')
    setError('')
    setCopied(false)
    setSource(null)
    setActiveHistoryId(null)
  }

  /** 点击历史条目：拉详情把完整结果填入结果区 */
  const handleSelectHistory = async (id: number) => {
    setError('')
    setLoading(true)
    try {
      const detail = await fetchHistoryDetail('horoscope', id)
      setResult(detail.result_text)
      setSource('history')
      setActiveHistoryId(id)
      setCopied(false)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="bg-panel bg-grid flex min-h-screen flex-col items-center justify-center px-4 py-8">
      {/* 主容器：HUD 切角发光卡片 + 玻璃拟态 */}
      <div className="hud-card w-full max-w-4xl">
        <div className="hud-card-body relative px-6 py-7 md:px-10 md:py-8">
          {/* 右上角发光 X：返回主页面 */}
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="关闭并返回主页面"
            className="absolute top-4 right-5 text-2xl leading-none text-white transition duration-200 hover:rotate-90 hover:text-tech [text-shadow:0_0_8px_#00f0ff]"
          >
            ✕
          </button>

          {/* 标题区：科技装饰线 + 大标题 */}
          <header className="mb-8 flex items-center gap-4">
            <TitleDecor />
            <h1 className="shrink-0 text-2xl font-bold tracking-[0.18em] text-white md:text-4xl [text-shadow:0_0_12px_rgba(0,240,255,0.55)]">
              星座分析测算
            </h1>
            <TitleDecor mirror />
          </header>

          {/* 表单：7 个必填字段 + 1 个选填名字，受控组件 + 必填红字 */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* 行1：出生年月日 + 出生时间 */}
            <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
              <div className="flex min-w-0 flex-1 basis-72 flex-col">
                <div className="flex items-center gap-3">
                  <label htmlFor="birthDate" className={LABEL_CLS}>
                    出生年月日
                  </label>
                  <input
                    id="birthDate"
                    name="birthDate"
                    type="date"
                    value={form.birthDate}
                    onChange={handleChange}
                    className="hud-input min-w-0 flex-1 [color-scheme:dark]"
                  />
                </div>
                <FieldError message={fieldErrors.birthDate} />
              </div>
              <div className="flex min-w-0 flex-1 basis-72 flex-col">
                <div className="flex items-center gap-3">
                  <label htmlFor="birthTime" className={LABEL_CLS}>
                    出生时间
                  </label>
                  <input
                    id="birthTime"
                    name="birthTime"
                    type="time"
                    value={form.birthTime}
                    onChange={handleChange}
                    className="hud-input min-w-0 flex-1 [color-scheme:dark]"
                  />
                </div>
                <FieldError message={fieldErrors.birthTime} />
              </div>
            </div>

            {/* 行2：出生地点 */}
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <label htmlFor="birthPlace" className={LABEL_CLS}>
                  出生地点
                </label>
                <input
                  id="birthPlace"
                  name="birthPlace"
                  type="text"
                  placeholder="（城市）"
                  value={form.birthPlace}
                  onChange={handleChange}
                  className="hud-input max-w-md flex-1"
                />
              </div>
              <FieldError message={fieldErrors.birthPlace} />
            </div>

            {/* 行3：性别 */}
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <label htmlFor="gender" className={LABEL_CLS}>
                  性别
                </label>
                <input
                  id="gender"
                  name="gender"
                  type="text"
                  placeholder="男/女"
                  value={form.gender}
                  onChange={handleChange}
                  className="hud-input max-w-40 flex-1"
                />
              </div>
              <FieldError message={fieldErrors.gender} />
            </div>

            {/* 行4：情感状态（下拉） */}
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <label htmlFor="emotionStatus" className={LABEL_CLS}>
                  情感状态
                </label>
                <select
                  id="emotionStatus"
                  name="emotionStatus"
                  value={form.emotionStatus}
                  onChange={handleChange}
                  className="hud-input hud-select flex-1"
                >
                  <option value="" disabled>
                    （单身/恋爱/已婚）
                  </option>
                  <option value="单身">单身</option>
                  <option value="恋爱">恋爱</option>
                  <option value="已婚">已婚</option>
                </select>
              </div>
              <FieldError message={fieldErrors.emotionStatus} />
            </div>

            {/* 行5：职业身份 */}
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <label htmlFor="occupation" className={LABEL_CLS}>
                  职业身份
                </label>
                <input
                  id="occupation"
                  name="occupation"
                  type="text"
                  placeholder="学生/职场/自由职业"
                  value={form.occupation}
                  onChange={handleChange}
                  className="hud-input flex-1"
                />
              </div>
              <FieldError message={fieldErrors.occupation} />
            </div>

            {/* 行6：测算关注点 */}
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <label htmlFor="focus" className={LABEL_CLS}>
                  测算关注点
                </label>
                <input
                  id="focus"
                  name="focus"
                  type="text"
                  placeholder="性格/事业/情感"
                  value={form.focus}
                  onChange={handleChange}
                  className="hud-input flex-1"
                />
              </div>
              <FieldError message={fieldErrors.focus} />
            </div>

            {/* 行7：你的名字（选填，不影响必填校验） */}
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <label htmlFor="name" className={LABEL_CLS}>
                  你的名字
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="选填"
                  value={form.name}
                  onChange={handleChange}
                  className="hud-input max-w-md flex-1"
                />
              </div>
            </div>

            {/* 立即解析：宽大切角按钮，loading 时禁用 */}
            <button
              type="submit"
              disabled={loading}
              className="hud-btn mt-2 transition duration-300 hover:bg-tech hover:drop-shadow-[0_0_20px_rgba(0,240,255,0.85)] focus-visible:outline-2 focus-visible:outline-tech disabled:pointer-events-none disabled:opacity-60"
            >
              <span className="py-4 text-xl shadow-[inset_0_0_24px_rgba(0,240,255,0.16)] md:text-2xl">
                {loading ? '解析中...' : '立即解析'}
              </span>
            </button>
          </form>
        </div>
      </div>

      {/* 解析结果展示区：loading 动画 / 成功换行 / 失败友好错误 + 三工具按钮 */}
      <section
        aria-label="解析结果展示区"
        aria-live="polite"
        className="mt-8 w-full max-w-4xl"
      >
        <div className="mb-3 flex items-center gap-2 text-sm tracking-[0.3em] text-tech">
          <span className="h-1.5 w-1.5 rotate-45 bg-tech shadow-[0_0_6px_#00f0ff]" />
          解析结果
          {/* 来源徽标：新解析 / 命中缓存 / 来自历史 */}
          {source && !loading && (
            <span
              className={`border px-2 py-0.5 text-xs tracking-normal ${SOURCE_BADGE[source].cls}`}
            >
              {SOURCE_BADGE[source].text}
            </span>
          )}
          {(result || error) && !loading && (
            <div className="ml-auto flex items-center gap-2">
              {result && (
                <button type="button" onClick={handleCopy} className="hud-tool">
                  {copied ? '已复制' : '复制'}
                </button>
              )}
              <button type="button" onClick={handleClear} className="hud-tool">
                清空
              </button>
              <button
                type="button"
                onClick={() => void handleAnalyze()}
                className="hud-tool"
              >
                重新解析
              </button>
            </div>
          )}
        </div>
        <div
          className={`hud-input min-h-[110px] whitespace-pre-line leading-relaxed ${
            error ? 'text-red-400' : result ? 'text-white' : 'text-dim'
          }`}
        >
          {loading ? <LoadingAnim /> : error || result || '解析结果将展示在此处'}
        </div>
      </section>

      {/* 最近分析：后端最近 5 条，点击拉详情展示完整结果 */}
      <HistoryPanel
        title="最近分析"
        emptyText="暂无历史分析"
        items={historyItems}
        loading={historyLoading}
        error={historyError}
        activeId={activeHistoryId}
        onSelect={(id) => void handleSelectHistory(id)}
        onRetry={() => void loadHistories()}
        makeBrief={makeBrief}
      />
    </main>
  )
}
