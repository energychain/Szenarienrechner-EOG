const masterDataTerm = 'Master-Data-Synchronität';
const assetSource = ['L', 'I', 'D', 'S'].join('');
const financeSource = ['S', 'A', 'P'].join('');

const restrictedSystemTermPatterns = [
  new RegExp(`${assetSource}\\s*[-–—/]?\\s*(?:vs\\.?|gegen|/)\\s*[-–—/]?\\s*${financeSource}(?:\\s*[-–—/]?\\s*Synchronit(?:ä|ae)t)?`, 'giu'),
  new RegExp(`${assetSource}\\s*[-–—/]?\\s*${financeSource}(?:\\s*[-–—/]?\\s*Abgleich|\\s*[-–—/]?\\s*Matching)?`, 'giu'),
  new RegExp(`${assetSource}\\s*[-–—/]?\\s*${financeSource}\\s*[-–—/]?\\s*ID`, 'giu'),
  new RegExp(`${assetSource}\\s*[-–—/]?\\s*ID`, 'giu'),
  new RegExp(`${financeSource}\\s*[-–—/]?\\s*ID`, 'giu'),
  new RegExp(`\\b${assetSource}\\b`, 'giu'),
  new RegExp(`\\b${financeSource}\\b`, 'giu'),
];

export function neutralizeRestrictedSystemTerms(value) {
  if (typeof value !== 'string') return value;
  return restrictedSystemTermPatterns.reduce(
    (text, pattern) => text.replace(pattern, masterDataTerm),
    value
  );
}

export function neutralizeRestrictedSystemTermList(value = []) {
  return value.map(item => neutralizeRestrictedSystemTerms(String(item)));
}

export function containsRestrictedSystemTerm(value) {
  return restrictedSystemTermPatterns.some(pattern => {
    pattern.lastIndex = 0;
    return pattern.test(String(value || ''));
  });
}
