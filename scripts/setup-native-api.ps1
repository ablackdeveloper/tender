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

# EDB bundles gettext 0.19.8, which can abort concurrent libpq connections on
# Windows. Install a private, verified replacement beside PostgREST only.
$gettextArchive = Join-Path $toolsDirectory 'gettext0.26-iconv1.17-shared-64.zip'
$gettextRoot = Join-Path $toolsDirectory 'gettext-0.26'
if (!(Test-Path -LiteralPath $gettextArchive)) {
  Invoke-WebRequest 'https://github.com/mlocati/gettext-iconv-windows/releases/download/v0.26-v1.17/gettext0.26-iconv1.17-shared-64.zip' -OutFile $gettextArchive
}
if ((Get-FileHash -LiteralPath $gettextArchive -Algorithm SHA256).Hash.ToLowerInvariant() -ne 'd820cdc8199162377b11e2088143b48f1898050ffd5376d63b05f0dee478e030') {
  throw 'gettext archive checksum mismatch. No runtime file was installed.'
}
New-Item -ItemType Directory -Force -Path $gettextRoot | Out-Null
& tar -xf $gettextArchive -C $gettextRoot
if ($LASTEXITCODE -ne 0) { throw 'gettext archive extraction failed.' }
# libpq requests the older DLL filename. The newer implementation retains its ABI.
Copy-Item -LiteralPath "$gettextRoot/bin/libintl-8.dll" -Destination "$toolsDirectory/libintl-9.dll" -Force
Copy-Item -LiteralPath "$gettextRoot/bin/libiconv-2.dll" -Destination "$toolsDirectory/libiconv-2.dll" -Force
Write-Output 'Verified PostgREST 16.4 and private gettext 0.26 runtime are ready. System PostgreSQL was not changed.'
