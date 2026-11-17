[CmdletBinding()]
param(
    [ValidateSet('Check', 'Up', 'Down')]
    [string]$Action = 'Check',
    [string]$Profile = 'mindguard',
    [switch]$RelayOnly
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $projectRoot 'compose.voice-local.yaml'
$environmentFile = Join-Path $projectRoot 'apps/voice-relay/.env'
$dockerCommand = Get-Command docker -ErrorAction Stop
$composeArguments = @('compose', '--project-directory', $projectRoot, '-f', $composeFile)
$runtimeDirectory = Join-Path $projectRoot 'artifacts/voice-runtime'
$runtimeCredentials = Join-Path $runtimeDirectory 'credentials.json'
$refreshStop = Join-Path $runtimeDirectory 'stop'

if ($Action -eq 'Down') {
    & $dockerCommand.Source @composeArguments down
    if ($LASTEXITCODE -ne 0) { throw 'Docker shutdown failed.' }
    [IO.Directory]::CreateDirectory($runtimeDirectory) | Out-Null
    [IO.File]::WriteAllText($refreshStop, 'stop')
    if (Test-Path -LiteralPath $runtimeCredentials) { Remove-Item -LiteralPath $runtimeCredentials }
    return
}
if (!(Test-Path -LiteralPath $environmentFile)) {
    throw 'Create apps/voice-relay/.env from .env.example and configure it locally. Never paste credentials into chat.'
}

# Never print the resolved configuration: it contains the local OpenAI key.
& $dockerCommand.Source @composeArguments config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose configuration validation failed.' }
if ($Action -eq 'Check') {
    Write-Output 'Docker Compose configuration is valid. This check does not test image building, authentication or live voice.'
    return
}

& $dockerCommand.Source info --format '{{.OSType}}'
if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop with Linux containers before continuing.' }
# Finish potentially long builds before obtaining short-lived AWS credentials.
$buildServices = @('voice-relay')
if (!$RelayOnly) { $buildServices += 'web' }
foreach ($buildService in $buildServices) {
    & $dockerCommand.Source @composeArguments build $buildService
    if ($LASTEXITCODE -ne 0) { throw 'Docker image build failed.' }
}
$awsCommand = Get-Command aws -ErrorAction SilentlyContinue
$awsExecutable = if ($awsCommand) { $awsCommand.Source } else { 'C:\Program Files\Amazon\AWSCLIV2\aws.exe' }
if (!(Test-Path -LiteralPath $awsExecutable)) { throw 'AWS CLI was not found.' }

$identityJson = & $awsExecutable sts get-caller-identity --profile $Profile --region ca-central-1 --no-cli-pager
if ($LASTEXITCODE -ne 0) { throw 'AWS identity verification failed. Refresh your local AWS login and retry.' }
$identity = ($identityJson -join "`n") | ConvertFrom-Json
if ($identity.Account -ne '950801850836') { throw 'AWS account does not match the approved MindGuard foundation.' }

# Temporary credentials live only in an ignored runtime directory, never in source or images.
$credentialJson = & $awsExecutable configure export-credentials --profile $Profile --format process --no-cli-pager
if ($LASTEXITCODE -ne 0) { throw 'Unable to obtain temporary AWS credentials.' }
$credentials = ($credentialJson -join "`n") | ConvertFrom-Json
if (!$credentials.AccessKeyId -or !$credentials.SecretAccessKey -or !$credentials.SessionToken -or !$credentials.Expiration) {
    throw 'Temporary AWS login credentials with an expiry are required.'
}
if ([DateTimeOffset]::Parse($credentials.Expiration) -le [DateTimeOffset]::UtcNow.AddSeconds(30)) {
    throw 'AWS credentials expire too soon. Refresh your local AWS login and retry.'
}

[IO.Directory]::CreateDirectory($runtimeDirectory) | Out-Null
if (Test-Path -LiteralPath $refreshStop) { Remove-Item -LiteralPath $refreshStop }
$credentials.Expiration = [DateTimeOffset]::Parse($credentials.Expiration).UtcDateTime.ToString('o')
$utf8 = New-Object Text.UTF8Encoding($false)
$initialCredentials = Join-Path $runtimeDirectory ('credentials-initial-' + [Guid]::NewGuid().ToString('N') + '.tmp')
[IO.File]::WriteAllText($initialCredentials, ($credentials | ConvertTo-Json -Compress), $utf8)
if (Test-Path -LiteralPath $runtimeCredentials) { [IO.File]::Replace($initialCredentials, $runtimeCredentials, [NullString]::Value) }
else { [IO.File]::Move($initialCredentials, $runtimeCredentials) }
$shellExecutable = (Get-Process -Id $PID).Path
$refresher = Join-Path $PSScriptRoot 'voice-credentials.ps1'
$refresherArguments = @('-NoProfile', '-File', ('"' + $refresher + '"'), '-Profile', ('"' + $Profile + '"'), '-Directory', ('"' + $runtimeDirectory + '"'))
$refreshRunning = $false
try {
    $probe = [IO.File]::Open((Join-Path $runtimeDirectory 'refresh.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
    $probe.Dispose()
} catch { $refreshRunning = $true }
if (!$refreshRunning) {
    Start-Process -FilePath $shellExecutable -ArgumentList $refresherArguments -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDirectory 'refresh.log') -RedirectStandardError (Join-Path $runtimeDirectory 'refresh-error.log') | Out-Null
}
try {
    $startupArguments = @('up', '--no-build', '--detach', '--force-recreate')
    if ($RelayOnly) { $startupArguments += @('--no-deps', 'voice-relay') }
    & $dockerCommand.Source @composeArguments @startupArguments
    if ($LASTEXITCODE -ne 0) { throw 'Docker build or startup failed.' }
    Write-Output 'Local relay startup requested. Check /api/voice/ready separately; health does not prove live voice readiness.'
    Write-Output 'Temporary AWS credentials refresh automatically while the local AWS login remains valid.'
}
finally {
    $credentials = $null
    $credentialJson = $null
}
