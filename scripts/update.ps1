# update.ps1 - pull the latest BooSkills and reinstall on Windows.
# Run this whenever you want your Windows agents to pick up catalog changes.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'

$RepoDir = Split-Path -Parent $PSScriptRoot
Write-Host "Updating BooSkills at $RepoDir"

Push-Location $RepoDir
try {
  git pull --ff-only
} finally {
  Pop-Location
}

& (Join-Path $PSScriptRoot 'install.ps1')
