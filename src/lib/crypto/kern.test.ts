// Tests des Krypto-Kerns (Lösungsdesign 8.4): bekannte Testvektoren, Round-Trips, Negativtests. Scheitert einer, bricht der Build ab.
import { describe, expect, it } from 'vitest'
import {
  aad, anmeldeGeheimnis, entpackeMaster, entschluessele, FalschePassphrase, formatiereCode, kekAusCode,
  kekAusPassphrase, kekAusPrf, masterMitPassphrase, neueKdfParameter, neuePasskeyParameter, neuerZonenSchluessel,
  schluesselbundEinrichten, schluesselbundOeffnen, tresorAusMaster, verpacke, verschluessele, type SchluesselbundEintrag,
} from './kern'
import { ausBase64, ausCrockford, ausHex, utf8, zuBase64, zuCrockford, zuHex } from './kodierung'
import { pruefePassphrase } from './passphrase'

const subtle = globalThis.crypto.subtle
const SCHNELL = 1000 // Iterationen in Tests; die Produktion nutzt PBKDF2_ITERATIONEN (600.000)

describe('Plattform-Testvektoren', () => {
  it('AES-256-GCM (McGrew/Viega, Test Case 13 und 14)', async () => {
    const k = await subtle.importKey('raw', new Uint8Array(32), 'AES-GCM', false, ['encrypt'])
    const iv = new Uint8Array(12)
    expect(zuHex(await subtle.encrypt({ name: 'AES-GCM', iv }, k, new Uint8Array(0)))).toBe('530f8afbc74536b9a963b4f1c4cb738b')
    expect(zuHex(await subtle.encrypt({ name: 'AES-GCM', iv }, k, new Uint8Array(16))))
      .toBe('cea7403d4d606b6e074ec5d3baf39d18' + 'd0d1c8a799996bf0265b98b5d48ab919')
  })

  it('PBKDF2-HMAC-SHA-256 (password/salt, 1 und 4096 Iterationen)', async () => {
    const basis = await subtle.importKey('raw', utf8('password'), 'PBKDF2', false, ['deriveBits'])
    const ab = (c: number) => subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: utf8('salt'), iterations: c }, basis, 256)
    expect(zuHex(await ab(1))).toBe('120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b')
    expect(zuHex(await ab(4096))).toBe('c5e478d59288c841aa530db6845c4c8d962893a001ce4e11a4963873aa98134a')
  })

  it('HKDF-SHA-256 (RFC 5869, Test Case 1)', async () => {
    const ikm = await subtle.importKey('raw', ausHex('0b'.repeat(22)), 'HKDF', false, ['deriveBits'])
    const okm = await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: ausHex('000102030405060708090a0b0c'), info: ausHex('f0f1f2f3f4f5f6f7f8f9') }, ikm, 42 * 8)
    expect(zuHex(okm)).toBe('3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865')
  })

  it('AES-KW (RFC 3394, 4.6: 256-Bit-Schlüssel mit 256-Bit-KEK)', async () => {
    const kek = await subtle.importKey('raw', ausHex('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f'), 'AES-KW', false, ['wrapKey'])
    const daten = await subtle.importKey('raw', ausHex('00112233445566778899aabbccddeeff000102030405060708090a0b0c0d0e0f'), 'AES-GCM', true, ['encrypt'])
    expect(zuHex(await subtle.wrapKey('raw', daten, kek, 'AES-KW')))
      .toBe('28c9f404c4b810f4cbccb35cfb87f8263f5786e2d80ed326cbc7f0e71a99f43bfb988b9b7a02dd21')
  })
})

describe('Kodierung', () => {
  it('Base64 und Hex hin und zurück', () => {
    const b = globalThis.crypto.getRandomValues(new Uint8Array(100))
    expect(ausBase64(zuBase64(b))).toEqual(b)
    expect(ausHex(zuHex(b))).toEqual(b)
  })
  it('Crockford: 128 Bit ergeben 26 Zeichen, tolerant bei Schreibweise', () => {
    const b = globalThis.crypto.getRandomValues(new Uint8Array(16))
    const code = zuCrockford(b)
    expect(code).toHaveLength(26)
    expect(ausCrockford(code, 16)).toEqual(b)
    expect(ausCrockford(formatiereCode(code).toLowerCase(), 16)).toEqual(b)
    expect(() => ausCrockford(code.slice(0, 20), 16)).toThrow()
    expect(() => ausCrockford(code.slice(0, 25) + 'U', 16)).toThrow()
  })
})

