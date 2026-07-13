export function downloadBlob(blob, filename, documentRef = document, urlRef = URL) {
  const url = urlRef.createObjectURL(blob);
  const anchor = documentRef.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  documentRef.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  urlRef.revokeObjectURL(url);
}

export function exportStamp(state) {
  return state.savedAt.slice(0, 19).replaceAll(':', '').replace('T', '-');
}

export function jsonForHtmlScript(value) {
  return JSON.stringify(value, null, 2)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

export function htmlWithEmbeddedModelState(html, state) {
  const cleaned = String(html).replace(/\n?\s*<script id="embedded-model-state" type="application\/json">[\s\S]*?<\/script>/g, '');
  const embeddedStateScript = `\n  <script id="embedded-model-state" type="application/json">${jsonForHtmlScript(state)}</script>\n`;
  if (cleaned.includes('</body>')) return cleaned.replace('</body>', `${embeddedStateScript}</body>`);
  return `${cleaned}${embeddedStateScript}`;
}
