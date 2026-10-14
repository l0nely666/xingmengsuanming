/**
 * 批次 9 回归：确认主页面 / 星座页 / 周公页视觉与主流程未被破坏
 */
import { createRequire } from 'node:module'
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

function loadPlaywright() {
  const require = createRequire(import.meta.url)
  for (const id of ['playwright', '@playwright/test']) {
    try {
      return require(id)
    } catch {}
  }
  const npxRoot = join(process.env.LOCALAPPDATA || '', 'npm-cache/_npx')
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
      const aA = a.version.includes('alpha') ? 1 : 0
      const bA = b.version.includes('alpha') ? 1 : 0
      return aA !== bA ? aA - bA : a.version < b.version ? 1 : -1
    })
  for (const { dir } of candidates) {
    try {
      return require(join(npxRoot, dir, 'node_modules/playwright'))
    } catch {}
  }
  throw new Error('找不到 playwright')
}

function resolveChromiumPath() {
  const root = join(process.env.LOCALAPPDATA || '', 'ms-playwright')
  const out = []
  for (const dir of readdirSync(root).sort().reverse()) {
    if (dir.startsWith('chromium-')) out.push(join(root, dir, 'chrome-win64/chrome.exe'))
    if (dir.startsWith('chromium_headless_shell-'))
      out.push(join(root, dir, 'chrome-headless-shell-win64/chrome-headless-shell.exe'))
  }
  return out.find((p) => existsSync(p))
}

const { chromium } = loadPlaywright()
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const run = async () => {
  const browser = await chromium.launch(
    resolveChromiumPath() ? { executablePath: resolveChromiumPath() } : {},
  )
  const page = await browser.newContext().then((c) => c.newPage())
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  // 主页视觉：大标题 + 两个大按钮 + 装饰线
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
  check('主页大标题「星梦智能助手」', await page.locator('h1:has-text("星梦智能助手")').isVisible())
  check('主页「星座星盘分析」大按钮', await page.locator('button:has-text("星座星盘分析")').isVisible())
  check('主页「周公解梦」大按钮', await page.locator('button:has-text("周公解梦")').isVisible())
  check('主页深蓝背景 bg-deep', await page.locator('main.bg-deep').isVisible())
  check('主页右上角登录状态条', await page.locator('button:has-text("登录")').isVisible())
  const titleShadow = await page
    .locator('h1:has-text("星梦智能助手")')
    .evaluate((el) => getComputedStyle(el).textShadow)
  check('主页标题保留发光 text-shadow', titleShadow && titleShadow !== 'none', titleShadow.slice(0, 40))

  // 星座页视觉（需登录）：直接注册新用户
  const stamp = Date.now()
  await page.goto('http://localhost:5173/register', { waitUntil: 'networkidle' })
  await page.fill('#username', `reg_${stamp}`)
  await page.fill('#password', 'secret123')
  await page.fill('#confirm', 'secret123')
  await page.click('button:has-text("注 册")')
  await page.waitForTimeout(2500)

  await page.goto('http://localhost:5173/horoscope', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('星座页标题「星座分析测算」', await page.locator('h1:has-text("星座分析测算")').isVisible())
  check('星座页 hud-card 存在', await page.locator('.hud-card').first().isVisible())
  check('星座页 hud-input 输入框存在', (await page.locator('.hud-input').count()) > 0)
  check('星座页「立即解析」按钮', await page.locator('button:has-text("立即解析")').isVisible())
  check('星座页最近分析区', await page.locator('section[aria-label="最近分析"]').isVisible())
  check('星座页背景 bg-panel + bg-grid', await page.locator('main.bg-panel.bg-grid').isVisible())

  // 周公页视觉
  await page.goto('http://localhost:5173/dream', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('周公页标题「周公解梦」', await page.locator('h1:has-text("周公解梦")').isVisible())
  check('周公页「立即解梦」按钮', await page.locator('button:has-text("立即解梦")').isVisible())
  check('周公页 hud-card 存在', await page.locator('.hud-card').first().isVisible())

  // 登录页 / 注册页视觉：先清 token（已登录访问 /login 会被自动跳走，属预期行为）
  await page.evaluate(() => localStorage.removeItem('xingmeng_token'))
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  check('登录页 hud-card 存在', await page.locator('.hud-card').first().isVisible())
  check('登录页 hud-input 存在', (await page.locator('.hud-input').count()) >= 2)
  const btnStyle = await page
    .locator('button:has-text("登 录") span')
    .first()
    .evaluate((el) => {
      const s = getComputedStyle(el)
      return { image: s.backgroundImage, color: s.backgroundColor }
    })
  const hasDeepBg =
    (btnStyle.image && btnStyle.image !== 'none' && btnStyle.image.includes('gradient')) ||
    (btnStyle.color && btnStyle.color !== 'rgba(0, 0, 0, 0)')
  check('登录页按钮内层有深蓝渐变底', hasDeepBg, JSON.stringify(btnStyle).slice(0, 80))

  const ignorable = errors.filter((e) => !/favicon|404|Failed to load resource/i.test(e))
  check('无控制台报错', ignorable.length === 0, ignorable.join(' | ').slice(0, 150))

  await browser.close()
  const passed = results.filter((r) => r.ok).length
  console.log(`\n===== 回归结果：${passed}/${results.length} 通过 =====`)
  if (passed !== results.length) process.exitCode = 1
}

run().catch((e) => {
  console.error('回归脚本异常：', e)
  process.exitCode = 1
})
