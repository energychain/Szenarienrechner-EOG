import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const artifact = resolve('dist/szenarienrechner-eog.html');
if (!existsSync(artifact)) {
  throw new Error('dist/szenarienrechner-eog.html fehlt. Bitte zuerst npm run build:release ausführen.');
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ acceptDownloads: true });
const externalRequests = [];
await context.route('**/*', route => {
  const url = route.request().url();
  if (/^https?:/i.test(url)) {
    externalRequests.push(url);
    return route.abort();
  }
  return route.continue();
});
const page = await context.newPage();
page.on('dialog', dialog => dialog.accept());
await page.goto(pathToFileURL(artifact).href, { waitUntil: 'domcontentloaded' });
await page.getByText('Szenario-Rechner regulierte Sparten').waitFor({ timeout: 10000 });
await page.getByRole('button', { name: /Demodaten ansehen/ }).click();
await page.getByRole('button', { name: /Projektplan/ }).click();
await page.getByText('Nächste fällige Aufgabe je Rolle').waitFor({ timeout: 10000 });
await page.locator('.action-menu summary').click();
await page.getByRole('button', { name: /Tabellen als XLSX exportieren/ }).waitFor({ timeout: 10000 });
await page.getByRole('button', { name: /KI-Prompt erstellen/ }).waitFor({ timeout: 10000 });
await browser.close();

if (externalRequests.length) {
  throw new Error(`Offline-Smoke-Test hat externe Requests beobachtet: ${externalRequests.join(', ')}`);
}

console.log('Offline browser smoke test passed: built single-file app opens via file:// without external network, demo data and project plan render.');
