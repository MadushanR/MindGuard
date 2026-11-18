[CmdletBinding()]
param([string]$Profile = 'mindguard')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$artifacts = Join-Path $root 'artifacts'
[IO.Directory]::CreateDirectory($artifacts) | Out-Null
$awsPath = (Get-Command aws -ErrorAction Stop).Source
$identity = & $awsPath sts get-caller-identity --profile $Profile --query Account --output text
if ($LASTEXITCODE -ne 0 -or $identity -ne '950801850836') { throw 'Authorized MindGuard AWS login required.' }
$requestPath = Join-Path $artifacts 'security-account-request.local.json'
$accountPath = Join-Path $artifacts 'security-test-accounts.local.json'
$utf8 = New-Object Text.UTF8Encoding($false)
$accounts = @()
try {
    foreach ($role in @('sender','recipient','deletion')) {
        $email = 'security-' + $role + '@mindguard.example'
        $bytes = New-Object byte[] 32
        $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
        $generator.GetBytes($bytes)
        $generator.Dispose()
        $password = 'Mg!9' + [Convert]::ToBase64String($bytes)
        $create = @{UserPoolId='ca-central-1_gHPR0XqZa';Username=$email;MessageAction='SUPPRESS';UserAttributes=@(@{Name='email';Value=$email},@{Name='email_verified';Value='true'})}
        [IO.File]::WriteAllText($requestPath, ($create | ConvertTo-Json -Depth 5), $utf8)
        $result = & $awsPath cognito-idp admin-create-user --cli-input-json ('file://' + $requestPath) --profile $Profile --region ca-central-1 --no-cli-pager 2>&1
        if ($LASTEXITCODE -ne 0 -and ($result -join "`n") -notmatch 'UsernameExistsException') { throw 'Synthetic account setup failed.' }
        [IO.File]::WriteAllText($requestPath, (@{UserPoolId='ca-central-1_gHPR0XqZa';Username=$email;Password=$password;Permanent=$true} | ConvertTo-Json), $utf8)
        $result = & $awsPath cognito-idp admin-set-user-password --cli-input-json ('file://' + $requestPath) --profile $Profile --region ca-central-1 --no-cli-pager 2>&1
        if ($LASTEXITCODE -ne 0) { throw 'Synthetic password setup failed.' }
        $accounts += @{role=$role;email=$email;password=$password}
    }
    [IO.File]::WriteAllText($accountPath, ($accounts | ConvertTo-Json), $utf8)
    Write-Output 'Three isolated synthetic security accounts prepared; invitations suppressed. Credentials remain in ignored artifacts.'
} finally {
    if (Test-Path -LiteralPath $requestPath) { Remove-Item -LiteralPath $requestPath }
    $password = $null
}
