import { notFound } from 'next/navigation'
import { Vorschau } from './Vorschau'

// Nur für die Entwicklung: alle Druckfassungen mit erfundenen Daten (Prüfung als PDF mit Edge headless).
// In Produktion gibt es diese Seite nicht.
export default function Druckvorschau() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <Vorschau />
}
