# Prüft einen Brevo-SMTP-Schlüssel, ohne ihn anzuzeigen oder zu speichern. Schickt eine Testmail an jv@icp-consultants.at.
$mail = Join-Path $env:TEMP 'brevo-test.txt'
"From: LSB Cockpit <noreply@icp-consultants.at>`r`nTo: jv@icp-consultants.at`r`nSubject: Brevo-Test LSB Cockpit`r`n`r`nTest ok.`r`n" | Set-Content -NoNewline $mail

Read-Host 'Jetzt in Brevo den SMTP-Schluessel kopieren (Kopier-Symbol), dann hier Enter druecken' | Out-Null
$p = (Get-Clipboard | Out-String).Trim()
"Laenge: $($p.Length), Anfang: $($p.Substring(0, [Math]::Min(9, $p.Length)))"
if (-not $p.StartsWith('xsmtpsib-')) { 'Das ist kein SMTP-Schluessel (muss mit xsmtpsib- beginnen). Abbruch.'; $p = $null; return }

curl.exe --silent --show-error --ssl-reqd --url 'smtp://smtp-relay.brevo.com:587' --user "acc633001@smtp-brevo.com:$p" --mail-from 'noreply@icp-consultants.at' --mail-rcpt 'jv@icp-consultants.at' --upload-file $mail
"Exitcode: $LASTEXITCODE  (0 = gesendet, 67 = Login abgelehnt)"
$p = $null
Set-Clipboard -Value ' '
