param([switch]$NoBrowser, [switch]$Voice, [switch]$StopVoice)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$studioUrl = 'http://127.0.0.1:4173'
$voicePython = Join-Path $projectRoot '.tools/voice/venv/Scripts/python.exe'
$voiceLauncher = Join-Path $PSScriptRoot 'voice/launch.py'
if ($StopVoice) {
    if (-not (Test-Path -LiteralPath $voicePython)) { Write-Warning 'Voice environment is absent, so there was no voice service to stop.'; exit 1 }
    & $voicePython $voiceLauncher --stop
    exit $LASTEXITCODE
}
function Start-OptionalVoice {
    if (-not $Voice) { return }
    if (-not (Test-Path -LiteralPath $voicePython)) { Write-Warning 'Voice environment is missing. Avatar startup will continue; run Setup Voice.cmd to add the character voice.'; return }
    try {
        if ($NoBrowser) { & $voicePython $voiceLauncher --no-browser }
        else { & $voicePython $voiceLauncher }
        if ($LASTEXITCODE -ne 0) { Write-Warning 'Optional voice startup failed. Avatar startup will continue; see .cache/voice/server-error.log.' }
    } catch { Write-Warning 'Optional voice startup failed. Avatar startup will continue; see docs/voice-setup.md.' }
}
function Open-Studio {
    if ($NoBrowser) { return }
    $browserPaths = @(
        (Join-Path $env:ProgramFiles 'Google/Chrome/Application/chrome.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Google/Chrome/Application/chrome.exe'),
        (Join-Path $env:LOCALAPPDATA 'Google/Chrome/Application/chrome.exe')
    )
    $browserPath = $browserPaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $browserPath) { throw 'The tested Chrome browser is missing. Install Chrome or open http://127.0.0.1:4173 in a compatible browser.' }
    Start-Process -FilePath $browserPath -ArgumentList $studioUrl -WindowStyle Normal
}
$existing = $null
try { $existing = Invoke-RestMethod -Uri "$studioUrl/health" -TimeoutSec 2 } catch {}
if ($existing -and $existing.application -eq 'vmodel') {
    Start-OptionalVoice
    Open-Studio
    exit 0
}
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'dist/index.html'))) {
    throw 'The local app build is missing. Run Setup VModel.cmd first.'
}
# A raw 'term is not recognized' error is the first thing a new user would
# see here, so name the missing program and the fix instead.
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) { throw 'Node.js was not found. Install Node.js from nodejs.org, then run Setup VModel.cmd before starting the studio.' }
$logFolder = Join-Path $projectRoot '.cache'
New-Item -ItemType Directory -Force -Path $logFolder | Out-Null
$serverScript = Join-Path $PSScriptRoot 'server.mjs'
$serverProcess = Start-Process -FilePath $nodeCommand.Source -ArgumentList ('"' + $serverScript + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logFolder 'server.log') -RedirectStandardError (Join-Path $logFolder 'server-error.log') -PassThru
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
        $health = Invoke-RestMethod -Uri "$studioUrl/health" -TimeoutSec 1
        if ($health.application -eq 'vmodel') {
            Set-Content -LiteralPath (Join-Path $logFolder 'server.pid') -Value $serverProcess.Id
            Start-OptionalVoice
            Open-Studio
            exit 0
        }
    } catch {}
    if ($serverProcess.HasExited) { throw 'Studio could not start. See .cache/server-error.log; port 4173 may be occupied.' }
    Start-Sleep -Milliseconds 200
}
throw 'Studio startup timed out. See .cache/server-error.log.'
