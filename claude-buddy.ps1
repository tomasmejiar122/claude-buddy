#Requires -Version 7
# claude-buddy — https://github.com/tomasmejiar122/claude-buddy
# Claude Code status line: session info on the left (fixed), a 3-line project
# mascot walking on the right.
# Each project gets its own body and color (hash of the folder name).
# While Claude is idle the mascot mostly faces front and now and then walks,
# looks around, waves or jumps; while Claude works it cycles through rainbow
# colors, pumps its arms and throws sparkles. It blinks, and gets tired and
# redder as context fills up.
# Animated through statusLine.refreshInterval (1s) in settings.json; the
# animation state lives in a small per-session file in the temp folder.

$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
# Keep ANSI colors: pwsh strips them by default when output is piped
$PSStyle.OutputRendering = 'Ansi'

$inputJson = [Console]::In.ReadToEnd()
try { $data = $inputJson | ConvertFrom-Json } catch { $data = $null }
if (-not $data) {
    Write-Output "Claude Code"
    exit 0
}

# ANSI colors
$esc    = [char]27
$reset  = "$esc[0m"
$dim    = "$esc[2m"
$red    = "$esc[31m"
$green  = "$esc[32m"
$yellow = "$esc[33m"
$blue   = "$esc[34m"
$cyan   = "$esc[36m"

# Per-session state: animation frame + cached git segment
$sessionId = if ($data.session_id) { $data.session_id } else { 'default' }
$stateFile = Join-Path ([IO.Path]::GetTempPath()) "claude-statusline-$sessionId.json"
$state = $null
if (Test-Path $stateFile) { try { $state = Get-Content $stateFile -Raw | ConvertFrom-Json } catch { } }
if (-not $state) { $state = [pscustomobject]@{} }
$defaults = @{ frame = 0; git = ''; gitAt = 0; cwd = ''; pos = 0; action = 'stand'; left = 0; dir = 1 }
foreach ($k in $defaults.Keys) {
    if ($null -eq $state.$k) { $state | Add-Member -NotePropertyName $k -NotePropertyValue $defaults[$k] -Force }
}
$now = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()

# Model
$modelName = $data.model.display_name
if ([string]::IsNullOrWhiteSpace($modelName)) { $modelName = "Claude" }

