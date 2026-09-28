// Kodierungen für den Krypto-Kern: Base64 (Speicherung), Hex (Tests), Crockford-Base32 (Wiederherstellungscode).

export function zuBase64(daten: ArrayBuffer | Uint8Array): string {
  const bytes = daten instanceof Uint8Array ? daten : new Uint8Array(daten)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

export function ausBase64(text: string): Uint8Array<ArrayBuffer> {
  const s = atob(text)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

/** Base64url ohne Auffüllzeichen – z. B. für das Anmelde-Geheimnis */
export function zuBase64Url(daten: ArrayBuffer | Uint8Array): string {
  return zuBase64(daten).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function zuHex(daten: ArrayBuffer | Uint8Array): string {
  const bytes = daten instanceof Uint8Array ? daten : new Uint8Array(daten)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function ausHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

export const utf8 = (text: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>

// Crockford-Base32: ohne I, L, O, U – gut vorlesbar und abschreibbar
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function zuCrockford(bytes: Uint8Array): string {
  let bits = 0, wert = 0, out = ''
  for (const b of bytes) {
    wert = ((wert << 8) | b) & 0xffff
    bits += 8
    while (bits >= 5) {
      out += CROCKFORD[(wert >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += CROCKFORD[(wert << (5 - bits)) & 31]
  return out
}

export function ausCrockford(text: string, laenge: number): Uint8Array<ArrayBuffer> {
  const norm = text.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1')
  const out = new Uint8Array(laenge)
  let bits = 0, wert = 0, i = 0
  for (const c of norm) {
    const v = CROCKFORD.indexOf(c)
    if (v < 0) throw new Error('Ungültiges Zeichen im Code')
    wert = ((wert << 5) | v) & 0xffff
    bits += 5
    if (bits >= 8) {
      if (i >= laenge) throw new Error('Code ist zu lang')
      out[i++] = (wert >>> (bits - 8)) & 0xff
      bits -= 8
    }
  }
  if (i !== laenge) throw new Error('Code ist unvollständig')
  return out
}
