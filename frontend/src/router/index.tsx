import { Route, Routes } from 'react-router-dom'
import AuthGuard from '../components/AuthGuard'
import Home from '../pages/Home'
import Horoscope from '../pages/Horoscope'
import Dream from '../pages/Dream'
import Login from '../pages/Login'
import Register from '../pages/Register'

/**
 * 路由表
 * - /login /register：认证页（已登录自动跳回）
 * - /horoscope /dream：需登录，未登录跳 /login?redirect=...
 */
export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/horoscope"
        element={
          <AuthGuard>
            <Horoscope />
          </AuthGuard>
        }
      />
      <Route
        path="/dream"
        element={
          <AuthGuard>
            <Dream />
          </AuthGuard>
        }
      />
    </Routes>
  )
}
