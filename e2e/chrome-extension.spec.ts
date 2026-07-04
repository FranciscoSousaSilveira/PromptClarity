import { expect, test } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

test.beforeEach(async ({ page }) => {
  await page.route('http://127.0.0.1:3000/api/rewrite', async (route) => {
    const body = route.request().postDataJSON() as { prompt?: string };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rewrittenPrompt: body.prompt || '' })
    });
  });
});

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

test('supports generic input composers without creating duplicate bubbles', async ({ page }) => {
  await page.goto(pathToFileURL(resolve('chrome-extension/test.html')).href);
  const input = page.locator('#input1');
  await input.fill('write a short status update');
  await page.locator('#prompt-enhancer-root').locator('.prompt-bubble').click();

  await expect(page.locator('#prompt-enhancer-root').locator('#pe-improved-textarea')).toBeVisible();
  await expect(page.locator('#prompt-enhancer-root')).toHaveCount(1);

  await page.locator('#prompt-enhancer-root').locator('.prompt-bubble').click();
  await expect(page.locator('#prompt-enhancer-root')).toHaveCount(1);
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
  await expect(improved).toHaveValue(/candidatura par a tum/i);
  await expect(page.locator('#prompt-enhancer-root').locator('#pe-insert-btn')).toBeEnabled();
});

test('does not throw when Chrome invalidates the extension during an async storage operation', async ({
  page
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    const runtime = { id: 'test-extension' };
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        runtime,
        storage: {
          local: {
            get: async () => {
              await new Promise((resolveDelay) => setTimeout(resolveDelay, 30));
              return {};
            },
            set: async () => {
              if (!runtime.id) throw new Error('Extension context invalidated.');
            }
          }
        }
      }
    });
  });

  await page.goto(pathToFileURL(resolve('chrome-extension/test.html')).href);
  const input = page.locator('#textarea1');
  await input.fill('explica me energia solar em tres pontos');
  await page.locator('#prompt-enhancer-root').locator('.prompt-bubble').click();
  await expect(page.locator('#prompt-enhancer-root').locator('#pe-improved-textarea')).toBeVisible();
  await page.locator('#prompt-enhancer-root').locator('#pe-insert-btn').click();
  await page.evaluate(() => {
    (globalThis as typeof globalThis & { chrome: { runtime: { id: string } } }).chrome.runtime.id = '';
  });
  await page.waitForTimeout(100);

  expect(pageErrors).toEqual([]);
});

test('rejects an incomplete game answer without inventing a replacement prompt', async ({ page }) => {
  await page.route('http://127.0.0.1:3000/api/rewrite', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        rewrittenPrompt:
          'O que você está buscando é um jogo online num navegador específico. Se estiver procurando por um jogo como'
      })
    });
  });
  await page.goto(pathToFileURL(resolve('chrome-extension/test.html')).href);
  const input = page.locator('#textarea1');
  await input.fill(
    'qual era o jogo online no browser ond eu podia contruir casad com desgin tipo com blcoso e tem bom aspecto?'
  );
  await page.locator('#prompt-enhancer-root').locator('.prompt-bubble').click();
  const improved = page.locator('#prompt-enhancer-root').locator('#pe-improved-textarea');
  await expect(improved).toBeVisible();
  await expect(improved).toHaveValue(/jogo online no browser/i);
  await expect(improved).toHaveValue(/contruir casad/i);
  await expect(improved).not.toHaveValue(/O que você está buscando/i);
  await expect(page.locator('#prompt-enhancer-root').locator('#pe-insert-btn')).toBeEnabled();
});

test('shows a checkmark when the model confirms that a clear prompt needs no changes', async ({ page }) => {
  await page.goto(pathToFileURL(resolve('chrome-extension/test.html')).href);
  await page.locator('#textarea1').fill('Explain photosynthesis clearly.');
  await page.locator('#prompt-enhancer-root').locator('.prompt-bubble').click();

  await expect(page.locator('#prompt-enhancer-root').locator('.result-no_change')).toBeVisible();
  await expect(page.locator('#prompt-enhancer-root').locator('.result-no_change')).toContainText(
    'Prompt checked'
  );
});

test('hides the popup when the active composer is removed from the DOM', async ({ page }) => {
  await page.goto(pathToFileURL(resolve('chrome-extension/test.html')).href);
  const input = page.locator('#textarea1');
  await input.fill('explica me energia solar em tres pontos');
  await page.locator('#prompt-enhancer-root').locator('.prompt-bubble').click();
  await expect(page.locator('#prompt-enhancer-root').locator('#pe-improved-textarea')).toBeVisible();

  await page.evaluate(() => {
    document.querySelector('#textarea1')?.remove();
  });

  await expect(page.locator('#prompt-enhancer-root').locator('.prompt-bubble')).not.toHaveClass(
    /visible/
  );
  await expect(page.locator('#prompt-enhancer-root').locator('.prompt-popup')).not.toHaveClass(
    /visible/
  );
});

test('keeps insert disabled after a composer is replaced before reusing the popup', async ({ page }) => {
  await page.goto(pathToFileURL(resolve('chrome-extension/test.html')).href);
  const input = page.locator('#textarea1');
  await input.fill('write a concise onboarding email');
  await page.locator('#prompt-enhancer-root').locator('.prompt-bubble').click();
  await expect(page.locator('#prompt-enhancer-root').locator('#pe-improved-textarea')).toBeVisible();

  await page.evaluate(() => {
    const original = document.querySelector('#textarea1');
    original?.remove();
    const replacement = document.createElement('textarea');
    replacement.id = 'textarea1';
    replacement.value = 'fresh composer';
    document.body.appendChild(replacement);
    replacement.focus();
  });

  await page.waitForTimeout(50);
  await page.locator('#prompt-enhancer-root').locator('.prompt-bubble').click();
  await expect(page.locator('#prompt-enhancer-root').locator('#pe-insert-btn')).toBeVisible();
  await page.locator('#prompt-enhancer-root').locator('#pe-insert-btn').click();
  await expect(page.locator('#textarea1')).toHaveValue(/fresh composer|onboarding email/);
});