describe('Anmelde-Geheimnis', () => {
  it('ist deterministisch, hängt von E-Mail ab und nicht von Groß-/Kleinschreibung der E-Mail', async () => {
    const a = await anmeldeGeheimnis('eine lange sichere Passphrase', 'Test@Beispiel.at', SCHNELL)
    expect(a).toBe(await anmeldeGeheimnis('eine lange sichere Passphrase', 'test@beispiel.at ', SCHNELL))
    expect(a).not.toBe(await anmeldeGeheimnis('eine lange sichere Passphrase', 'andere@beispiel.at', SCHNELL))
    expect(a).not.toBe(await anmeldeGeheimnis('eine lange sichere Passphrasf', 'test@beispiel.at', SCHNELL))
    expect(a).toHaveLength(43)
  })
  it('Unicode-Normalisierung: gleiche Passphrase in NFC und NFD ergibt dasselbe Geheimnis', async () => {
    const nfc = 'Grüße aus Gumpoldskirchen'.normalize('NFC'), nfd = nfc.normalize('NFD')
    expect(nfc).not.toBe(nfd)
    expect(await anmeldeGeheimnis(nfc, 'x@y.at', SCHNELL)).toBe(await anmeldeGeheimnis(nfd, 'x@y.at', SCHNELL))
  })
})

describe('Datensätze verschlüsseln', () => {
  it('Round-Trip mit Umlauten, leerem Text und großem Text', async () => {
    const k = await neuerZonenSchluessel()
    const z = aad('protokoll_version', 'id-1', 'inhalt')
    for (const t of ['', 'Grüße – „Test“ ✓', 'x'.repeat(200_000)]) expect(await entschluessele(k, await verschluessele(k, t, z), z)).toBe(t)
  })
  it('gleicher Klartext ergibt jedes Mal anderen Chiffretext (Zufalls-IV)', async () => {
    const k = await neuerZonenSchluessel(), z = aad('t', '1', 'f')
    expect(await verschluessele(k, 'gleich', z)).not.toBe(await verschluessele(k, 'gleich', z))
  })
  it('falscher Schlüssel wird abgelehnt', async () => {
    const z = aad('t', '1', 'f')
    const c = await verschluessele(await neuerZonenSchluessel(), 'geheim', z)
    await expect(entschluessele(await neuerZonenSchluessel(), c, z)).rejects.toThrow()
  })
  it('vertauschter Datensatz (andere ID in der AAD) wird abgelehnt', async () => {
    const k = await neuerZonenSchluessel()
    const c = await verschluessele(k, 'geheim', aad('protokoll_version', 'id-1', 'inhalt'))
    await expect(entschluessele(k, c, aad('protokoll_version', 'id-2', 'inhalt'))).rejects.toThrow()
    await expect(entschluessele(k, c, aad('protokoll_version', 'id-1', 'abschluss'))).rejects.toThrow()
  })
  it('manipulierter oder abgeschnittener Chiffretext wird abgelehnt', async () => {
    const k = await neuerZonenSchluessel(), z = aad('t', '1', 'f')
    const roh = ausBase64(await verschluessele(k, 'geheim genug', z))
    const kippen = roh.slice(); kippen[20] ^= 1
    await expect(entschluessele(k, zuBase64(kippen), z)).rejects.toThrow()
    await expect(entschluessele(k, zuBase64(roh.slice(0, roh.length - 1)), z)).rejects.toThrow()
    await expect(entschluessele(k, zuBase64(roh.slice(0, 20)), z)).rejects.toThrow('zu kurz')
    const version = roh.slice(); version[0] = 2
    await expect(entschluessele(k, zuBase64(version), z)).rejects.toThrow('Formatversion')
  })
  it('Dateien (Bytes): Round-Trip, falsche Zuordnung wird abgelehnt', async () => {
    const { verschluesseleBytes, entschluesseleBytes } = await import('./kern')
    const k = await neuerZonenSchluessel()
    const daten = globalThis.crypto.getRandomValues(new Uint8Array(50_000))
    const c = await verschluesseleBytes(k, daten, aad('fin_beleg', 'b1', 'datei'))
    expect(new Uint8Array(await entschluesseleBytes(k, c, aad('fin_beleg', 'b1', 'datei')))).toEqual(daten)
    await expect(entschluesseleBytes(k, c, aad('fin_beleg', 'b2', 'datei'))).rejects.toThrow()
  })
  it('AAD-Angaben werden geprüft', () => {
    expect(() => aad('Tabelle; drop', '1', 'f')).toThrow()
    expect(() => aad('t', '', 'f')).toThrow()
  })
})

