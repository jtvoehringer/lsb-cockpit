import brand from '@/config/brand.config'

/** Schmaler Rahmen für Anmelde-, Einrichtungs- und Sperrseiten */
export function SchmalerRahmen({ titel, untertitel, children }: { titel: string; untertitel?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-md px-4 py-12 sm:py-20">
      <div className="mb-8 flex items-center gap-3">
        <img src="/brand/bildmarke.svg" alt="" width={38} height={29} />
        <span className="font-heading text-xl text-heading">{brand.appName}</span>
      </div>
      <h1 className="font-heading text-heading">{titel}</h1>
      {untertitel && <p className="mt-2 text-text-muted">{untertitel}</p>}
      <div className="mt-8">{children}</div>
    </main>
  )
}
