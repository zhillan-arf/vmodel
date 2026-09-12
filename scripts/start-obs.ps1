param([ValidateSet('Landscape','Portrait')][string]$Orientation = 'Landscape', [switch]$Background)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$obsExecutable = Join-Path $projectRoot '.tools/obs/bin/64bit/obs64.exe'
$statePath = Join-Path $projectRoot '.cache/obs-process.json'
$existing = Get-Process obs64 -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $obsExecutable }
if ($existing) { Write-Output 'The project OBS instance is already open.'; exit 0 }
Push-Location $projectRoot
try {
    python scripts/setup_obs.py
    if ($LASTEXITCODE -ne 0) { throw 'OBS profile setup failed.' }
    $arguments = @('--portable', '--disable-updater', '--profile', ('"Ene ' + $Orientation + '"'), '--collection', '"Ene Studio"', '--scene', ('"Ene ' + $Orientation + '"'))
    $windowStyle = 'Normal'
    if ($Background) { $windowStyle = 'Hidden'; $arguments += '--minimize-to-tray' }
    $process = Start-Process -FilePath $obsExecutable -ArgumentList $arguments -WorkingDirectory (Split-Path -Parent $obsExecutable) -WindowStyle $windowStyle -PassThru
    New-Item -ItemType Directory -Path (Split-Path -Parent $statePath) -Force | Out-Null
    @{ pid = $process.Id; executable = $obsExecutable; started = [DateTime]::UtcNow.ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
    Write-Output ('Project OBS started (PID ' + $process.Id + '). No recording or stream was started.')
} finally { Pop-Location }
