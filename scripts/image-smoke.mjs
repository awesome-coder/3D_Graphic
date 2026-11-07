import { chromium } from 'playwright-core'
import { fileURLToPath } from 'node:url'

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
})
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, locale: 'zh-CN' })
const errors = []
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})
page.on('pageerror', (error) => errors.push(error.message))
const shot = (name) => fileURLToPath(new URL(`../screenshots/${name}`, import.meta.url))
const check = (value, message) => {
  if (!value) throw new Error(message)
}

try {
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' })
  await page.locator('.canvas-viewport .graph-node').first().waitFor()
  await page.waitForTimeout(800)

  await page.locator('.component-card', { hasText: '状态图片' }).click()
  await page.waitForTimeout(500)
  const nodeId = await page.locator('.canvas-viewport .graph-node.is-selected').getAttribute('data-node-id')
  check(nodeId, 'image node should be selected after creation')
  check(
    await page.getByText('图片状态映射', { exact: true }).isVisible(),
    'image mapping editor should be visible',
  )
  check((await page.locator('.image-rule').count()) === 1, 'unbound image should have one state')

  await page
    .locator('.image-rule input[type=file]')
    .first()
    .setInputFiles(fileURLToPath(new URL('./fixtures/fan-on.png', import.meta.url)))
  await page.waitForTimeout(600)
  check((await page.locator('.image-upload-tile img').count()) === 1, 'default image should be uploaded')
  await page.screenshot({ path: shot('hmi-image-upload.png') })

  // Bind a boolean point and upload both states.
  await page.getByRole('button', { name: '数据', exact: true }).click()
  await page.locator('.point-select-trigger').click()
  await page.locator('.point-search input').fill('p-unit-running')
  await page.locator('.point-dropdown-list > button').first().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: '属性', exact: true }).click()
  await page.waitForTimeout(300)
  check((await page.locator('.image-rule').count()) === 2, 'boolean point should create two image states')
  const inputs = page.locator('.image-rule input[type=file]')
  await inputs.nth(0).setInputFiles(fileURLToPath(new URL('./fixtures/fan-on.png', import.meta.url)))
  await page.waitForTimeout(500)
  await page.locator('.image-rule input[type=file]').nth(1).setInputFiles(
    fileURLToPath(new URL('./fixtures/fan-off.png', import.meta.url)),
  )
  await page.waitForTimeout(600)
  check((await page.locator('.image-upload-tile img').count()) === 2, 'both boolean images should be uploaded')
  await page.screenshot({ path: shot('hmi-image-bool.png') })

  await page.getByRole('button', { name: '预览', exact: true }).click()
  await page.waitForTimeout(800)
  const previewImage = page.locator(`.runtime-stage [data-node-id="${nodeId}"] img`)
  const runningSrc = await previewImage.getAttribute('src')
  await page.locator('.runtime-stage [data-node-id="ahu-stop-button"]').click()
  await page.waitForTimeout(700)
  const stoppedSrc = await previewImage.getAttribute('src')
  check(runningSrc && stoppedSrc && runningSrc !== stoppedSrc, 'boolean point should swap image assets')
  await page.screenshot({ path: shot('hmi-image-preview.png') })
  await page.locator('.runtime-stage [data-node-id="ahu-start-button"]').click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /退出预览/ }).click()
  await page.waitForTimeout(500)

  // Numeric mapping should create ranges.
  await page.locator(`.canvas-viewport [data-node-id="${nodeId}"]`).click({ position: { x: 80, y: 70 } })
  await page.getByRole('button', { name: '数据', exact: true }).click()
  await page.locator('.point-select-trigger').click()
  await page.locator('.point-search input').fill('p-supply-temp')
  await page.locator('.point-dropdown-list > button').first().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: '属性', exact: true }).click()
  await page.waitForTimeout(300)
  check((await page.locator('.image-rule').count()) === 3, 'numeric point should create range states')
  check((await page.locator('.image-range-inputs').count()) === 3, 'numeric states should expose range inputs')

  // Enum mapping should create one state per option.
  await page.getByRole('button', { name: '数据', exact: true }).click()
  await page.locator('.point-select-trigger').click()
  await page.locator('.point-search input').fill('p-mode')
  await page.locator('.point-dropdown-list > button').first().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: '属性', exact: true }).click()
  await page.waitForTimeout(300)
  check((await page.locator('.image-rule').count()) === 3, 'enum point should create one image per value')

  // Removing the binding returns to one default image.
  await page.getByRole('button', { name: '数据', exact: true }).click()
  await page.locator('.point-clear').click()
  await page.getByRole('button', { name: '属性', exact: true }).click()
  await page.waitForTimeout(300)
  check((await page.locator('.image-rule').count()) === 1, 'unbound image should return to one state')

  check(errors.length === 0, `console errors: ${errors.join(' | ')}`)
  console.log(JSON.stringify({ ok: true, nodeId, errors }, null, 2))
} catch (error) {
  console.error('IMAGE TEST FAILED:', error.message)
  console.error(JSON.stringify({ errors }, null, 2))
  await page.screenshot({ path: shot('image-test-failure.png') }).catch(() => {})
  process.exitCode = 1
} finally {
  await browser.close()
}
