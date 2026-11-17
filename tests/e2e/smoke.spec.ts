import { expect, Page, test } from '@playwright/test'
import { collectPageErrors, expectNoHorizontalOverflow, gotoSmokeRoute } from './helpers'

async function expectLanding(page: Page) {
  await expect(page.getByRole('heading', { level: 1, name: /Six AI specialists/ })).toBeVisible()
  await expect(page.locator('#landing-identifier')).toBeVisible()
}

test.describe('Zenquanta public smoke', () => {
  test('landing page opens on the sign-up form', async ({ page }) => {
    const pageErrors = collectPageErrors(page)

    await gotoSmokeRoute(page, '/')

    await expectLanding(page)
    await expect(page.getByPlaceholder('e.g. sam.rivera')).toBeVisible()
    await expect(page.getByPlaceholder('At least 8 characters')).toBeVisible()
    await expect(page.getByPlaceholder('Type it once more')).toBeVisible()
    expect(pageErrors).toEqual([])
  })

  test('landing form switches to sign-in', async ({ page }) => {
    const pageErrors = collectPageErrors(page)

    await gotoSmokeRoute(page, '/')
    await page.locator('#landing-identifier').scrollIntoViewIfNeeded()
    await page.locator('button[aria-pressed]', { hasText: 'Sign in' }).click()

    await expect(page.getByPlaceholder('Enter your ID')).toBeVisible()
    await expect(page.getByPlaceholder('Enter your password')).toBeVisible()
    await expect(page.getByPlaceholder('Type it once more')).toHaveCount(0)
    expect(pageErrors).toEqual([])
  })

  for (const path of ['/dashboard', '/knowledge', '/admin']) {
    test(`${path} sends signed-out visitors to the landing page`, async ({ page }) => {
      const pageErrors = collectPageErrors(page)

      await gotoSmokeRoute(page, path)

      await expect(page).toHaveURL('/')
      await expectLanding(page)
      expect(pageErrors).toEqual([])
    })
  }

  const staticPages = [
    { path: '/terms', title: 'Terms of Service' },
    { path: '/privacy', title: 'Privacy Policy' },
    { path: '/docs/cli', title: 'zq: Forge in your terminal' },
  ]

  for (const staticPage of staticPages) {
    test(`${staticPage.path} renders`, async ({ page }) => {
      const pageErrors = collectPageErrors(page)

      await gotoSmokeRoute(page, staticPage.path)

      await expect(page.getByRole('heading', { level: 1, name: staticPage.title })).toBeVisible()
      expect(pageErrors).toEqual([])
    })
  }

  test('zq login page asks signed-out visitors to sign in', async ({ page }) => {
    const pageErrors = collectPageErrors(page)

    await gotoSmokeRoute(page, '/cli/authorize?code=ABCD-EFGH')

    await expect(page.getByRole('heading', { level: 1, name: 'Sign in to zq' })).toBeVisible()
    await expect(page.getByPlaceholder('Zenquanta ID')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Privacy Policy' })).toBeVisible()
    expect(pageErrors).toEqual([])
  })

  const assistantPages = [
    {
      path: '/nova',
      name: 'Nova',
      badge: 'General intelligence',
      headline: 'Nova keeps broad work clear, useful, and fast-moving.',
    },
    {
      path: '/velora',
      name: 'Velora',
      badge: 'Creative engine',
      headline: 'Velora is built for taste, tone, and original direction.',
    },
    {
      path: '/axiom',
      name: 'Axiom',
      badge: 'Reasoning engine',
      headline: 'Axiom is for decisions that need structure, not guesswork.',
    },
    {
      path: '/forge',
      name: 'Forge',
      badge: 'Technical engine',
      headline: 'Forge focuses on implementation, debugging, and shipping.',
    },
    {
      path: '/pulse',
      name: 'Pulse',
      badge: 'Current-context engine',
      headline: 'Pulse is tuned for fast-moving context and live-style synthesis.',
    },
    {
      path: '/prism',
      name: 'Prism',
      badge: 'Visual engine',
      headline: 'Prism turns creative direction into polished visual output.',
    },
  ]

  for (const assistant of assistantPages) {
    test(`${assistant.path} renders the public ${assistant.name} assistant page`, async ({
      page,
    }) => {
      const pageErrors = collectPageErrors(page)

      await gotoSmokeRoute(page, assistant.path)

      await expect(page.getByText(assistant.badge)).toBeVisible()
      await expect(
        page.getByRole('heading', { level: 1, name: assistant.headline })
      ).toBeVisible()
      await expect(
        page.getByRole('link', { name: `Open ${assistant.name}` })
      ).toBeVisible()
      expect(pageErrors).toEqual([])
    })
  }

  test.describe('phone width', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    for (const path of ['/', '/pricing', '/terms', '/privacy', '/docs/cli', '/forge']) {
      test(`${path} has no sideways scroll at 390 px`, async ({ page }) => {
        await gotoSmokeRoute(page, path)
        await expectNoHorizontalOverflow(page)
      })
    }
  })
})
