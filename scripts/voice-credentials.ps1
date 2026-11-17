[CmdletBinding()]
param([string]$Profile = 'mindguard', [Parameter(Mandatory)][string]$Directory)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$runtimeDirectory = [IO.Path]::GetFullPath($Directory)
if (!$runtimeDirectory.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'The local voice credential directory must stay inside this workspace.'
}
[IO.Directory]::CreateDirectory($runtimeDirectory) | Out-Null
$lockPath = Join-Path $runtimeDirectory 'refresh.lock'
$stopPath = Join-Path $runtimeDirectory 'stop'
$destination = Join-Path $runtimeDirectory 'credentials.json'
$utf8 = New-Object Text.UTF8Encoding($false)
$awsCommand = Get-Command aws -ErrorAction SilentlyContinue
$awsPath = if ($awsCommand) { $awsCommand.Source } else { 'C:\Program Files\Amazon\AWSCLIV2\aws.exe' }
try { $lock = [IO.File]::Open($lockPath, 'OpenOrCreate', 'ReadWrite', 'None') }
catch { exit 0 } # A refresher for this workspace is already running.
try {
    while (!(Test-Path -LiteralPath $stopPath)) {
        $json = & $awsPath configure export-credentials --profile $Profile --format process --no-cli-pager 2>$null
        if (Test-Path -LiteralPath $stopPath) { break }
        if ($LASTEXITCODE -eq 0) {
            try {
                $credentials = ($json -join "`n") | ConvertFrom-Json
                if (!$credentials.AccessKeyId -or !$credentials.SecretAccessKey -or !$credentials.SessionToken -or !$credentials.Expiration) { throw 'Invalid credentials.' }
                $expiry = [DateTimeOffset]::Parse($credentials.Expiration)
                if ($expiry -le [DateTimeOffset]::UtcNow.AddSeconds(30)) { throw 'Expired credentials.' }
                $credentials.Expiration = $expiry.UtcDateTime.ToString('o')
                $temporary = Join-Path $runtimeDirectory ('credentials-' + [Guid]::NewGuid().ToString('N') + '.tmp')
                [IO.File]::WriteAllText($temporary, ($credentials | ConvertTo-Json -Compress), $utf8)
                if (Test-Path -LiteralPath $destination) { [IO.File]::Replace($temporary, $destination, [NullString]::Value) }
                else { [IO.File]::Move($temporary, $destination) }
            } catch { Write-Output 'LOCAL_AWS_REFRESH_REQUIRED' }
        } else { Write-Output 'LOCAL_AWS_LOGIN_REQUIRED' }
        $json = $null
        $credentials = $null
        # Poll the stop marker promptly; only refresh credentials once per minute.
        for ($waitStep=0; $waitStep -lt 30 -and !(Test-Path -LiteralPath $stopPath); $waitStep++) { Start-Sleep -Seconds 2 }
    }
} finally {
    $lock.Dispose()
    if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination }
}
