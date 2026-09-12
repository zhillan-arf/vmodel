param([switch]$Install)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$moduleRoot = Join-Path $projectRoot '.tools/obs/data/obs-plugins/win-dshow'
$reportPath = Join-Path $projectRoot 'ops/reports/obs-virtual-camera-install.json'
$classId = '{A3FCE0F5-3493-419F-958A-ABA1250EC20B}'
$expected = @{
    '32' = 'E9513840E2B96DB8CEEB41CF6F5FDB85E58FE7DC44B6B9AFB62B198C5505AA88'
    '64' = '0DCDE4A969A7CE45A39472D39BD15F5BFFF242A06449B27C61E20E667358EC34'
}
function Get-Registration([string]$bits) {
    $view = if ($bits -eq '32') { [Microsoft.Win32.RegistryView]::Registry32 } else { [Microsoft.Win32.RegistryView]::Registry64 }
    $baseKey = [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::LocalMachine, $view)
    try {
        $key = $baseKey.OpenSubKey('SOFTWARE\Classes\CLSID\' + $classId + '\InprocServer32')
        if ($null -eq $key) { return $null }
        try { return [string]$key.GetValue('') } finally { $key.Dispose() }
    } finally { $baseKey.Dispose() }
}
function Save-Report([string]$state, [string]$detail) {
    $entries = foreach ($bits in @('32', '64')) {
        $registeredPath = Get-Registration $bits
        @{ bits = $bits; registered = [bool]$registeredPath; usesProjectModule = $registeredPath -eq (Join-Path $moduleRoot ('obs-virtualcam-module' + $bits + '.dll')); expectedSha256 = $expected[$bits] }
    }
    $json = @{ date = [DateTime]::UtcNow.ToString('o'); state = $state; detail = $detail; obsVersion = '32.2.2'; registrations = @($entries) } | ConvertTo-Json -Depth 5
    # A byte-order mark made this the one evidence file of 170 that a strict
    # JSON parser rejected. Write UTF-8 without one, on 5.1 as well as 7.
    [IO.File]::WriteAllText($reportPath, $json, (New-Object Text.UTF8Encoding($false)))
}

foreach ($bits in @('32', '64')) {
    $modulePath = Join-Path $moduleRoot ('obs-virtualcam-module' + $bits + '.dll')
    if ((Get-FileHash -LiteralPath $modulePath -Algorithm SHA256).Hash -ne $expected[$bits]) { throw 'The OBS virtual-camera module differs from the reviewed 32.2.2 file.' }
    $signature = Get-AuthenticodeSignature -LiteralPath $modulePath
    if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'OBS Project, LLC') { throw 'The OBS publisher signature is not valid.' }
}
$missing = @('32', '64') | Where-Object { -not (Get-Registration $_) }
if (-not $missing) { Save-Report 'registered' 'Both OBS camera architectures are already registered. Existing registrations were preserved.'; Write-Output 'OBS Virtual Camera is registered.'; exit 0 }
if (-not $Install) { Save-Report 'registration-required' 'The reviewed modules are present and signed. Windows administrator confirmation is needed to register the missing camera components.'; Write-Output 'OBS Virtual Camera requires Windows registration. Run this script with -Install to open the administrator confirmation.'; exit 0 }

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = (New-Object Security.Principal.WindowsPrincipal($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Save-Report 'awaiting-windows-confirmation' 'Requested Windows elevation only for registration of the two verified OBS virtual-camera DLLs.'
    try {
        $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $PSCommandPath + '"'), '-Install')
        $child = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList $arguments -Verb RunAs -WindowStyle Hidden -PassThru -Wait
        if ($child.ExitCode -ne 0) { throw ('The registration helper exited with code ' + $child.ExitCode) }
        if (-not (Get-Registration '32') -or -not (Get-Registration '64')) { throw 'Windows confirmation did not result in both camera registrations.' }
        Write-Output 'OBS Virtual Camera registered. Restart the project OBS instance before testing it.'
    } catch {
        # Declining the Windows prompt is the common outcome and is recoverable;
        # saying only that it was cancelled leaves the user without the next step.
        $detail = $_.Exception.Message
        Save-Report 'not-installed' $detail
        if ($detail -match 'canceled by the user|cancelled by the user') {
            Write-Error ('The Windows administrator prompt was declined, so OBS Virtual Camera was not registered. ' +
                'Nothing was changed. Run Install OBS Camera.cmd again and choose Yes on the prompt. ' +
                'OBS window capture and recording work without this; only the virtual camera for Zoom, Discord and similar apps needs it.')
        } else {
            Write-Error ('OBS camera registration was not completed: ' + $detail)
        }
        exit 1
    }
    exit 0
}

try {
    foreach ($bits in $missing) {
        $modulePath = Join-Path $moduleRoot ('obs-virtualcam-module' + $bits + '.dll')
        $systemDirectory = if ($bits -eq '32') { 'SysWOW64' } else { 'System32' }
        $registrar = Join-Path $env:SystemRoot ($systemDirectory + '\regsvr32.exe')
        $process = Start-Process -FilePath $registrar -ArgumentList @('/i', '/s', ('"' + $modulePath + '"')) -WindowStyle Hidden -PassThru -Wait
        if ($process.ExitCode -ne 0 -or -not (Get-Registration $bits)) { throw ('OBS ' + $bits + '-bit camera registration failed.') }
    }
    Save-Report 'registered' 'Missing signed OBS 32.2.2 camera modules were registered using Windows regsvr32 /i /s. Restart OBS before use; no camera stream was started.'
} catch { Save-Report 'registration-error' $_.Exception.Message; throw }
