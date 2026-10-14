import request from './client'
import type { ApiResponse } from './client'

/** 星座分析表单字段（camelCase，与页面一致） */
export interface HoroscopeForm {
  birthDate: string // 出生年月日 YYYY-MM-DD
  birthTime: string // 出生时间 HH:MM
  birthPlace: string // 出生地点
  gender: string // 性别
  emotionStatus: string // 情感状态：单身/恋爱/已婚
  occupation: string // 职业身份
  focus: string // 测算关注点
  name: string // 你的名字（选填）
}

/** 接口请求参数（snake_case，接口契约） */
export interface HoroscopeParams {
  birth_date: string
  birth_time: string
  birth_place: string
  gender: string
  relationship_status: string
  occupation: string
  focus: string
  name: string // 选填昵称
}

/** 表单 → 接口参数映射 */
function toParams(form: HoroscopeForm): HoroscopeParams {
  return {
    birth_date: form.birthDate,
    birth_time: form.birthTime,
    birth_place: form.birthPlace,
    gender: form.gender,
    relationship_status: form.emotionStatus,
    occupation: form.occupation,
    focus: form.focus,
    name: form.name.trim(),
  }
}

/** POST /api/horoscope/analyze —— 星座分析（含 cached / history_id） */
export async function analyzeHoroscope(
  form: HoroscopeForm,
): Promise<ApiResponse> {
  const { data } = await request.post<ApiResponse>(
    '/horoscope/analyze',
    toParams(form),
  )
  return data
}
