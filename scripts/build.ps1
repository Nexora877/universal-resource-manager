$ErrorActionPreference = 'Stop'
param([ValidateSet('public','personal','developer')][string]$Profile='public')
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Ext = Join-Path $Root 'extension'
$Manifest = Get-Content (Join-Path $Ext 'manifest.json') | ConvertFrom-Json
$Dist = Join-Path $Root 'dist'
$Package = Join-Path $Dist "package-$Profile"
New-Item -ItemType Directory -Force -Path $Dist | Out-Null
if (Test-Path $Package) { Remove-Item -Recurse -Force $Package }
New-Item -ItemType Directory -Force -Path $Package | Out-Null
Copy-Item -Recurse -Force (Join-Path $Ext '*') $Package
$ProfileObject = switch ($Profile) {
  'public' { '{"channel":"public","debug":false,"diagnostics":false,"appName":"Universal Resource Manager","subtitle":"Unified Link Intelligence"}' }
  'personal' { '{"channel":"personal","debug":false,"diagnostics":true,"appName":"Universal Resource Manager","subtitle":"Unified Link Intelligence"}' }
  'developer' { '{"channel":"developer","debug":true,"diagnostics":true,"appName":"Universal Resource Manager","subtitle":"Unified Link Intelligence"}' }
}
Set-Content -NoNewline -Encoding utf8 -Path (Join-Path $Package 'profile.js') -Value "globalThis.UM_BUILD = Object.freeze($ProfileObject);"
$Zip = Join-Path $Dist "universal-resource-manager-v$($Manifest.version)-$Profile.zip"
if (Test-Path $Zip) { Remove-Item -Force $Zip }
Compress-Archive -Path (Join-Path $Package '*') -DestinationPath $Zip -CompressionLevel Optimal
Remove-Item -Recurse -Force $Package
Write-Output $Zip
