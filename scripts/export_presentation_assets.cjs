const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const outputDir = path.resolve(__dirname, '../../apresentacao-assets');
const artifactDir = 'C:\\Users\\fpass\\.gemini\\antigravity\\brain\\25646630-dc4c-48e8-abab-0c895292046a';

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}
if (!fs.existsSync(artifactDir)) {
  fs.mkdirSync(artifactDir, { recursive: true });
}

// 1. Logo Squircle (Original)
const logoSquircleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1" />
      <stop offset="50%" stop-color="#8b5cf6" />
      <stop offset="100%" stop-color="#ec4899" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <rect width="128" height="128" rx="32" fill="url(#bgGrad)" />
  <g fill="#ffffff" filter="url(#glow)">
    <path d="M64,24 Q64,52 36,52 Q64,52 64,80 Q64,52 92,52 Q64,52 64,24 Z" />
    <path d="M96,24 Q96,36 84,36 Q96,36 96,48 Q96,36 108,36 Q96,36 96,24 Z" transform="scale(0.6) translate(64, 10)" />
    <path d="M32,80 Q32,92 20,92 Q32,92 32,104 Q32,92 44,92 Q32,92 32,80 Z" transform="scale(0.5) translate(-10, 80)" />
  </g>
  <path d="M34,102 L52,84" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity="0.8" />
  <path d="M30,106 C28,108 24,108 22,106 C20,104 20,100 22,98 L26,94" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.5" />
</svg>`;

// 2. Logo Circular (Brand mark in full circle)
const logoCircleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="512" height="512">
  <defs>
    <linearGradient id="bgGradCircle" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1" />
      <stop offset="50%" stop-color="#8b5cf6" />
      <stop offset="100%" stop-color="#ec4899" />
    </linearGradient>
    <filter id="glowCircle" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <circle cx="64" cy="64" r="64" fill="url(#bgGradCircle)" />
  <g fill="#ffffff" filter="url(#glowCircle)">
    <path d="M64,24 Q64,52 36,52 Q64,52 64,80 Q64,52 92,52 Q64,52 64,24 Z" />
    <path d="M96,24 Q96,36 84,36 Q96,36 96,48 Q96,36 108,36 Q96,36 96,24 Z" transform="scale(0.6) translate(64, 10)" />
    <path d="M32,80 Q32,92 20,92 Q32,92 32,104 Q32,92 44,92 Q32,92 32,80 Z" transform="scale(0.5) translate(-10, 80)" />
  </g>
  <path d="M34,102 L52,84" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity="0.8" />
  <path d="M30,106 C28,108 24,108 22,106 C20,104 20,100 22,98 L26,94" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.5" />
</svg>`;

// 3. Browser Circular Bubble (Floating Action Indicator)
const browserBubbleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="512" height="512">
  <defs>
    <linearGradient id="bubbleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1" />
      <stop offset="50%" stop-color="#8b5cf6" />
      <stop offset="100%" stop-color="#ec4899" />
    </linearGradient>
    <filter id="bubbleShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#6366f1" flood-opacity="0.45" />
    </filter>
  </defs>

  <!-- Bubble Circle with Border and Glow -->
  <g filter="url(#bubbleShadow)">
    <circle cx="128" cy="120" r="92" fill="url(#bubbleGrad)" stroke="rgba(255, 255, 255, 0.85)" stroke-width="8" />
  </g>

  <!-- Centered Inner Icon (scaled from 24x24) -->
  <g transform="translate(68, 60) scale(5)" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <!-- 8 Radial Ray lines -->
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    <!-- Outer concentric ring -->
    <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" fill="#ffffff" opacity="0.35" stroke="none" />
    <!-- Inner core -->
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" fill="#ffffff" stroke="none" />
  </g>
