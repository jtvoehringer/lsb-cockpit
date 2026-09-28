// Prüfung der Passphrase (Lösungsdesign 4.2): mindestens 16 Zeichen oder 5 Wörter, keine häufigen Passwörter.

const HAEUFIG = [
  'passwort', 'password', 'kennwort', '123456', 'qwertz', 'qwerty', 'hallo', 'geheim', 'sommer', 'winter',
  'schatz', 'melanie', 'lebensberatung', 'sozialberatung', 'beratung', 'passphrase', 'iloveyou', 'abc123',
]

export type PassphrasePruefung = { ok: boolean; hinweise: string[] }

export function pruefePassphrase(passphrase: string, email = ''): PassphrasePruefung {
  const p = passphrase.normalize('NFC')
  const hinweise: string[] = []
  const woerter = p.split(/[\s\-_.,;:]+/).filter((w) => w.length >= 3)
  const lang = p.length >= 16
  const vieleWoerter = woerter.length >= 5
  if (!lang && !vieleWoerter) hinweise.push('Mindestens 16 Zeichen oder 5 Wörter.')

  const klein = p.toLowerCase()
  if (HAEUFIG.some((h) => klein.replace(/[^a-z0-9äöüß]/g, '') === h || (klein.includes(h) && p.length < 24)))
    hinweise.push('Enthält ein häufig verwendetes Wort oder Passwort.')
  const lokal = email.split('@')[0]?.toLowerCase()
  if (lokal && lokal.length >= 3 && klein.includes(lokal)) hinweise.push('Darf die E-Mail-Adresse nicht enthalten.')
  if (/^(.)\1+$/.test(p) || /^(0123456789|abcdefghijklmnop)/i.test(p)) hinweise.push('Zu einfach aufgebaut.')
  if (new Set(p).size < 8) hinweise.push('Zu wenige verschiedene Zeichen.')

  return { ok: hinweise.length === 0, hinweise }
}
