import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openDetails } from './disclose.mjs';

const jpg = readFileSync(new URL('../../docs/assets/wallpapers/dawn-hills.jpg', import.meta.url));
const { pool } = JSON.parse(readFileSync(new URL('../../docs/data/remote-wallpapers.json', import.meta.url)));

for (const viewport of [{ width: 1366, height: 900 }, { width: 390, height: 844 }]) {
  for (const failure of ['abort', '404']) {
    test(`wallpaper previews recover from ${failure} at ${viewport.width}px`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize(viewport);
      let failedPhoto;
      await page.route('https://**/*', async route => {
        if (new URL(route.request().url()).hostname !== 'images.unsplash.com') return route.abort();
        const photo = new URL(route.request().url()).pathname.slice('/photo-'.length);
        failedPhoto ||= photo;
        if (photo === failedPhoto) {
          return failure === 'abort' ? route.abort() : route.fulfill({ status: 404, body: '' });
        }
        return route.fulfill({ contentType: 'image/jpeg', body: jpg });
      });
      await page.goto('/');
      await expect(page.locator('#wallpaper-grid .wp-card').first()).toBeAttached();
      await openDetails(page, '#wp-details');
      await expect(page.locator('html')).toHaveAttribute('data-wallpaper-grid', viewport.width === 1366 ? '4' : '2');
      await expect.poll(() => failedPhoto).toBeTruthy();
      const failed = pool.find(item => item.unsplash === failedPhoto);
      expect(failed).toBeTruthy();
      const fallback = viewport.width === 390 ? /\/phone\/dawn-hills-phone\.jpg$/ : /\/dawn-hills\.jpg$/;
      const brokenThumb = page.locator(`#wallpaper-grid [data-wp-id="${failed.id}"] .wp-thumb img`);
      await brokenThumb.scrollIntoViewIfNeeded();
      await expect(brokenThumb).toHaveAttribute('src', fallback);

      // Scroll each rendered card into view so native lazy loading is exercised.
      const images = page.locator('#wallpaper-grid .wp-thumb img');
      const count = await images.count();
      expect(count).toBeGreaterThan(6);
      for (let i = 0; i < count; i++) {
        const image = images.nth(i);
        await image.scrollIntoViewIfNeeded();
        await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
      }
      await expect.poll(() => page.locator('.wp-thumb img').evaluateAll(images =>
        images.filter(img => img.checkVisibility()).every(img => img.naturalWidth > 0)
      )).toBe(true);

      // Exercise the load-event guard separately from network error events.
      const healthyId = await page.locator('#wallpaper-grid .wp-thumb img[src*="images.unsplash.com"]').first()
        .evaluate(img => img.closest('[data-wp-id]').dataset.wpId);
      const healthyThumb = page.locator(`#wallpaper-grid [data-wp-id="${healthyId}"] .wp-thumb img`);
      await healthyThumb.evaluate(img => {
        Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 0 });
        img.dispatchEvent(new Event('load'));
        delete img.naturalWidth;
      });
      await expect(healthyThumb).toHaveAttribute('src', fallback);
      await expect.poll(() => healthyThumb.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);

      // The failed first daily selection also drives the aspect and background previews.
      await expect(page.locator('#wp-aspect-thumb')).toHaveAttribute('src', fallback);
      await expect.poll(() => page.evaluate(() => document.body.style.backgroundImage)).toContain(viewport.width === 390 ? '/phone/dawn-hills-phone.jpg' : '/dawn-hills.jpg');
      await page.locator(`#wallpaper-grid [data-view-background="${failed.id}"]`).click();
      await expect(page.locator('body')).toHaveClass(/is-background-view/);
      await expect.poll(() => page.evaluate(() => document.body.style.backgroundImage)).toContain('dawn-hills');
    });
  }
}
