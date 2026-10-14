import { useCallback, useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyzeDream } from '../api/dream'
import type { DreamForm } from '../api/dream'
import { fetchHistory, fetchHistoryDetail } from '../api/history'
import type { HistoryItem } from '../api/history'
import { getErrorMessage } from '../api/client'
import HistoryPanel from '../components/HistoryPanel'

/**
 * 周公解梦页
 * 视觉参考 docs/周公解梦.png：与星座页完全一致的科技 HUD 视觉语言，
 * 区别在于标题上方增加电路板纹路装饰。
 * 必填校验 + loading + 结果展示 + 友好错误 + 复制/清空/重新解析 + 历史记录
 */

const INITIAL_FORM: DreamForm = {
  dreamContent: '',
  dreamTime: '',
  gender: '',
  age: '',
  occupation: '',
  recentStatus: '',
  focus: '',
  name: '',
}

/** 字段错误集合（无错误的字段为 undefined） */
type FieldErrors = Partial<Record<keyof DreamForm, string>>

/** 必填字段与提示文案（7 个效果图字段必填，name 选填不在此列） */
const REQUIRED: { name: keyof DreamForm; label: string; select?: boolean }[] = [
  { name: 'dreamContent', label: '梦境内容' },
  { name: 'dreamTime', label: '做梦时间' },
  { name: 'gender', label: '性别', select: true },
  { name: 'age', label: '年龄', select: true },
  { name: 'occupation', label: '职业' },
  { name: 'recentStatus', label: '近期状态' },
  { name: 'focus', label: '解梦关注点' },
]

/** 左侧标签统一样式（左对齐成列） */
const LABEL_CLS =
  'w-24 shrink-0 text-left text-sm font-medium tracking-wider text-white md:text-base'

/** 字段下方红色错误提示（无错误时不渲染），className 控制缩进 */
function FieldError({
  message,
  className = '',
}: {
  message?: string
  className?: string
}) {
  if (!message) return null
  return (
    <p role="alert" className={`mt-1 text-xs text-red-500 ${className}`}>
      {message}
    </p>
  )
}

/** 标题上方的电路板纹路装饰（左右镜像对称） */
function CircuitDecor({ mirror = false }: { mirror?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`hidden items-center gap-2 sm:flex ${mirror ? '-scale-x-100' : ''}`}
    >
      {/* 阶梯走线 ┐ └ + 节点 + 菱形焊盘 + 亮线 */}
      <span className="h-5 w-14 border-t border-r border-tech/50" />
      <span className="h-2 w-2 rounded-full bg-tech shadow-[0_0_6px_#00f0ff]" />
      <span className="h-px w-8 bg-tech/70" />
      <span className="h-3 w-6 border-b border-l border-tech/50" />
      <span className="h-2.5 w-2.5 rotate-45 border border-tech/80" />
      <span className="h-px w-12 bg-gradient-to-r from-tech/40 to-tech" />
      <span className="h-1.5 w-1.5 rotate-45 bg-tech shadow-[0_0_6px_#00f0ff]" />
    </div>
  )
}

/** 标题一侧的短线 + 菱形装饰 */
function TitleDecor({ mirror = false }: { mirror?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`hidden items-center gap-2 sm:flex ${mirror ? '-scale-x-100' : ''}`}
    >
      <span className="h-px w-14 bg-gradient-to-r from-transparent to-tech/60" />
      <span className="h-px w-8 bg-gradient-to-r from-transparent to-tech" />
      <span className="h-2 w-2 rotate-45 bg-tech shadow-[0_0_8px_#00f0ff]" />
    </span>
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
  const content = input.dream_content || ''
  return `${content.slice(0, 14)}${content.length > 14 ? '…' : ''} · ${input.focus || ''}`
}

