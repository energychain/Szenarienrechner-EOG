import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
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
const fileInputsHidden = await page.locator('input[type="file"]').evaluateAll(inputs => inputs.every(input => {
  const style = window.getComputedStyle(input);
  const rect = input.getBoundingClientRect();
  return style.display === 'none' || input.hidden || rect.width === 0 || rect.height === 0;
}));
if (!fileInputsHidden) {
  throw new Error('Offline-Smoke-Test hat sichtbare native Datei-Auswahlfelder gefunden.');
}
await page.locator('.action-menu summary').click();
await page.getByRole('button', { name: /Tabellen als XLSX exportieren/ }).waitFor({ timeout: 10000 });
await page.getByRole('button', { name: /KI-Prompt erstellen/ }).waitFor({ timeout: 10000 });
const [selfContainedDownload] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: /HTML mit Daten speichern/ }).click()
]);
const selfContainedPath = resolve('/tmp', selfContainedDownload.suggestedFilename());
await selfContainedDownload.saveAs(selfContainedPath);
const selfContainedHtml = await readFile(selfContainedPath, 'utf8');
if (!selfContainedHtml.includes('embedded-model-state')) {
  throw new Error('HTML-mit-Daten-Export enthält keinen eingebetteten Modellstand.');
}
const exportedPage = await context.newPage();
const exportedErrors = [];
exportedPage.on('console', msg => {
  if (msg.type() === 'error') exportedErrors.push(msg.text());
});
exportedPage.on('pageerror', error => exportedErrors.push(error.message));
await exportedPage.goto(pathToFileURL(selfContainedPath).href, { waitUntil: 'domcontentloaded' });
await exportedPage.getByText('HTML-Datei mit eingebettetem Datenstand geladen.').waitFor({ timeout: 10000 });
await exportedPage.getByRole('heading', { name: /Projektplan aus der Userstory/ }).waitFor({ timeout: 10000 });
await exportedPage.locator('.action-menu').evaluate(menu => menu.setAttribute('open', ''));
await exportedPage.locator('#openAiPromptGenerator').click();
await exportedPage.locator('#aiPromptRole').selectOption('challenge');
await exportedPage.locator('#aiPromptOutput').waitFor({ timeout: 10000 });
await exportedPage.evaluate(() => {
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  document.execCommand = command => command === 'copy';
});
await exportedPage.getByRole('button', { name: /In Zwischenablage kopieren/ }).click();
await exportedPage.getByText(/Lokaler Fallback wurde genutzt|Prompt ist markiert/).waitFor({ timeout: 10000 });
if (exportedErrors.length) {
  throw new Error(`HTML-mit-Daten-Export erzeugt Browser-Fehler: ${exportedErrors.join(' | ')}`);
}
await browser.close();

if (externalRequests.length) {
  throw new Error(`Offline-Smoke-Test hat externe Requests beobachtet: ${externalRequests.join(', ')}`);
}

console.log('Offline browser smoke test passed: built single-file app opens via file:// without external network, demo data and project plan render.');
