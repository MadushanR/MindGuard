[CmdletBinding()]
param([string]$Profile = 'mindguard')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$artifactDirectory = Join-Path $root 'artifacts'
[IO.Directory]::CreateDirectory($artifactDirectory) | Out-Null
$awsCommand = Get-Command aws -ErrorAction SilentlyContinue
$awsPath = if ($awsCommand) { $awsCommand.Source } else { 'C:\Program Files\Amazon\AWSCLIV2\aws.exe' }
$identityJson = & $awsPath sts get-caller-identity --profile $Profile --region ca-central-1 --no-cli-pager
if ($LASTEXITCODE -ne 0) { throw 'AWS login is unavailable.' }
if ((($identityJson -join "`n") | ConvertFrom-Json).Account -ne '950801850836') { throw 'Unexpected AWS account.' }

# One dedicated synthetic identity; SUPPRESS prevents email/SMS invitations.
$username = 'voice-e2e@mindguard.example'
$randomBytes = New-Object byte[] 32
$generator = [Security.Cryptography.RandomNumberGenerator]::Create()
$generator.GetBytes($randomBytes)
$generator.Dispose()
$password = 'Mg!9' + [Convert]::ToBase64String($randomBytes)
$requestPath = Join-Path $artifactDirectory 'voice-account-request.local.json'
$credentialsPath = Join-Path $artifactDirectory 'voice-test-account.local.json'
$utf8 = New-Object Text.UTF8Encoding($false)
try {
    $create = @{ UserPoolId='ca-central-1_gHPR0XqZa'; Username=$username; MessageAction='SUPPRESS'; UserAttributes=@(@{Name='email';Value=$username},@{Name='email_verified';Value='true'}) }
    [IO.File]::WriteAllText($requestPath, ($create | ConvertTo-Json -Depth 5), $utf8)
    $created = & $awsPath cognito-idp admin-create-user --cli-input-json ('file://' + $requestPath) --profile $Profile --region ca-central-1 --no-cli-pager 2>&1
    if ($LASTEXITCODE -ne 0 -and ($created -join "`n") -notmatch 'UsernameExistsException') { throw 'Synthetic test-account creation failed.' }
    $setPassword = @{ UserPoolId='ca-central-1_gHPR0XqZa'; Username=$username; Password=$password; Permanent=$true }
    [IO.File]::WriteAllText($requestPath, ($setPassword | ConvertTo-Json), $utf8)
    $result = & $awsPath cognito-idp admin-set-user-password --cli-input-json ('file://' + $requestPath) --profile $Profile --region ca-central-1 --no-cli-pager 2>&1
    if ($LASTEXITCODE -ne 0) { throw 'Synthetic test-account password setup failed.' }
    [IO.File]::WriteAllText($credentialsPath, (@{email=$username;password=$password} | ConvertTo-Json), $utf8)
    Write-Output 'Synthetic test identity prepared. Its generated credentials are in the ignored artifacts directory and were not printed.'
}
finally {
    if (Test-Path -LiteralPath $requestPath) { Remove-Item -LiteralPath $requestPath }
    $password = $null
}
