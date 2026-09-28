# Änderungen committen und auf GitHub pushen (löst das Vercel-Deployment aus).
# Im Terminal: .\push.ps1 "Kurze Beschreibung"   – ohne Beschreibung wird nur gepusht.
param([string]$Nachricht = "")
Set-Location -Path $PSScriptRoot
if ($Nachricht -ne "") {
  git add -A
  git commit -m $Nachricht
}
git push origin main
Write-Host "Push abgeschlossen – Vercel deployt jetzt." -ForegroundColor Green
