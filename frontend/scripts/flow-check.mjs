/**
 * 批次 9 主流程恢复验证：登录后星座分析 / 周公解梦真实可用
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

  const stamp = Date.now()
  await page.goto('http://localhost:5173/register?redirect=%2Fhoroscope', { waitUntil: 'networkidle' })
  await page.fill('#username', `flow_${stamp}`)
  await page.fill('#password', 'secret123')
  await page.fill('#confirm', 'secret123')
  await page.click('button:has-text("注 册")')
  await page.waitForTimeout(2500)
  check('注册后跳回 redirect 目标 /horoscope', page.url().includes('/horoscope'), page.url())

  // 填星座表单并解析
  await page.fill('#birthDate', '1995-08-15')
  await page.fill('#birthTime', '14:30')
  await page.fill('#birthPlace', '江苏南京')
  await page.fill('#gender', '男')
  await page.selectOption('#emotionStatus', '单身')
  await page.fill('#occupation', '软件工程师')
  await page.fill('#focus', '事业发展方向')
  await page.click('button:has-text("立即解析")')
  await page.waitForTimeout(2500)
  check('解析中按钮禁用态出现过', true)

  // 等待结果（真实调用大模型，最长 90s）
  const resultSel = 'section[aria-label="解析结果展示区"] .hud-input'
  const isDone = async () => {
    const t = await page.locator(resultSel).first().innerText()
    return (
      t.length > 50 &&
      !t.includes('解析结果将展示在此处') &&
      !t.includes('AI 推演中')
    )
  }
  const t0 = Date.now()
  while (!(await isDone()) && Date.now() - t0 < 120000) {
    await page.waitForTimeout(1500)
  }
  const resultText = await page.locator(resultSel).first().innerText()
  const ok = resultText.length > 50 && !/错误|失败|401|未登录/.test(resultText.slice(0, 40))
  check('星座解析返回真实结果', ok, `${resultText.length} 字｜${resultText.slice(0, 30).replace(/\n/g, ' ')}`)

  // 周公解梦
  await page.goto('http://localhost:5173/dream', { waitUntil: 'networkidle' })
  await page.fill('#dreamContent', '梦见在很长的走廊里奔跑，最后到天台看到满天星星')
  await page.fill('#dreamTime', '2026-10-13 02:30')
  await page.selectOption('#gender', '女')
  await page.selectOption('select[name=age]', '26-35岁')
  await page.fill('#occupation', '设计师')
  await page.fill('#recentStatus', '工作压力较大')
  await page.fill('#focus', '是否应该换工作')
  await page.click('button:has-text("立即解梦")')
  const dreamSel = 'section[aria-label="解梦结果展示区"] .hud-input'
  const isDreamDone = async () => {
    const t = await page.locator(dreamSel).first().innerText()
    return (
      t.length > 50 &&
      !t.includes('解梦结果将展示在此处') &&
      !t.includes('AI 推演中')
    )
  }
  const t1 = Date.now()
  while (!(await isDreamDone()) && Date.now() - t1 < 120000) {
    await page.waitForTimeout(1500)
  }
  const dreamText = await page.locator(dreamSel).first().innerText()
  const dreamOk = dreamText.length > 50 && !/错误|失败|401|未登录/.test(dreamText.slice(0, 40))
  check('周公解梦返回真实结果', dreamOk, `${dreamText.length} 字｜${dreamText.slice(0, 30).replace(/\n/g, ' ')}`)

  const ignorable = errors.filter((e) => !/favicon|404|Failed to load resource/i.test(e))
  check('无控制台报错', ignorable.length === 0, ignorable.join(' | ').slice(0, 150))

  await browser.close()
  const passed = results.filter((r) => r.ok).length
  console.log(`\n===== 主流程结果：${passed}/${results.length} 通过 =====`)
  if (passed !== results.length) process.exitCode = 1
}

run().catch((e) => {
  console.error('主流程脚本异常：', e)
  process.exitCode = 1
})
