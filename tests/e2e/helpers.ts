import { expect, Page } from '@playwright/test'

export function collectPageErrors(page: Page): string[] {
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

export async function gotoSmokeRoute(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
}

export async function expectNoHorizontalOverflow(page: Page) {
  await page.waitForLoadState('load')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  expect(overflow, 'page scrolls sideways').toBeLessThanOrEqual(1)
}
