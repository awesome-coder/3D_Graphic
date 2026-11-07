import { chromium } from 'playwright-core'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const outputDir = new URL('../screenshots/', import.meta.url)
await mkdir(outputDir, { recursive: true })
const shot = (name) => fileURLToPath(new URL(name, outputDir))

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
})

const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 1,
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
})

const errors = []
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`)
})
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))

await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.screenshot({ path: shot('hmi-edit.png') })

await page.locator('[data-node-id="ahu-fan"]').click({ position: { x: 80, y: 80 } })
await page.waitForTimeout(500)
await page.screenshot({ path: shot('hmi-selected.png') })

await page.getByRole('button', { name: '数据', exact: true }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: shot('hmi-binding.png') })

await page.locator('.connection-chip').click()
await page.waitForTimeout(400)
await page.screenshot({ path: shot('hmi-connection.png') })

await page.getByRole('button', { name: /连接数据源/ }).click()
await page.waitForTimeout(1800)
await page.screenshot({ path: shot('hmi-ws-connected.png') })
await page.getByRole('button', { name: '关闭' }).click()

await page.locator('.bottom-tabs button', { hasText: '数据源' }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: shot('hmi-datasource.png') })
await page.locator('.bottom-tabs button', { hasText: '点位监视' }).click()

await page.getByRole('button', { name: '预览', exact: true }).click()
await page.waitForTimeout(1200)
await page.screenshot({ path: shot('hmi-preview.png') })

await page.locator('.runtime-stage [data-node-id="ahu-speed-slider"] .slider-input').click({
  position: { x: 260, y: 11 },
})
await page.waitForTimeout(700)
await page.screenshot({ path: shot('hmi-preview-interaction.png') })

await page.getByRole('button', { name: /退出预览/ }).click()
await page.waitForTimeout(500)
await page.locator('.bottom-tabs button', { hasText: '点位监视' }).click()
await page.waitForTimeout(3500)
await page.getByRole('button', { name: 'B1 冷站监控' }).click()
await page.waitForTimeout(900)
await page.screenshot({ path: shot('hmi-plant.png') })

await page.setViewportSize({ width: 1440, height: 900 })
await page.waitForTimeout(900)
await page.screenshot({ path: shot('hmi-1440.png') })

console.log(JSON.stringify({ errors, title: await page.title() }, null, 2))
await browser.close()
