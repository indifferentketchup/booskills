# install.ps1 - Windows installer for the BooSkills catalog (copy mode).
# Mirrors scripts/install.sh for Windows agents. Copies (no symlinks), so re-run
# after every `git pull` to refresh. Personal/local-only: no marketplace, no npm.
#
# Targets (per agent skill/agent discovery on Windows):
#   - Flat catalog : %USERPROFILE%\.agents\skills\<name>
#   - Claude Code  : %USERPROFILE%\.claude\skills\<name>
#   - Codex        : %USERPROFILE%\.codex\skills\<name>  + \.codex\agents\<name>.toml
#   - OpenCode     : %USERPROFILE%\.config\opencode\agents\<name>.md (base personas)
#
# OpenCode personas are copied WITHOUT a model line (the canonical agents/opencode
# files), so each inherits the session model. The Linux flow injects per-preset
# models from Paseo's active preset; Windows has no Paseo, so base personas are correct.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'

$RepoDir = Split-Path -Parent $PSScriptRoot
$UserHome = $env:USERPROFILE

$skillTargets = @(
  (Join-Path $UserHome '.agents\skills'),
  (Join-Path $UserHome '.claude\skills'),
  (Join-Path $UserHome '.codex\skills')
)
$codexAgents    = Join-Path $UserHome '.codex\agents'
$opencodeAgents = Join-Path $UserHome '.config\opencode\agents'

$created = New-Object System.Collections.Generic.List[string]
$failed  = New-Object System.Collections.Generic.List[string]

function Copy-Item-Tracked($src, $dst, $label) {
  try {
    $parent = Split-Path -Parent $dst
    if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
    if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
    Copy-Item -Recurse -Force -Path $src -Destination $dst
    $created.Add($label)
  } catch {
    $failed.Add("$label ($($_.Exception.Message))")
  }
}

Write-Host '--- Installing skills (copy) ---'
Get-ChildItem -Directory (Join-Path $RepoDir 'skills') | ForEach-Object {
  $name = $_.Name
  if (-not (Test-Path (Join-Path $_.FullName 'SKILL.md'))) { return }
  foreach ($base in $skillTargets) {
    Copy-Item-Tracked $_.FullName (Join-Path $base $name) "skill:$name -> $base"
  }
}

# Some catalog files are symlinks in the repo (router.mjs, shared design-guidance).
# Git on Windows materializes symlinks as broken text stubs, so overwrite the
# installed copies with the real target file in every skill target.
$linkFixes = @(
  @{ Src = (Join-Path $RepoDir 'model-router\router.mjs');                                  Rel = 'boo-router\scripts\router.mjs' },
  @{ Src = (Join-Path $RepoDir 'skills\boo-critiquing-frontend\references\design-guidance.md'); Rel = 'boo-building-ui\references\design-guidance.md' }
)
foreach ($fix in $linkFixes) {
  if (-not (Test-Path $fix.Src)) { continue }
  foreach ($base in $skillTargets) {
    $dst = Join-Path $base $fix.Rel
    if (Test-Path (Split-Path -Parent $dst)) {
      Copy-Item -Force -Path $fix.Src -Destination $dst
    }
  }
}

Write-Host '--- Installing Codex agents (TOML) ---'
Get-ChildItem (Join-Path $RepoDir 'agents\codex\*.toml') | ForEach-Object {
  Copy-Item-Tracked $_.FullName (Join-Path $codexAgents $_.Name) "codex:$($_.Name)"
}

Write-Host '--- Installing OpenCode agents (base personas, no model line) ---'
if (-not (Test-Path $opencodeAgents)) { New-Item -ItemType Directory -Force -Path $opencodeAgents | Out-Null }
Get-ChildItem (Join-Path $RepoDir 'agents\opencode\*.md') | ForEach-Object {
  Copy-Item-Tracked $_.FullName (Join-Path $opencodeAgents $_.Name) "opencode:$($_.Name)"
}

Write-Host ''
Write-Host '=== Installation Summary ==='
Write-Host "Created: $($created.Count)"
Write-Host "Failed:  $($failed.Count)"
Write-Host ''
foreach ($item in $created) { Write-Host "  [OK] $item" }
foreach ($item in $failed)  { Write-Host "  [FAIL] $item" }
Write-Host ''
Write-Host 'Claude Code also supports the plugin route: claude plugin marketplace add ' -NoNewline
Write-Host $RepoDir
if ($failed.Count -gt 0) { exit 1 }
