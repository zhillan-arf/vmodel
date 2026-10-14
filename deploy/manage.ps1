param(
    [Parameter(Position = 0)]
    [string]$Command
)

$ErrorActionPreference = 'Stop'
$DeployDir = $PSScriptRoot
$ComposeFile = Join-Path $DeployDir 'compose.yaml'

function Show-Usage {
    @'
Usage: powershell -ExecutionPolicy Bypass -File deploy\manage.ps1 COMMAND

  start     Build and start the service.
  stop      Stop the service. Keep certificate storage.
  restart   Build and replace the containers. Keep certificate storage.
  status    Show container status.
  logs      Show the last 200 log lines and wait for new lines.
  cert      Export the public certificate to deploy\vmodel-local-ca.crt.
  help      Show these instructions.
'@
}

function Invoke-Compose {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$ComposeArgs,
        [switch]$CaptureOutput
    )

    $arguments = @('compose', '--project-directory', $DeployDir, '-f', $ComposeFile) + $ComposeArgs
    if ($CaptureOutput) {
        $result = & docker @arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Docker Compose failed with exit code $LASTEXITCODE."
        }
        return $result
    }

    & docker @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose failed with exit code $LASTEXITCODE."
    }
}

function Export-Certificate {
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        try {
            $certificate = Invoke-Compose -ComposeArgs @('exec', '-T', 'https', 'cat', '/data/caddy/pki/authorities/local/root.crt') -CaptureOutput
            $certificateText = (($certificate | ForEach-Object { [string]$_ }) -join "`n") + "`n"
            $certificatePath = Join-Path $DeployDir 'vmodel-local-ca.crt'
            $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
            [System.IO.File]::WriteAllText($certificatePath, $certificateText, $utf8NoBom)
            Write-Output "Public certificate: $certificatePath"
            Write-Output 'Install this certificate as a trusted root certificate on this computer.'
            return
        }
        catch {
            if ($attempt -eq 30) {
                throw 'Certificate export failed. Check deploy\manage.ps1 logs.'
            }
            Start-Sleep -Seconds 1
        }
    }
}

if ([string]::IsNullOrWhiteSpace($Command) -or $args.Count -gt 0) {
    [Console]::Error.WriteLine((Show-Usage))
    exit 2
}

$Command = $Command.ToLowerInvariant()
if ($Command -in @('help', '-h', '--help')) {
    Show-Usage
    exit 0
}
if ($Command -notin @('start', 'stop', 'restart', 'status', 'logs', 'cert')) {
    [Console]::Error.WriteLine((Show-Usage))
    exit 2
}

try {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Install Docker Desktop with Docker Compose v2.'
    }

    Push-Location $DeployDir
    try {
        & docker info *> $null
        if ($LASTEXITCODE -ne 0) {
            throw 'Docker access failed. Check Docker Desktop and your permissions.'
        }

        & docker compose version *> $null
        if ($LASTEXITCODE -ne 0) {
            throw 'Install Docker Desktop with Docker Compose v2.'
        }

        switch ($Command) {
            { $_ -in @('start', 'restart') } {
                $composeArgs = @('up', '-d', '--build', '--wait', '--wait-timeout', '120')
                if ($Command -eq 'restart') {
                    $composeArgs += '--force-recreate'
                }
                Invoke-Compose -ComposeArgs $composeArgs
                Export-Certificate
                $origin = Invoke-Compose -ComposeArgs @('exec', '-T', 'vmodel', 'printenv', 'VMODEL_ORIGIN') -CaptureOutput
                Write-Output "Open $($origin -join '') after this computer trusts the certificate."
            }
            'stop' { Invoke-Compose -ComposeArgs @('down') }
            'status' { Invoke-Compose -ComposeArgs @('ps') }
            'logs' { Invoke-Compose -ComposeArgs @('logs', '--follow', '--tail', '200') }
            'cert' { Export-Certificate }
        }
    }
    finally {
        Pop-Location
    }
}
catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
