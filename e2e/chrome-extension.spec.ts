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
  await page.route('http://127.0.0.1:3000/api/rewrite', async (route) => {
    const body = route.request().postDataJSON() as { prompt?: string };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'changed',
        original: body.prompt || '',
        rewritten: 'Explica-me a energia solar em três pontos.',
        source: 'model',
        latencyMs: 4,
        mode: 'fast',
        intervention: 'normal',
        validation: { passed: true, reason: 'model_output_valid' }
      })
    });
  });
  await page.goto(pathToFileURL(resolve('chrome-extension/test.html')).href);
  const input = page.locator('#textarea1');
  const original = 'explica me energia solar em tres pontos';
  await input.fill(original);
  const bubble = page.locator('#prompt-enhancer-root').locator('.prompt-bubble');
  await expect(bubble).toBeVisible();
  await bubble.click();
  const improved = page.locator('#prompt-enhancer-root').locator('#pe-improved-textarea');
  await expect(improved).toBeVisible();
  await expect(improved).toHaveValue('Explica-me a energia solar em três pontos.');
  await page.locator('#prompt-enhancer-root').locator('#pe-insert-btn').click();
  await expect(input).toHaveValue('Explica-me a energia solar em três pontos.');
  await expect(page.locator('#prompt-enhancer-root').locator('.prompt-popup')).toHaveClass(/visible/);
  await page
    .locator('#prompt-enhancer-root')
    .locator('#pe-undo-btn')
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(input).toHaveValue(original);
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

  await page.locator('#prompt-enhancer-root').locator('#pe-close-btn').click();
  await input.fill('write another short status update');
  await page.locator('#prompt-enhancer-root').locator('.prompt-bubble').click();
  await expect(page.locator('#prompt-enhancer-root').locator('#pe-improved-textarea')).toBeVisible();
  await expect(page.locator('#prompt-enhancer-root')).toHaveCount(1);
});

test('keeps a validated local fallback pasteable when the model response is unavailable', async ({
  page
}) => {
  await page.route('http://127.0.0.1:3000/api/rewrite', async (route) => {
    await route.abort('connectionrefused');
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

test('shows a normalized Ollama-offline fallback without exposing an error stack', async ({ page }) => {
  await page.route('http://127.0.0.1:3000/api/rewrite', async (route) => {
    const original = (route.request().postDataJSON() as { prompt?: string }).prompt || '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'fallback',
        original,
        rewritten: original,
        source: 'local_fallback',
        latencyMs: 7,
        mode: 'fast',
        intervention: 'normal',
        validation: { passed: false, reason: 'model_unavailable' },
        error: 'Local model is unavailable'
      })
    });
  });
  await page.goto(pathToFileURL(resolve('chrome-extension/test.html')).href);
  const input = page.locator('#textarea1');
  await input.fill('explain this local fallback clearly');
  await page.locator('#prompt-enhancer-root').locator('.prompt-bubble').click();

  const root = page.locator('#prompt-enhancer-root');
  await expect(root.locator('.result-fallback')).toBeVisible();
  await expect(root.locator('#pe-insert-btn')).toBeEnabled();
  await expect(root).toContainText('Ollama or the selected model is unavailable');
  await expect(root).not.toContainText(/stack|at\s+\w+\s*\(/i);
});

test('shows a friendly API error and never enables an empty insert', async ({ page }) => {
  await page.route('http://127.0.0.1:3000/api/rewrite', async (route) => {
    const original = (route.request().postDataJSON() as { prompt?: string }).prompt || '';
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'error',
        original,
        rewritten: original,
        source: 'error',
        latencyMs: 3,
        mode: 'fast',
        intervention: 'normal',
        validation: { passed: false, reason: 'internal_error' },
        error: 'Local rewrite is temporarily unavailable'
      })
    });
  });
  await page.goto(pathToFileURL(resolve('chrome-extension/test.html')).href);
  const input = page.locator('#textarea1');
  const original = 'explain this error without changing my prompt';
  await input.fill(original);
  await page.locator('#prompt-enhancer-root').locator('.prompt-bubble').click();

  const root = page.locator('#prompt-enhancer-root');
  await expect(root.locator('.result-error')).toBeVisible();
  await expect(root.locator('#pe-insert-btn')).toBeHidden();
  await expect(root).toContainText('The local API returned an internal error');
  await expect(input).toHaveValue(original);
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

