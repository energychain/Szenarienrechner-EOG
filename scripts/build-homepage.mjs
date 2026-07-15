import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const commit = process.env.VITE_BUILD_COMMIT || process.env.GITHUB_SHA?.slice(0, 12) || 'local-build';

function link(href, label, className = 'button') {
  return `<a class="${className}" href="${href}">${label}</a>`;
}

function externalLink(href, label, className = 'button') {
  return `<a class="${className}" href="${href}" target="_blank" rel="noopener">${label}</a>`;
}

const arcadeDemoUrl = 'https://app.arcade.software/share/ZlZVVMORTrNI4FxeSxlB';

const workflowDemos = [
  {
    image: 'assets/homepage/01-planungsstart.jpg',
    title: 'Planungsrunde starten',
    label: 'So beginnt man strukturiert',
    text: 'Demodaten oder eigener Arbeitsstand öffnen, Rolle wählen und den Prozessstand sichtbar machen.',
    alt: 'Start einer Planungsrunde mit Demodaten, Rollen, Stammdaten und Prozesshinweis'
  },
  {
    image: 'assets/homepage/02-massnahmen-herleitung.jpg',
    title: 'Maßnahmen und Annahmen herleiten',
    label: 'So wird aus Bauchzahl eine Quelle',
    text: 'Herleitungshelfer erklären Aktivierbarkeit, Risiko, Qualität, Nutzungsdauer und Finanzierungsspread.',
    alt: 'Maßnahmenbewertung mit Herleitungshelfern für Aktivierung, Risiko, Qualität, AfA und Finanzierungsspread'
  },
  {
    image: 'assets/homepage/03-eog-cashflow.jpg',
    title: 'EOG und Cashflow trennen',
    label: 'So liest man die Kennzahlen',
    text: 'Regulatorische EOG-Wirkung, wirtschaftliche Überleitung und indikative Cashflow-Basis bleiben getrennt.',
    alt: 'Entscheidungsansicht mit Trennung zwischen regulatorischer EOG-Wirkung und indikativer Cashflow-Basis'
  },
  {
    image: 'assets/homepage/04-projektplan.jpg',
    title: 'Projektplan steuern',
    label: 'So wird die Story operativ',
    text: 'Meilensteine, Rollen-Swimlanes, Abhängigkeiten und nächste Aufgaben je Rolle führen durch die Planungsrunde.',
    alt: 'Projektplan mit Meilensteinen, Rollen-Swimlanes, Abhängigkeiten und nächster fälliger Aufgabe'
  },
  {
    image: 'assets/homepage/05-tabellenexport.jpg',
    title: 'Daten für Excel exportieren',
    label: 'So vermeidet man Datensilos',
    text: 'XLSX und CSV-ZIP stellen Maßnahmen, KPIs, Jahreswerte, Projektplan, Klärpunkte und Provenienz bereit.',
    alt: 'Menü Mehr mit XLSX- und CSV-ZIP-Exporten für Excel und nachgelagerte Systeme'
  },
  {
    image: 'assets/homepage/06-ki-prompt.jpg',
    title: 'KI-Prompt lokal erzeugen',
    label: 'So nutzt man Unternehmens-KI',
    text: 'Rollenbezogene Prompts übersetzen den Arbeitsstand für Gremium, Management, Controlling oder Regulierung.',
    alt: 'KI-Prompt-Generator mit Rollenwahl, Datenumfang, Redaktionsoptionen und Prompt-Vorschau'
  },
  {
    image: 'assets/homepage/07-html-mit-daten.jpg',
    title: 'HTML mit Daten weitergeben',
    label: 'So reist der Arbeitsstand mit',
    text: 'Die App kann den aktuellen Modellstand als selbsttragende HTML-Datei für Kolleginnen und Kollegen speichern.',
    alt: 'Menü Mehr mit HTML mit Daten speichern als selbsttragende Offline-Datei für Kolleginnen und Kollegen'
  }
];

