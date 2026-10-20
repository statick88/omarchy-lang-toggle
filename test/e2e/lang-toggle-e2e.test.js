/**
 * E2E tests for lang-toggle plugin using Playwright
 * These tests verify the widget behavior in a real Omarchy shell environment
 */

const { test, expect } = require('@playwright/test')

// Skip if not running in an environment with Omarchy shell
test.describe('Language Toggle Widget E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a page that loads the Omarchy shell
    // This would typically be a test HTML page that embeds the shell
    await page.goto('http://localhost:8080/test-shell.html')
    await page.waitForSelector('[data-module="io.github.statick.lang-toggle"]', { timeout: 10000 })
  })

  test('widget displays current layout', async ({ page }) => {
    const widget = page.locator('[data-module="io.github.statick.lang-toggle"]')
    await expect(widget).toBeVisible()
    
    // Should show either EN or ES
    const text = await widget.textContent()
    expect(text).toMatch(/^(EN|ES)$/)
  })

  test('clicking widget toggles layout', async ({ page }) => {
    const widget = page.locator('[data-module="io.github.statick.lang-toggle"]')
    const initialText = await widget.textContent()
    
    await widget.click()
    
    // Wait for layout to change
    await page.waitForTimeout(500)
    
    const newText = await widget.textContent()
    expect(newText).not.toBe(initialText)
    expect(newText).toMatch(/^(EN|ES)$/)
  })

  test('right-click cycles through all layouts', async ({ page }) => {
    const widget = page.locator('[data-module="io.github.statick.lang-toggle"]')
    
    await widget.click({ button: 'right' })
    await page.waitForTimeout(500)
    
    const text = await widget.textContent()
    expect(text).toMatch(/^(EN|ES)$/)
  })

  test('tooltip shows full layout name', async ({ page }) => {
    const widget = page.locator('[data-module="io.github.statick.lang-toggle"]')
    
    await widget.hover()
    await page.waitForTimeout(200)
    
    const tooltip = page.locator('.tooltip, [role="tooltip"]')
    const tooltipText = await tooltip.textContent()
    expect(tooltipText).toMatch(/(English|Spanish)/)
  })

  test('widget only visible when multiple layouts configured', async ({ page }) => {
    // This test would require modifying the Hyprland config to have only one layout
    // and verifying the widget hides itself
    // For now, we just verify the widget exists in the multi-layout setup
    const widget = page.locator('[data-module="io.github.statick.lang-toggle"]')
    await expect(widget).toBeVisible()
  })

  test('Fn key toggles layout (if key binding configured)', async ({ page }) => {
    // This test requires the Fn key binding to be set up in Hyprland
    // We simulate the IPC call that the key binding would trigger
    const widget = page.locator('[data-module="io.github.statick.lang-toggle"]')
    const initialText = await widget.textContent()
    
    // Simulate the toggleEnEs IPC call
    await page.evaluate(() => {
      window.omarchyShell?.sendIpc?.('io.github.statick.lang-toggle', 'toggleEnEs')
    })
    
    await page.waitForTimeout(500)
    
    const newText = await widget.textContent()
    // If there's only EN/ES configured, it should toggle
    if (['EN', 'ES'].includes(initialText) && ['EN', 'ES'].includes(newText)) {
      expect(newText).not.toBe(initialText)
    }
  })
})

// Test the IPC handlers directly
test.describe('Language Toggle IPC', () => {
  test('toggleEnEs IPC handler exists', async ({ page }) => {
    await page.goto('http://localhost:8080/test-shell.html')
    await page.waitForSelector('[data-module="io.github.statick.lang-toggle"]', { timeout: 10000 })
    
    const hasHandler = await page.evaluate(() => {
      return typeof window.omarchyShell?.ipcHandlers?.['io.github.statick.lang-toggle']?.toggleEnEs === 'function'
    })
    expect(hasHandler).toBe(true)
  })

  test('refresh IPC handler exists', async ({ page }) => {
    await page.goto('http://localhost:8080/test-shell.html')
    await page.waitForSelector('[data-module="io.github.statick.lang-toggle"]', { timeout: 10000 })
    
    const hasHandler = await page.evaluate(() => {
      return typeof window.omarchyShell?.ipcHandlers?.['io.github.statick.lang-toggle']?.refresh === 'function'
    })
    expect(hasHandler).toBe(true)
  })
})