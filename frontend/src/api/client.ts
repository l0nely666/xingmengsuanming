import axios, { isAxiosError } from 'axios'

/** 统一响应结构（接口契约） */
export interface ApiResponse {
  success: boolean
  result: string
  error: string | null
  /** 是否命中同参缓存（命中则未调用大模型） */
  cached?: boolean
  /** 本次结果在 analyses 表中的记录 id */
  history_id?: number | null
}

/** 本地 token 存储键 */
export const TOKEN_KEY = 'xingmeng_token'

/** 读取本地 token */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

/** 保存 token（登录 / 注册成功后调用） */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

/** 清除 token（退出登录 / 401 / 恢复失败） */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

/**
 * 统一请求实例
 * baseURL 优先取环境变量 VITE_API_BASE_URL，默认 /api
 * 经 Vite proxy 转发到后端 http://localhost:8000
 */
const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  // 大模型生成可能耗时 1~4 分钟（推理模型思考链长），超时给足余量
  timeout: 240_000,
})

/** 401 统一处理回调（由 AuthProvider 注册，用于 SPA 内跳转登录页） */
type UnauthorizedHandler = () => void
let onUnauthorized: UnauthorizedHandler | null = null

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler
}

/** 这些认证接口自身的 401 由调用方处理，不触发全局跳转 */
const AUTH_SELF_PATHS = ['/auth/login', '/auth/register', '/auth/me', '/auth/logout']

function isAuthSelfRequest(url: string | undefined): boolean {
  return AUTH_SELF_PATHS.some((p) => (url ?? '').includes(p))
}

// 请求拦截器：自动附带 Authorization: Bearer <token>
request.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：401 → 清 token 并跳转登录页（带 redirect）
request.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const url: string | undefined = error.config?.url

    if (status === 401 && !isAuthSelfRequest(url)) {
      clearToken()
      const redirect = encodeURIComponent(
        window.location.pathname + window.location.search,
      )
      if (onUnauthorized) {
        onUnauthorized()
      } else if (!window.location.pathname.startsWith('/login')) {
        window.location.href = `/login?redirect=${redirect}`
      }
    }
    return Promise.reject(error)
  },
)

/**
 * 将请求异常转换为用户可读的友好提示
 * - 无响应：网络不通 / 后端未启动 / 超时
 * - 非 JSON 错误页（如 Vite proxy 转发失败的 500）：视为后端未连接
 * - 后端按契约返回的 JSON：优先展示 error 字段
 * - 其余 HTTP 错误：展示状态码
 */
export function getErrorMessage(err: unknown): string {
  // 业务层主动抛出的普通错误（如登录返回异常），直接用其 message
  if (err instanceof Error && !isAxiosError(err)) {
    return err.message || '请求异常，请稍后重试'
  }
  if (!isAxiosError(err)) return '请求异常，请稍后重试'

  // 无响应对象：连接被拒 / 断网 / 超时
  if (!err.response) {
    return err.code === 'ECONNABORTED'
      ? '请求超时，请稍后重试'
      : '后端服务未连接，请先启动后端'
  }

  const { status, data } = err.response

  // 后端按契约返回的 JSON 错误信息
  if (data && typeof data === 'object' && 'error' in data) {
    const msg = (data as ApiResponse).error
    if (msg) return msg
  }

  // 非 JSON 错误页 + 5xx：多为 Vite proxy 转发失败（后端未启动）
  if (status >= 500 && (typeof data !== 'object' || data === null)) {
    return '后端服务未连接，请先启动后端'
  }

  return `请求失败（HTTP ${status}），请稍后重试`
}

export default request