export default function Dream() {
  const navigate = useNavigate()
  const [form, setForm] = useState<DreamForm>(INITIAL_FORM)
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
      setHistoryItems(await fetchHistory('dream'))
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

  /** 立即解梦：校验 → 调用后端 → 展示结果 + 缓存徽标，成功后刷新历史 */
  const handleAnalyze = async () => {
    if (!validate()) return // 必填缺失：仅红字提示，不发请求
    setLoading(true)
    setError('')
    setResult('')
    setCopied(false)
    setSource(null)
    setActiveHistoryId(null)
    try {
      const data = await analyzeDream(form)
      if (data.success && typeof data.result === 'string') {
        setResult(data.result)
        setSource(data.cached ? 'cached' : 'new')
        setActiveHistoryId(data.history_id ?? null)
        void loadHistories()
      } else {
        setError(data.error || '解梦失败，请稍后重试')
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
      const detail = await fetchHistoryDetail('dream', id)
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
      {/* 主容器：HUD 切角发光卡片 + 玻璃拟态（与星座页一致） */}
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

          {/* 标题区：上方电路板纹路 + 大标题 */}
          <header className="mb-8">
            <div className="mb-3 flex items-center justify-center gap-3">
              <CircuitDecor />
              <span className="h-px w-16 bg-gradient-to-r from-transparent via-tech/70 to-transparent" />
              <CircuitDecor mirror />
            </div>
            <div className="flex items-center justify-center gap-4">
              <TitleDecor />
              <h1 className="shrink-0 text-2xl font-bold tracking-[0.18em] text-white md:text-4xl [text-shadow:0_0_12px_rgba(0,240,255,0.55)]">
                周公解梦
              </h1>
              <TitleDecor mirror />
            </div>
          </header>

          {/* 表单：垂直布局，标签左对齐，输入框占满剩余宽度 */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* 梦境内容（单行输入框） */}
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <label htmlFor="dreamContent" className={LABEL_CLS}>
                  梦境内容
                </label>
                <input
                  id="dreamContent"
                  name="dreamContent"
                  type="text"
                  value={form.dreamContent}
                  onChange={handleChange}
                  className="hud-input flex-1"
                />
              </div>
              <FieldError
                message={fieldErrors.dreamContent}
                className="pl-[6.75rem]"
              />
            </div>

            {/* 做梦时间 */}
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <label htmlFor="dreamTime" className={LABEL_CLS}>
                  做梦时间
                </label>
                <input
                  id="dreamTime"
                  name="dreamTime"
                  type="text"
                  value={form.dreamTime}
                  onChange={handleChange}
                  className="hud-input flex-1"
                />
              </div>
              <FieldError
                message={fieldErrors.dreamTime}
                className="pl-[6.75rem]"
              />
            </div>

            {/* 性别 + 年龄：同一行，各占 50%，错误提示在各自下拉框下方 */}
            <div className="flex items-center gap-3">
              <label htmlFor="gender" className={LABEL_CLS}>
                性别
              </label>
              <div className="grid flex-1 grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <select
                    id="gender"
                    name="gender"
                    value={form.gender}
                    onChange={handleChange}
                    className="hud-input hud-select"
                  >
                    <option value="" disabled>
                      性别
                    </option>
                    <option value="男">男</option>
                    <option value="女">女</option>
                  </select>
                  <FieldError message={fieldErrors.gender} />
                </div>
                <div className="flex flex-col">
                  <select
                    name="age"
                    aria-label="年龄"
                    value={form.age}
                    onChange={handleChange}
                    className="hud-input hud-select"
                  >
                    <option value="" disabled>
                      年龄
                    </option>
                    <option value="18岁以下">18岁以下</option>
                    <option value="18-25岁">18-25岁</option>
                    <option value="26-35岁">26-35岁</option>
                    <option value="36-45岁">36-45岁</option>
                    <option value="46-60岁">46-60岁</option>
                    <option value="60岁以上">60岁以上</option>
                  </select>
                  <FieldError message={fieldErrors.age} />
                </div>
              </div>
            </div>

            {/* 职业 */}
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <label htmlFor="occupation" className={LABEL_CLS}>
                  职业
                </label>
                <input
                  id="occupation"
                  name="occupation"
                  type="text"
                  value={form.occupation}
                  onChange={handleChange}
                  className="hud-input flex-1"
                />
              </div>
              <FieldError
                message={fieldErrors.occupation}
                className="pl-[6.75rem]"
              />
            </div>

            {/* 近期状态 */}
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <label htmlFor="recentStatus" className={LABEL_CLS}>
                  近期状态
                </label>
                <input
                  id="recentStatus"
                  name="recentStatus"
                  type="text"
                  value={form.recentStatus}
                  onChange={handleChange}
                  className="hud-input flex-1"
                />
              </div>
              <FieldError
                message={fieldErrors.recentStatus}
                className="pl-[6.75rem]"
              />
            </div>

            {/* 解梦关注点 */}
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <label htmlFor="focus" className={LABEL_CLS}>
                  解梦关注点
                </label>
                <input
                  id="focus"
                  name="focus"
                  type="text"
                  value={form.focus}
                  onChange={handleChange}
                  className="hud-input flex-1"
                />
              </div>
              <FieldError
                message={fieldErrors.focus}
                className="pl-[6.75rem]"
              />
            </div>

            {/* 你的名字（选填，不影响必填校验） */}
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
                  className="hud-input flex-1"
                />
              </div>
            </div>

            {/* 立即解梦：与星座页「立即解析」同款，loading 时禁用 */}
            <button
              type="submit"
              disabled={loading}
              className="hud-btn mt-2 transition duration-300 hover:bg-tech hover:drop-shadow-[0_0_20px_rgba(0,240,255,0.85)] focus-visible:outline-2 focus-visible:outline-tech disabled:pointer-events-none disabled:opacity-60"
            >
              <span className="py-4 text-xl shadow-[inset_0_0_24px_rgba(0,240,255,0.16)] md:text-2xl">
                {loading ? '解梦中...' : '立即解梦'}
              </span>
            </button>
          </form>
        </div>
      </div>

      {/* 解梦结果展示区：loading 动画 / 成功换行 / 失败友好错误 + 三工具按钮 */}
      <section
        aria-label="解梦结果展示区"
        aria-live="polite"
        className="mt-8 w-full max-w-4xl"
      >
        <div className="mb-3 flex items-center gap-2 text-sm tracking-[0.3em] text-tech">
          <span className="h-1.5 w-1.5 rotate-45 bg-tech shadow-[0_0_6px_#00f0ff]" />
          解梦结果
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
                重新解梦
              </button>
            </div>
          )}
        </div>
        <div
          className={`hud-input min-h-[110px] whitespace-pre-line leading-relaxed ${
            error ? 'text-red-400' : result ? 'text-white' : 'text-dim'
          }`}
        >
          {loading ? <LoadingAnim /> : error || result || '解梦结果将展示在此处'}
        </div>
      </section>

      {/* 最近解梦：后端最近 5 条，点击拉详情展示完整结果 */}
      <HistoryPanel
        title="最近解梦"
        emptyText="暂无历史解梦"
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
