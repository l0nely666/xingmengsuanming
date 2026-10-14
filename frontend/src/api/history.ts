import request from './client'

/** 历史记录类型 */
export type AnalysisType = 'horoscope' | 'dream'

/** 历史列表项（对应后端 HistoryItem） */
export interface HistoryItem {
  id: number
  analysis_type: string
  /** 完整表单输入 */
  input: Record<string, string>
  /** 结果前 100 字预览 */
  result_preview: string
  created_at: string
}

/** 历史详情（对应后端 HistoryDetail） */
export interface HistoryDetail extends HistoryItem {
  result_text: string
}

/** GET /api/history/{type} —— 当前用户该类型最近 5 条 */
export async function fetchHistory(type: AnalysisType): Promise<HistoryItem[]> {
  const { data } = await request.get<{
    success: boolean
    items: HistoryItem[]
    error: string | null
  }>(`/history/${type}`)
  if (!data.success) {
    throw new Error(data.error || '历史加载失败，请稍后重试')
  }
  return data.items || []
}

/** GET /api/history/{type}/{id} —— 完整 input 与 result_text（仅本人） */
export async function fetchHistoryDetail(
  type: AnalysisType,
  id: number,
): Promise<HistoryDetail> {
  const { data } = await request.get<{
    success: boolean
    item: HistoryDetail | null
    error: string | null
  }>(`/history/${type}/${id}`)
  if (!data.success || !data.item) {
    throw new Error(data.error || '历史记录不存在')
  }
  return data.item
}
