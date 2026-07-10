param(
    [string]$InputFile = "",
    [string]$CommitMessage = "",
    [switch]$SkipBuild,
    [switch]$NoPush
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..")
$Downloads = Join-Path $env:USERPROFILE "Downloads"

Set-Location $RepoRoot

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

if (-not $InputFile) {
    $latest = Get-ChildItem -LiteralPath $Downloads -Filter *.xlsx |
        Where-Object { $_.Name -notlike "~$*" } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if (-not $latest) {
        throw "No .xlsx files found in $Downloads. Pass -InputFile explicitly."
    }

    $InputFile = $latest.FullName
}

$InputFile = (Resolve-Path -LiteralPath $InputFile).Path

if (-not $CommitMessage) {
    $date = Get-Date -Format "yyyy-MM-dd HH:mm"
    $CommitMessage = "Автообновление данных СКУД $date"
}

Write-Step "Using input Excel"
Write-Host $InputFile

Write-Step "Checking Python dependencies"
python -c "import pandas, openpyxl" 2>$null
if ($LASTEXITCODE -ne 0) {
    python -m pip install pandas openpyxl
}

Write-Step "Generating reports"
python .\generate_report.py "$InputFile"

Write-Step "Copying work_summary.json into Next.js app"
Copy-Item -LiteralPath .\work_summary.json -Destination .\web\data\work_summary.json -Force
Copy-Item -LiteralPath .\work_summary.json -Destination .\web\public\work_summary.json -Force

if (-not $SkipBuild) {
    Write-Step "Building web app"
    Push-Location .\web
    if (-not (Test-Path .\node_modules)) {
        npm install
    }
    npm run build
    Pop-Location
}

Write-Step "Git status"
git status --short

Write-Step "Committing updated files"
git add `
    .\work_summary.json `
    .\weekly_report.xlsx `
    .\breaks_report.xlsx `
    .\web\data\work_summary.json `
    .\web\public\work_summary.json `
    .\automation\.gitignore `
    .\automation\compare_perco_exports.py `
    .\automation\perco_api_probe.py `
    .\automation\perco_eventsystem_export.py `
    .\automation\update_scud_data.ps1

$changes = git diff --cached --name-only
if (-not $changes) {
    Write-Host "No staged changes to commit."
} else {
    git commit -m "$CommitMessage"
}

if (-not $NoPush) {
    Write-Step "Pushing to GitHub"
    git push
} else {
    Write-Host "Skipping git push because -NoPush was provided."
}

Write-Step "Done"
