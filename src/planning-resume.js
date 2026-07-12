function cleanText(value) {
  return String(value || '').trim();
}

function cleanDate(value) {
  const text = cleanText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

export function normalizePlanningResume(value = {}) {
  return {
    statusNote: cleanText(value.statusNote),
    nextStep: cleanText(value.nextStep),
    owner: cleanText(value.owner),
    dueDate: cleanDate(value.dueDate),
    updatedAt: cleanText(value.updatedAt)
  };
}

export function shouldShowPlanningResume(resume = {}) {
  const normalized = normalizePlanningResume(resume);
  return Boolean(normalized.statusNote || normalized.nextStep);
}

function formatDateShort(value) {
  if (!value) return '';
  const date = new Date(value + 'T00:00:00');
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

export function buildPlanningResume({
  phaseLabel = 'Maßnahmenbewertung',
  resume = {},
  maturity = {},
  openClarifications = 0,
  reviewCount = 0
} = {}) {
  const normalized = normalizePlanningResume(resume);
  const maturityData = maturity && typeof maturity === 'object' ? maturity : {};
  const scoreValue = Number(maturityData['score']);
  const blockerValue = Number(maturityData['blockers']);
  const score = Number.isFinite(scoreValue) ? `${Math.round(scoreValue)} % Entscheidungsreife` : 'Entscheidungsreife offen';
  const blockers = Number.isFinite(blockerValue) ? blockerValue : Number(openClarifications) || 0;
  const nextParts = [];
  if (normalized.nextStep) nextParts.push(`Nächster Schritt: ${normalized.nextStep}`);
  if (normalized.owner) nextParts.push(`Zuständig: ${normalized.owner}`);
  if (normalized.dueDate) nextParts.push(`fällig ${formatDateShort(normalized.dueDate)}`);
  return {
    headline: `Stand: ${phaseLabel} · ${score}`,
    status: normalized.statusNote || 'Kein kurzer Arbeitsstand hinterlegt.',
    next: nextParts.length ? nextParts.join(' · ') : 'Nächster Schritt noch nicht festgelegt.',
    risks: `${blockers} offene Klärpunkte · ${Number(reviewCount) || 0} prüfpflichtige Wirkannahmen`,
    updatedAt: normalized.updatedAt
  };
}
