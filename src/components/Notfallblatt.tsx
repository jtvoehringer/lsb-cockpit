import brand from '@/config/brand.config'

/** Notfallblatt (Wiederherstellungscode) – Einrichtung und Druckvorschau. */
export function Notfallblatt({ email, code, adresse }: { email: string; code: string; adresse: string }) {
  return (
        <div className="karte" id="notfallblatt">
          <p className="overline">Notfallblatt · {brand.appName}</p>
          <p className="mt-3 text-sm">Wiederherstellungscode für <b>{email}</b>:</p>
          <p className="code mt-2 break-all text-heading">{code}</p>
          <p className="mt-4 text-sm text-text-muted">Adresse: {adresse} · Erstellt am {new Date().toLocaleDateString('de-AT')}</p>
          <p className="mt-2 text-sm text-text-muted">Mit diesem Code lässt sich das Cockpit auf einem neuen Gerät entsperren, wenn kein eingerichtetes Gerät mehr da ist. Ausdrucken, nicht digital speichern, versiegelt bei der Vertrauensperson oder im Safe verwahren.</p>
        </div>
  )
}
