// Legt das Konto einer Beraterin an (nur ICP, einmalig, lokal – nie auf Vercel).
// Aufruf (PowerShell):
//   $env:SUPABASE_SERVICE_ROLE_KEY = "<aus dem Supabase-Dashboard, Project Settings → API Keys>"
//   node scripts/konto-anlegen.mjs melanie@beispiel.at "Praxis Melanie Vöhringer"
// Ausgabe: der Einrichtungscode. Ihn persönlich (nicht per E-Mail) übergeben; er gilt nur bis zur Einrichtung
// (danach Anmeldung per E-Mail-Code + Authenticator, Entsperren mit Windows Hello / Face ID).
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'

//   Support-Konto (ICP, technisch ohne Inhalte, nur mit Freigabe der Beraterin):
//   node scripts/konto-anlegen.mjs support@icp-consultants.at "Praxis Melanie Vöhringer" --support
const argumente = process.argv.slice(2)
const alsSupport = argumente.includes('--support')
const [email, praxisName = 'Praxis'] = argumente.filter((a) => a !== '--support')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://mndfkacmmjhvkhvxgbkz.supabase.co'
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!email || !key) { console.error('Aufruf: node scripts/konto-anlegen.mjs <email> [Praxisname]  (SUPABASE_SERVICE_ROLE_KEY setzen)'); process.exit(1) }

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const einrichtungscode = randomBytes(15).toString('base64url') // 120 Bit, nur für die Einrichtung

const { data: praxen, error: e1 } = await admin.from('praxis').select('id, name').eq('name', praxisName)
if (e1) throw e1
let praxisId = praxen?.[0]?.id
if (!praxisId) {
  const { data, error } = await admin.from('praxis').insert({ name: praxisName }).select('id').single()
  if (error) throw error
  praxisId = data.id
}

const { data: neu, error: e2 } = await admin.auth.admin.createUser({ email: email.trim().toLowerCase(), password: einrichtungscode, email_confirm: true })
if (e2) throw e2
const { error: e3 } = await admin.from('benutzer').insert({ user_id: neu.user.id, praxis_id: praxisId, rolle: alsSupport ? 'support' : 'beraterin' })
if (e3) throw e3

console.log(`${alsSupport ? 'Support-Konto' : 'Konto'} angelegt: ${email} (Praxis ${praxisName})`)
console.log(`Einrichtungscode: ${einrichtungscode}`)
console.log('Einrichtung unter https://lsb.icp-consultants.at/einrichten')
