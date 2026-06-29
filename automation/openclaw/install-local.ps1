[CmdletBinding()]
param(
  [ValidateSet('dry-run', 'live')]
  [string] $Mode = 'live',

  [string] $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,

  [string] $Model = $(if ($env:PL_OPENCLAW_MODEL) { $env:PL_OPENCLAW_MODEL } else { 'ollama/qwen3.6:27b' }),

  [string] $Image = 'prompt-language-openclaw-runner:latest',

  [int] $EveryMinutes = 60
)

$ErrorActionPreference = 'Stop'

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string] $FilePath,

    [Parameter(Mandatory = $true)]
    [string[]] $ArgumentList,

    [string] $WorkingDirectory = $RepoRoot
  )

  Push-Location $WorkingDirectory
  try {
    & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) {
      throw "$FilePath exited with code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

function New-Token {
  $bytes = [byte[]]::new(32)
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }
  return ([Convert]::ToBase64String($bytes) -replace '[+/=]', '')
}

$runtimeRoot = Join-Path $RepoRoot '.tmp\openclaw-autodev'
$controlRoot = Join-Path $runtimeRoot 'control'
$secretsRoot = Join-Path $runtimeRoot 'secrets'
$tokenPath = Join-Path $secretsRoot 'gateway-token.txt'
$gatewayConfig = Join-Path $env:USERPROFILE '.openclaw\openclaw.json'

New-Item -ItemType Directory -Force -Path $runtimeRoot, $secretsRoot | Out-Null

if (-not (Test-Path -LiteralPath $tokenPath)) {
  New-Token | Set-Content -LiteralPath $tokenPath -NoNewline -Encoding utf8
}

$token = (Get-Content -LiteralPath $tokenPath -Raw).Trim()

Write-Host "Building runner image: $Image"
Invoke-Step -FilePath docker -ArgumentList @(
  'build',
  '-t',
  $Image,
  '-f',
  (Join-Path $PSScriptRoot 'Dockerfile.runner'),
  $RepoRoot
)

Write-Host 'Writing OpenClaw Gateway config'
$patch = @{
  gateway = @{
    mode = 'local'
    bind = 'loopback'
    port = 18789
    auth = @{ token = $token }
  }
  models = @{
    providers = @{
      ollama = @{
        baseUrl = 'http://127.0.0.1:11434'
        apiKey = 'ollama-local'
        api = 'ollama'
        timeoutSeconds = 1200
        contextWindow = 32768
        maxTokens = 8192
        models = @(
          @{
            id = 'qwen3.6:27b'
            name = 'qwen3.6:27b'
            input = @('text')
            contextWindow = 32768
            maxTokens = 4096
            params = @{
              num_ctx = 32768
              keep_alive = '30m'
            }
          },
          @{
            id = 'qwen3.6-27b-q8:latest'
            name = 'qwen3.6-27b-q8:latest'
            input = @('text')
            contextWindow = 32768
            maxTokens = 8192
            params = @{
              num_ctx = 32768
              keep_alive = '12h'
            }
          },
          @{
            id = 'gemma4-e2b-opencode:latest'
            name = 'gemma4-e2b-opencode:latest'
            input = @('text')
            contextWindow = 32768
            maxTokens = 8192
            params = @{
              num_ctx = 32768
              keep_alive = '30m'
            }
          }
        )
      }
    }
  }
  agents = @{
    defaults = @{
      workspace = $controlRoot
      model = @{
        primary = $Model
        fallbacks = @('ollama/gemma4-e2b-opencode:latest')
      }
    }
  }
  tools = @{
    exec = @{
      host = 'auto'
      mode = 'full'
    }
  }
  cron = @{
    enabled = $true
    maxConcurrentRuns = 1
    sessionRetention = '72h'
    runLog = @{
      keepLines = 4000
    }
  }
} | ConvertTo-Json -Depth 20

$patchPath = Join-Path $runtimeRoot 'gateway-config.patch.json'
$patch | Set-Content -LiteralPath $patchPath -Encoding utf8
Invoke-Step -FilePath openclaw -ArgumentList @('config', 'patch', '--file', $patchPath)
Invoke-Step -FilePath openclaw -ArgumentList @('config', 'validate')

Write-Host 'Installing and starting OpenClaw Gateway'
Invoke-Step -FilePath openclaw -ArgumentList @('gateway', 'install', '--force', '--token', $token)
Invoke-Step -FilePath openclaw -ArgumentList @('gateway', 'start')

Start-Sleep -Seconds 3

Write-Host 'Preparing durable control worktree'
if (Test-Path -LiteralPath $controlRoot) {
  git -C $RepoRoot worktree remove --force $controlRoot 2>$null
  if (Test-Path -LiteralPath $controlRoot) {
    Remove-Item -LiteralPath $controlRoot -Recurse -Force
  }
}
Invoke-Step -FilePath git -ArgumentList @('fetch', 'origin', 'main', '--prune')
Invoke-Step -FilePath git -ArgumentList @('worktree', 'add', '--detach', $controlRoot, 'origin/main')

Write-Host 'Registering OpenClaw cron job'
$existingJson = ''
try {
  $existingJson = & openclaw cron list --json --token $token
} catch {
  $existingJson = ''
}

if ($LASTEXITCODE -eq 0 -and $existingJson) {
  $jobs = $existingJson | ConvertFrom-Json
  $jobList = if ($jobs.PSObject.Properties.Name -contains 'jobs') {
    @($jobs.jobs)
  } else {
    @($jobs)
  }

  foreach ($job in $jobList) {
    if ($job.name -eq 'prompt-language-autodev' -or $job.id -eq 'prompt-language-autodev') {
      & openclaw cron rm $job.id --token $token | Out-Host
    }
  }
}

$commandArgvItems = @(
  'powershell',
  '-NoProfile',
  '-ExecutionPolicy',
  'Bypass',
  '-File',
  "$controlRoot\automation\openclaw\supervisor.ps1",
  '-RepoRoot',
  $RepoRoot,
  '-Mode',
  $Mode,
  '-Model',
  $Model,
  '-Image',
  $Image
)
$commandArgv = ConvertTo-Json -InputObject $commandArgvItems -Compress
$commandArgvArgument = if ($PSVersionTable.PSVersion.Major -lt 6) {
  $commandArgv -replace '"', '\"'
} else {
  $commandArgv
}

Invoke-Step -FilePath openclaw -ArgumentList @(
  'cron',
  'add',
  '--name',
  'prompt-language-autodev',
  '--description',
  'Autonomously improves prompt-language from fresh worktrees using local Ollama inference and Docker execution.',
  '--every',
  "${EveryMinutes}m",
  '--session',
  'isolated',
  '--command-argv',
  $commandArgvArgument,
  '--command-cwd',
  $RepoRoot,
  '--no-deliver',
  '--timeout-seconds',
  '43200',
  '--no-output-timeout-seconds',
  '1800',
  '--output-max-bytes',
  '250000',
  '--token',
  $token
)

Write-Host "Installed prompt-language OpenClaw autodev in $Mode mode."
Write-Host "Gateway config: $gatewayConfig"
Write-Host "Control worktree: $controlRoot"
Write-Host "Token file: $tokenPath"
