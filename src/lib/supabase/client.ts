'use client'
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/** Supabase im Browser (Sitzung in Cookies, damit proxy.ts sie sieht). Nur öffentlicher Schlüssel – nie der Service-Role-Schlüssel. */
export function supabaseBrowser(): SupabaseClient {
  client ??= createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)
  return client
}
