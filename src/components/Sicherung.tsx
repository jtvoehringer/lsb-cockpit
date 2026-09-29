'use client'
// Verschlüsselter Gesamt-Export und Prüfung einer Exportdatei (unter „Schutz & Audit“).
import { useState } from 'react'
import { protokolliere } from '@/lib/konto'
import { erstelleExport, pruefeExport } from '@/lib/sicherung'
import { useTresor } from '@/lib/tresor'
import { Bestaetigung } from './Bestaetigung'

export function Sicherung() {
  const tresor = useTresor()
  const [schritt, setSchritt] = useState<'' | 'bestaetigen' | 'laeuft'>('')
  const [stand, setStand] = useState('')
  const [fehler, setFehler] = useState('')
  const [pruefung, setPruefung] = useState<Awaited<ReturnType<typeof pruefeExport>> | null>(null)

  async function exportieren() {
    setSchritt('laeuft'); setFehler(''); setStand('')
    try {
      const blob = await erstelleExport(tresor.schluessel('zone_a'), setStand)
      const name = `lsb-cockpit-export-${new Date().toISOString().slice(0, 10)}.json`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = name; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      await protokolliere('export_erstellt', `${Math.round(blob.size / 1024)} KB`)
      setStand(`Export erstellt (${Math.round(blob.size / 1024)} KB): ${name}`)
    } catch (e) { setFehler((e as Error).message || 'Der Export ist fehlgeschlagen.'); setStand('') } finally { setSchritt('') }
  }

  async function pruefen(d: File | undefined) {
    if (!d) return
    setFehler(''); setPruefung(null)
    try { setPruefung(await pruefeExport(tresor.schluessel('zone_a'), d)) } catch (e) { setFehler((e as Error).message || 'Die Exportdatei konnte nicht geprüft werden.') }
  }

  return (
    <div className="karte space-y-3">
      <h2 className="font-heading text-heading">Verschlüsselter Gesamt-Export</h2>
      <p className="text-sm text-text-muted">Eine vollständige Kopie aller Daten, Schlüssel und Dateien – unabhängig von Supabase und ICP. Die Datei ist verschlüsselt; öffnen lässt sie sich nur mit einem eingerichteten Gerät oder dem Notfallblatt. Empfehlung: einmal im Monat auf einen eigenen Datenträger (z. B. verschlüsselter USB-Stick) sichern.</p>
      {schritt === '' && <button className="btn btn-ghost" onClick={() => setSchritt('bestaetigen')}>Export erstellen …</button>}
      {schritt === 'bestaetigen' && (
        <div className="max-w-md space-y-2">
          <Bestaetigung knopf="Export bestätigen" ereignis="export_erstellen" weiter={async () => { await exportieren() }} />
          <button className="text-sm text-text-muted underline" onClick={() => setSchritt('')}>Abbrechen</button>
        </div>
      )}
      {stand && <p className="text-sm" aria-live="polite">{stand}</p>}
      <label className="btn btn-ghost cursor-pointer">Exportdatei prüfen …
        <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => { void pruefen(e.target.files?.[0]); e.target.value = '' }} />
      </label>
      {pruefung && (
        <p className="hinweis text-sm">Export vom {new Date(pruefung.erstellt_am).toLocaleString('de-AT')} ist vollständig lesbar: {Object.entries(pruefung.tabellen).filter(([, n]) => n > 0).map(([t, n]) => `${t} ${n}`).join(', ')}; {pruefung.dateien} Dateien.</p>
      )}
      {fehler && <p className="fehler" role="alert">{fehler}</p>}
    </div>
  )
}
