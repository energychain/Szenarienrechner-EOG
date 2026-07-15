import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const repo = resolve(process.cwd());
const html = `file://${repo}/docs/visuals/methodik-grafikserie.html`;
const outDir = resolve(repo, 'docs/visuals/exports');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.goto(html, { waitUntil: 'networkidle' });
const slides = await page.locator('.slide').count();
for (let i = 0; i < slides; i += 1) {
  const slide = page.locator('.slide').nth(i);
  const number = String(i + 1).padStart(2, '0');
  await slide.screenshot({ path: `${outDir}/methodik-slide-${number}.png` });
  console.log(`Exported docs/visuals/exports/methodik-slide-${number}.png`);
}
await browser.close();
