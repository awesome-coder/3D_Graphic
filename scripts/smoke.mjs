import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
})

const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
  acceptDownloads: true,
})
const page = await context.newPage()
const errors = []
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`)
})
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))

const check = (condition, message) => {
  if (!condition) throw new Error(message)
}
const nodeCount = () => page.locator('.canvas-viewport .graph-node').count()

try {
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' })
  await page.locator('.canvas-viewport .graph-node').first().waitFor()
  await page.waitForTimeout(900)

  check((await page.title()).includes('AERON HMI'), 'page title should identify HMI studio')
  check((await nodeCount()) >= 20, 'seed page should contain generic HMI widgets')
  check((await page.locator('.node-port').count()) === 0, 'connection ports must not be rendered')
  check((await page.locator('.edge-layer').count()) === 0, 'connection layer must not be rendered')
  check((await page.locator('.canvas-toolbar').textContent())?.includes('组件'), 'toolbar should report components')

  // Panel layering: selecting a panel must not cover its children.
  await page.locator('[data-node-id="ahu-panel-overview"]').click({ position: { x: 320, y: 17 } })
  await page.waitForTimeout(250)
  check(
    (await page.locator('.inspector-panel .selection-titles h2').textContent())?.includes('机组运行总览'),
    'clicking a panel header should select it',
  )
  check(
    await page.locator('[data-node-id="ahu-fan"] .fan-widget').isVisible(),
    'selecting a panel must not hide child widgets',
  )
  const hitNode = await page.evaluate(() => {
    const fan = document.querySelector('[data-node-id="ahu-fan"]')
    if (!fan) return null
    const rect = fan.getBoundingClientRect()
    const element = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
    return element?.closest('[data-node-id]')?.getAttribute('data-node-id') ?? null
  })
  check(hitNode === 'ahu-fan', 'selected panel must stay behind child widgets in the hit stack')

  // Drag a new generic component from the library.
  const initialCount = await nodeCount()
  await page
    .locator('.component-card', { hasText: '按钮' })
    .dragTo(page.locator('.canvas-viewport'), { targetPosition: { x: 760, y: 610 } })
  await page.waitForTimeout(400)
  check((await nodeCount()) === initialCount + 1, 'HTML5 drag should add a component')
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(350)
  check((await nodeCount()) === initialCount, 'undo should remove the new component')

  // Verify an existing data binding and its live value.
  await page.locator('[data-node-id="ahu-supply-temp"]').click({ position: { x: 70, y: 55 } })
  await page.getByRole('button', { name: '数据', exact: true }).click()
  await page.waitForTimeout(300)
  check(
    (await page.locator('.binding-card').textContent())?.includes('送风温度'),
    'value widget should expose its bound point',
  )
  check(
    (await page.locator('.point-select-trigger').textContent())?.includes('p-supply-temp'),
    'point picker should show the bound point id',
  )

  // Connect to the real mock WebSocket server.
  await page.locator('.connection-chip').click()
  await page.locator('.connection-modal').waitFor()
  await page.getByRole('button', { name: /连接数据源/ }).click()
  await page.waitForTimeout(1100)
  check(
    (await page.locator('.connection-chip').getAttribute('class'))?.includes('is-connected'),
    'connection chip should enter connected state',
  )
  check(
    (await page.locator('.connection-status-hero').textContent())?.includes('实时连接正常'),
    'connection modal should report live connection',
  )
  const messageCountText = await page.locator('.connection-hero-meta').textContent()
  check(Number.parseInt(messageCountText ?? '0', 10) > 0, 'server snapshot should be received')
  await page.getByRole('button', { name: '关闭' }).click()

  // Confirm incoming WebSocket pushes update the renderer.
  const co2Row = page.locator('[data-point-row="p-zone-co2"] .point-table-value')
  const beforeValue = await co2Row.textContent()
  await page.waitForTimeout(3400)
  const afterValue = await co2Row.textContent()
  check(beforeValue !== afterValue, `WebSocket values should change (${beforeValue} -> ${afterValue})`)

  // Preview interactions: button, switch, slider and dropdown all write back.
  await page.getByRole('button', { name: '预览', exact: true }).click()
  await page.locator('.runtime-stage').waitFor()
  await page.waitForTimeout(900)

  await page.locator('.runtime-stage [data-node-id="ahu-stop-button"]').click()
  await page.waitForTimeout(500)
  check(
    (await page.locator('.runtime-stage [data-node-id="ahu-fan"] .fan-state').textContent())?.includes('STOPPED'),
    'clicking stop should update the bound fan state',
  )

  await page.locator('.runtime-stage [data-node-id="ahu-start-button"]').click()
  await page.waitForTimeout(300)
  await page.locator('.runtime-stage [data-node-id="ahu-switch"]').click()
  await page.waitForTimeout(300)

  await page.locator('.runtime-stage [data-node-id="ahu-speed-slider"] .slider-input').click({
    position: { x: 250, y: 11 },
  })
  await page.waitForTimeout(400)

  await page.locator('.runtime-stage [data-node-id="ahu-mode-select"] select').selectOption('manual')
  await page.waitForTimeout(500)

  await page.getByRole('button', { name: /退出预览/ }).click()
  await page.waitForTimeout(500)

  await page.getByRole('button', { name: /写入记录/ }).click()
  await page.waitForTimeout(300)
  const writeRows = await page.locator('.write-table-row').count()
  check(writeRows >= 4, `expected at least 4 write entries, got ${writeRows}`)
  check(
    (await page.locator('.write-transport').first().textContent())?.includes('WebSocket'),
    'preview writes should be sent over WebSocket',
  )
  check(
    (await page.locator('.write-table-body').textContent())?.includes('运行模式'),
    'dropdown write should be recorded',
  )

  // New page, add a component there, then undo both actions.
  await page.getByRole('button', { name: '新建组态页面' }).click()
  await page.waitForTimeout(500)
  check(
    (await page.locator('.page-tab', { hasText: '新页面 3' }).count()) === 1,
    'new page should be created',
  )
  check(await page.locator('.canvas-empty-state').isVisible(), 'new page should show empty state')
  await page.locator('.component-card', { hasText: '数值显示' }).click()
  await page.waitForTimeout(400)
  check((await nodeCount()) === 1, 'new page should accept a component')
  const canvasBox = await page.locator('.canvas-viewport').boundingBox()
  const nodeBox = await page.locator('.canvas-viewport .graph-node').first().boundingBox()
  check(
    Boolean(canvasBox && nodeBox) &&
      nodeBox.x >= canvasBox.x &&
      nodeBox.y >= canvasBox.y &&
      nodeBox.x + nodeBox.width <= canvasBox.x + canvasBox.width &&
      nodeBox.y + nodeBox.height <= canvasBox.y + canvasBox.height,
    'first component on an empty page should be placed inside the viewport',
  )
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(300)
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(350)
  check(
    (await page.locator('.page-tab', { hasText: '新页面 3' }).count()) === 0,
    'undo should remove the new page',
  )

  // Persistence and export.
  await page.getByRole('button', { name: '立即保存' }).click()
  await page.waitForTimeout(450)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check((await nodeCount()) >= 20, 'saved project should survive reload')
  await page.getByRole('button', { name: '项目菜单' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /导出项目 JSON/ }).click(),
  ])
  check(download.suggestedFilename().endsWith('.json'), 'export should download a JSON project')

  check(errors.length === 0, `browser errors: ${errors.join(' | ')}`)
  console.log(
    JSON.stringify(
      {
        ok: true,
        nodes: await nodeCount(),
        writes: writeRows,
        wsMessageSample: afterValue,
        download: download.suggestedFilename(),
        errors,
      },
      null,
      2,
    ),
  )
} catch (error) {
  console.error('SMOKE FAILED:', error.message)
  console.error(JSON.stringify({ errors }, null, 2))
  await page.screenshot({ path: 'screenshots/smoke-failure.png' }).catch(() => {})
  process.exitCode = 1
} finally {
  await browser.close()
}
