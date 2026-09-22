#Requires -Version 7
# claude-buddy installer
#   Install:    irm https://raw.githubusercontent.com/tomasmejiar122/claude-buddy/main/install.ps1 | iex
#   Local:      ./install.ps1
#   Uninstall:  ./install.ps1 -Uninstall
# Copies claude-buddy.mjs into ~/.claude and points statusLine in
# ~/.claude/settings.json at it (a backup of settings.json is kept).

param([switch]$Uninstall)

$ErrorActionPreference = 'Stop'
$repoRaw = 'https://raw.githubusercontent.com/tomasmejiar122/claude-buddy/main'
$claudeDir = Join-Path $HOME '.claude'
$target = Join-Path $claudeDir 'claude-buddy.mjs'
$settingsPath = Join-Path $claudeDir 'settings.json'

New-Item -ItemType Directory -Force -Path $claudeDir | Out-Null

$settings = [ordered]@{}
if (Test-Path $settingsPath) {
    $raw = Get-Content $settingsPath -Raw
    if ($raw.Trim()) { $settings = $raw | ConvertFrom-Json -AsHashtable }
    Copy-Item $settingsPath "$settingsPath.bak" -Force
}

if ($Uninstall) {
    if ($settings.Contains('statusLine') -and "$($settings['statusLine']['command'])" -like '*claude-buddy*') {
        $settings.Remove('statusLine')
        $settings | ConvertTo-Json -Depth 32 | Set-Content $settingsPath
    }
    Remove-Item -LiteralPath $target -ErrorAction SilentlyContinue
    Write-Host 'claude-buddy desinstalado. Backup de tu configuración en settings.json.bak'
    return
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'claude-buddy necesita Node.js 18 o más reciente: https://nodejs.org'
}

# Script: take the one next to this installer, or download it
$local = if ($PSScriptRoot) { Join-Path $PSScriptRoot 'claude-buddy.mjs' }
if ($local -and (Test-Path $local)) {
    Copy-Item $local $target -Force
} else {
    Invoke-WebRequest "$repoRaw/claude-buddy.mjs" -OutFile $target
}

if ($settings.Contains('statusLine')) {
    Write-Host "Tu statusLine anterior se reemplaza (queda en settings.json.bak):"
    Write-Host ($settings['statusLine'] | ConvertTo-Json -Compress)
}

# Forward slashes: Claude Code runs the command through a POSIX shell
$scriptPath = $target -replace '\\', '/'
$settings['statusLine'] = [ordered]@{
    type            = 'command'
    command         = "node `"$scriptPath`""
    refreshInterval = 2
}
$settings | ConvertTo-Json -Depth 32 | Set-Content $settingsPath

Write-Host 'claude-buddy instalado. Aparecerá en tu próxima respuesta de Claude Code (o al abrir una sesión nueva).'
