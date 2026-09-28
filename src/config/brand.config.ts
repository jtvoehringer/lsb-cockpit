// Corporate Design der Praxis (Lebens- & Sozialberatung · Melanie Vöhringer) – Brand tokens v1.3 (2026-09-24)
// Quelle: Claude Design „Mivora CI“ (brand.config.ts v1.0, Original unter CI/quelle/).
// v1.3 übernimmt die Originalpalette unverändert, passt einzelne Werte an (WCAG 2.2 AA, exakte Logo-Maße)
// und ergänzt Tokens, Flächen, Dateien und Praxisangaben – alle Abweichungen: README.md, „Änderungen gegenüber dem Export“.
//
// NAMENSWECHSEL: NAME und SLUG ändern, dann in CI/tools „npm run alles“ ausführen.
const NAME = "Mivora";
const SLUG = "mivora"; // Dateinamen: <slug>-logo.svg …

export const brand = {
  name: NAME,                       // Praxis- und Markenname (Logo, Briefkopf, Website)
  appName: "LSB Cockpit",           // interne Web-Anwendung (Kopfzeile, Anmeldeseite, Systemmails) – Arbeitstitel
  tagline: "Lebens- & Sozialberatung",
  owner: {
    name: "Melanie Vöhringer",
    title: "Lebens- und Sozialberaterin",
    address: "2352 Gumpoldskirchen",
    email: "", // Entwurf nannte eine private Provider-Adresse – eigene Domain-Adresse eintragen (README, Offene Punkte)
  },
  // Pflichtangaben für Briefkopf, Impressum, E-Mail-Signatur und Kundendokumente (§ 63 GewO, § 5 ECG, § 25 MedienG).
  // Erst nach der Gewerbeanmeldung bekannt – vor dem ersten Einsatz befüllen.
  praxis: {
    firmenwortlaut: "",   // wie im GISA eingetragen
    strasse: "",          // Standort der Gewerbeberechtigung: Straße und Hausnummer
    plzOrt: "2352 Gumpoldskirchen",
    telefon: "",
    email: "",            // z. B. praxis@<domain>.at
    web: "",              // z. B. https://<domain>.at
    gisaZahl: "",
    gewerbebehoerde: "",  // aus dem GISA-Auszug übernehmen (voraussichtlich Bezirkshauptmannschaft Mödling)
    kammer: "Wirtschaftskammer Niederösterreich, Fachgruppe Personenberatung und Personenbetreuung", // zu bestätigen
    berufsbezeichnung: "Lebens- und Sozialberaterin (verliehen in Österreich)",
    berufsrecht: "Gewerbeordnung 1994, abrufbar unter www.ris.bka.gv.at",
    uid: "",              // nur falls vorhanden
  },
  voice: {
    address: "du",
    tone: ["ruhig", "zugewandt", "kompetent"],
    // VORSCHLAG – mit der Inhaberin abstimmen und rechtlich gegenlesen lassen (README, „Tonalität“)
    rules: {
      status: "Vorschlag",
      anrede: { klientinnen: "du", rechtstexte: "du, sachlich-neutral", unternehmen: "Sie", jugendliche: "du, eigene altersgerechte Fassung" },
      gendern: "Doppelpunkt (Klient:innen)",
      vermeiden: ["Therapie", "Behandlung", "Heilung", "Diagnose", "Patient:in", "Psychologin", "Psychotherapeutin"],
      abgrenzung: "Lebens- und Sozialberatung ersetzt keine ärztliche, psychotherapeutische oder klinisch-psychologische Behandlung.",
    },
  },

  colors: {
    palette: {
      forest: "#2F3E33",     // Waldgrün – Primär, Text auf hell, dunkle Flächen
      moss: "#5B6F5E",       // Moos – Sekundärtext, Links, Unterzeile im Logo
      sage: "#8FA38F",       // Salbei – Bildmarke, Flächen
      terracotta: "#C4805E", // Terrakotta – Akzent, Flächen, Akzentbalken (v1.0: „Akzent, CTAs“ – CTAs jetzt terracottaDeep)
      linen: "#F4F1EA",      // Leinen – Hintergrund
      white: "#FFFFFF",
      ink: "#2B2A27",        // Fließtext
      stone: "#57534C",      // gedämpfter Text
      pebble: "#7A756C",     // Icons, Dekor (v1.0: „Captions, Meta“ – als Text jetzt pebbleDeep)
      line: "#EAE6DE",       // Trennlinien
      sand: "#E3DED2",       // Bild-Platzhalter, Flächen
      // NEU – gleicher Farbton und gleiche Buntheit (OKLCH), nur Helligkeit angepasst:
      terracottaDeep: "#9D5C3B", // Buttons mit weißer Schrift, Terrakotta-Text, Fokus
      terracottaDark: "#8A4B2A", // Hover-Zustand zu terracottaDeep
      pebbleDeep: "#716C63",     // Captions, Meta, Overlines, Platzhaltertext
      sageLight: "#97AB97",      // Sekundärtext auf Waldgrün, Unterzeile im inversen Logo
      // NEU – aus dem Entwurf übernommen (dort ohne Token):
      forestDeep: "#1F2A22",     // Entwurf: Social-Post-Headline auf Salbei → Text auf Salbei
      taupe: "#8A857C",          // Entwurf: Rücksendezeile im Briefkopf → hier Rahmen von Eingabefeldern (≥ 3:1)
    },
    semantic: {
      background: "#F4F1EA",
      surface: "#FFFFFF",
      surfaceInverse: "#2F3E33",
      text: "#2B2A27",
      textMuted: "#57534C",        // auch einzige Textfarbe (neben text) auf sand-Flächen
      textSubtle: "#716C63",       // v1.0: #7A756C (4,05:1 auf Leinen) → pebbleDeep (4,62:1)
      textInverse: "#F4F1EA",
      textInverseMuted: "#97AB97", // NEU: Sekundärtext auf surfaceInverse
      textOnSage: "#1F2A22",       // NEU: Text, Überschriften, Links auf Salbei-Flächen
      textOnAccent: "#1F2A22",     // NEU: Text, Überschriften, Links auf Terrakotta-Flächen (4,66:1)
      placeholder: "#716C63",      // NEU: Platzhaltertext in Eingabefeldern
      heading: "#2F3E33",
      primary: "#2F3E33",
      primaryContrast: "#F4F1EA",
      accent: "#C4805E",           // Flächen, Akzentbalken, Illustration – Text darauf erst ab 24 px
      accentContrast: "#FFFFFF",   // nur Großtext ab 24 px auf accent (3,18:1)
      accentStrong: "#9D5C3B",     // NEU: CTA-Buttons, Terrakotta-Links und -Text
      accentStrongHover: "#8A4B2A",
      accentStrongContrast: "#FFFFFF",
      link: "#5B6F5E",             // Links im Fließtext immer unterstreichen; auf sand: linkHover verwenden
      linkHover: "#2F3E33",
      border: "#EAE6DE",           // Trennlinien (dekorativ)
      borderInput: "#8A857C",      // NEU: Rahmen von Eingabefeldern, Checkboxen, Selects – Formulare nur auf hellen Flächen
      focus: "#9D5C3B",            // v1.0: #C4805E (2,82:1 auf Leinen) → accentStrong; auf Leinen/Weiß/sand
      focusInverse: "#C4805E",     // NEU: Fokusrahmen auf Waldgrün (3,55:1); auf Waldgrün tief Leinen verwenden
      focusOnColor: "#2F3E33",     // NEU: Fokusrahmen auf Salbei- und Terrakotta-Flächen
    },
  },

  // NEU: Flächen. Jede Fläche legt Textfarbe, Überschrift, Link, Link-Hover und Fokusrahmen fest.
  // tokens.css setzt diese Werte über die Klassen bzw. das Attribut data-surface="<name>" (bei bg-…/90, md:bg-… nur über data-surface);
  // die innerste umgebende Fläche gewinnt. generate-tokens.mjs prüft jede Fläche gegen jeden ihrer Hintergründe.
  surfaces: {
    hell:       { classes: ["bg-background", "bg-surface", "bg-linen", "bg-white"], bg: ["background", "surface"], text: "text", heading: "heading", link: "link", linkHover: "linkHover", focus: "focus", forms: true },
    sand:       { classes: ["bg-sand"], bg: ["sand"], text: "text", heading: "heading", link: "linkHover", linkHover: "forestDeep", focus: "focus", forms: false },
    dunkel:     { classes: ["bg-surface-inverse", "bg-primary", "bg-forest"], bg: ["surfaceInverse"], text: "textInverse", heading: "textInverse", link: "textInverse", linkHover: "textInverseMuted", focus: "focusInverse", forms: false },
    tief:       { classes: ["bg-forest-deep"], bg: ["forestDeep"], text: "textInverse", heading: "textInverse", link: "textInverse", linkHover: "textInverseMuted", focus: "linen", forms: false },
    salbei:     { classes: ["bg-sage"], bg: ["sage"], text: "textOnSage", heading: "textOnSage", link: "textOnSage", linkHover: "textOnSage", focus: "focusOnColor", forms: false },
    terrakotta: { classes: ["bg-accent", "bg-terracotta"], bg: ["accent"], text: "textOnAccent", heading: "textOnAccent", link: "textOnAccent", linkHover: "textOnAccent", focus: "focusOnColor", forms: false },
  },

  fonts: {
    // SIL Open Font License 1.1. In App und Website selbst hosten (next/font bzw. CI/fonts) –
    // nie zur Laufzeit von fonts.googleapis.com laden. „google“ ist nur Achsen-/Schnitt-Referenz für den Build.
    heading: { family: "'Newsreader', Georgia, serif", weights: [300, 400, 500], axes: ["opsz"], google: "Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;1,6..72,400" },
    body: { family: "'Instrument Sans', system-ui, sans-serif", weights: [400, 500, 600], google: "Instrument+Sans:wght@400;500;600" },
    // Keine Mono-Schrift in der CI: Chiffren und Zahlen mit tabellarischen Ziffern (font-variant-numeric: tabular-nums).
  },

  typeScale: {
    display: { font: "heading", size: 56, lineHeight: 1.05, weight: 300, letterSpacing: "-0.01em" },
    h1: { font: "heading", size: 40, lineHeight: 1.05, weight: 300 },
    h2: { font: "heading", size: 30, lineHeight: 1.1, weight: 400 },
    h3: { font: "heading", size: 20, lineHeight: 1.2, weight: 400 },
    quote: { font: "heading", size: 28, lineHeight: 1.15, weight: 400, style: "italic" },
    bodyLg: { font: "body", size: 17, lineHeight: 1.55, weight: 400 },
    body: { font: "body", size: 15, lineHeight: 1.55, weight: 400 },
    small: { font: "body", size: 13, lineHeight: 1.5, weight: 400 },
    overline: { font: "body", size: 11, lineHeight: 1.4, weight: 500, letterSpacing: "0.2em", transform: "uppercase" },
  },

  space: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 40, 8: 56, 9: 64, 10: 96 },

  // Achtung: überschreiben in Tailwind die Standardwerte rounded-sm/md/lg (rounded-xl/2xl nicht verwenden, sie wären kleiner).
  // arch nur als rounded-arch (4 Werte).
  // arch v1.0 "999px 999px 8px 8px" skaliert in CSS alle Radien herunter (unten ≈ 1 px) → Designwert übernommen
  radius: { sm: 4, md: 8, lg: 14, pill: 999, arch: "120px 120px 8px 8px" },

  shadow: { paper: "0 1px 3px rgba(0,0,0,0.08)" },

  logo: {
    // Bildmarke: zwei Kreise, Durchmesser d. Gefüllter Kreis links, Umrisskreis rechts darüber (Strich innen).
    mark: {
      filledCircle: { color: "sage" },
      outlineCircle: { color: "forest", strokeRatio: 5 / 88 }, // 2.5 / 44 (v1.0 gerundet 0.057)
      offsetRatio: 7 / 22,  // 14 / 44 (v1.0: 0.318)
      widthRatio: 29 / 22,  // 58 / 44 (v1.0: 1.318)
    },
    // NEU: kleiner Master (Entwurf: Briefkopf und App-Icon) – für Kreisdurchmesser unter 32 px
    markSmall: { d: 22, offset: 8, stroke: 1.5 },
    // NEU: eigene Favicon-Master je Größe (Marke füllt die Kachel, ganzzahlige Lage) – abgeleitet, nicht im Entwurf
    favicon: {
      px48: { tile: 48, radius: 10, d: 24, offset: 10, stroke: 3, x: 7, y: 12 },
      px32: { tile: 32, radius: 7, d: 16, offset: 6, stroke: 2, x: 5, y: 8 },
      px16: { tile: 16, radius: 3.5, d: 10, offset: 4, stroke: 1.5, x: 1, y: 3 },
    },
    // NEU: Signaturkachel laut Entwurf (52 × 52, Radius 12)
    signature: { tile: 52, radius: 12, d: 20, offset: 8, stroke: 1.5, x: 12, y: 16 },
    wordmark: { font: "heading", weight: 400, sizeRatio: 12 / 11 }, // 48 / 44; Sperrung je Lockup (s. u.)
    gapRatio: 9 / 22,        // 18 / 44 (v1.0: 0.41) – Abstand Marke–Wortmarke
    clearSpaceRatio: 0.5,    // Schutzzone = 0.5 × d rundum
    // Regeln für Mindestgrößen – die Werte je Datei berechnet build-logos.mjs nach logo/mindestgroessen.json
    // (v1.0: „Marke 16 px, Lockup 96 px, Druck 20 mm“ – damit wurde der Strich dünner als im Entwurf):
    minSize: {
      markDiameterPx: 32,  // großer Master (Hauptlogo, Bildmarke): Kreis mindestens 32 px
      strokePx: 1.5,       // kleiner Master (Kompaktlogo, Bildmarke klein): Strich mindestens 1,5 px
      taglinePrintPt: 6,   // Hauptlogo im Druck: Unterzeile mindestens 6 pt
      compactPrintMm: 20,  // Kompaktlogo im Druck: mindestens 20 mm breit
    },
    // Lockup-Geometrie (gemessen im Export, px bei Referenzgröße)
    lockups: {
      primary: { d: 44, markY: 8.59375, textX: 76, wordmarkSize: 48, wordmarkBaseline: 32, letterSpacing: "0.01em", taglineSize: 11, taglineBaseline: 58.1875, taglineLetterSpacing: "0.2em" },
      compact: { d: 22, markY: 1, textX: 40, wordmarkSize: 24, wordmarkBaseline: 18, letterSpacing: "0" },
    },
    variants: {
      primary: { background: "linen", filled: "sage", outline: "forest", text: "forest", tagline: "moss" }, // auch auf Weiß
      inverse: { background: "forest", filled: "sage", outline: "linen", text: "linen", tagline: "sageLight" },
      accent: { background: "terracotta", filled: "linen", outline: "forest" }, // Master-Geometrie (Entwurfskachel gerundet: d38/14/2,5)
      onSage: { background: "sage", filled: "linen", outline: "forest", text: "forest" }, // Entwurf: Social-Post; Datei = akzent
      appIcon: { background: "forest", filled: "sage", outline: "linen", radius: "lg" },
    },
    // Dateien (in der App unter /public/brand/; Icons siehe README „Einsatz in der Web-Anwendung“)
    files: {
      logo: `/brand/${SLUG}-logo.svg`,
      logoInverse: `/brand/${SLUG}-logo-inverse.svg`,
      logoCompact: `/brand/${SLUG}-logo-kompakt.svg`,
      logoCompactInverse: `/brand/${SLUG}-logo-kompakt-inverse.svg`,
      mark: `/brand/${SLUG}-bildmarke.svg`,
      markInverse: `/brand/${SLUG}-bildmarke-inverse.svg`,
      markSmall: `/brand/${SLUG}-bildmarke-klein.svg`,
      markSmallInverse: `/brand/${SLUG}-bildmarke-klein-inverse.svg`,
      markAccent: `/brand/${SLUG}-bildmarke-akzent.svg`,   // auch für Salbei-Flächen (onSage)
      appIcon: `/brand/${SLUG}-app-icon.svg`,
      appIconFull: `/brand/${SLUG}-app-icon-vollflaeche.svg`,
      signature: `/brand/${SLUG}-signatur-icon.svg`,
      favicon: "/favicon.ico",
      png: {
        icon192: `/brand/${SLUG}-app-icon-192.png`,
        icon512: `/brand/${SLUG}-app-icon-512.png`,
        maskable512: `/brand/${SLUG}-icon-maskable-512.png`,
        appleTouch: "/brand/apple-touch-icon.png",
        signature104: `/brand/${SLUG}-signatur-icon-104.png`,
        logo600: `/brand/${SLUG}-logo-600.png`,
        logoInverse600: `/brand/${SLUG}-logo-inverse-600.png`,
        logoCompact450: `/brand/${SLUG}-logo-kompakt-450.png`,
      },
    },
    slug: SLUG,
  },

  print: {
    // senderLineSizePt: Entwurf 7 pt → 8 pt; Farbe der Rücksendezeile: textSubtle (Entwurf #8A857C = 3,66:1)
    letterhead: { format: "A4", marginMm: { top: 20, right: 22, bottom: 16, left: 22 }, senderLineSizePt: 8, senderLineColor: "textSubtle", bodySizePt: 10 },
  },
} as const;

export type Brand = typeof brand;
export default brand;
