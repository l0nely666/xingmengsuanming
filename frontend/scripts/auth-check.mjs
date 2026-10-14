/**
 * 批次 9 自检：登录 / 注册 / 认证状态 / 路由保护 / 主页状态条
 * 运行：node scripts/auth-check.mjs
 * 依赖 playwright（浏览器内核已本地缓存），脚本自动从 node_modules 或 npx 缓存解析
 */
import { createRequire } from 'node:module'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

function loadPlaywright() {
  const require = createRequire(import.meta.url)
  // 1) 项目/全局 node_modules
  for (const id of ['playwright', '@playwright/test']) {
    try {
      return require(id)
    } catch {
      /* 继续尝试下一个 */
    }
  }
  // 2) npx 缓存（本环境 playwright 由 npx 拉取，未写入项目依赖）
  //    优先取稳定版（非 alpha），与已缓存浏览器内核匹配
  const npxRoot = join(process.env.LOCALAPPDATA || '', 'npm-cache/_npx')
  try {
    const candidates = readdirSync(npxRoot)
      .map((dir) => {
        try {
          const pkg = require(join(npxRoot, dir, 'node_modules/playwright/package.json'))
          return { dir, version: pkg.version }
        } catch {
          return null
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        const aAlpha = a.version.includes('alpha') ? 1 : 0
        const bAlpha = b.version.includes('alpha') ? 1 : 0
        if (aAlpha !== bAlpha) return aAlpha - bAlpha
        return a.version < b.version ? 1 : -1
      })
    for (const { dir } of candidates) {
      try {
        return require(join(npxRoot, dir, 'node_modules/playwright'))
      } catch {
        /* 跳过 */
      }
    }
  } catch {
    /* npx 缓存不存在 */
  }
  throw new Error('找不到 playwright，请先执行 npm i -D playwright')
}

const { chromium } = loadPlaywright()

/**
 * 本环境 playwright 为 npx 临时拉取，版本与已缓存浏览器内核不一致，
 * 显式指向 ms-playwright 里已存在的 Chromium 可执行文件。
 */
function resolveChromiumPath() {
  const root = join(process.env.LOCALAPPDATA || '', 'ms-playwright')
  const candidates = []
  try {
    for (const dir of readdirSync(root).sort().reverse()) {
      if (dir.startsWith('chromium-')) {
        candidates.push(join(root, dir, 'chrome-win64/chrome.exe'))
      }
      if (dir.startsWith('chromium_headless_shell-')) {
        candidates.push(
          join(root, dir, 'chrome-headless-shell-win64/chrome-headless-shell.exe'),
        )
      }
    }
  } catch {
    /* 目录不存在 */
  }
  const { existsSync } = createRequire(import.meta.url)('node:fs')
  return candidates.find((p) => existsSync(p))
}

const BASE = 'http://localhost:5173'
const results = []

function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const run = async () => {
  const executablePath = resolveChromiumPath()
  const browser = await chromium.launch(executablePath ? { executablePath } : {})
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })

  const stamp = Date.now()
  const username = `ui_test_${stamp}`
  const password = 'secret123'

  // 1. 主页右上角未登录态
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  const authBar = page.locator('text=登录').first()
  check('主页右上角显示「登录」', await authBar.isVisible())
  check('主页右上角显示「注册」', await page.locator('text=注册').first().isVisible())

  // 2. 未登录访问 /horoscope → 跳 /login?redirect=/horoscope
  await page.goto(BASE + '/horoscope', { waitUntil: 'networkidle' })
  check('未登录访问 /horoscope 跳登录页', page.url().includes('/login'), page.url())
  check('redirect 参数为 /horoscope', page.url().includes('redirect=%2Fhoroscope'), page.url())

  // 3. 未登录访问 /dream → 跳 /login?redirect=/dream
  await page.goto(BASE + '/dream', { waitUntil: 'networkidle' })
  check('未登录访问 /dream 跳登录页', page.url().includes('/login'), page.url())
  check('redirect 参数为 /dream', page.url().includes('redirect=%2Fdream'), page.url())

  // 4. 登录页字段与链接
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
  check('登录页标题「登录星梦」', await page.locator('h1:has-text("登录星梦")').isVisible())
  check('登录页用户名输入框', await page.locator('#username').isVisible())
  check('登录页密码输入框', await page.locator('#password').isVisible())
  check('登录页「去注册」链接', await page.locator('a:has-text("去注册")').isVisible())

  // 5. 登录校验：空表单红字
  await page.click('button:has-text("登 录")')
  await page.waitForTimeout(200)
  check('空表单显示用户名红字', await page.locator('text=请输入用户名').isVisible())
  check('空表单显示密码红字', await page.locator('text=请输入密码').isVisible())

  // 6. 登录失败：错误密码显示红色提示
  await page.fill('#username', 'nobody_user_xx')
  await page.fill('#password', 'wrongpass')
  await page.click('button:has-text("登 录")')
  await page.waitForTimeout(1200)
  check('登录失败显示错误提示', await page.locator('[role=alert]').first().isVisible())
  const alertText = await page.locator('[role=alert]').first().innerText()
  check('错误提示为红色文案', /用户名或密码错误|请求失败|后端/.test(alertText), alertText)

  // 7. 注册页字段
  await page.goto(BASE + '/register', { waitUntil: 'networkidle' })
  check('注册页标题「注册账号」', await page.locator('h1:has-text("注册账号")').isVisible())
  check('注册页确认密码输入框', await page.locator('#confirm').isVisible())
  check('注册页「去登录」链接', await page.locator('a:has-text("去登录")').isVisible())

  // 8. 注册校验：两次密码不一致
  await page.fill('#username', username)
  await page.fill('#password', password)
  await page.fill('#confirm', 'different123')
  await page.click('button:has-text("注 册")')
  await page.waitForTimeout(300)
  check('两次密码不一致显示红字', await page.locator('text=两次输入的密码不一致').isVisible())

  // 9. 弱密码红字
  await page.fill('#password', '123')
  await page.fill('#confirm', '123')
  await page.click('button:has-text("注 册")')
  await page.waitForTimeout(300)
  check('弱密码显示红字', await page.locator('text=密码需 6–64 个字符').isVisible())

  // 10. 注册成功（带 redirect）→ 跳回 /horoscope
  await page.goto(BASE + '/register?redirect=%2Fhoroscope', { waitUntil: 'networkidle' })
  await page.fill('#username', username)
  await page.fill('#password', password)
  await page.fill('#confirm', password)
  await page.click('button:has-text("注 册")')
  await page.waitForTimeout(2500)
  check('注册成功后跳回 /horoscope', page.url().includes('/horoscope'), page.url())
  const token = await page.evaluate(() => localStorage.getItem('xingmeng_token'))
  check('localStorage 已保存 xingmeng_token', Boolean(token), token ? `${token.slice(0, 12)}...` : 'null')

  // 11. 星座页可正常打开（AuthGuard 放行）
  check('星座页标题可见', await page.locator('h1:has-text("星座分析测算")').isVisible())

  // 12. 刷新后登录态恢复
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const greetVisible = await page.locator(`text=你好，`).isVisible()
  check('刷新后主页显示「你好，用户名」', greetVisible, username)
  check('已登录显示「退出登录」', await page.locator('button:has-text("退出登录")').isVisible())
  check(
    '已登录不再显示「登录/注册」入口',
    !(await page.locator('button:text-is("登录")').isVisible().catch(() => false)) &&
      !(await page.locator('button:text-is("注册")').isVisible().catch(() => false)),
  )

  // 13. 退出登录
  await page.click('button:has-text("退出登录")')
  await page.waitForTimeout(1500)
  const tokenAfter = await page.evaluate(() => localStorage.getItem('xingmeng_token'))
  check('退出后 token 已清除', !tokenAfter, String(tokenAfter))
  check('退出后主页显示「登录」', await page.locator('button:has-text("登录")').first().isVisible())

  // 14. 退出后访问 /dream → 跳登录
  await page.goto(BASE + '/dream', { waitUntil: 'networkidle' })
  check('退出后访问 /dream 跳登录页', page.url().includes('/login'), page.url())

  // 15. 控制台无报错
  const ignorable = consoleErrors.filter((e) => !/favicon|404|Failed to load resource/i.test(e))
  check('无控制台报错', ignorable.length === 0, ignorable.join(' | ').slice(0, 200))

  await browser.close()

  const passed = results.filter((r) => r.ok).length
  console.log(`\n===== 自检结果：${passed}/${results.length} 通过 =====`)
  if (passed !== results.length) process.exitCode = 1
}

run().catch((e) => {
  console.error('自检脚本异常：', e)
  process.exitCode = 1
})
