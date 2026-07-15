import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const repo = resolve(process.cwd());
const sourceHtml = pathToFileURL(resolve(repo, 'docs/visuals/methodik-slide-source.html')).href;
const outDir = resolve(repo, 'docs/visuals/exports');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.goto(sourceHtml, { waitUntil: 'networkidle' });
const slides = await page.locator('.deck .slide').count();
for (let i = 0; i < slides; i += 1) {
  const number = String(i + 1).padStart(2, '0');
  const slide = page.locator('.deck .slide').nth(i);
  await slide.screenshot({ path: `${outDir}/methodik-slide-${number}.png` });
  console.log(`Exported docs/visuals/exports/methodik-slide-${number}.png`);
}

const contact = await browser.newPage({ viewport: { width: 1800, height: 1200 }, deviceScaleFactor: 1 });
const items = Array.from({ length: slides }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return `<figure><img src="${pathToFileURL(resolve(outDir, `methodik-slide-${n}.png`)).href}" alt="Slide ${i + 1}"><figcaption>Slide ${i + 1}</figcaption></figure>`;
}).join('');
await contact.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#e9f0f7;font-family:system-ui,sans-serif}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:24px;padding:28px}figure{margin:0;background:white;border-radius:18px;padding:12px;box-shadow:0 14px 34px rgba(16,32,51,.18)}img{width:100%;display:block;border-radius:12px}figcaption{font-weight:900;color:#102033;margin-top:8px;font-size:22px}</style></head><body><div class="grid">${items}</div></body></html>`, { waitUntil: 'networkidle' });
await contact.locator('.grid').screenshot({ path: `${outDir}/methodik-contact-sheet.png` });
console.log('Exported docs/visuals/exports/methodik-contact-sheet.png');
await browser.close();
