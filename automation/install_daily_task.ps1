param(
    [string]$RunAt = "06:10"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$UpdateScript = (Resolve-Path (Join-Path $ScriptDir "update_scud_data.ps1")).Path
$CredentialDir = Join-Path $env:LOCALAPPDATA "ScudAutomation"
$CredentialFile = Join-Path $CredentialDir "perco_credentials.xml"
$TaskName = "SCUD Daily Update"

try {
    $triggerTime = [datetime]::ParseExact($RunAt, "HH:mm", $null)
}
catch {
    throw "RunAt must use HH:mm format, for example 06:10."
}

Write-Host "Enter the PERCo administrator credentials once." -ForegroundColor Cyan
$credential = Get-Credential -Message "PERCo administrator credentials"
if (-not $credential) {
    throw "PERCo credentials were not provided."
}

New-Item -ItemType Directory -Path $CredentialDir -Force | Out-Null
$credential | Export-Clixml -LiteralPath $CredentialFile

$powerShell = (Get-Command powershell.exe).Source
$arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$UpdateScript`""
$action = New-ScheduledTaskAction -Execute $powerShell -Argument $arguments
$trigger = New-ScheduledTaskTrigger -Daily -At $triggerTime
$principal = New-ScheduledTaskPrincipal `
    -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description "Downloads completed PERCo events through yesterday, rebuilds reports, and deploys them through GitHub/Vercel." `
    -Force | Out-Null

Write-Host ""
Write-Host "Daily task installed: $TaskName at $RunAt" -ForegroundColor Green
Write-Host "The task runs under the current Windows user, including while the PC is locked."
Write-Host "Keep this Windows user signed in and make sure GitHub credentials are saved."
