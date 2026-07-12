import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const sourcePath = 'docs/story/planungsrunde-userstory.md';
const sourceDir = 'docs/story';
const outputDir = 'dist/story';
const outputPath = join(outputDir, 'planungsrunde-userstory.html');
const screenshotSourceDir = join(sourceDir, 'screenshots');
const screenshotOutputDir = join(outputDir, 'screenshots');

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function inlineMarkdown(value) {
  let text = escapeHtml(value);
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return text;
}

function closeList(state, html) {
  if (state.inList) {
    html.push('</ul>');
    state.inList = false;
  }
}

function closeTable(state, html) {
  if (state.inTable) {
    html.push('</tbody></table>');
    state.inTable = false;
    state.tableHeaderPending = false;
  }
}

function isTableDivider(line) {
  return /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function parseTableCells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => inlineMarkdown(cell.trim()));
}

function renderMarkdown(markdown) {
  const html = [];
  const lines = markdown.split(/\r?\n/);
  const state = { inList: false, inTable: false, tableHeaderPending: false };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    const nextLine = lines[index + 1]?.trim() || '';

    if (!trimmed) {
      closeList(state, html);
      closeTable(state, html);
      continue;
    }

    if (/^<a\s+id="[^"]+"><\/a>$/.test(trimmed)) {
      closeList(state, html);
      closeTable(state, html);
      html.push(trimmed);
      continue;
    }

    if (trimmed === '---') {
      closeList(state, html);
      closeTable(state, html);
      html.push('<hr>');
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      closeList(state, html);
      closeTable(state, html);
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    if (/^!\[[^\]]*\]\([^)]+\)$/.test(trimmed)) {
      closeList(state, html);
      closeTable(state, html);
      html.push(`<figure>${inlineMarkdown(trimmed)}</figure>`);
      continue;
    }

    if (/^-\s+/.test(trimmed)) {
      closeTable(state, html);
      if (!state.inList) {
        html.push('<ul>');
        state.inList = true;
      }
      html.push(`<li>${inlineMarkdown(trimmed.replace(/^-\s+/, ''))}</li>`);
      continue;
    }

    if (trimmed.startsWith('|') && nextLine.startsWith('|') && isTableDivider(nextLine)) {
      closeList(state, html);
      closeTable(state, html);
      const cells = parseTableCells(trimmed);
      html.push('<table><thead><tr>');
      for (const cell of cells) html.push(`<th>${cell}</th>`);
      html.push('</tr></thead><tbody>');
      state.inTable = true;
      index += 1;
      continue;
    }

    if (state.inTable && trimmed.startsWith('|')) {
      const cells = parseTableCells(trimmed);
      html.push('<tr>');
      for (const cell of cells) html.push(`<td>${cell}</td>`);
      html.push('</tr>');
      continue;
    }

    closeList(state, html);
    closeTable(state, html);
    html.push(`<p>${inlineMarkdown(trimmed)}</p>`);
  }

  closeList(state, html);
  closeTable(state, html);
  return html.join('\n');
}

function renderPage(body) {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Fiktive Userstory · Szenarienrechner-EOG</title>
  <style>
    :root { color-scheme: light; --ink: #102033; --muted: #5b6b7f; --line: #d8e1ec; --brand: #007ea7; --soft: #eef8fb; --paper: #ffffff; --bg: #f4f7fa; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.65; }
    header { background: var(--paper); border-bottom: 1px solid var(--line); padding: 1rem 1.5rem; position: sticky; top: 0; z-index: 1; }
    header a { color: var(--brand); font-weight: 700; text-decoration: none; }
    main { max-width: 1040px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
    article { background: var(--paper); border: 1px solid var(--line); border-radius: 18px; padding: clamp(1.25rem, 2vw, 2.5rem); box-shadow: 0 18px 40px rgba(16, 32, 51, 0.08); }
    h1 { font-size: clamp(2rem, 4vw, 3.5rem); line-height: 1.1; margin: 0 0 1rem; }
    h2 { border-top: 1px solid var(--line); margin-top: 3rem; padding-top: 2rem; font-size: clamp(1.45rem, 2.5vw, 2.1rem); }
    h1 + p, h2 + p { color: var(--muted); }
    a { color: var(--brand); }
    p a:first-child:last-child { display: inline-block; border: 1px solid #8ac6da; background: var(--soft); border-radius: 999px; padding: 0.45rem 0.9rem; font-weight: 700; text-decoration: none; }
    img { display: block; width: 100%; height: auto; border: 1px solid var(--line); border-radius: 14px; box-shadow: 0 14px 35px rgba(16, 32, 51, 0.12); }
    figure { margin: 1.25rem 0 1.75rem; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0 1.5rem; font-size: 0.96rem; }
    th, td { border: 1px solid var(--line); padding: 0.75rem; vertical-align: top; }
    th { background: #edf4f8; text-align: left; }
    code { background: #edf2f7; border-radius: 0.3rem; padding: 0.1rem 0.3rem; }
    hr { border: 0; border-top: 1px solid var(--line); margin: 2rem 0; }
    footer { color: var(--muted); font-size: 0.9rem; margin-top: 1.5rem; text-align: center; }
  </style>
</head>
<body>
  <header><a href="../index.html">← Zur Anwendung</a></header>
  <main>
    <article>
${body}
    </article>
    <footer>Szenarienrechner-EOG · synthetische Userstory · Apache-2.0</footer>
  </main>
</body>
</html>
`;
}

mkdirSync(outputDir, { recursive: true });
mkdirSync(screenshotOutputDir, { recursive: true });

const markdown = readFileSync(sourcePath, 'utf8');
const html = renderPage(renderMarkdown(markdown));
writeFileSync(outputPath, html);

for (const file of readdirSync(screenshotSourceDir)) {
  if (file.endsWith('.png')) {
    copyFileSync(join(screenshotSourceDir, file), join(screenshotOutputDir, basename(file)));
  }
}

console.log(`Built ${outputPath}`);
