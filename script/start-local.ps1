[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 4321,

    [ValidateNotNullOrEmpty()]
    [string]$ListenAddress = '127.0.0.1'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$packageFile = Join-Path $projectRoot 'package.json'
$astroCommand = Join-Path $projectRoot 'node_modules\.bin\astro.cmd'
$nodeCommand = Get-Command 'node.exe' -ErrorAction SilentlyContinue
$npmCommand = Get-Command 'npm.cmd' -ErrorAction SilentlyContinue
$requiredNodeVersion = [version]'22.12.0'

if (-not (Test-Path -LiteralPath $packageFile -PathType Leaf)) {
    throw "package.json was not found at: $projectRoot"
}

if ($null -eq $nodeCommand -or $null -eq $npmCommand) {
    throw 'Node.js or npm.cmd was not found. Install Node.js 22.12.0 or newer and try again.'
}

$nodeVersionText = (& $nodeCommand.Source --version).TrimStart('v')
$nodeExitCode = $LASTEXITCODE
if ($nodeExitCode -ne 0) {
    throw "Unable to read the Node.js version (exit code $nodeExitCode)."
}

try {
    $nodeVersion = [version]$nodeVersionText
}
catch {
    throw "Unable to parse the Node.js version: $nodeVersionText"
}

if ($nodeVersion -lt $requiredNodeVersion) {
    throw "Node.js $requiredNodeVersion or newer is required. Current version: $nodeVersion"
}

$exitCode = 0
Push-Location -LiteralPath $projectRoot

try {
    if (-not (Test-Path -LiteralPath $astroCommand -PathType Leaf)) {
        Write-Host 'Project dependencies are missing. Running npm ci...' -ForegroundColor Yellow
        & $npmCommand.Source ci
        $installExitCode = $LASTEXITCODE
        if ($installExitCode -ne 0) {
            throw "npm ci failed with exit code $installExitCode."
        }
    }

    $localUrl = "http://${ListenAddress}:$Port/"
    Write-Host "Starting the local blog server at $localUrl" -ForegroundColor Cyan
    Write-Host 'Press Ctrl+C to stop the server.' -ForegroundColor DarkGray

    & $npmCommand.Source run dev -- --host $ListenAddress --port $Port
    $exitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}

if ($exitCode -ne 0) {
    exit $exitCode
}
