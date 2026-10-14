/**
 * 批次 11 联调测试 · 前端 UI 层
 * 覆盖：注册自动登录跳转 / 登录+刷新保持 / 路由保护 / 缓存徽标 / 历史刷新 / 多用户隔离 / 退出
 * 运行：node scripts/integration-check.mjs
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

async function waitResult(page, selector, placeholder) {
  const isDone = async () => {
    const t = await page.locator(selector).first().innerText()
    return t.length > 50 && !t.includes(placeholder) && !t.includes('AI 推演中')
  }
  const t0 = Date.now()
  while (!(await isDone()) && Date.now() - t0 < 150000) await page.waitForTimeout(1500)
  return page.locator(selector).first().innerText()
}

const HORO_SEL = 'section[aria-label="解析结果展示区"] .hud-input'
const DREAM_SEL = 'section[aria-label="解梦结果展示区"] .hud-input'

const run = async () => {
  const browser = await chromium.launch(
    resolveChromiumPath() ? { executablePath: resolveChromiumPath() } : {},
  )
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  const stamp = Date.now()
  const userA = `itA_${stamp}`
  const userB = `itB_${stamp}`
  const pwd = 'secret123'

  // ---------- 1. 注册：自动登录并跳转 ----------
  await page.goto('http://localhost:5173/register?redirect=%2Fhoroscope', { waitUntil: 'networkidle' })
  await page.fill('#username', userA)
  await page.fill('#password', pwd)
  await page.fill('#confirm', pwd)
  await page.click('button:has-text("注 册")')
  await page.waitForTimeout(3000)
  check('注册后自动登录并跳转 /horoscope', page.url().includes('/horoscope'), page.url())
  const token = await page.evaluate(() => localStorage.getItem('xingmeng_token'))
  check('注册后 token 已保存', Boolean(token), token ? `${token.slice(0, 10)}...` : 'null')

  // ---------- 2. 路由保护：未登录访问 → 登录页 ----------
  const ctx2 = await browser.newContext()
  const page2 = await ctx2.newPage()
  await page2.goto('http://localhost:5173/horoscope', { waitUntil: 'networkidle' })
  check('未登录访问 /horoscope 跳登录页', page2.url().includes('/login'), page2.url())
  check('redirect 参数保留', page2.url().includes('redirect=%2Fhoroscope'), page2.url())
  await page2.goto('http://localhost:5173/dream', { waitUntil: 'networkidle' })
  check('未登录访问 /dream 跳登录页', page2.url().includes('/login'), page2.url())

  // 用同一个新标签页登录，验证跳回原页面
  await page2.goto('http://localhost:5173/login?redirect=%2Fdream', { waitUntil: 'networkidle' })
  await page2.fill('#username', userA)
  await page2.fill('#password', pwd)
  await page2.click('button:has-text("登 录")')
  await page2.waitForTimeout(3000)
  check('登录后跳回 redirect 目标 /dream', page2.url().includes('/dream'), page2.url())
  await ctx2.close()

  // ---------- 3. 登录状态刷新保持 ----------
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  check('主页显示「你好，{用户}」', await page.locator(`text=你好，`).isVisible())
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  check('刷新后登录状态保持', await page.locator('text=你好，').isVisible())
  const tokenAfterReload = await page.evaluate(() => localStorage.getItem('xingmeng_token'))
  check('刷新后 token 仍在', tokenAfterReload === token)

  // ---------- 4. 星座分析 + 落库 + 缓存徽标 ----------
  await page.goto('http://localhost:5173/horoscope', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const fillHoro = async (focus) => {
    await page.fill('#birthDate', '1995-08-15')
    await page.fill('#birthTime', '14:30')
    await page.fill('#birthPlace', '江苏南京')
    await page.fill('#gender', '男')
    await page.selectOption('#emotionStatus', '单身')
    await page.fill('#occupation', '软件工程师')
    await page.fill('#focus', focus)
  }
  await fillHoro('事业发展方向')
  await page.click('button:has-text("立即解析")')
  const r1 = await waitResult(page, HORO_SEL, '解析结果将展示在此处')
  check('星座解析展示结果', r1.length > 50, `${r1.length} 字`)
  check('徽标「新解析完成」', await page.locator('text=新解析完成').isVisible())
  await page.waitForTimeout(2500)
  check('历史列表出现 1 条', (await page.locator('section[aria-label="最近分析"] ul li').count()) === 1)

  // 同参 → 缓存徽标
  await fillHoro('事业发展方向')
  await page.click('button:has-text("立即解析")')
  const r2 = await waitResult(page, HORO_SEL, '解析结果将展示在此处')
  check('同参结果一致', r2 === r1, `${r2.length} 字`)
  check('徽标「来自历史缓存，未消耗大模型 token」', await page.locator('text=来自历史缓存，未消耗大模型 token').isVisible())
  await page.waitForTimeout(2500)
  check('缓存命中不新增历史', (await page.locator('section[aria-label="最近分析"] ul li').count()) === 1)

  // 点击历史 → 完整结果
  await page.locator('section[aria-label="最近分析"] ul li button').first().click()
  await page.waitForTimeout(3000)
  check('点击历史展示完整结果', (await page.locator(HORO_SEL).first().innerText()).length > 50)
  check('徽标「来自历史记录」', await page.locator('text=来自历史记录').isVisible())

  // ---------- 5. 周公解梦 + 缓存 ----------
  await page.goto('http://localhost:5173/dream', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.fill('#dreamContent', '梦见在很长的走廊里奔跑，最后到天台看到满天星星')
  await page.fill('#dreamTime', '2026-10-13 02:30')
  await page.selectOption('#gender', '女')
  await page.selectOption('select[name=age]', '26-35岁')
  await page.fill('#occupation', '设计师')
  await page.fill('#recentStatus', '工作压力较大')
  await page.fill('#focus', '是否应该换工作')
  await page.click('button:has-text("立即解梦")')
  const d1 = await waitResult(page, DREAM_SEL, '解梦结果将展示在此处')
  check('周公解梦展示结果', d1.length > 50, `${d1.length} 字`)
  check('周公徽标「新解析完成」', await page.locator('text=新解析完成').isVisible())

  await page.click('button:has-text("立即解梦")')
  await waitResult(page, DREAM_SEL, '解梦结果将展示在此处')
  check('周公徽标「来自历史缓存」', await page.locator('text=来自历史缓存，未消耗大模型 token').isVisible())
  await page.waitForTimeout(2500)
  check('周公历史 1 条', (await page.locator('section[aria-label="最近解梦"] ul li').count()) === 1)

  // ---------- 6. 多用户隔离（UI 层） ----------
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
  await page.click('button:has-text("退出登录")')
  await page.waitForTimeout(2500)
  check('退出后回到「登录」入口', await page.locator('button:text-is("登录")').first().isVisible())
  const tokenAfterLogout = await page.evaluate(() => localStorage.getItem('xingmeng_token'))
  check('退出后 token 已清除', !tokenAfterLogout, String(tokenAfterLogout))

  // 退出后访问受保护页 → 跳登录
  await page.goto('http://localhost:5173/horoscope', { waitUntil: 'networkidle' })
  check('退出后访问 /horoscope 跳登录', page.url().includes('/login'), page.url())

  // 用户 B 注册，看不到 A 的历史
  await page.goto('http://localhost:5173/register?redirect=%2Fhoroscope', { waitUntil: 'networkidle' })
  await page.fill('#username', userB)
  await page.fill('#password', pwd)
  await page.fill('#confirm', pwd)
  await page.click('button:has-text("注 册")')
  await page.waitForTimeout(3000)
  await page.waitForTimeout(2500)
  const bEmpty = await page.locator('text=暂无历史分析').isVisible()
  check('用户 B 看不到 A 的历史（空态）', bEmpty)

  const ignorable = errors.filter((e) => !/favicon|404|Failed to load resource/i.test(e))
  check('无控制台报错', ignorable.length === 0, ignorable.join(' | ').slice(0, 150))

  await browser.close()
  const passed = results.filter((r) => r.ok).length
  console.log(`\n===== UI 联调结果：${passed}/${results.length} 通过 =====`)
  if (passed !== results.length) process.exitCode = 1
}

run().catch((e) => {
  console.error('联调脚本异常：', e)
  process.exitCode = 1
})
