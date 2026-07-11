export const repositoryReference = 'github.com/energychain/Szenarienrechner-EOG';

export const trustNotice = 'Alle Daten bleiben auf diesem Gerät. Diese Anwendung baut keine Internetverbindung auf.';

export const cspVerificationNotice = 'Prüfbar per F12-Netzwerk-Tab: Beim lokalen Öffnen entstehen keine Requests. Der CSP-Meta-Tag im Quelltext blockiert Netzwerkverbindungen technisch.';

export const imprintSections = [
  {
    title: 'Angaben gemäß § 5 DDG',
    lines: [
      'STROMDAO GmbH',
      'Gerhard Weiser Ring 29',
      '69256 Mauer',
      'Deutschland'
    ]
  },
  {
    title: 'Vertreten durch',
    lines: [
      'Thorsten Zoerner (Geschäftsführer)'
    ]
  },
  {
    title: 'Kontakt',
    lines: [
      'E-Mail: kontakt@stromdao.de',
      'Telefon: +49 6226 9680090'
    ]
  },
  {
    title: 'Registereintrag',
    lines: [
      'Amtsgericht Mannheim HR-B 728691'
    ]
  },
  {
    title: 'Umsatzsteuer-ID',
    lines: [
      'USt-ID: DE314368974'
    ]
  },
  {
    title: 'Verantwortlich für den Inhalt',
    lines: [
      'Geschäftsführer: Thorsten Zoerner, Gerhard Weiser Ring 29, 69256 Mauer'
    ]
  }
];

export function imprintPlainText() {
  return imprintSections
    .map(section => [section.title, ...section.lines].join('\n'))
    .join('\n\n');
}
