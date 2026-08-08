export function downloadBlob(blob, filename, documentRef = document, urlRef = URL) {
  const url = urlRef.createObjectURL(blob);
  const anchor = documentRef.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  documentRef.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  const revoke = () => urlRef.revokeObjectURL(url);
  if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
    window.setTimeout(revoke, 1000);
  } else {
    setTimeout(revoke, 1000);
  }
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

// Der eigene Build fügt Skripte immer ohne src ein (vite-plugin-singlefile
// bündelt alles inline); jedes <script src="…"> im live DOM stammt daher von
// außen (z. B. eine Browser-Erweiterung) und wird beim HTML-Export entfernt,
// damit ein prüfbares Deliverable keine fremden Skripte enthält, die es nie
// selbst geladen hat (Anhang A4).
export function stripForeignScripts(html) {
  return String(html).replace(/<script\b[^>]*\ssrc=[^>]*>[\s\S]*?<\/script>\s*/gi, '');
}

export function htmlWithEmbeddedModelState(html, state) {
  const cleaned = String(html).replace(/\n?\s*<script id="embedded-model-state" type="application\/json">[\s\S]*?<\/script>\s*(?=<\/body>)/g, '');
  const embeddedStateScript = `\n  <script id="embedded-model-state" type="application/json">${jsonForHtmlScript(state)}</script>\n`;
  const bodyCloseIndex = cleaned.lastIndexOf('</body>');
  if (bodyCloseIndex !== -1) {
    return `${cleaned.slice(0, bodyCloseIndex)}${embeddedStateScript}${cleaned.slice(bodyCloseIndex)}`;
  }
  return `${cleaned}${embeddedStateScript}`;
}
