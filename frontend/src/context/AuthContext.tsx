import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
} from '../api/auth'
import type { AuthUser } from '../api/auth'
import { clearToken, getToken, setToken, setUnauthorizedHandler } from '../api/client'

/** 认证状态与操作（登录 / 注册 / 退出 / 当前用户） */
interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  isLoggedIn: boolean
  /** 启动恢复登录态期间为 true，避免误判未登录 */
  loading: boolean
  login: (username: string, password: string) => Promise<AuthUser>
  register: (username: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** 只允许站内相对路径，防开放重定向 */
function safeRedirectPath(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw
  return '/'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken())
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState<boolean>(() => Boolean(getToken()))
  const navigate = useNavigate()
  const restored = useRef(false)

  // 401 统一处理：清 token 并跳转登录页（带 redirect）
  useEffect(() => {
    const handler = () => {
      setTokenState(null)
      setUser(null)
      const redirect = encodeURIComponent(
        window.location.pathname + window.location.search,
      )
      if (!window.location.pathname.startsWith('/login')) {
        navigate(`/login?redirect=${redirect}`, { replace: true })
      }
    }
    setUnauthorizedHandler(handler)
    return () => setUnauthorizedHandler(null)
  }, [navigate])

  // 刷新页面后通过 GET /api/auth/me 恢复登录状态
  useEffect(() => {
    if (restored.current) return
    restored.current = true

    const saved = getToken()
    if (!saved) {
      setLoading(false)
      return
    }

    void fetchMe()
      .then((data) => {
        if (data.success && data.user) {
          setUser(data.user)
        } else {
          clearToken()
          setTokenState(null)
        }
      })
      .catch(() => {
        clearToken()
        setTokenState(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const data = await apiLogin(username, password)
    if (!data.success || !data.token || !data.user) {
      throw new Error(data.error || '登录失败，请稍后重试')
    }
    setToken(data.token)
    setTokenState(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback(async (username: string, password: string) => {
    const data = await apiRegister(username, password)
    if (!data.success || !data.token || !data.user) {
      throw new Error(data.error || '注册失败，请稍后重试')
    }
    setToken(data.token)
    setTokenState(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } catch {
      // 服务端删除失败不阻断：本地仍清除登录态
    }
    clearToken()
    setTokenState(null)
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoggedIn: Boolean(token && user),
      loading,
      login,
      register,
      logout,
    }),
    [user, token, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** 读取认证状态；必须在 AuthProvider 内使用 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 必须在 <AuthProvider> 内使用')
  return ctx
}

export { safeRedirectPath }