test('ignores a late rewrite after an observed extension context is invalidated', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    const runtime = { id: 'test-extension' };
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        runtime,
        storage: { local: { get: async () => ({}), set: async () => undefined } }
      }
    });
  });
  await page.route('http://127.0.0.1:3000/api/rewrite', async (route) => {
    const original = (route.request().postDataJSON() as { prompt?: string }).prompt || '';
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 120));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'changed',
        original,
        rewritten: 'Late result that must be ignored.',
        source: 'model',
        latencyMs: 120,
        mode: 'fast',
        intervention: 'normal',
        validation: { passed: true, reason: 'model_output_valid' }
      })
    });
  });

  await page.goto(pathToFileURL(resolve('chrome-extension/test.html')).href);
  await page.locator('#textarea1').fill('rewrite this before the extension reloads');
  await page.locator('#prompt-enhancer-root').locator('.prompt-bubble').click();
  await page.evaluate(() => {
    (globalThis as typeof globalThis & { chrome: { runtime: { id: string } } }).chrome.runtime.id = '';
  });
  await page.waitForTimeout(250);

  await expect(page.locator('#prompt-enhancer-root').locator('.prompt-popup')).not.toHaveClass(/visible/);
  expect(pageErrors).toEqual([]);
});

test('latest request wins and insertion requires the current composer/result pair', async ({ page }) => {
  await page.route('http://127.0.0.1:3000/api/rewrite', async (route) => {
    const original = (route.request().postDataJSON() as { prompt?: string }).prompt || '';
    const isFirst = original.includes('prompt A');
    await new Promise((resolveDelay) => setTimeout(resolveDelay, isFirst ? 180 : 20));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'changed',
        original,
        rewritten: isFirst ? 'Corrected prompt A.' : 'Corrected prompt B.',
        source: 'model',
        latencyMs: isFirst ? 180 : 20,
        mode: 'fast',
        intervention: 'normal',
        validation: { passed: true, reason: 'model_output_valid' }
      })
    });
  });

  await page.goto(pathToFileURL(resolve('chrome-extension/test.html')).href);
  const input = page.locator('#textarea1');
  await input.fill('rewrite prompt A for this race test');
  await page.locator('#prompt-enhancer-root').locator('.prompt-bubble').click();
  await input.fill('rewrite prompt B for this race test');
  await page.locator('#prompt-enhancer-root').locator('.prompt-bubble').click();

  const improved = page.locator('#prompt-enhancer-root').locator('#pe-improved-textarea');
  await expect(improved).toHaveValue('Corrected prompt B.');
  await expect(input).toHaveValue('rewrite prompt B for this race test');
  await page.locator('#prompt-enhancer-root').locator('#pe-insert-btn').click();
  await expect(input).toHaveValue('Corrected prompt B.');
});

test('Too much feedback remains local and storage failure does not crash or call the API again', async ({
  page
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        runtime: { id: 'test-extension' },
        storage: {
          local: {
            get: async () => ({}),
            set: async () => {
              throw new Error('Local storage unavailable');
            }
          }
        }
      }
    });
  });
  let rewriteCalls = 0;
  await page.route('http://127.0.0.1:3000/api/rewrite', async (route) => {
    rewriteCalls += 1;
    const original = (route.request().postDataJSON() as { prompt?: string }).prompt || '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rewrittenPrompt: original })
    });
  });

  await page.goto(pathToFileURL(resolve('chrome-extension/test.html')).href);
  await page.locator('#textarea1').fill('explain why this feedback should stay local');
  await page.locator('#prompt-enhancer-root').locator('.prompt-bubble').click();
  await expect(page.locator('#prompt-enhancer-root').locator('#pe-too-much-btn')).toBeVisible();
  const callsBeforeFeedback = rewriteCalls;
  await page.locator('#prompt-enhancer-root').locator('#pe-too-much-btn').click();
  await page.waitForTimeout(50);

  expect(rewriteCalls).toBe(callsBeforeFeedback);
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

  await expect(page.locator('#prompt-enhancer-root').locator('.prompt-bubble')).not.toHaveClass(/visible/);
  await expect(page.locator('#prompt-enhancer-root').locator('.prompt-popup')).not.toHaveClass(/visible/);
});

test('does not insert a stale result after the composer is replaced', async ({ page }) => {
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
  await expect(page.locator('#prompt-enhancer-root').locator('.prompt-popup')).not.toHaveClass(/visible/);
  await page.locator('#prompt-enhancer-root').locator('.prompt-bubble').click();
  await expect(page.locator('#prompt-enhancer-root').locator('#pe-improved-textarea')).toHaveValue(
    'fresh composer'
  );
  await expect(page.locator('#prompt-enhancer-root').locator('#pe-insert-btn')).toBeVisible();
  await page.locator('#prompt-enhancer-root').locator('#pe-insert-btn').click();
  await expect(page.locator('#textarea1')).toHaveValue('fresh composer');
  await expect(page.locator('#textarea1')).not.toHaveValue(/onboarding email/i);
});
