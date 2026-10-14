import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

/**
 * 主页面《星梦智能助手》
 * 视觉参考 docs/主页面.png：纯色深蓝背景 + 发光大标题 + 对称装饰线/菱形 + 双切角大按钮
 * 右上角显示登录状态（未登录：登录/注册；已登录：你好+退出登录）
 */

/** 标题一侧的装饰：渐变横线组 + 两个发光菱形；mirror=true 时整体水平镜像作为另一侧 */
function TitleDecor({ mirror = false }: { mirror?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`hidden flex-1 items-center justify-end gap-3 sm:flex ${
        mirror ? '-scale-x-100' : ''
      }`}
    >
      {/* 三条不同长度的横线：由外向内变亮（亮端朝向标题） */}
      <div className="xm-line flex flex-col gap-1.5">
        <span className="h-px w-32 bg-gradient-to-r from-transparent to-tech/50" />
        <span className="h-px w-56 bg-gradient-to-r from-transparent to-tech" />
        <span className="h-px w-40 bg-gradient-to-r from-transparent to-tech/70" />
      </div>
      {/* 菱形点缀 ◆ ◆ */}
      <span className="h-2.5 w-2.5 rotate-45 bg-tech shadow-[0_0_8px_#00f0ff]" />
      <span className="h-1.5 w-1.5 rotate-45 bg-tech/70 shadow-[0_0_6px_#00f0ff]" />
    </div>
  )
}

/** 右上角登录状态条：未登录显示「登录/注册」，已登录显示问候 + 退出登录 */
function AuthBar() {
  const navigate = useNavigate()
  const { user, isLoggedIn, loading, logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="absolute top-5 right-6 z-10 flex items-center gap-2">
      {loading ? (
        <span className="text-sm tracking-wider text-dim">…</span>
      ) : isLoggedIn && user ? (
        <>
          <span className="text-sm tracking-wider text-dim">
            你好，
            <span className="text-tech [text-shadow:0_0_8px_rgba(0,240,255,0.7)]">
              {user.username}
            </span>
          </span>
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            className="hud-tool"
          >
            {loggingOut ? '退出中...' : '退出登录'}
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={() => navigate('/login')} className="hud-tool">
            登录
          </button>
          <span className="text-dim/60">/</span>
          <button type="button" onClick={() => navigate('/register')} className="hud-tool">
            注册
          </button>
        </>
      )}
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()

  return (
    <main className="bg-deep relative flex min-h-screen flex-col items-center overflow-x-hidden">
      {/* 右上角登录状态（不影响标题与主按钮布局） */}
      <AuthBar />
      {/* 页面级入场动画（CSS-only） */}
      <style>{`
        @keyframes xm-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes xm-rise { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes xm-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .xm-title { animation: xm-fade 0.9s ease both; }
        .xm-line { transform-origin: right; animation: xm-grow 0.8s cubic-bezier(0.22, 0.8, 0.36, 1) 0.2s both; }
        .xm-btn { animation: xm-rise 0.7s cubic-bezier(0.22, 0.8, 0.36, 1) both; }
      `}</style>

      {/* 顶部：发光标题 + 两侧对称装饰线与菱形 */}
      <header className="xm-title mt-[9vh] flex w-full max-w-5xl items-center gap-4 px-6">
        <TitleDecor />
        <h1 className="shrink-0 text-[clamp(2.4rem,7vw,4.5rem)] leading-tight font-black tracking-[0.1em] text-white [text-shadow:0_0_12px_rgba(255,255,255,0.9),0_0_36px_rgba(0,240,255,0.75),0_0_90px_rgba(0,240,255,0.45)]">
          星梦智能助手
        </h1>
        <TitleDecor mirror />
      </header>

      {/* 中部：两个巨大切角功能按钮，垂直排列 */}
      <section className="mt-[13vh] flex w-full max-w-4xl flex-col gap-10 px-8">
        <button
          type="button"
          onClick={() => navigate('/horoscope')}
          style={{ animationDelay: '0.35s' }}
          className="hud-btn xm-btn transition duration-300 hover:bg-tech hover:drop-shadow-[0_0_20px_rgba(0,240,255,0.85)] focus-visible:outline-2 focus-visible:outline-tech"
        >
          <span className="px-8 py-8 text-3xl shadow-[inset_0_0_28px_rgba(0,240,255,0.16)] md:py-10 md:text-[44px]">
            星座星盘分析
          </span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/dream')}
          style={{ animationDelay: '0.5s' }}
          className="hud-btn xm-btn transition duration-300 hover:bg-tech hover:drop-shadow-[0_0_20px_rgba(0,240,255,0.85)] focus-visible:outline-2 focus-visible:outline-tech"
        >
          <span className="px-8 py-8 text-3xl shadow-[inset_0_0_28px_rgba(0,240,255,0.16)] md:py-10 md:text-[44px]">
            周公解梦
          </span>
        </button>
      </section>
    </main>
  )
}
