import { expect, test } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

test('opens a suggestion and inserts it in textarea', async ({ page }) => {
  await page.goto(pathToFileURL(resolve('chrome-extension/test.html')).href);
  const input = page.locator('#textarea1');
  await input.fill('explica me energia solar em tres pontos');
  const bubble = page.locator('#prompt-enhancer-root').locator('.prompt-bubble');
  await expect(bubble).toBeVisible();
  await bubble.click();
  const improved = page.locator('#prompt-enhancer-root').locator('#pe-improved-textarea');
  await expect(improved).toBeVisible();
  await expect(improved).toHaveValue(/energia solar/i);
  await page.locator('#prompt-enhancer-root').locator('#pe-insert-btn').click();
  await expect(input).toHaveValue(/energia solar/i);
});

test('supports contenteditable composers', async ({ page }) => {
  await page.goto(pathToFileURL(resolve('chrome-extension/test.html')).href);
  const editor = page.locator('.contenteditable-box');
  await editor.fill('write a concise email to a client');
  await page.locator('#prompt-enhancer-root').locator('.prompt-bubble').click();
  await expect(page.locator('#prompt-enhancer-root').locator('#pe-improved-textarea')).toBeVisible();
});
