[CmdletBinding()]
param(
  [string] $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Continue'

$runtimeRoot = Join-Path $RepoRoot '.tmp\openclaw-autodev'
$tokenPath = Join-Path $runtimeRoot 'secrets\gateway-token.txt'
$token = if (Test-Path -LiteralPath $tokenPath) {
  (Get-Content -LiteralPath $tokenPath -Raw).Trim()
} else {
  ''
}

Write-Host '== Docker =='
docker version --format 'Server {{.Server.Version}}' 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Docker daemon is not reachable.'
}

Write-Host ''
Write-Host '== Ollama =='
ollama ps

Write-Host ''
Write-Host '== OpenClaw Gateway =='
openclaw gateway status

Write-Host ''
Write-Host '== Cron =='
if ($token) {
  openclaw cron status --token $token
  openclaw cron list --token $token
} else {
  Write-Host "No token file at $tokenPath"
}

Write-Host ''
Write-Host '== Latest Runs =='
$runs = Join-Path $runtimeRoot 'runs'
if (Test-Path -LiteralPath $runs) {
  Get-ChildItem -LiteralPath $runs -Directory |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 5 Name, LastWriteTime |
    Format-Table -AutoSize
} else {
  Write-Host 'No runs yet.'
}
