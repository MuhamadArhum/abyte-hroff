param(
  [string]$OutputDir = "release\Abyte-EMS",
  [switch]$IncludeNodeModules,
  [switch]$IncludeBuilds
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root $OutputDir

function Ensure-Dir($path) {
  if (!(Test-Path $path)) { New-Item -ItemType Directory -Path $path -Force | Out-Null }
}

function Get-ForbiddenFiles($scanRoot) {
  if (!(Test-Path $scanRoot)) { return @() }
  return @(Get-ChildItem -Path $scanRoot -Recurse -Force -File |
    Where-Object {
      $n = $_.Name
      $n -eq '.env' -or
      $n -like '*.db' -or $n -like '*.db-journal' -or $n -like '*.db-wal' -or $n -like '*.db-shm' -or
      $n -like '*.log' -or
      $n -eq '.DS_Store' -or
      $_.FullName -match '[\\/]__MACOSX[\\/]'
    })
}

Write-Host "Creating clean release package at: $dest"
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
Ensure-Dir $dest

# Core docs/scripts
foreach ($f in @("README.md", "RELEASE-CHECKLIST.md", "AUDIT-REPORT.md", "start.bat", "start-prod.bat", ".gitignore")) {
  $src = Join-Path $root $f
  if (Test-Path $src) { Copy-Item $src (Join-Path $dest $f) -Force }
}

# Client (source + config; build optional)
Ensure-Dir (Join-Path $dest "client")
$clientFiles = @("package.json","package-lock.json","tsconfig.json","tsconfig.app.json","tsconfig.node.json","vite.config.ts","postcss.config.js","tailwind.config.js","index.html",".oxlintrc.json",".gitignore")
foreach ($f in $clientFiles) {
  $src = Join-Path $root "client\$f"
  if (Test-Path $src) { Copy-Item $src (Join-Path $dest "client\$f") -Force }
}
foreach ($d in @("public","src")) {
  $src = Join-Path $root "client\$d"
  if (Test-Path $src) { Copy-Item $src (Join-Path $dest "client\$d") -Recurse -Force }
}
if ($IncludeBuilds -and (Test-Path (Join-Path $root "client\dist"))) {
  Copy-Item (Join-Path $root "client\dist") (Join-Path $dest "client\dist") -Recurse -Force
}

# Server (source + config; NO database, NO seed, NO prisma.config.ts)
Ensure-Dir (Join-Path $dest "server")
$serverFiles = @("package.json","package-lock.json","tsconfig.json",".gitignore",".env.example")
foreach ($f in $serverFiles) {
  $src = Join-Path $root "server\$f"
  if (Test-Path $src) { Copy-Item $src (Join-Path $dest "server\$f") -Force }
}
Copy-Item (Join-Path $root "server\src") (Join-Path $dest "server\src") -Recurse -Force
Ensure-Dir (Join-Path $dest "server\prisma")
Copy-Item (Join-Path $root "server\prisma\schema.prisma") (Join-Path $dest "server\prisma\schema.prisma") -Force
if ($IncludeBuilds -and (Test-Path (Join-Path $root "server\dist"))) {
  Copy-Item (Join-Path $root "server\dist") (Join-Path $dest "server\dist") -Recurse -Force
}

if ($IncludeNodeModules) {
  foreach ($d in @("client\node_modules","server\node_modules")) {
    $src = Join-Path $root $d
    if (Test-Path $src) { Copy-Item $src (Join-Path $dest $d) -Recurse -Force }
  }
}

# Ensure empty storage structure (no data)
$storageDirs = @(
  "storage","storage\profile-pictures","storage\cnic-front","storage\cnic-back",
  "storage\father-pictures","storage\other-pictures","storage\documents","storage\backups","storage\config"
)
foreach ($d in $storageDirs) { Ensure-Dir (Join-Path $dest $d) }

# Remove leftover secrets/logs/junk using a recursive scan (the previous -Include without -Recurse was a no-op).
$forbidden = Get-ForbiddenFiles $dest
foreach ($f in $forbidden) { Remove-Item $f.FullName -Force -ErrorAction SilentlyContinue }

# Post-build assertion: fail loudly if the package is not clean.
$remaining = Get-ForbiddenFiles $dest
if ($remaining.Count -gt 0) {
  Write-Error "Release packaging aborted: forbidden files remained:`n$($remaining.FullName -join "`n")"
  exit 1
}
$storageFiles = @(Get-ChildItem -Path (Join-Path $dest "storage") -Recurse -Force -File)
if ($storageFiles.Count -gt 0) {
  Write-Error "Release packaging aborted: storage contains data files:`n$($storageFiles.FullName -join "`n")"
  exit 1
}
$nonEmpty = @(Get-ChildItem -Path (Join-Path $dest "storage") -Recurse -Force -File | Where-Object { $_.Length -gt 0 })
if ($nonEmpty.Count -gt 0) { Write-Error "Release packaging aborted: storage files are not empty."; exit 1 }

Write-Host "Release package created and verified clean."
Write-Host "Excluded: .env, SQLite DB files, seed data, existing storage data and logs."
if (-not $IncludeBuilds) { Write-Host "Note: builds not included (run client/server builds on target or re-run with -IncludeBuilds)." }
if (-not $IncludeNodeModules) { Write-Host "Note: node_modules not included (run npm ci on target)." }
Write-Host "Next: configure server/.env from server/.env.example and follow RELEASE-CHECKLIST.md"
