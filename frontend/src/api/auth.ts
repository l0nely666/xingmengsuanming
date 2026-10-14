import request from './client'

/** 后端返回的用户信息（不含密码与盐） */
export interface AuthUser {
  id: number
  username: string
}

/** 注册 / 登录响应 */
export interface AuthResponse {
  success: boolean
  token: string | null
  user: AuthUser | null
  error: string | null
}

/** GET /api/auth/me 响应 */
export interface MeResponse {
  success: boolean
  user: AuthUser | null
  error: string | null
}

/** 登录：成功返回 token + user */
export async function login(
  username: string,
  password: string,
): Promise<AuthResponse> {
  const { data } = await request.post<AuthResponse>('/auth/login', {
    username,
    password,
  })
  return data
}

/** 注册：成功即签发 token 并返回 user */
export async function register(
  username: string,
  password: string,
): Promise<AuthResponse> {
  const { data } = await request.post<AuthResponse>('/auth/register', {
    username,
    password,
  })
  return data
}

/** 退出登录：删除服务端 session */
export async function logout(): Promise<void> {
  await request.post('/auth/logout')
}

/** 获取当前登录用户（用于刷新页面后恢复登录态） */
export async function fetchMe(): Promise<MeResponse> {
  const { data } = await request.get<MeResponse>('/auth/me')
  return data
}
