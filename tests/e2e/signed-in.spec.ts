import { BrowserContextOptions, expect, test } from '@playwright/test'
import { collectPageErrors, expectNoHorizontalOverflow, gotoSmokeRoute } from './helpers'

const loginId = process.env.SMOKE_LOGIN_ID
const password = process.env.SMOKE_PASSWORD
// Sending a chat costs a fraction of a cent, so it only runs when asked for.
const sendChat = process.env.SMOKE_CHAT === '1'

type StorageState = Exclude<BrowserContextOptions['storageState'], string | undefined>

test.describe('Zenquanta signed-in smoke', () => {
  test.skip(!loginId || !password, 'Set SMOKE_LOGIN_ID and SMOKE_PASSWORD to run')
  test.describe.configure({ mode: 'serial' })

  let storageState: StorageState

  // One sign-in for the whole file keeps clear of the sign-in rate limit.
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(90_000)
    const context = await browser.newContext()
    const page = await context.newPage()
    await gotoSmokeRoute(page, '/')
    await page.locator('#landing-identifier').scrollIntoViewIfNeeded()
    await page.locator('button[aria-pressed]', { hasText: 'Sign in' }).click()
    await page.getByPlaceholder('Enter your ID').fill(loginId!)
    await page.getByPlaceholder('Enter your password').fill(password!)
    await page.locator('form').getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('textbox', { name: 'Message' })).toBeVisible({ timeout: 30_000 })
    // A new account gets the first-run setup dialog. Skip it the way its button does, so later tests start clean.
    const skipped = await page.request.post('/api/onboarding', { data: { action: 'skip' } })
    expect(skipped.ok()).toBe(true)
    storageState = await context.storageState()
    await context.close()
  })

  const viewports = [
    { label: 'desktop', width: 1280, height: 800 },
    { label: 'phone', width: 390, height: 844 },
  ]

  for (const viewport of viewports) {
    test(`workspace loads the composer (${viewport.label})`, async ({ browser }) => {
      const context = await browser.newContext({ storageState, viewport })
      const page = await context.newPage()
      const pageErrors = collectPageErrors(page)

      await gotoSmokeRoute(page, '/')

      await expect(page.getByRole('textbox', { name: 'Message' })).toBeVisible({ timeout: 30_000 })
      await expectNoHorizontalOverflow(page)
      expect(pageErrors).toEqual([])
      await context.close()
    })

    for (const path of ['/dashboard', '/pricing', '/knowledge']) {
      test(`${path} renders signed in (${viewport.label})`, async ({ browser }) => {
        const context = await browser.newContext({ storageState, viewport })
        const page = await context.newPage()
        const pageErrors = collectPageErrors(page)

        await gotoSmokeRoute(page, path)

        await expect(page).toHaveURL(path)
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
        await expectNoHorizontalOverflow(page)
        expect(pageErrors).toEqual([])
        await context.close()
      })
    }
  }

  test('a short chat gets a streamed reply', async ({ browser }) => {
    test.skip(!sendChat, 'Set SMOKE_CHAT=1 to send a real message')
    test.setTimeout(120_000)
    const context = await browser.newContext({ storageState })
    const page = await context.newPage()
    const pageErrors = collectPageErrors(page)

    await gotoSmokeRoute(page, '/')
    const composer = page.getByRole('textbox', { name: 'Message' })
    await expect(composer).toBeVisible({ timeout: 30_000 })
    await composer.fill('Reply with the single word pong and nothing else.')
    await page.getByRole('button', { name: 'Send message' }).click()

    await expect(page).toHaveURL(/\/c\//, { timeout: 30_000 })
    await expect(page.getByText(/pong/i).last()).toBeVisible({ timeout: 90_000 })
    expect(pageErrors).toEqual([])
    await context.close()
  })
})
