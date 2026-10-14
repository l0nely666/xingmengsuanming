import type { HistoryItem } from '../api/history'

/**
 * 共用历史区（星座「最近分析」/ 周公「最近解梦」）
 * 四态：加载中 / 空 / 错误 / 列表；条目点击后由父级拉详情填结果区
 */

interface HistoryPanelProps {
  /** 区块标题：最近分析 / 最近解梦 */
  title: string
  /** 空态文案：暂无历史分析 / 暂无历史解梦 */
  emptyText: string
  items: HistoryItem[]
  loading: boolean
  error: string
  /** 当前展示中的历史 id（用于高亮） */
  activeId: number | null
  onSelect: (id: number) => void
  onRetry: () => void
  /** 生成输入摘要（各页字段不同，由父级提供） */
  makeBrief: (input: Record<string, string>) => string
}

/** 把后端 UTC ISO 时间转成本地可读时间 */
function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', { hour12: false })
}

/** 历史区加载动画：脉冲菱形 + 扫描线（与结果区 LoadingAnim 同语言） */
function PanelLoading() {
  return (
    <div className="hud-input text-dim">
      <div className="flex items-center gap-3 py-1">
        <span className="xm-pulse-diamond h-2.5 w-2.5 bg-tech shadow-[0_0_8px_#00f0ff]" />
        <div className="relative h-1 flex-1 overflow-hidden bg-tech/10">
          <div className="xm-scan-bar absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-tech to-transparent" />
        </div>
        <span className="text-xs tracking-[0.25em] text-tech">加载历史中</span>
      </div>
    </div>
  )
}

export default function HistoryPanel({
  title,
  emptyText,
  items,
  loading,
  error,
  activeId,
  onSelect,
  onRetry,
  makeBrief,
}: HistoryPanelProps) {
  return (
    <section aria-label={title} className="mt-6 w-full max-w-4xl">
      {/* 标题行：菱形 + 标题 + 条数 */}
      <div className="mb-3 flex items-center gap-2 text-sm tracking-[0.3em] text-tech">
        <span className="h-1.5 w-1.5 rotate-45 bg-tech/80" />
        {title}
        {!loading && !error && (
          <span className="text-xs tracking-wider text-dim/70">
            （{items.length} / 5）
          </span>
        )}
      </div>

      {/* 四态 */}
      {loading ? (
        <PanelLoading />
      ) : error ? (
        <div className="hud-input border-red-500/50 text-red-400">
          <div className="flex items-center gap-3">
            <span className="flex-1 text-sm">{error}</span>
            <button type="button" onClick={onRetry} className="hud-tool">
              重试
            </button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="hud-input text-dim">{emptyText}</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => onSelect(h.id)}
                aria-label={`查看历史：${makeBrief(h.input)}`}
                className={`hud-input cursor-pointer text-left text-sm transition hover:border-tech/80 ${
                  activeId === h.id ? 'border-tech/90 shadow-[0_0_8px_rgba(0,240,255,0.35)]' : ''
                }`}
              >
                <span className="mr-3 text-xs whitespace-nowrap text-dim">
                  {formatTime(h.created_at)}
                </span>
                <span className="text-tech/80">
                  [{h.analysis_type === 'horoscope' ? '星座' : '解梦'}]
                </span>
                <span className="ml-3 text-dim">{makeBrief(h.input)}</span>
                {/* 结果预览（前 100 字） */}
                <span className="mt-1 block truncate text-xs text-dim/60">
                  {h.result_preview}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
