/** localStorage 解析历史：两页共用，按类型读取，整体保留最近 5 条 */

export interface HistoryItem {
  id: string
  type: 'horoscope' | 'dream'
  time: string // 本地时间字符串
  brief: string // 表单摘要（展示用）
  result: string // 完整解析结果
}

const STORAGE_KEY = 'xm_history'
const MAX_ITEMS = 5

/** 读全部记录（解析失败/被清空时返回空数组） */
function readAll(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(list) ? (list as HistoryItem[]) : []
  } catch {
    return []
  }
}

function writeAll(list: HistoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // 隐私模式 / 存储满：静默忽略，不影响主流程
  }
}

/** 读取某类型的历史（最新在前） */
export function loadHistory(type: HistoryItem['type']): HistoryItem[] {
  return readAll().filter((h) => h.type === type)
}

/** 新增一条成功记录（最新在前，整体截断到最近 5 条），返回该类型的最新列表 */
export function addHistory(
  item: Omit<HistoryItem, 'id' | 'time'>,
): HistoryItem[] {
  const entry: HistoryItem = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    time: new Date().toLocaleString('zh-CN', { hour12: false }),
  }
  const next = [entry, ...readAll()].slice(0, MAX_ITEMS)
  writeAll(next)
  return next.filter((h) => h.type === item.type)
}

/** 清空某类型的历史，返回该类型的最新列表（空） */
export function clearHistory(type: HistoryItem['type']): HistoryItem[] {
  writeAll(readAll().filter((h) => h.type !== type))
  return []
}