# Directory basename
$cwd = $data.workspace.current_dir
if ([string]::IsNullOrWhiteSpace($cwd)) { $cwd = (Get-Location).Path }
$dirName = Split-Path -Leaf ($cwd.TrimEnd('\', '/'))
if ([string]::IsNullOrWhiteSpace($dirName)) { $dirName = $cwd }

# Git: branch, uncommitted changes (*), commits ahead/behind; cached for 5s
if ($state.cwd -eq $cwd -and ($now - $state.gitAt) -lt 5000) {
    $gitStr = $state.git
} else {
    $gitStr = ""
    if (Test-Path $cwd) {
        $status = git -C $cwd --no-optional-locks status --porcelain=v1 --branch 2>$null
        if ($LASTEXITCODE -eq 0 -and $status) {
            $lines = @($status)
            $head = $lines[0] -replace '^## ', ''
            $branch = ($head -replace '^No commits yet on ', '') -replace '\.\.\..*$', '' -replace ' \[.*$', ''
            if ($branch -like 'HEAD (no branch)*') { $branch = 'detached' }
            $gitStr = "$green$branch"
            if ($lines.Count -gt 1) { $gitStr += "$yellow*" }
            if ($head -match 'ahead (\d+)')  { $gitStr += " $cyan↑$($Matches[1])" }
            if ($head -match 'behind (\d+)') { $gitStr += " $cyan↓$($Matches[1])" }
            $gitStr += $reset
        }
    }
    $state.git = $gitStr
    $state.gitAt = $now
    $state.cwd = $cwd
}

# Context: color by level + bar
$usedPct = $data.context_window.used_percentage
$pct = if ($null -ne $usedPct) { [double]$usedPct } else { 0 }
$ctxColor = if ($pct -ge 80) { $red } elseif ($pct -ge 50) { $yellow } else { $green }

$barWidth = 10
$filled = [math]::Min($barWidth, [math]::Round($pct / 100 * $barWidth))
$bar = ('▓' * $filled) + ('░' * ($barWidth - $filled))
$ctxStr = "$ctxColor$bar {0:N0}%$reset" -f $pct

# Working = the transcript was written in the last few seconds
$working = $false
$transcript = $data.transcript_path
if ($transcript -and (Test-Path $transcript)) {
    $age = ([DateTime]::UtcNow - (Get-Item $transcript).LastWriteTimeUtc).TotalSeconds
    $working = $age -lt 4
}

# Project identity: FNV-1a hash of the folder name -> body + color
$hash = [uint64]2166136261
foreach ($ch in $dirName.ToLowerInvariant().ToCharArray()) {
    $hash = (($hash -bxor [uint64][int]$ch) * 16777619) % 4294967296
}

# Every body is 7 columns wide; Feet = stand, left foot up, right foot up
$bodies = @(
    @{ Top = '╭─────╮'; L = '│'; R = '│'; Feet = @('╰┬───┬╯', '╰┴───┬╯', '╰┬───┴╯') }  # blob
    @{ Top = '┌──┴──┐'; L = '│'; R = '│'; Feet = @('└┬───┬┘', '└┴───┬┘', '└┬───┴┘') }  # robot
    @{ Top = '╭^───^╮'; L = '│'; R = '│'; Feet = @('╰┬───┬╯', '╰┴───┬╯', '╰┬───┴╯') }  # cat
    @{ Top = '(o)─(o)'; L = '│'; R = '│'; Feet = @('╰┬───┬╯', '╰┴───┬╯', '╰┬───┴╯') }  # bear
    @{ Top = '.-~~~-.'; L = '('; R = ')'; Feet = @("'-┬─┬-'", "'-┴─┬-'", "'-┬─┴-'") }  # cloud
    @{ Top = '╭─────╮'; L = '│'; R = '│'; Feet = @('╰v^v^v╯', '╰^v^v^╯', '╰v^v^v╯') }  # ghost
)
# Base colors (RGB): sky, pink, purple, green, orange, blue, gold, coral
$palette = @(
    @(0, 215, 255), @(255, 135, 255), @(175, 135, 255), @(135, 215, 135),
    @(255, 175, 95), @(95, 175, 255), @(255, 215, 135), @(255, 95, 135)
)
$body = $bodies[[int]($hash % $bodies.Count)]
$baseRgb = $palette[[int]([math]::Floor($hash / $bodies.Count) % $palette.Count)]

function Get-HueRgb([double]$hue) {
    # Pastel rainbow: HSV with s=0.55, v=1
    $h = ($hue % 360) / 60; $s = 0.55
    $x = 1 - $s * (1 - [math]::Abs(($h % 2) - 1))
    $m = 1 - $s
    $rgb = switch ([int][math]::Floor($h)) {
        0 { 1, $x, $m } 1 { $x, 1, $m } 2 { $m, 1, $x }
        3 { $m, $x, 1 } 4 { $x, $m, 1 } default { 1, $m, $x }
    }
    $rgb | ForEach-Object { [int]($_ * 255) }
}

# Color: rainbow while Claude works; otherwise the project color, fading
# toward red as the context fills past 50%
if ($working) {
    $rgb = Get-HueRgb (([int]$state.frame) * 40)
} else {
    $k = [math]::Min(1.0, [math]::Max(0.0, ($pct - 50) / 40)) * 0.85
    $rgb = 0..2 | ForEach-Object { [int]($baseRgb[$_] + (@(255, 70, 70)[$_] - $baseRgb[$_]) * $k) }
}
$bodyColor = "$esc[38;2;$($rgb[0]);$($rgb[1]);$($rgb[2])m"
$sparkColor = "$esc[38;2;255;240;150m"

# Animation: a small state machine advanced once per render.
# While idle the mascot mostly stands facing front, and now and then walks a
# few steps, looks around, waves or jumps. While working it stays put,
# pumps its arms, reads and throws sparkles.
$lane = 24                  # columns the mascot can walk in
$span = $lane - 9           # 9 = body (7) + one arm column on each side
$pos = [math]::Min([math]::Max([int]$state.pos, 0), $span)
$frame = ([int]$state.frame + 1) % 1000
$state.frame = $frame
$tick = [int]([math]::Floor($now / 1000))

$look = 0
$feet = $body.Feet[0]
$armL = ' '; $armR = ' '; $topL = ' '; $topR = ' '; $botL = ' '; $botR = ' '
$happy = $false
$blink = (Get-Random -Maximum 100) -lt 12

if ($working) {
    # Busy: arms pumping, eyes darting as if reading, sparkles popping around
    $state.action = 'stand'
    $state.left = 0
    $armL = if ($frame % 2) { '\' } else { '/' }
    $armR = if ($frame % 2) { '/' } else { '\' }
    $look = if ($frame % 2) { -1 } else { 1 }
    $blink = $false
    $spark = { param($c) "$sparkColor$c$bodyColor" }
    switch ($frame % 4) {
        0 { $topL = & $spark '*'; $botR = & $spark '+' }
        1 { $topR = & $spark '+'; $botL = & $spark '·' }
        2 { $topR = & $spark '*'; $botL = & $spark '+' }
        3 { $topL = & $spark '+'; $botR = & $spark '·' }
    }
} else {
    if ([int]$state.left -le 0) {
        $roll = Get-Random -Maximum 100
        if ($roll -lt 45)     { $state.action = 'stand'; $state.left = Get-Random -Minimum 5 -Maximum 11 }
        elseif ($roll -lt 70) { $state.action = 'walk';  $state.left = Get-Random -Minimum 3 -Maximum 9; $state.dir = @(-1, 1)[(Get-Random -Maximum 2)] }
        elseif ($roll -lt 85) { $state.action = 'look';  $state.left = 4 }
        elseif ($roll -lt 95) { $state.action = 'wave';  $state.left = 4 }
        else                  { $state.action = 'jump';  $state.left = 4 }
    }
    $left = [int]$state.left
    switch ($state.action) {
        'walk' {
            $dir = [int]$state.dir
            if ($pos + $dir -lt 0 -or $pos + $dir -gt $span) { $dir = -$dir; $state.dir = $dir }
            $pos += $dir
            $look = $dir
            $feet = $body.Feet[1 + ($frame % 2)]
            $blink = $false
        }
        'look' {
            $look = if ($left -gt 2) { -1 } else { 1 }
            $blink = $false
        }
        'wave' {
            $happy = $true
            if ($left % 2) { $topR = '/' } else { $armR = '/' }
        }
        'jump' {
            $happy = $true
            if ($left % 2) {
                $topL = '\'; $topR = '/'
                $feet = $body.Feet[0] -replace '┬', '┴'
            }
        }
    }
    $state.left = $left - 1
}
$state.pos = $pos

# Eyes: mood from context; happy when waving or jumping; occasional blink
$eye = if ($pct -ge 50 -and $pct -lt 80) { '▬' } else { '▮' }
if ($blink) { $eye = '─' }
if ($happy) { $eye = '^' }
$face = switch ($look) {
    -1 { "$eye $eye  " }
    1  { "  $eye $eye" }
    default { " $eye $eye " }
}
if ($pct -ge 80 -and $topR -eq ' ') { $topR = "$esc[38;5;117m'$bodyColor" }

$mascot = @(
    "$topL$($body.Top)$topR"
    "$armL$($body.L)$face$($body.R)$armR"
    "$botL$feet$botR"
)

# Info block (left, fixed width so the mascot's lane never shifts)
$info1 = @("$cyan$modelName$reset", "$blue$dirName$reset")
if ($gitStr) { $info1 += $gitStr }
$mood = if ($working) { 'trabajando' + ('.' * (1 + $frame % 3)) }
        elseif ($pct -ge 80) { 'agotado, toca /compact' }
        elseif ($pct -ge 50) { 'algo cansado' }
        else { '' }
$info = @(
    [string]::Join(" $dim|$reset ", $info1)
    $ctxStr
    "$dim$mood$reset"
)
$visible = { param($s) ($s -replace "$esc\[[0-9;]*m", '').Length }
$infoWidth = [math]::Max(30, ($info | ForEach-Object { & $visible $_ } | Measure-Object -Maximum).Maximum)

# NBSP padding so the spacing survives any whitespace trimming
$nbsp = [char]0xA0
for ($i = 0; $i -lt 3; $i++) {
    $gap = [string]$nbsp * ($infoWidth - (& $visible $info[$i]) + 2 + $pos)
    Write-Output "$($info[$i])$gap$bodyColor$($mascot[$i])$reset"
}

try { $state | ConvertTo-Json -Compress | Set-Content $stateFile -NoNewline } catch { }
