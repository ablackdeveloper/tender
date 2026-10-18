$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$toolsDirectory = Join-Path $workspace 'scripts/feature-integration/artifacts/native-api-tools'
$archivePath = Join-Path $toolsDirectory 'postgrest-v16.4-windows-x86-64.zip'
$expectedHash = '29a5b56e5a09b7168bb552ef14aa7ade40bf0a81dd0687cffa86610187b89d78'
New-Item -ItemType Directory -Force -Path $toolsDirectory | Out-Null
if (-not (Test-Path -LiteralPath $archivePath)) {
  Invoke-WebRequest -Uri 'https://github.com/PostgREST/postgrest/releases/download/v16.4/postgrest-v16.4-windows-x86-64.zip' -OutFile $archivePath
}
if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash) {
  throw 'PostgREST archive checksum mismatch. No executable was started.'
}
Expand-Archive -LiteralPath $archivePath -DestinationPath $toolsDirectory -Force
Write-Output 'Verified Windows PostgREST 16.4 is ready for localhost integration tests.'
