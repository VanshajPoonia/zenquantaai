import { expect, Page, test } from '@playwright/test'

function collectPageErrors(page: Page): string[] {
  const errors: string[] = []

  page.on('console', (message) => {
    const text = message.text()
    if (
      message.type() === 'error' &&
      !text.startsWith('Failed to load resource:')
    ) {
      errors.push(text)
    }
  })

  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  return errors
}

async function expectAuthGate(page: Page) {
  await expect(
    page.getByRole('heading', { name: 'Sign in to your workspace' })
  ).toBeVisible()
  await expect(page.getByPlaceholder('Enter your ID')).toBeVisible()
  await expect(page.getByPlaceholder('Enter your password')).toBeVisible()
}

async function gotoSmokeRoute(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
}

test.describe('Zenquanta smoke routes', () => {
  test('landing route loads the unauthenticated auth gate', async ({ page }) => {
    const pageErrors = collectPageErrors(page)

    await gotoSmokeRoute(page, '/')

    await expectAuthGate(page)
    expect(pageErrors).toEqual([])
  })

  test('sign-in form renders on the auth gate', async ({ page }) => {
    const pageErrors = collectPageErrors(page)

    await gotoSmokeRoute(page, '/')

    await expect(page.getByPlaceholder('Enter your ID')).toBeVisible()
    await expect(page.getByPlaceholder('Enter your password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' }).first()).toBeVisible()
    expect(pageErrors).toEqual([])
  })

  test('sign-up form renders from the auth gate', async ({ page }) => {
    const pageErrors = collectPageErrors(page)

    await gotoSmokeRoute(page, '/')
    await page.getByRole('button', { name: 'Create account' }).first().click()

    await expect(page.getByPlaceholder('Choose your ID')).toBeVisible()
    await expect(page.getByPlaceholder('Create a password')).toBeVisible()
    await expect(page.getByPlaceholder('Confirm your password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create account' }).last()).toBeVisible()
    expect(pageErrors).toEqual([])
  })

  test('dashboard protects unauthenticated users', async ({ page }) => {
    const pageErrors = collectPageErrors(page)

    await gotoSmokeRoute(page, '/dashboard')

    await expect(page).toHaveURL('/')
    await expectAuthGate(page)
    expect(pageErrors).toEqual([])
  })

  test('pricing protects unauthenticated users', async ({ page }) => {
    const pageErrors = collectPageErrors(page)

    await gotoSmokeRoute(page, '/pricing')

    await expect(page).toHaveURL('/')
    await expectAuthGate(page)
    expect(pageErrors).toEqual([])
  })

  test('admin blocks users without an authenticated admin session', async ({ page }) => {
    const pageErrors = collectPageErrors(page)

    await gotoSmokeRoute(page, '/admin')

    await expect(page).toHaveURL('/')
    await expectAuthGate(page)
    expect(pageErrors).toEqual([])
  })

  const assistantPages = [
    { path: '/nova', name: 'Nova' },
    { path: '/velora', name: 'Velora' },
    { path: '/axiom', name: 'Axiom' },
    { path: '/forge', name: 'Forge' },
    { path: '/pulse', name: 'Pulse' },
    { path: '/prism', name: 'Prism' },
  ]

  for (const assistant of assistantPages) {
    test(`${assistant.path} renders the public ${assistant.name} assistant page`, async ({
      page,
    }) => {
      const pageErrors = collectPageErrors(page)

      await gotoSmokeRoute(page, assistant.path)

      await expect(
        page.getByRole('heading', { name: assistant.name })
      ).toBeVisible()
      await expect(page.getByText('Zenquanta assistant')).toBeVisible()
      await expect(
        page.getByRole('link', { name: /Open Zenquanta/i })
      ).toBeVisible()
      expect(pageErrors).toEqual([])
    })
  }
})
