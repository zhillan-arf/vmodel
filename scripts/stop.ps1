$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $projectRoot '.cache/server.pid'
if (-not (Test-Path -LiteralPath $pidFile)) { Write-Output 'No launcher-owned server is recorded.'; exit 0 }
$serverPid = [int](Get-Content -LiteralPath $pidFile)
$server = Get-CimInstance Win32_Process -Filter "ProcessId=$serverPid"
$expectedScript = Join-Path $PSScriptRoot 'server.mjs'
if ($server -and $server.Name -eq 'node.exe' -and $server.CommandLine.Contains($expectedScript)) {
    Stop-Process -Id $serverPid
    Remove-Item -LiteralPath $pidFile
    Write-Output 'Ene Studio server stopped. The production studio releases its camera after detecting the disconnect (normally within four seconds). Close its browser windows when finished.'
} elseif ($server) {
    throw 'The recorded process is not this project server; it was left running.'
} else {
    Remove-Item -LiteralPath $pidFile
    Write-Output 'The studio server has already stopped.'
}
