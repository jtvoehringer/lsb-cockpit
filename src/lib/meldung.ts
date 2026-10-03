'use client'
// Erfolgsmeldung nach einer Aktion („✓ Gespeichert …“) – überlebt einen Seitenwechsel (sessionStorage) und wird
// von <Meldungen /> im App-Rahmen angezeigt. Nur kurze Texte ohne Klientendaten (Chiffre, Nummer, Art der Aktion).

const SCHLUESSEL = 'lsb-meldung'
export const MELDUNG_EREIGNIS = 'lsb-meldung'

export function zeigeMeldung(text: string) {
  try { sessionStorage.setItem(SCHLUESSEL, text) } catch { /* privat/gesperrt – Ereignis genügt */ }
  window.dispatchEvent(new CustomEvent(MELDUNG_EREIGNIS, { detail: text }))
}

/** Liest eine wartende Meldung (z. B. nach Seitenwechsel) und entfernt sie */
export function holeMeldung(): string {
  try { const t = sessionStorage.getItem(SCHLUESSEL) ?? ''; sessionStorage.removeItem(SCHLUESSEL); return t } catch { return '' }
}