</svg>`;

// Save SVGs
const files = [
  { name: 'logo-promptclarity.svg', content: logoSquircleSvg },
  { name: 'logo-promptclarity-circular.svg', content: logoCircleSvg },
  { name: 'simbolo-browser-bubble.svg', content: browserBubbleSvg },
];

for (const f of files) {
  fs.writeFileSync(path.join(outputDir, f.name), f.content, 'utf8');
  fs.writeFileSync(path.join(artifactDir, f.name), f.content, 'utf8');
}

// Copy existing icon.png from desktop-app assets if present
const desktopIconPng = path.resolve(__dirname, '../apps/desktop-app/assets/icon.png');
if (fs.existsSync(desktopIconPng)) {
  fs.copyFileSync(desktopIconPng, path.join(outputDir, 'logo-promptclarity-512x512.png'));
  fs.copyFileSync(desktopIconPng, path.join(artifactDir, 'logo-promptclarity-512x512.png'));
}

async function renderPngs() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 800 }, deviceScaleFactor: 2 });

  // Render Circular Logo PNG
  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:transparent;display:flex;align-items:center;justify-content:center;height:100vh;">
    <div id="render" style="width:512px;height:512px;">${logoCircleSvg}</div>
  </body></html>`);
  const circleElem = await page.$('#render');
  await circleElem.screenshot({ path: path.join(outputDir, 'logo-promptclarity-circular.png'), omitBackground: true });
  await circleElem.screenshot({ path: path.join(artifactDir, 'logo-promptclarity-circular.png'), omitBackground: true });

  // Render Browser Bubble PNG (High Resolution Transparent)
  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:transparent;display:flex;align-items:center;justify-content:center;height:100vh;">
    <div id="render" style="width:512px;height:512px;">${browserBubbleSvg}</div>
  </body></html>`);
  const bubbleElem = await page.$('#render');
  await bubbleElem.screenshot({ path: path.join(outputDir, 'simbolo-browser-bubble.png'), omitBackground: true });
  await bubbleElem.screenshot({ path: path.join(artifactDir, 'simbolo-browser-bubble.png'), omitBackground: true });

  // Render a Presentation Mockup showing the browser bubble in action (inside ChatGPT/AI input box)
  await page.setViewportSize({ width: 900, height: 420 });
  await page.setContent(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { background: transparent; padding: 24px; display: flex; align-items: center; justify-content: center; }
    .card {
      width: 820px;
      background: #181926;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 20px;
      padding: 28px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.5);
      position: relative;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
    }
    .dot { width: 12px; height: 12px; border-radius: 50%; }
    .dot-red { background: #ff5f56; }
    .dot-yellow { background: #ffbd2e; }
    .dot-green { background: #27c93f; }
    .title { color: #94a3b8; font-size: 13px; font-weight: 500; margin-left: 12px; letter-spacing: 0.5px; }
    .input-box {
      background: #24273a;
      border: 1.5px solid #363a4f;
      border-radius: 14px;
      padding: 18px 58px 18px 20px;
      min-height: 110px;
      color: #cad3f5;
      font-size: 16px;
      line-height: 1.6;
      position: relative;
    }
    .placeholder { color: #8087a2; }
    .bubble-badge {
      position: absolute;
      right: 14px;
      bottom: 14px;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899);
      border: 2px solid rgba(255, 255, 255, 0.85);
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: pulse 2s infinite;
    }
    .bubble-badge svg {
      width: 20px;
      height: 20px;
      stroke: white;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
    }
    .label {
      position: absolute;
      top: 14px;
      right: 20px;
      background: rgba(99, 102, 241, 0.15);
      color: #a5b4fc;
      border: 1px solid rgba(99, 102, 241, 0.3);
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="card" id="mockup">
    <div class="label">Chrome Extension • In-Browser Action</div>
    <div class="header">
      <div class="dot dot-red"></div>
      <div class="dot dot-yellow"></div>
      <div class="dot dot-green"></div>
      <span class="title">ChatGPT / Claude / Gemini Prompt Input</span>
    </div>
    <div class="input-box">
      <span>Escreve uma proposta comercial para um cliente de e-commerce com foco em IA...</span>
      <div class="bubble-badge">
        <svg viewBox="0 0 24 24">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" fill="#ffffff" opacity="0.35" stroke="none" />
          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" fill="#ffffff" stroke="none" />
        </svg>
      </div>
    </div>
  </div>
</body>
</html>`);
  const mockupElem = await page.$('#mockup');
  await mockupElem.screenshot({ path: path.join(outputDir, 'mockup-browser-bubble.png'), omitBackground: true });
  await mockupElem.screenshot({ path: path.join(artifactDir, 'mockup-browser-bubble.png'), omitBackground: true });

  await browser.close();
  console.log('All presentation assets exported successfully!');
}

renderPngs().catch(console.error);
