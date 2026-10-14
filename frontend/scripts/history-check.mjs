/**
 * 批次 10 自检：历史记录列表 + 缓存命中提示 + 点击查看完整结果
 * 运行：node scripts/history-check.mjs
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

/** 等结果区出现真实结果（排除占位与 loading） */
async function waitResult(page, selector, placeholder) {
  const isDone = async () => {
    const t = await page.locator(selector).first().innerText()
    return (
      t.length > 50 && !t.includes(placeholder) && !t.includes('AI 推演中')
    )
  }
  const t0 = Date.now()
  while (!(await isDone()) && Date.now() - t0 < 120000) {
    await page.waitForTimeout(1500)
  }
  return page.locator(selector).first().innerText()
}

const run = async () => {
  const browser = await chromium.launch(
    resolveChromiumPath() ? { executablePath: resolveChromiumPath() } : {},
  )
  const page = await browser.newContext().then((c) => c.newPage())
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  const stamp = Date.now()
  const username = `hist_${stamp}`

  // ---------- 注册并进入星座页 ----------
  await page.goto('http://localhost:5173/register?redirect=%2Fhoroscope', {
    waitUntil: 'networkidle',
  })
  await page.fill('#username', username)
  await page.fill('#password', 'secret123')
  await page.fill('#confirm', 'secret123')
  await page.click('button:has-text("注 册")')
  await page.waitForTimeout(2500)
  check('注册后落在星座页', page.url().includes('/horoscope'), page.url())

  // ---------- 空状态 ----------
  await page.waitForTimeout(2500)
  check('新用户历史区显示空态「暂无历史分析」', await page.locator('text=暂无历史分析').isVisible())
  check('历史区标题「最近分析」', await page.locator('section[aria-label="最近分析"]').isVisible())

  // ---------- 首次解析 → 徽标「新解析完成」 ----------
  const fillHoroscope = async (focus) => {
    await page.fill('#birthDate', '1995-08-15')
    await page.fill('#birthTime', '14:30')
    await page.fill('#birthPlace', '江苏南京')
    await page.fill('#gender', '男')
    await page.selectOption('#emotionStatus', '单身')
    await page.fill('#occupation', '软件工程师')
    await page.fill('#focus', focus)
    await page.click('button:has-text("立即解析")')
  }
  await fillHoroscope('事业发展方向')
  const r1 = await waitResult(page, 'section[aria-label="解析结果展示区"] .hud-input', '解析结果将展示在此处')
  check('首次解析返回结果', r1.length > 50, `${r1.length} 字`)
  check('徽标显示「新解析完成」', await page.locator('text=新解析完成').isVisible())

  // ---------- 历史列表出现 1 条 ----------
  await page.waitForTimeout(2500)
  const itemCount1 = await page.locator('section[aria-label="最近分析"] ul li').count()
  check('历史列表出现 1 条', itemCount1 === 1, `实际 ${itemCount1} 条`)
  check('历史条目含时间', await page.locator('section[aria-label="最近分析"] ul li').first().innerText().then((t) => /20\d{2}/.test(t)))
  check('历史条目含输入摘要', await page.locator('section[aria-label="最近分析"] ul li').first().innerText().then((t) => t.includes('江苏南京')))
  check('历史条目含结果预览', await page.locator('section[aria-label="最近分析"] ul li').first().innerText().then((t) => t.includes('核心性格') || t.includes('###')))

  // ---------- 同参再解析 → 徽标「来自历史缓存」 ----------
  await fillHoroscope('事业发展方向')
  const r2 = await waitResult(page, 'section[aria-label="解析结果展示区"] .hud-input', '解析结果将展示在此处')
  check('同参解析返回结果', r2.length > 50, `${r2.length} 字`)
  check(
    '徽标显示「来自历史缓存，未消耗大模型 token」',
    await page.locator('text=来自历史缓存，未消耗大模型 token').isVisible(),
  )
  await page.waitForTimeout(2500)
  const itemCount2 = await page.locator('section[aria-label="最近分析"] ul li').count()
  check('同参缓存不新增历史（仍 1 条）', itemCount2 === 1, `实际 ${itemCount2} 条`)

  // ---------- 点击历史 → 完整结果 + 徽标「来自历史记录」 ----------
  await page.locator('section[aria-label="最近分析"] ul li button').first().click()
  await page.waitForTimeout(2500)
  const r3 = await page.locator('section[aria-label="解析结果展示区"] .hud-input').first().innerText()
  check('点击历史显示完整结果', r3.length > 50, `${r3.length} 字`)
  check('徽标显示「来自历史记录」', await page.locator('text=来自历史记录').isVisible())

  // ---------- 解析 5 条不同内容 → 历史最多 5 条 ----------
  for (let i = 2; i <= 6; i++) {
    await fillHoroscope(`事业发展方向-${i}`)
    await waitResult(page, 'section[aria-label="解析结果展示区"] .hud-input', '解析结果将展示在此处')
  }
  await page.waitForTimeout(2500)
  const itemCount3 = await page.locator('section[aria-label="最近分析"] ul li').count()
  check('6 条不同内容后历史最多 5 条', itemCount3 === 5, `实际 ${itemCount3} 条`)

  // ---------- 周公页 ----------
  await page.goto('http://localhost:5173/dream', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  check('周公页历史区标题「最近解梦」', await page.locator('section[aria-label="最近解梦"]').isVisible())
  check('周公页空态「暂无历史解梦」', await page.locator('text=暂无历史解梦').isVisible())

  await page.fill('#dreamContent', '梦见在很长的走廊里奔跑，最后到天台看到满天星星')
  await page.fill('#dreamTime', '2026-10-13 02:30')
  await page.selectOption('#gender', '女')
  await page.selectOption('select[name=age]', '26-35岁')
  await page.fill('#occupation', '设计师')
  await page.fill('#recentStatus', '工作压力较大')
  await page.fill('#focus', '是否应该换工作')
  await page.click('button:has-text("立即解梦")')
  const d1 = await waitResult(page, 'section[aria-label="解梦结果展示区"] .hud-input', '解梦结果将展示在此处')
  check('周公解梦返回结果', d1.length > 50, `${d1.length} 字`)
  check('周公页徽标「新解析完成」', await page.locator('text=新解析完成').isVisible())

  await page.waitForTimeout(2500)
  const dreamCount = await page.locator('section[aria-label="最近解梦"] ul li').count()
  check('周公历史列表出现 1 条', dreamCount === 1, `实际 ${dreamCount} 条`)

  // 周公同参缓存
  await page.click('button:has-text("立即解梦")')
  await waitResult(page, 'section[aria-label="解梦结果展示区"] .hud-input', '解梦结果将展示在此处')
  check(
    '周公页徽标「来自历史缓存」',
    await page.locator('text=来自历史缓存，未消耗大模型 token').isVisible(),
  )

  // 周公点击历史
  await page.locator('section[aria-label="最近解梦"] ul li button').first().click()
  await page.waitForTimeout(2500)
  const d2 = await page.locator('section[aria-label="解梦结果展示区"] .hud-input').first().innerText()
  check('周公点击历史显示完整结果', d2.length > 50, `${d2.length} 字`)
  check('周公页徽标「来自历史记录」', await page.locator('text=来自历史记录').isVisible())

  // ---------- 表单字段回归 ----------
  await page.goto('http://localhost:5173/horoscope', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  check('星座页表单字段齐全', (await page.locator('.hud-input').count()) >= 8)
  check('星座页「立即解析」按钮在', await page.locator('button:has-text("立即解析")').isVisible())
  check('星座页 hud-card 视觉保留', await page.locator('.hud-card').first().isVisible())
  check('星座页 bg-panel bg-grid 保留', await page.locator('main.bg-panel.bg-grid').isVisible())

  const ignorable = errors.filter((e) => !/favicon|404|Failed to load resource/i.test(e))
  check('无控制台报错', ignorable.length === 0, ignorable.join(' | ').slice(0, 150))

  await browser.close()
  const passed = results.filter((r) => r.ok).length
  console.log(`\n===== 自检结果：${passed}/${results.length} 通过 =====`)
  if (passed !== results.length) process.exitCode = 1
}

run().catch((e) => {
  console.error('自检脚本异常：', e)
  process.exitCode = 1
})
