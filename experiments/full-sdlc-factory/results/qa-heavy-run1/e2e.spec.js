const { test, expect } = require('@playwright/test');
const path = require('path');

const url = 'file://' + path.resolve('index.html').replace(/\\/g, '/');

test.describe('CloudPulse Marketing Website', () => {
  test('page loads and title contains CloudPulse', async ({ page }) => {
    await page.goto(url);
    await expect(page).toHaveTitle(/CloudPulse/);
  });

  test('all nav links exist and have valid href anchors', async ({ page }) => {
    await page.goto(url);
    const navLinks = page.locator('nav a');
    const count = await navLinks.count();
    expect(count).toBeGreaterThanOrEqual(3);

    for (let i = 0; i < count; i++) {
      const href = await navLinks.nth(i).getAttribute('href');
      expect(href).toBeTruthy();
      if (href.startsWith('#')) {
        const sectionId = href.slice(1);
        const section = page.locator(`[id="${sectionId}"]`);
        await expect(section).toBeAttached();
      }
    }
  });

  test('all 3 pricing tiers are visible (Starter, Pro, Enterprise)', async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('text=Starter').first()).toBeVisible();
    await expect(page.locator('text=Pro').first()).toBeVisible();
    await expect(page.locator('text=Enterprise').first()).toBeVisible();
  });

  test('FAQ accordion opens and closes on click', async ({ page }) => {
    await page.goto(url);

    // Find the first details element in the FAQ section
    const firstDetails = page.locator('#faq details').first();
    await expect(firstDetails).toBeAttached();

    // Get the summary element
    const summary = firstDetails.locator('summary');
    await expect(summary).toBeVisible();

    // Get the answer element
    const answer = firstDetails.locator('.faq-answer');

    // Initially the details should be closed
    const isOpenBefore = await firstDetails.getAttribute('open');
    if (isOpenBefore !== null) {
      // If open, close it first
      await summary.click();
      await page.waitForTimeout(300);
    }

    // Click to open
    await summary.click();
    await page.waitForTimeout(300);
    await expect(firstDetails).toHaveAttribute('open', /.*/);
    await expect(answer).toBeVisible();

    // Click to close
    await summary.click();
    await page.waitForTimeout(300);
    const isOpenAfter = await firstDetails.getAttribute('open');
    expect(isOpenAfter).toBeNull();
  });

  test('CTA buttons are present and clickable', async ({ page }) => {
    await page.goto(url);
    // Look for buttons with CTA text
    const ctaButtons = page.locator('button.btn-primary, a.btn-primary');
    const count = await ctaButtons.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Verify at least one has "Start Free Trial" or "Get Started" text
    const allText = [];
    for (let i = 0; i < count; i++) {
      const text = await ctaButtons.nth(i).textContent();
      allText.push(text.trim());
    }
    const hasCtaText = allText.some(
      (t) =>
        t.includes('Start Free Trial') ||
        t.includes('Get Started') ||
        t.includes('Start My Free Trial'),
    );
    expect(hasCtaText).toBeTruthy();
  });

  test('responsive layout at 375px, 768px, and 1024px', async ({ page }) => {
    const viewports = [
      { width: 375, height: 812 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.goto(url);
      await page.waitForLoadState('domcontentloaded');

      // Hero section should be visible at each width
      const hero = page.locator('.hero, #hero, [class*="hero"]').first();
      await expect(hero).toBeVisible();

      // Check no horizontal overflow
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(bodyWidth).toBeLessThanOrEqual(vp.width + 5); // small tolerance
    }
  });

  test('footer contains copyright text and at least one link', async ({ page }) => {
    await page.goto(url);
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    // Check copyright text
    const footerText = await footer.textContent();
    expect(footerText).toContain('CloudPulse');
    expect(footerText).toMatch(/©|copyright/i);

    // Check at least one link in footer
    const footerLinks = footer.locator('a');
    const count = await footerLinks.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
