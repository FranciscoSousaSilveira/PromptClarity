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

test('keeps a validated local fallback pasteable when the model response is unavailable', async ({
  page
}) => {
  await page.route('http://127.0.0.1:3000/api/rewrite', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Test model unavailable' })
    });
  });
  await page.goto(pathToFileURL(resolve('chrome-extension/test.html')).href);
  const input = page.locator('#textarea1');
  await input.fill(
    'eu devo recebr daqui a um mes tenho tempoe eposso deixar e4nste estado a minha candidatura par a tum enqunaotio eserpo pelo diploma certo?'
  );
  await page.locator('#prompt-enhancer-root').locator('.prompt-bubble').click();
  const improved = page.locator('#prompt-enhancer-root').locator('#pe-improved-textarea');
  await expect(improved).toBeVisible();
  await expect(improved).toHaveValue(/candidatura à TUM/i);
  await expect(page.locator('#prompt-enhancer-root').locator('#pe-insert-btn')).toBeEnabled();
});
