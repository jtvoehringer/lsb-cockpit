// Ausgabe-Formate (de-AT, Zeitzone Europe/Vienna)
const nf1 = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 2 })
const nf2 = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const datum = (iso?: string | null) => (iso ? new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso.length === 10 ? iso + 'T12:00' : iso)) : '')
export const zeitpunkt = (iso?: string | null) => (iso ? new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Vienna' }).format(new Date(iso)) : '')
export const stunden = (min: number) => nf2.format(min / 60)
export const zahl = (n: number) => nf1.format(n)
export const heute = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
