param(
    [string]$InputFile = "",
    [string]$DateBegin = "",
    [string]$DateEnd = "",
    [string]$CommitMessage = "",
    [switch]$SetupCredentials,
    [switch]$SkipBuild,
    [switch]$NoPush
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path (Join-Path $ScriptDir "..")).Path
$CredentialDir = Join-Path $env:LOCALAPPDATA "ScudAutomation"
$CredentialFile = Join-Path $CredentialDir "perco_credentials.xml"
$Yesterday = (Get-Date).Date.AddDays(-1)

if (-not $DateBegin) {
    $DateBegin = Get-Date -Date (Get-Date -Year $Yesterday.Year -Month 1 -Day 1) -Format "yyyy-MM-dd"
}
if (-not $DateEnd) {
    $DateEnd = $Yesterday.ToString("yyyy-MM-dd")
}

$RequestedEnd = [datetime]::ParseExact($DateEnd, "yyyy-MM-dd", $null).Date
if ($RequestedEnd -ge (Get-Date).Date) {
    $DateEnd = $Yesterday.ToString("yyyy-MM-dd")
    Write-Host "Current day is incomplete. Export end changed to $DateEnd." -ForegroundColor Yellow
}

Set-Location $RepoRoot

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Assert-LastExitCode {
    param([string]$Action)
    if ($LASTEXITCODE -ne 0) {
        throw "$Action failed with exit code $LASTEXITCODE."
    }
}

function Get-PercoCredential {
    if ($env:PERCO_LOGIN -and $env:PERCO_PASSWORD -and -not $SetupCredentials) {
        $securePassword = ConvertTo-SecureString $env:PERCO_PASSWORD -AsPlainText -Force
        return [PSCredential]::new($env:PERCO_LOGIN, $securePassword)
    }

    if ((Test-Path -LiteralPath $CredentialFile) -and -not $SetupCredentials) {
        return Import-Clixml -LiteralPath $CredentialFile
    }

    Write-Host "PERCo credentials are needed once. Windows will encrypt them for this user." -ForegroundColor Yellow
    $credential = Get-Credential -Message "PERCo administrator credentials"
    if (-not $credential) {
        throw "PERCo credentials were not provided."
    }

    New-Item -ItemType Directory -Path $CredentialDir -Force | Out-Null
    $credential | Export-Clixml -LiteralPath $CredentialFile
    Write-Host "Credentials saved securely for this Windows account: $CredentialFile" -ForegroundColor Green
    return $credential
}

Write-Step "Checking repository state"
$trackedChanges = git status --porcelain --untracked-files=no
Assert-LastExitCode "git status"
if ($trackedChanges) {
    throw "Repository has uncommitted tracked changes. Commit them before running the automatic update."
}

if (-not $NoPush) {
    Write-Step "Updating local repository"
    git pull --rebase
    Assert-LastExitCode "git pull --rebase"
}

Write-Step "Checking Python dependencies"
python -c "import pandas, openpyxl"
if ($LASTEXITCODE -ne 0) {
    python -m pip install pandas openpyxl
    Assert-LastExitCode "Python dependency installation"
}

if (-not $InputFile) {
    Write-Step "Downloading completed events from PERCo"
    $credential = Get-PercoCredential
    $env:PERCO_LOGIN = $credential.UserName
    $env:PERCO_PASSWORD = $credential.GetNetworkCredential().Password
    if (-not $env:PERCO_BASE_URL) {
        $env:PERCO_BASE_URL = "http://127.0.0.1"
    }

    $InputFile = Join-Path $RepoRoot "automation\downloads\perco_events_${DateBegin}_${DateEnd}.xlsx"
    try {
        python .\automation\perco_eventsystem_export.py `
            --date-begin $DateBegin `
            --date-end $DateEnd `
            --out $InputFile
        Assert-LastExitCode "PERCo export"
    }
    finally {
        Remove-Item Env:PERCO_PASSWORD -ErrorAction SilentlyContinue
    }
} else {
    $InputFile = (Resolve-Path -LiteralPath $InputFile).Path
    Write-Step "Using manual Excel override"
    Write-Host $InputFile
}

if (-not $CommitMessage) {
    $date = Get-Date -Format "yyyy-MM-dd HH:mm"
    $CommitMessage = "Auto update SCUD data $date"
}

Write-Step "Generating reports"
python .\generate_report.py "$InputFile"
Assert-LastExitCode "Report generation"

Write-Step "Copying data into Next.js app"
Copy-Item -LiteralPath .\work_summary.json -Destination .\web\data\work_summary.json -Force
Copy-Item -LiteralPath .\work_summary.json -Destination .\web\public\work_summary.json -Force

if (-not $SkipBuild) {
    Write-Step "Building web app"
    Push-Location .\web
    try {
        if (-not (Test-Path .\node_modules)) {
            npm install
            Assert-LastExitCode "npm install"
        }
        npm run build
        Assert-LastExitCode "npm run build"
    }
    finally {
        Pop-Location
    }
}

Write-Step "Committing updated reports"
git add `
    .\work_summary.json `
    .\weekly_report.xlsx `
    .\breaks_report.xlsx `
    .\web\data\work_summary.json `
    .\web\public\work_summary.json `
    .\automation\.gitignore `
    .\automation\compare_perco_exports.py `
    .\automation\INSTALL_DAILY_TASK.cmd `
    .\automation\install_daily_task.ps1 `
    .\automation\perco_api_probe.py `
    .\automation\perco_eventsystem_export.py `
    .\automation\RUN_UPDATE.cmd `
    .\automation\update_scud_data.ps1
Assert-LastExitCode "git add"

$changes = git diff --cached --name-only
if ($changes) {
    git commit -m "$CommitMessage"
    Assert-LastExitCode "git commit"
} else {
    Write-Host "No report changes to commit."
}

if (-not $NoPush) {
    Write-Step "Pushing to GitHub"
    git push
    Assert-LastExitCode "git push"
} else {
    Write-Host "Git push skipped because -NoPush was provided."
}

Write-Step "Done. Vercel will deploy the updated data from GitHub."
