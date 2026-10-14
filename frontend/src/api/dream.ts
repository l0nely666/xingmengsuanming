import request from './client'
import type { ApiResponse } from './client'

/** 周公解梦表单字段（camelCase，与页面一致） */
export interface DreamForm {
  dreamContent: string // 梦境内容
  dreamTime: string // 做梦时间
  gender: string // 性别
  age: string // 年龄
  occupation: string // 职业
  recentStatus: string // 近期状态
  focus: string // 解梦关注点
  name: string // 你的名字（选填）
}

/** 接口请求参数（snake_case，接口契约） */
export interface DreamParams {
  dream_content: string
  dream_time: string
  gender: string
  age: string
  occupation: string
  recent_status: string
  focus: string
  name: string // 选填昵称
}

/** 表单 → 接口参数映射 */
function toParams(form: DreamForm): DreamParams {
  return {
    dream_content: form.dreamContent,
    dream_time: form.dreamTime,
    gender: form.gender,
    age: form.age,
    occupation: form.occupation,
    recent_status: form.recentStatus,
    focus: form.focus,
    name: form.name.trim(),
  }
}

/** POST /api/dream/analyze —— 周公解梦（含 cached / history_id） */
export async function analyzeDream(form: DreamForm): Promise<ApiResponse> {
  const { data } = await request.post<ApiResponse>('/dream/analyze', toParams(form))
  return data
}