function renderWorkflowDemoCards() {
  return workflowDemos.map((demo, index) => `
    <article class="demo-card" id="demo-${index + 1}">
      <button class="demo-shot" type="button" data-demo-index="${index}" aria-label="Screenshot in Originalgröße öffnen: ${demo.title}">
        <img src="${demo.image}" alt="${demo.alt}" loading="eager" width="1280" height="853">
        <span class="demo-zoom-hint">Screenshot groß ansehen</span>
      </button>
      <div class="demo-copy">
        <span>${demo.label}</span>
        <h3>${demo.title}</h3>
        <p>${demo.text}</p>
      </div>
    </article>`).join('');
}

function renderWorkflowDemoModal() {
  return `<div class="demo-modal" id="demoModal" hidden aria-hidden="true">
    <div class="demo-modal-backdrop" data-demo-close></div>
    <section class="demo-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="demoModalTitle" aria-describedby="demoModalText">
      <div class="demo-modal-toolbar">
        <div>
          <span id="demoModalLabel" class="demo-modal-label"></span>
          <h3 id="demoModalTitle"></h3>
        </div>
        <button class="demo-modal-close" type="button" data-demo-close aria-label="Screenshot schließen">×</button>
      </div>
      <p id="demoModalText"></p>
      <div class="demo-modal-frame">
        <img id="demoModalImage" alt="" width="1280" height="853">
      </div>
      <div class="demo-modal-actions">
        <button class="button" type="button" data-demo-prev>← Vorheriges Beispiel</button>
        <a class="button" id="demoModalOpenOriginal" href="#" target="_blank" rel="noopener">Bild in neuem Tab öffnen</a>
        <button class="button" type="button" data-demo-next>Nächstes Beispiel →</button>
      </div>
    </section>
  </div>`;
}

function renderWorkflowDemoScript() {
  return `<script>
    (() => {
      const demos = ${JSON.stringify(workflowDemos)};
      const modal = document.getElementById('demoModal');
      if (!modal) return;
      const image = document.getElementById('demoModalImage');
      const title = document.getElementById('demoModalTitle');
      const label = document.getElementById('demoModalLabel');
      const text = document.getElementById('demoModalText');
      const openOriginal = document.getElementById('demoModalOpenOriginal');
      const cards = Array.from(document.querySelectorAll('[data-demo-index]'));
      const carousel = document.querySelector('[data-demo-carousel]');
      let activeIndex = 0;
      let lastFocus = null;

      function setActive(index) {
        activeIndex = (index + demos.length) % demos.length;
        const demo = demos[activeIndex];
        image.src = demo.image;
        image.alt = demo.alt;
        title.textContent = demo.title;
        label.textContent = demo.label;
        text.textContent = demo.text;
        openOriginal.href = demo.image;
      }

      function openDemo(index) {
        lastFocus = document.activeElement;
        setActive(index);
        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('demo-modal-open');
        modal.querySelector('[data-demo-close]').focus();
      }

      function closeDemo() {
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('demo-modal-open');
        if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
      }

      cards.forEach((button) => button.addEventListener('click', () => openDemo(Number(button.dataset.demoIndex))));
      modal.querySelectorAll('[data-demo-close]').forEach((button) => button.addEventListener('click', closeDemo));
      modal.querySelector('[data-demo-prev]').addEventListener('click', () => setActive(activeIndex - 1));
      modal.querySelector('[data-demo-next]').addEventListener('click', () => setActive(activeIndex + 1));
      document.addEventListener('keydown', (event) => {
        if (modal.hidden) return;
        if (event.key === 'Escape') closeDemo();
        if (event.key === 'ArrowLeft') setActive(activeIndex - 1);
        if (event.key === 'ArrowRight') setActive(activeIndex + 1);
      });
      document.querySelectorAll('[data-demo-scroll]').forEach((button) => {
        button.addEventListener('click', () => {
          const direction = button.dataset.demoScroll === 'next' ? 1 : -1;
          carousel?.scrollBy({ left: direction * Math.max(320, carousel.clientWidth * 0.82), behavior: 'smooth' });
        });
      });
    })();
  </script>`;
}

function copyHomepageAssets() {
  const source = 'docs/assets/homepage';
  const target = 'dist/assets/homepage';
  if (existsSync(source)) {
    mkdirSync('dist/assets', { recursive: true });
    cpSync(source, target, { recursive: true });
  }
}

