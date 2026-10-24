param([switch]$WithPhone)
$ErrorActionPreference = 'Stop'
$toolRoot = Join-Path $PSScriptRoot '../feature-integration/artifacts/service-tools'
$toolRoot = [IO.Path]::GetFullPath($toolRoot)
New-Item -ItemType Directory -Force -Path $toolRoot | Out-Null

function Get-VerifiedArchive($Url, $Name, $Hash, $Destination) {
  $archive = Join-Path $toolRoot $Name
  if (!(Test-Path -LiteralPath $archive)) {
    Invoke-WebRequest $Url -OutFile $archive
  }
  if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $Hash) {
    throw "Checksum mismatch: $Name. Remove that archive and retry."
  }
  if (!(Test-Path -LiteralPath $Destination)) {
    # tar avoids the slow per-file PowerShell extraction of the Go toolchain.
    & tar -xf $archive -C $toolRoot
    if ($LASTEXITCODE -ne 0) { throw "Extraction failed: $Name" }
  }
}

Get-VerifiedArchive 'https://go.dev/dl/go1.27.2.windows-amd64.zip' 'go1.27.2.windows-amd64.zip' '1314008898bd40df77af4b014f777f08873dbdfbcd3d92308728ee03304fe04f' "$toolRoot/go/bin/go.exe"
Get-VerifiedArchive 'https://codeload.github.com/supabase/auth/zip/refs/tags/v2.197.0' 'auth-v2.197.0.zip' '359a3235b3280e8c8c175559450a07b72249504edc55b266ab9be1776470526b' "$toolRoot/auth-2.197.0/go.mod"
Get-VerifiedArchive 'https://github.com/denoland/deno/releases/download/v2.9.7/deno-x86_64-pc-windows-msvc.zip' 'deno-2.9.7.zip' 'a0c3101b4158d1dfb7d6a78a7bf0f3de80c96bb423c152beec8beb22786f2238' "$toolRoot/deno.exe"
Get-VerifiedArchive 'https://dl.google.com/android/repository/platform-tools_r37.0.1-win.zip' 'platform-tools.zip' '45f4d63113e895ebde0c90f194099a4676b6ac653bd28d54314a9e022bbc1a99' "$toolRoot/platform-tools/adb.exe"

if ($WithPhone) {
  Get-VerifiedArchive 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/OpenJDK21U-jdk_x64_windows_hotspot_21.0.12.1_1.zip' 'java21.zip' 'f9d6e191ab098c0d416e7d588a24420a8621cd2f4720dab2459b8b7b2d2d8b4e' "$toolRoot/jdk-21.0.12.1+1/bin/java.exe"
  Get-VerifiedArchive 'https://github.com/mobile-dev-inc/Maestro/releases/download/cli-2.11.0/maestro.zip' 'maestro.zip' '5384593cb4e7a106489e75a821d157dd43f4e438df6bc308b72e82c685e1283a' "$toolRoot/maestro/bin/maestro.bat"
}

if (!(Test-Path -LiteralPath "$toolRoot/auth.exe")) {
  & node "$PSScriptRoot/prepare-auth.mjs"
  if ($LASTEXITCODE -ne 0) { throw 'Windows listener preparation failed.' }
  $env:GOTOOLCHAIN = 'local'
  $env:CGO_ENABLED = '0'
  $env:GOCACHE = "$toolRoot/go-cache"
  $env:GOMODCACHE = "$toolRoot/go-modules"
  Push-Location "$toolRoot/auth-2.197.0"
  try {
    & "$toolRoot/go/bin/go.exe" build -trimpath -o "$toolRoot/auth.exe" .
    if ($LASTEXITCODE -ne 0) { throw 'Auth build failed.' }
  } finally { Pop-Location }
}
& "$toolRoot/deno.exe" cache --no-config --import-map "$PSScriptRoot/import-map.json" "$PSScriptRoot/../../supabase/functions/account-data/index.ts"
if ($LASTEXITCODE -ne 0) { throw 'Deno dependency preparation failed.' }
Write-Output 'Portable Auth, Deno, and Android tools are ready. No system PATH or service was changed.'