describe('Schlüsselbund', () => {
  const P = 'vier zufaellige woerter und noch eines'

  it('Einrichten und Öffnen: Zonen-Schlüssel ver- und entschlüsseln gegenseitig', async () => {
    const { eintraege, wiederherstellungscode } = await schluesselbundEinrichten(P, SCHNELL)
    expect(eintraege.map((e) => e.art).sort()).toEqual(['master', 'notfall', 'zone_a', 'zone_b', 'zone_c'])
    expect(wiederherstellungscode).toHaveLength(26)
    const a = await schluesselbundOeffnen(eintraege, P)
    const b = await schluesselbundOeffnen(eintraege, P)
    const z = aad('akte', 'x', 'inhalt')
    expect(await entschluessele(b.zone_b, await verschluessele(a.zone_b, 'hallo', z), z)).toBe('hallo')
    await expect(entschluessele(b.zone_c, await verschluessele(a.zone_b, 'hallo', z), z)).rejects.toThrow()
  })

  it('entpackte Zonen-Schlüssel sind nicht exportierbar', async () => {
    const { eintraege } = await schluesselbundEinrichten(P, SCHNELL)
    const t = await schluesselbundOeffnen(eintraege, P)
    expect(t.zone_a.extractable).toBe(false)
    await expect(subtle.exportKey('raw', t.zone_a)).rejects.toThrow()
  })

  it('falsche Passphrase ergibt FalschePassphrase', async () => {
    const { eintraege } = await schluesselbundEinrichten(P, SCHNELL)
    await expect(schluesselbundOeffnen(eintraege, P + '!')).rejects.toBeInstanceOf(FalschePassphrase)
  })

  it('Wiederherstellungscode öffnet den Master-Schlüssel, neue Passphrase danach nutzbar', async () => {
    const { eintraege, wiederherstellungscode } = await schluesselbundEinrichten(P, SCHNELL)
    const z = aad('akte', 'y', 'inhalt')
    const vorher = await verschluessele((await schluesselbundOeffnen(eintraege, P)).zone_b, 'alte Daten', z)

    const notfall = eintraege.find((e) => e.art === 'notfall')!
    const master = await entpackeMaster(notfall.verpackt, await kekAusCode(formatiereCode(wiederherstellungscode), notfall.kdf!), true)
    const kdf = neueKdfParameter(SCHNELL)
    const neu: SchluesselbundEintrag = { art: 'master', version: 2, verpackt: zuBase64(await subtle.wrapKey('raw', master, await kekAusPassphrase('ganz neue Passphrase für später', kdf), 'AES-KW')), kdf }
    const alle = [...eintraege, neu]

    const t = await schluesselbundOeffnen(alle, 'ganz neue Passphrase für später')
    expect(await entschluessele(t.zone_b, vorher, z)).toBe('alte Daten')
    await expect(schluesselbundOeffnen(alle, P)).rejects.toBeInstanceOf(FalschePassphrase) // alte Passphrase gilt nicht mehr
  })

  it('falscher Wiederherstellungscode wird abgelehnt', async () => {
    const { eintraege } = await schluesselbundEinrichten(P, SCHNELL)
    const notfall = eintraege.find((e) => e.art === 'notfall')!
    const falsch = zuCrockford(globalThis.crypto.getRandomValues(new Uint8Array(16)))
    await expect(entpackeMaster(notfall.verpackt, await kekAusCode(falsch, notfall.kdf!))).rejects.toThrow()
  })

  it('Passkey-PRF verpackt eine Kopie des Master-Schlüssels; anderes PRF oder Notfall-Parameter scheitern', async () => {
    const { eintraege } = await schluesselbundEinrichten(P, SCHNELL)
    const z = aad('akte', 'p', 'inhalt')
    const vorher = await verschluessele((await schluesselbundOeffnen(eintraege, P)).zone_b, 'geheim', z)

    const master = await masterMitPassphrase(eintraege, P, true)
    const prf = globalThis.crypto.getRandomValues(new Uint8Array(32))
    const kdf = neuePasskeyParameter()
    const verpackt = await verpacke(master, await kekAusPrf(prf, kdf))

    const t = await tresorAusMaster(eintraege, await entpackeMaster(verpackt, await kekAusPrf(prf, kdf)))
    expect(await entschluessele(t.zone_b, vorher, z)).toBe('geheim')
    const anderes = globalThis.crypto.getRandomValues(new Uint8Array(32))
    await expect(entpackeMaster(verpackt, await kekAusPrf(anderes, kdf))).rejects.toThrow()
    await expect(kekAusPrf(prf, eintraege.find((e) => e.art === 'notfall')!.kdf!)).rejects.toThrow()
    await expect(kekAusPrf(prf.slice(0, 16), kdf)).rejects.toThrow()
    // Ohne „exportierbar“ lässt sich der Master nicht neu verpacken
    await expect(verpacke(await masterMitPassphrase(eintraege, P), await kekAusPrf(prf, kdf))).rejects.toThrow()
  })

  it('Produktions-Iterationen: 600.000', async () => {
    const { PBKDF2_ITERATIONEN } = await import('./kern')
    expect(PBKDF2_ITERATIONEN).toBe(600_000)
    expect(neueKdfParameter()).toMatchObject({ alg: 'PBKDF2-SHA256', iter: 600_000 })
  })
})

describe('Passphrase-Prüfung', () => {
  it('lehnt kurze und häufige ab, akzeptiert lange und Wortfolgen', () => {
    expect(pruefePassphrase('kurz').ok).toBe(false)
    expect(pruefePassphrase('Passwort1234567890').ok).toBe(false)
    expect(pruefePassphrase('aaaaaaaaaaaaaaaaaaaa').ok).toBe(false)
    expect(pruefePassphrase('Wolke Tanne Kiesel Brücke Laterne').ok).toBe(true)
    expect(pruefePassphrase('Ein-langer-Satz mit Zahl 7').ok).toBe(true)
    expect(pruefePassphrase('melvoe beratung wolke tanne kiesel', 'melvoe@x.at').ok).toBe(false)
  })
})
