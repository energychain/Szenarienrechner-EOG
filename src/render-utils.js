const deNumberFormat = (digits = 0) => new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits
});

export function fmtTeur(value, digits = 0) {
  return deNumberFormat(digits).format(value) + ' TEUR';
}

export function fmtPct(value, digits = 1) {
  if (!Number.isFinite(value)) return '-';
  return deNumberFormat(digits).format(value) + ' %';
}

export function fmtEur(value, digits = 0) {
  if (!Number.isFinite(value)) return '-';
  return deNumberFormat(digits).format(value) + ' EUR';
}

export function fmtPlain(value, digits = 0) {
  return deNumberFormat(digits).format(value);
}

export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function formatDateShort(value) {
  if (!value) return '';
  const date = new Date(value + 'T00:00:00');
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}
