import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const appPath = resolve('dist/app.html');
const outDir = resolve('docs/assets/homepage');
mkdirSync(outDir, { recursive: true });

const demos = [
  {
    file: '01-planungsstart.jpg',
    alt: 'Start einer Planungsrunde mit Demodaten, Rollen, Stammdaten und Prozesshinweis',
    title: 'Planungsrunde starten'
  },
  {
    file: '02-massnahmen-herleitung.jpg',
    alt: 'Maßnahmenbewertung mit Herleitungshelfern für Aktivierung, Risiko, Qualität, AfA und Finanzierungsspread',
    title: 'Maßnahmen und Annahmen herleiten'
  },
  {
    file: '03-eog-cashflow.jpg',
    alt: 'Entscheidungsansicht mit Trennung zwischen regulatorischer EOG-Wirkung und indikativer Cashflow-Basis',
    title: 'EOG und Cashflow trennen'
  },
  {
    file: '04-projektplan.jpg',
    alt: 'Projektplan mit Meilensteinen, Rollen-Swimlanes, Abhängigkeiten und nächster fälliger Aufgabe',
    title: 'Projektplan steuern'
  },
  {
    file: '05-tabellenexport.jpg',
    alt: 'Menü Mehr mit XLSX- und CSV-ZIP-Exporten für Excel und nachgelagerte Systeme',
    title: 'Tabellen für Excel exportieren'
  },
  {
    file: '06-ki-prompt.jpg',
    alt: 'KI-Prompt-Generator mit Rollenwahl, Datenumfang, Redaktionsoptionen und Prompt-Vorschau',
    title: 'KI-Prompt lokal erzeugen'
  },
  {
    file: '07-html-mit-daten.jpg',
    alt: 'Menü Mehr mit HTML mit Daten speichern als selbsttragende Offline-Datei für Kolleginnen und Kollegen',
    title: 'HTML mit Daten weitergeben'
  }
];

async function screenshot(page, filename) {
  await page.screenshot({
    path: resolve(outDir, filename),
    type: 'jpeg',
    quality: 82,
    fullPage: false
  });
}

async function clickView(page, name) {
  await page.getByRole('button', { name }).click();
  await page.waitForTimeout(350);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  deviceScaleFactor: 1,
  acceptDownloads: true
});
const page = await context.newPage();
page.on('dialog', dialog => dialog.accept());
await page.goto(pathToFileURL(appPath).href, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: /Demodaten ansehen/ }).click();
await page.waitForTimeout(500);
await screenshot(page, demos[0].file);

await clickView(page, /2\s*Maßnahmen/);
await page.getByRole('button', { name: /Netzautomatisierung Demogebiet Alpha/ }).click();
await page.waitForTimeout(250);
const helper = page.getByText('Herleitungshelfer').first();
if (await helper.count() && await helper.isVisible()) {
  await helper.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
} else {
  await page.mouse.wheel(0, 650);
  await page.waitForTimeout(250);
}
await screenshot(page, demos[1].file);
await page.locator('#measureEditClose').click();
await page.waitForTimeout(250);

await clickView(page, /3\s*Entscheidung/);
const bridge = page.getByText('EOG-/Cashflow-Überleitung').first();
if (await bridge.count() && await bridge.isVisible()) {
  await bridge.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
} else {
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(250);
}
await screenshot(page, demos[2].file);

await clickView(page, /Projektplan/);
await page.getByText('Nächste fällige Aufgabe je Rolle').waitFor({ timeout: 10000 });
await screenshot(page, demos[3].file);

await page.locator('.action-menu summary').click();
await page.getByRole('button', { name: /Tabellen als XLSX exportieren/ }).waitFor({ timeout: 10000 });
await screenshot(page, demos[4].file);

await page.getByRole('button', { name: /KI-Prompt erstellen/ }).click();
await page.getByRole('heading', { name: 'KI-Prompt erstellen' }).waitFor({ timeout: 10000 });
await page.waitForTimeout(500);
await screenshot(page, demos[5].file);
await page.keyboard.press('Escape');
await page.locator('#aiPromptClose').click().catch(() => {});

await page.locator('.action-menu summary').click();
await page.getByRole('button', { name: /HTML mit Daten speichern/ }).waitFor({ timeout: 10000 });
await screenshot(page, demos[6].file);

await browser.close();
console.log(`Generated ${demos.length} homepage demo screenshots in ${outDir}`);