export function renderHomepage() {
  const appVersion = packageJson.version;
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Szenarienrechner-EOG · Offline-Tool für regulierte Finanzplanung Strom/Gas</title>
  <meta name="description" content="Open-Source-Szenarienrechner für regulierte Finanzplanung bei Stadtwerken und Verteilnetzbetreibern: Maßnahmen, EOG-Wirkung, Cashflow, Projektplan, Gremienvorlagen und Offline-Exporte.">
  <meta name="robots" content="index, follow">
  <meta name="author" content="STROMDAO GmbH">
  <link rel="canonical" href="https://energychain.github.io/Szenarienrechner-EOG/">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Szenarienrechner-EOG · Regulierte Finanzplanung offline strukturieren">
  <meta property="og:description" content="Offline-first Open-Source-Werkzeug für VNBs und Stadtwerke: Maßnahmenportfolios, regulatorische Wirkung, Cashflow, Projektplan, Reports und Excel-Exporte.">
  <meta property="og:url" content="https://energychain.github.io/Szenarienrechner-EOG/">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Szenarienrechner-EOG',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web Browser',
    softwareVersion: appVersion,
    license: 'https://www.apache.org/licenses/LICENSE-2.0',
    url: 'https://energychain.github.io/Szenarienrechner-EOG/',
    author: { '@type': 'Organization', name: 'STROMDAO GmbH', url: 'https://stromdao.de' },
    description: 'Offline-first Open-Source-Werkzeug für regulierte Finanzplanung in Strom- und Gasverteilnetzen.'
  })}</script>
  <style>
    :root {
      color-scheme: light;
      --ink: #102033;
      --muted: #52657a;
      --brand: #007ea7;
      --brand-dark: #005e7d;
      --accent: #f59e0b;
      --line: #d7e2ed;
      --soft: #eef8fb;
      --soft-2: #f6fafc;
      --paper: #ffffff;
      --ok: #0f766e;
      --warn: #b45309;
      --shadow: 0 18px 50px rgba(16, 32, 51, 0.12);
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: linear-gradient(180deg, #f8fbfd 0%, #eef4f8 100%); line-height: 1.6; }
    a { color: var(--brand); }
    .topbar { position: sticky; top: 0; z-index: 5; backdrop-filter: blur(16px); background: rgba(255,255,255,0.88); border-bottom: 1px solid var(--line); }
    .nav { max-width: 1180px; margin: 0 auto; padding: 0.85rem 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .brand { font-weight: 850; letter-spacing: -0.03em; color: var(--ink); text-decoration: none; }
    .nav-links { display: flex; flex-wrap: wrap; gap: 0.85rem; align-items: center; font-size: 0.94rem; }
    .nav-links a { text-decoration: none; font-weight: 700; color: #29445d; }
    .hero { max-width: 1180px; margin: 0 auto; padding: clamp(3rem, 7vw, 6rem) 1.25rem 2.5rem; display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr); gap: 2rem; align-items: center; }
    .eyebrow { display: inline-flex; gap: 0.5rem; align-items: center; border: 1px solid #afddec; background: var(--soft); color: var(--brand-dark); padding: 0.35rem 0.7rem; border-radius: 999px; font-size: 0.88rem; font-weight: 800; }
    h1 { margin: 1rem 0; font-size: clamp(2.4rem, 5vw, 5.2rem); line-height: 0.98; letter-spacing: -0.065em; }
    .lead { font-size: clamp(1.08rem, 1.8vw, 1.35rem); color: var(--muted); max-width: 760px; }
    .actions { display: flex; flex-wrap: wrap; gap: 0.8rem; margin: 1.6rem 0 0; }
    .button { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; border-radius: 999px; padding: 0.72rem 1.1rem; text-decoration: none; font-weight: 850; border: 1px solid #8ac6da; background: var(--paper); color: var(--brand-dark); }
    .button.primary { background: var(--brand); color: white; border-color: var(--brand); box-shadow: 0 10px 26px rgba(0, 126, 167, 0.25); }
    .button.ghost { background: transparent; }
    .hero-card { background: var(--paper); border: 1px solid var(--line); border-radius: 24px; padding: 1.25rem; box-shadow: var(--shadow); }
    .status-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .status { border: 1px solid var(--line); background: var(--soft-2); border-radius: 16px; padding: 0.9rem; }
    .status strong { display: block; font-size: 1.35rem; line-height: 1.1; }
    .status span { color: var(--muted); font-size: 0.9rem; }
    section { max-width: 1180px; margin: 0 auto; padding: 3.2rem 1.25rem; }
    .section-head { max-width: 850px; margin-bottom: 1.4rem; }
    h2 { font-size: clamp(1.8rem, 3.4vw, 3rem); line-height: 1.05; margin: 0 0 0.75rem; letter-spacing: -0.045em; }
    .section-head p { color: var(--muted); font-size: 1.08rem; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
    .grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .card { background: var(--paper); border: 1px solid var(--line); border-radius: 20px; padding: 1.15rem; box-shadow: 0 8px 26px rgba(16, 32, 51, 0.06); }
    .card h3 { margin: 0 0 0.45rem; font-size: 1.1rem; }
    .card p, .card li { color: var(--muted); }
    .card ul { padding-left: 1.1rem; margin: 0.55rem 0 0; }
    .demo-carousel-shell { position: relative; }
    .demo-carousel-controls { display: flex; justify-content: flex-end; gap: 0.55rem; margin: -0.3rem 0 0.9rem; }
    .demo-carousel-controls .button { min-height: 38px; padding: 0.48rem 0.85rem; }
    .demo-grid { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(320px, 45%); gap: 1.15rem; overflow-x: auto; padding: 0.25rem 0.1rem 1rem; scroll-snap-type: x mandatory; scrollbar-width: thin; }
    .demo-card { background: var(--paper); border: 1px solid var(--line); border-radius: 22px; overflow: hidden; box-shadow: 0 12px 32px rgba(16, 32, 51, 0.08); scroll-snap-align: start; }
    .demo-shot { position: relative; display: block; width: 100%; padding: 0; border: 0; background: #dbe8f0; border-bottom: 1px solid var(--line); cursor: zoom-in; }
    .demo-shot:focus-visible { outline: 4px solid #fbbf24; outline-offset: -4px; }
    .demo-card img { display: block; width: 100%; height: auto; aspect-ratio: 16 / 10; object-fit: cover; object-position: top left; }
    .demo-zoom-hint { position: absolute; right: 0.7rem; bottom: 0.7rem; color: white; background: rgba(15, 34, 54, 0.86); border: 1px solid rgba(255,255,255,0.35); border-radius: 999px; padding: 0.32rem 0.62rem; font-size: 0.82rem; font-weight: 850; box-shadow: 0 8px 18px rgba(16, 32, 51, 0.18); }
    .demo-copy { padding: 1rem 1.1rem 1.15rem; }
    .demo-copy span { display: inline-flex; color: var(--brand-dark); background: var(--soft); border: 1px solid #b8dfeb; border-radius: 999px; padding: 0.22rem 0.55rem; font-size: 0.82rem; font-weight: 850; margin-bottom: 0.7rem; }
    .demo-copy h3 { margin: 0 0 0.35rem; }
    .demo-copy p { color: var(--muted); margin: 0; }
    .proof-note { margin-top: 1rem; color: var(--muted); font-size: 0.96rem; }
    body.demo-modal-open { overflow: hidden; }
    .demo-modal[hidden] { display: none; }
    .demo-modal { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; padding: clamp(0.6rem, 2vw, 1.4rem); }
    .demo-modal-backdrop { position: absolute; inset: 0; background: rgba(6, 18, 31, 0.74); backdrop-filter: blur(7px); }
    .demo-modal-dialog { position: relative; z-index: 1; width: min(1200px, 96vw); max-height: 94vh; display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; gap: 0.75rem; background: var(--paper); border: 1px solid rgba(255,255,255,0.4); border-radius: 24px; padding: 1rem; box-shadow: 0 26px 80px rgba(0, 0, 0, 0.28); }
    .demo-modal-toolbar { display: flex; align-items: start; justify-content: space-between; gap: 1rem; }
    .demo-modal-label { display: inline-flex; color: var(--brand-dark); background: var(--soft); border: 1px solid #b8dfeb; border-radius: 999px; padding: 0.18rem 0.55rem; font-size: 0.8rem; font-weight: 850; margin-bottom: 0.35rem; }
    .demo-modal-toolbar h3 { margin: 0; font-size: clamp(1.2rem, 2.6vw, 1.8rem); line-height: 1.1; }
    .demo-modal-close { width: 42px; height: 42px; border-radius: 999px; border: 1px solid var(--line); background: white; color: var(--ink); font-size: 1.35rem; cursor: pointer; }
    .demo-modal-dialog p { margin: 0; color: var(--muted); }
    .demo-modal-frame { overflow: auto; background: #eef4f8; border: 1px solid var(--line); border-radius: 16px; }
    .demo-modal-frame img { display: block; width: min(1280px, 100%); height: auto; max-width: none; margin: 0 auto; }
    .demo-modal-actions { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.65rem; }
    .split { display: grid; grid-template-columns: 0.9fr 1.1fr; gap: 1rem; align-items: start; }
    .feature-list { display: grid; gap: 0.7rem; }
    .feature { display: grid; grid-template-columns: auto 1fr; gap: 0.7rem; align-items: start; background: var(--paper); border: 1px solid var(--line); border-radius: 16px; padding: 0.85rem; }
    .check { color: white; background: var(--ok); width: 1.45rem; height: 1.45rem; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 900; margin-top: 0.1rem; }
    .trust { background: #0f2236; color: white; }
    .trust .section-head p, .trust .card p, .trust li { color: #c7d7e5; }
    .trust .card { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.16); }
    .trust a { color: #9ee7ff; }
    .cta { background: linear-gradient(135deg, #005e7d, #0f766e); color: white; border-radius: 28px; padding: clamp(1.3rem, 4vw, 2.4rem); display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 1rem; align-items: center; box-shadow: var(--shadow); }
    .cta p { color: #dff7ff; }
    .contact-box { background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.22); border-radius: 18px; padding: 1rem; }
    footer { max-width: 1180px; margin: 0 auto; padding: 2rem 1.25rem 3rem; color: var(--muted); font-size: 0.92rem; }
    @media (max-width: 880px) { .hero, .split, .cta { grid-template-columns: 1fr; } .grid, .grid.two { grid-template-columns: 1fr; } .demo-grid { grid-auto-columns: minmax(280px, 88%); } .demo-carousel-controls { justify-content: flex-start; } .demo-modal-actions { justify-content: stretch; } .demo-modal-actions .button { flex: 1 1 100%; } .nav { align-items: flex-start; flex-direction: column; } .status-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="topbar">
    <nav class="nav" aria-label="Hauptnavigation">
      <a class="brand" href="./">Szenarienrechner-EOG</a>
      <div class="nav-links">
        <a href="#positionierung">Positionierung</a>
        <a href="#features">Features</a>
        <a href="#vertrauen">Vertrauen</a>
        <a href="#kontakt">Kontakt</a>
        <a href="app.html">App starten</a>
      </div>
    </nav>
  </div>

  <header class="hero">
    <div>
      <span class="eyebrow">Offline-first · Open Source · regulierte Sparten Strom/Gas</span>
      <h1>Regulierte Finanzplanung verständlich, prüfbar und entscheidungsreif machen.</h1>
      <p class="lead">Der Szenarienrechner-EOG ist ein browserbasiertes Open-Source-Werkzeug für Stadtwerke, EVUs und Verteilnetzbetreiber. Die App strukturiert Maßnahmenportfolios, regulatorische Wirkungen, Cashflow-Sichten, Projektplan, Gremienvorlagen und Exportartefakte — ohne Backend, Telemetrie oder automatische Datenübertragung.</p>
      <div class="actions">
        ${link('app.html', 'App starten', 'button primary')}
        ${externalLink(arcadeDemoUrl, 'Interaktive Demo ansehen')}
        ${link('szenarienrechner-eog.html', 'Offline-HTML öffnen')}
        ${link('story/planungsrunde-userstory.html', 'User-Story lesen')}
        ${link('docs/index.html', 'Methodik & Vorlagen', 'button ghost')}
      </div>
    </div>
    <aside class="hero-card" aria-label="Kurzstatus">
      <div class="status-grid">
        <div class="status"><strong>0.3.1</strong><span>aktueller Pilot-Release</span></div>
        <div class="status"><strong>TRL 5</strong><span>technisch pilotfähig, reale Validierung bleibt erforderlich</span></div>
        <div class="status"><strong>Single File</strong><span>offline nutzbar und mit Daten weitergebbar</span></div>
        <div class="status"><strong>Apache-2.0</strong><span>offen nutzbar, prüfbar, forkbar</span></div>
      </div>
      <p>Für produktive Entscheidungen gilt: keine Rechts-, Steuer-, Wirtschaftsprüfungs- oder Regulierungsberatung; fachliche Prüfung bleibt erforderlich.</p>
    </aside>
  </header>

  <section id="positionierung">
    <div class="section-head">
      <h2>Mehr als ein EOG-Rechner: ein Arbeitsraum für regulierte Spartenplanung.</h2>
      <p>Kleine und mittlere VNBs müssen technische Maßnahmen, Wirtschaftsplanung, HGB-/Controlling-Sicht, regulatorische Logik, Finanzierung und Gremienkommunikation zusammenbringen. Genau dafür liefert die App Struktur, Sprache und exportierbare Artefakte.</p>
    </div>
    <div class="grid three">
      <article class="card"><h3>Für Stadtwerke und VNBs</h3><p>Maßnahmen, Budgets, Aktivierung, Wirkannahmen und Beschlussfähigkeit in einem wiederaufnahmefähigen Arbeitsstand.</p></article>
      <article class="card"><h3>Für Regulierung und Finanzen</h3><p>Klare Trennung von EOG-Wirkung, indikativer Cashflow-Sicht, laufenden Effekten, Einmaleffekten und prüfpflichtigen Annahmen.</p></article>
      <article class="card"><h3>Für Management und Gremien</h3><p>Reports, Gremienvorlagen, Projektplan, Auflagenlogik und KI-Prompt-Export übersetzen komplexe Planung in entscheidbare Sprache.</p></article>
    </div>
  </section>

  <section id="features">
    <div class="section-head">
      <h2>Fachliche und technische Features getrennt sichtbar.</h2>
      <p>Die fachlichen Funktionen helfen beim Denken und Entscheiden; die technischen Funktionen sorgen dafür, dass die App in EVU-/VNB-Umgebungen nicht zum Datensilo wird.</p>
    </div>
    <div class="split">
      <div class="card">
        <h3>Fachliche Features</h3>
        <div class="feature-list">
          <div class="feature"><span class="check">✓</span><div><strong>Maßnahmenportfolio Strom/Gas</strong><br>CAPEX/OPEX, Aktivierbarkeit, Nutzungsdauer, Reinvestition, Rückbau und Wirkungsverzüge.</div></div>
          <div class="feature"><span class="check">✓</span><div><strong>Governance-Ampel</strong><br>Robust tragfähig, tragfähig mit Auflage, nicht tragfähig oder nicht entscheidungsreif — inklusive konservativem Urteil.</div></div>
          <div class="feature"><span class="check">✓</span><div><strong>EOG-/Cashflow-Brücke</strong><br>Regulatorische EOG-Wirkung, wirtschaftliche Überleitung, laufende Effekte und Einmaleffekte getrennt.</div></div>
          <div class="feature"><span class="check">✓</span><div><strong>Herleitungshelfer</strong><br>Q-Wirkung, Risiko-Erwartungswert, CAPEX/OPEX-Split, Nutzungsdauer/AfA und Finanzierungsspread.</div></div>
          <div class="feature"><span class="check">✓</span><div><strong>Projektplan</strong><br>Meilensteine, Rollen-Swimlanes, Abhängigkeiten, eigene Aufgaben, nächste fällige Aufgabe je Rolle.</div></div>
          <div class="feature"><span class="check">✓</span><div><strong>Monitoring-/§14d-Vorbereitung</strong><br>Externe Maßnahmen-ID, Netzebene, Region, Status, Genehmigungsstand, Kapazitätswirkung und Alternativenprüfung für Reporting-Profile.</div></div>
        </div>
      </div>
      <div class="card">
        <h3>Technische Features</h3>
        <div class="feature-list">
          <div class="feature"><span class="check">✓</span><div><strong>Offline-first Single-File</strong><br>Keine Telemetrie, keine Cookies, kein Backend; Daten bleiben lokal im Browser oder in exportierten Dateien.</div></div>
          <div class="feature"><span class="check">✓</span><div><strong>HTML mit Daten speichern</strong><br>App-Version und Arbeitsstand reisen gemeinsam als selbsttragende HTML-Datei.</div></div>
          <div class="feature"><span class="check">✓</span><div><strong>Excel-freundliche Exporte</strong><br>XLSX und CSV-ZIP für Maßnahmen, KPIs, Jahreswerte, Projektplan, Klärpunkte, Monitoring-Aggregate, Q-Reg-Netzleistungsfähigkeit, §14d-Netzausbauplan und Provenienz.</div></div>
          <div class="feature"><span class="check">✓</span><div><strong>Aktualitätsprüfung mit Einwilligung</strong><br>App-/Ruleset-Stand und SHA-256 über Manifest prüfen, ohne Modelldaten zu übertragen.</div></div>
          <div class="feature"><span class="check">✓</span><div><strong>KI-Prompt-Export</strong><br>Rollenbezogene Prompts lokal erzeugen; keine KI-API, keine automatische Übertragung.</div></div>
        </div>
      </div>
    </div>
  </section>

  <section id="workflow-proofs">
    <div class="section-head">
      <h2>So arbeitet die App in der Praxis.</h2>
      <p>Die folgenden Workflow-Beweise sind echte Screenshots aus dem gebauten Browser-Artefakt. Sie zeigen nicht nur Feature-Namen, sondern konkrete Arbeitsschritte: starten, bewerten, entscheiden, planen, exportieren und weitergeben.</p>
      <p>${externalLink(arcadeDemoUrl, 'Geführte Arcade-Demo: Von der Netzmaßnahme zur belastbaren Investitionsentscheidung', 'button primary')}</p>
    </div>
    <div class="demo-carousel-shell">
      <div class="demo-carousel-controls" aria-label="Praxis-Beispiele durchblättern">
        <button class="button" type="button" data-demo-scroll="prev">← Zurück</button>
        <button class="button" type="button" data-demo-scroll="next">Weiter →</button>
      </div>
      <div class="demo-grid" data-demo-carousel aria-label="Praxis-Beispiele als Karussell">
        ${renderWorkflowDemoCards()}
      </div>
    </div>
    ${renderWorkflowDemoModal()}
    <p class="proof-note">Die gezeigten Daten sind synthetische Demodaten. Für reale Planungen bleiben JSON und „HTML mit Daten speichern“ die kanonischen Arbeitsstände; XLSX/CSV, PDF und KI-Prompts sind Übergabe- und Kommunikationsartefakte.</p>
  </section>

  <section id="moeglich">
    <div class="section-head">
      <h2>Was wird mit der App möglich?</h2>
      <p>Die Anwendung soll Excel nicht dadurch verdrängen, dass sie Daten einschließt, sondern dadurch, dass sie Struktur, Governance und Exportfähigkeit bietet.</p>
    </div>
    <div class="grid">
      <article class="card"><h3>30-Minuten-Selbsttest</h3><p>Demodaten laden, Projektplan ansehen, Entscheidungsampel lesen, XLSX exportieren und die Offline-HTML mit Daten speichern.</p><p>${link('docs/pilot-program.html', 'Pilotprogramm ansehen')}</p></article>
      <article class="card"><h3>Planungsrunde vorbereiten</h3><p>Rollen, Klärpunkte, Datenquellen, Aufgaben, Fälligkeiten und Beschlussartefakte werden im Arbeitsstand dokumentiert.</p><p>${link('docs/project-plan.html', 'Projektplan verstehen')}</p></article>
      <article class="card"><h3>Gremium erklären</h3><p>Management-Report, Gremienvorlage und KI-Prompt-Export übersetzen technische und regulatorische Details in Beschlusslogik.</p><p>${link('story/planungsrunde-userstory.html', 'User-Story lesen')}</p></article>
    </div>
  </section>

  <section id="vertrauen" class="trust">
    <div class="section-head">
      <h2>Vertrauen entsteht durch Transparenz, nicht durch Blackbox-Automatisierung.</h2>
      <p>Die App ist bewusst begrenzt: Sie strukturiert Planung, macht Annahmen sichtbar und erzeugt prüfbare Artefakte. Sie ersetzt keine fachliche Freigabe und keine regulatorische Einzelfallprüfung.</p>
    </div>
    <div class="grid">
      <article class="card"><h3>Datensouveränität</h3><p>Standardmäßig kein Netzzugriff. Aktualitätsprüfung und GitHub-Support sind nutzerinitiierte Aktionen mit klarer Einwilligung.</p></article>
      <article class="card"><h3>Provenienz</h3><p>Build-Commit, Build-Zeit, Ruleset-ID, Ruleset-Konfidenz und SHA-256 werden im Export und Manifest geführt.</p></article>
      <article class="card"><h3>Open Source</h3><p>Apache-2.0, GitHub-Repo, Issues, Pull Requests, Release-Artefakte und Dokumentation sind öffentlich prüfbar.</p></article>
    </div>
  </section>

  <section id="seo-inhalte">
    <div class="section-head">
      <h2>Wissen, Vorlagen und Einstiegspunkte.</h2>
      <p>Die statischen Seiten sind als Mini-Wissensbasis aufgebaut: suchmaschinenfreundlich, druckbar und für interne Weitergabe geeignet.</p>
    </div>
    <div class="grid">
      <article class="card"><h3>Methodik</h3><ul><li><a href="docs/handbook/regulierte-finanzplanung-vnb.html">Regulierte Finanzplanung für kleine VNBs</a></li><li><a href="docs/visuals/index.html">Methodik-Grafikserie</a></li><li><a href="docs/visuals/methodik-grafikserie.html">7-Slide-Master</a></li><li><a href="docs/regulatory-map.html">Regulatorik-Landkarte Strom/Gas</a></li><li><a href="docs/maturity-model.html">Reifegradmodell</a></li></ul></article>
      <article class="card"><h3>Arbeitsartefakte</h3><ul><li><a href="docs/templates/gremienvorlage.html">Gremienvorlage</a></li><li><a href="docs/templates/massnahmensteckbrief.html">Maßnahmensteckbrief</a></li><li><a href="docs/starter-kits/index.html">Starter-Kits</a></li></ul></article>
      <article class="card"><h3>Technische Nachweise</h3><ul><li><a href="release-manifest.json">Release-Manifest</a></li><li><a href="llm.txt">LLM-Kontextdatei</a></li><li><a href="https://github.com/energychain/Szenarienrechner-EOG">GitHub-Repository</a></li></ul></article>
    </div>
  </section>

  <section id="kontakt">
    <div class="cta">
      <div>
        <h2>Pilot, Feedback oder Cernion-Ausbaupfad?</h2>
        <p>Der Szenarienrechner-EOG ist der offene Einstieg. Für Datenintegration, kontinuierliche Analysen, MaStR-/Netz-/Vertriebskontext und operative Entscheidungsunterstützung ist Cernion der professionelle Ausbaupfad der STROMDAO GmbH.</p>
        <div class="actions">
          ${link('mailto:kontakt@stromdao.de?subject=Szenarienrechner-EOG%20Pilot%20/%20Kontakt', 'STROMDAO kontaktieren', 'button primary')}
          ${link('https://github.com/energychain/Szenarienrechner-EOG/issues/new/choose', 'Feedback auf GitHub')}
        </div>
      </div>
      <div class="contact-box">
        <strong>STROMDAO GmbH</strong><br>
        Gerhard Weiser Ring 29<br>
        69256 Mauer, Deutschland<br>
        E-Mail: <a href="mailto:kontakt@stromdao.de">kontakt@stromdao.de</a><br>
        Telefon: +49 6226 9680090<br>
        <a href="https://stromdao.de">stromdao.de</a> · <a href="https://cernion.de">cernion.de</a>
      </div>
    </div>
  </section>

  <footer>
    Szenarienrechner-EOG · Version ${appVersion} · Build ${commit} · Apache-2.0 · Keine Rechts-, Steuer- oder Regulierungsberatung. Produktive Entscheidungen müssen fachlich geprüft werden.
  </footer>
  ${renderWorkflowDemoScript()}
</body>
</html>`;
}

export function buildHomepage() {
  mkdirSync('dist', { recursive: true });
  copyHomepageAssets();
  writeFileSync('dist/index.html', renderHomepage());
  console.log('Built dist/index.html homepage');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildHomepage();
}
