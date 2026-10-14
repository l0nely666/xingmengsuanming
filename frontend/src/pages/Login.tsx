import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getErrorMessage } from '../api/client'
import { useAuth, safeRedirectPath } from '../context/AuthContext'

/**
 * 登录页
 * 视觉与《星梦智能助手》一致：深蓝网格背景 + HUD 切角发光卡片 + 青色输入框 + 科技按钮
 */

const LABEL_CLS =
  'w-20 shrink-0 text-right text-sm font-medium tracking-wider text-white md:text-base'

/** 字段下方红色错误提示（无错误时不渲染） */
function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="mt-1 pl-[5.5rem] text-xs text-red-500">
      {message}
    </p>
  )
}

/** 标题一侧的科技装饰线 + 菱形，mirror 时整体水平镜像 */
function TitleDecor({ mirror = false }: { mirror?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`hidden flex-1 items-center justify-end gap-3 sm:flex ${
        mirror ? '-scale-x-100' : ''
      }`}
    >
      <div className="flex flex-col gap-1.5">
        <span className="h-px w-16 bg-gradient-to-r from-transparent to-tech/60" />
        <span className="h-px w-28 bg-gradient-to-r from-transparent to-tech" />
        <span className="h-px w-20 bg-gradient-to-r from-transparent to-tech/40" />
      </div>
      <span className="h-2 w-2 rotate-45 bg-tech shadow-[0_0_8px_#00f0ff]" />
    </div>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login, isLoggedIn, loading } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string
    password?: string
  }>({})
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const redirectPath = safeRedirectPath(searchParams.get('redirect'))

  // 已登录访问登录页：直接跳回目标页或主页
  useEffect(() => {
    if (!loading && isLoggedIn) {
      navigate(redirectPath, { replace: true })
    }
  }, [loading, isLoggedIn, redirectPath, navigate])

  const handleChange =
    (setter: (v: string) => void, key: 'username' | 'password') =>
    (e: ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value)
      setFieldErrors((prev) => ({ ...prev, [key]: undefined }))
      setError('')
    }

  /** 校验：用户名 2–32、密码 6–64（与后端一致） */
  const validate = (): boolean => {
    const errs: { username?: string; password?: string } = {}
    const u = username.trim()
    const p = password
    if (!u) errs.username = '请输入用户名'
    else if (u.length < 2 || u.length > 32) errs.username = '用户名需 2–32 个字符'
    if (!p) errs.password = '请输入密码'
    else if (p.length < 6 || p.length > 64) errs.password = '密码需 6–64 个字符'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!validate()) return
    setSubmitting(true)
    try {
      await login(username.trim(), password)
      navigate(redirectPath, { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="bg-panel bg-grid flex min-h-screen flex-col items-center justify-center px-4 py-8">
      {/* 主容器：HUD 切角发光卡片 + 玻璃拟态 */}
      <div className="hud-card w-full max-w-2xl">
        <div className="hud-card-body relative px-6 py-8 md:px-12 md:py-10">
          {/* 右上角发光 X：返回主页面 */}
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="关闭并返回主页面"
            className="absolute top-4 right-5 text-2xl leading-none text-white transition duration-200 hover:rotate-90 hover:text-tech [text-shadow:0_0_8px_#00f0ff]"
          >
            ✕
          </button>

          {/* 标题区：科技装饰线 + 发光标题 */}
          <header className="mb-8 flex items-center gap-4">
            <TitleDecor />
            <h1 className="glow-title shrink-0 text-2xl font-bold tracking-[0.18em] text-white md:text-4xl">
              登录星梦
            </h1>
            <TitleDecor mirror />
          </header>

          {/* 整体错误提示条 */}
          {error && (
            <div
              role="alert"
              className="mb-5 border border-red-500/60 bg-red-500/10 px-4 py-2.5 text-sm text-red-400"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* 用户名 */}
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <label htmlFor="username" className={LABEL_CLS}>
                  用户名
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="2–32 个字符"
                  autoComplete="username"
                  value={username}
                  onChange={handleChange(setUsername, 'username')}
                  className="hud-input max-w-md flex-1"
                />
              </div>
              <FieldError message={fieldErrors.username} />
            </div>

            {/* 密码 */}
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <label htmlFor="password" className={LABEL_CLS}>
                  密码
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="6–64 个字符"
                  autoComplete="current-password"
                  value={password}
                  onChange={handleChange(setPassword, 'password')}
                  className="hud-input max-w-md flex-1"
                />
              </div>
              <FieldError message={fieldErrors.password} />
            </div>

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={submitting}
              className="hud-btn mt-2 transition duration-300 hover:bg-tech hover:drop-shadow-[0_0_20px_rgba(0,240,255,0.85)] focus-visible:outline-2 focus-visible:outline-tech disabled:pointer-events-none disabled:opacity-60"
            >
              <span className="py-4 text-xl shadow-[inset_0_0_24px_rgba(0,240,255,0.16)] md:text-2xl">
                {submitting ? '登录中...' : '登 录'}
              </span>
            </button>
          </form>

          {/* 去注册 */}
          <p className="mt-6 text-center text-sm tracking-wider text-dim">
            还没有账号？
            <Link
              to="/register"
              className="ml-2 text-tech underline-offset-4 transition hover:underline [text-shadow:0_0_8px_rgba(0,240,255,0.6)]"
            >
              去注册
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
