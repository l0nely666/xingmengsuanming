import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/** 恢复登录态期间的 HUD 风格加载占位（脉冲菱形 + 扫描线） */
function Restoring() {
  return (
    <main className="bg-panel bg-grid flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <div className="flex w-full max-w-sm items-center gap-3">
        <span className="xm-pulse-diamond h-3 w-3 bg-tech shadow-[0_0_10px_#00f0ff]" />
        <div className="relative h-1 flex-1 overflow-hidden bg-tech/10">
          <div className="xm-scan-bar absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-tech to-transparent" />
        </div>
        <span className="text-sm tracking-[0.3em] text-tech">校验登录中</span>
      </div>
    </main>
  )
}

/**
 * 路由保护：未登录跳转 /login?redirect=<当前路径>
 * 恢复登录态期间显示加载占位，避免闪跳
 */
export default function AuthGuard({ children }: { children: ReactNode }) {
  const { isLoggedIn, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Restoring />

  if (!isLoggedIn) {
    const redirect = encodeURIComponent(
      location.pathname + location.search,
    )
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }

  return <>{children}</>
}
