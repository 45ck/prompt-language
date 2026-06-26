[CmdletBinding()]
param(
  [ValidateSet('dry-run', 'live')]
  [string] $Mode = $(if ($env:PL_OPENCLAW_MODE) { $env:PL_OPENCLAW_MODE } else { 'live' }),

  [string] $RepoRoot = '',

  [string] $Model = $(if ($env:PL_OPENCLAW_MODEL) { $env:PL_OPENCLAW_MODEL } else { 'ollama/qwen3.6-27b-q8:latest' }),

  [string] $Image = 'prompt-language-openclaw-runner:latest',

  [int] $AgentTimeoutSeconds = 28800,

  [switch] $SkipAgent,

  [switch] $SkipCi,

  [string] $Task = $env:PL_OPENCLAW_TASK
)

$ErrorActionPreference = 'Stop'

if (-not $RepoRoot) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}

function Write-Utf8NoBomLf {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Path,

    [Parameter(Mandatory = $true)]
    [string] $Content
  )

  $normalized = $Content -replace "`r`n", "`n"
  $encoding = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($Path, $normalized, $encoding)
}

function Invoke-Logged {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Name,

    [Parameter(Mandatory = $true)]
    [string] $FilePath,

    [Parameter(Mandatory = $true)]
    [string[]] $ArgumentList,

    [string] $WorkingDirectory = $RepoRoot
  )

  $logPath = Join-Path $script:RunDir "$Name.log"
  ">>> $FilePath $($ArgumentList -join ' ')" | Tee-Object -FilePath $logPath -Append

  Push-Location $WorkingDirectory
  try {
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
      & $FilePath @ArgumentList 2>&1 | Tee-Object -FilePath $logPath -Append
    } finally {
      $ErrorActionPreference = $previousErrorActionPreference
    }
    $exit = $LASTEXITCODE
    if ($exit -ne 0) {
      throw "$Name failed with exit code $exit"
    }
  } finally {
    Pop-Location
  }
}

function Write-Result {
  param(
    [string] $Status,
    [string] $Message,
    [hashtable] $Extra = @{}
  )

  $payload = [ordered]@{
    runId = $script:RunId
    status = $Status
    message = $Message
    mode = $Mode
    model = $Model
    worktree = $script:Worktree
    timestamp = (Get-Date).ToUniversalTime().ToString('o')
  }

  foreach ($key in $Extra.Keys) {
    $payload[$key] = $Extra[$key]
  }

  $resultJson = $payload | ConvertTo-Json -Depth 10
  Write-Utf8NoBomLf -Path (Join-Path $script:RunDir 'result.json') -Content $resultJson
}

function Ensure-RunnerImage {
  docker image inspect $Image *> $null
  if ($LASTEXITCODE -eq 0) {
    return
  }

  Invoke-Logged -Name 'docker-build' -FilePath docker -ArgumentList @(
    'build',
    '-t',
    $Image,
    '-f',
    (Join-Path $PSScriptRoot 'Dockerfile.runner'),
    $RepoRoot
  )
}

function Write-ContainerOpenClawConfig {
  $config = @{
    models = @{
      providers = @{
        ollama = @{
          baseUrl = 'http://host.docker.internal:11434'
          apiKey = 'ollama-local'
          api = 'ollama'
          timeoutSeconds = 1200
          contextWindow = 32768
          maxTokens = 8192
          models = @(
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
        workspace = '/work'
        model = @{
          primary = $Model
          fallbacks = @('ollama/gemma4-e2b-opencode:latest')
        }
      }
      list = @(
        @{
          id = 'prompt-language-autodev'
          workspace = '/work'
          model = @{
            primary = $Model
            fallbacks = @('ollama/gemma4-e2b-opencode:latest')
          }
        }
      )
    }
    tools = @{
      exec = @{
        host = 'auto'
        mode = 'full'
      }
    }
  } | ConvertTo-Json -Depth 20

  New-Item -ItemType Directory -Force -Path $script:ProfileRoot | Out-Null
  Write-Utf8NoBomLf -Path (Join-Path $script:ProfileRoot 'openclaw.json') -Content $config
}

function Invoke-Runner {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Name,

    [Parameter(Mandatory = $true)]
    [string] $ScriptPath
  )

  $containerName = "pl-openclaw-$($script:RunId)-$Name" -replace '[^a-zA-Z0-9_.-]', '-'
  Invoke-Logged -Name $Name -FilePath docker -ArgumentList @(
    'run',
    '--rm',
    '--name',
    $containerName,
    '--add-host',
    'host.docker.internal:host-gateway',
    '-v',
    "$($script:Worktree):/work",
    '-v',
    "$($script:ProfileRoot):/root/.openclaw",
    '-v',
    "$($script:RunDir):/run-context",
    '-v',
    '/var/run/docker.sock:/var/run/docker.sock',
    '-v',
    'pl-openclaw-npm-cache:/root/.npm',
    '-w',
    '/work',
    '-e',
    'OLLAMA_API_KEY=ollama-local',
    '-e',
    "PL_OPENCLAW_MODEL=$Model",
    '-e',
    "PL_OPENCLAW_RUN_ID=$($script:RunId)",
    '-e',
    "PL_OPENCLAW_AGENT_TIMEOUT_SECONDS=$AgentTimeoutSeconds",
    $Image,
    'bash',
    $ScriptPath
  ) -WorkingDirectory $RepoRoot
}

function New-CyclePrompt {
  $templatePath = Join-Path $PSScriptRoot 'prompts\cycle.md'
  $taskText = if ($Task) {
    $Task
  } else {
    'Choose one bounded, high-value improvement from the current repository state.'
  }

  $prompt = Get-Content -LiteralPath $templatePath -Raw
  $prompt = $prompt.Replace('{{RUN_ID}}', $script:RunId)
  $prompt = $prompt.Replace('{{TASK}}', $taskText)
  $prompt = $prompt.Replace('{{MODE}}', $Mode)
  Write-Utf8NoBomLf -Path (Join-Path $script:RunDir 'cycle-prompt.md') -Content $prompt
}

function Invoke-AgentTurn {
  $agentScript = @'
set -euo pipefail
git config --global --add safe.directory /work
node --version | tee /run-context/node-version.txt
npm --version | tee /run-context/npm-version.txt
docker version > /run-context/docker-version.txt
openclaw --version | tee /run-context/openclaw-version.txt
openclaw infer model run \
  --local \
  --model "$PL_OPENCLAW_MODEL" \
  --prompt "Reply with exactly: ok" \
  --json | tee /run-context/model-smoke.json
prompt="$(cat /run-context/cycle-prompt.md)"
openclaw agent \
  --local \
  --agent prompt-language-autodev \
  --session-key "pl-autodev-$PL_OPENCLAW_RUN_ID" \
  --model "$PL_OPENCLAW_MODEL" \
  --thinking high \
  --timeout "$PL_OPENCLAW_AGENT_TIMEOUT_SECONDS" \
  --message "$prompt" \
  --json | tee /run-context/openclaw-agent.json
'@

  $agentScriptPath = Join-Path $script:RunDir 'agent-turn.sh'
  Write-Utf8NoBomLf -Path $agentScriptPath -Content $agentScript
  Invoke-Runner -Name 'agent-turn' -ScriptPath '/run-context/agent-turn.sh'
}

function Invoke-Gates {
  param([string] $Name = 'gates')

  $ciLine = if ($SkipCi) {
    'echo "Skipping npm run ci because -SkipCi was supplied"'
  } else {
    'npm run ci'
  }

  $gateScript = @"
set -euo pipefail
git config --global --add safe.directory /work
npm ci
npm run format:check
npm run lint
npm run spell
npm run typecheck
npm run build
npm run test
$ciLine
"@

  $gateScriptPath = Join-Path $script:RunDir "$Name.sh"
  Write-Utf8NoBomLf -Path $gateScriptPath -Content $gateScript
  Invoke-Runner -Name $Name -ScriptPath "/run-context/$Name.sh"
}

function Get-CommitMessage {
  $candidatePaths = @(
    (Join-Path $script:RunDir 'commit-message.txt'),
    (Join-Path $script:Worktree '.openclaw-commit-message')
  )

  foreach ($path in $candidatePaths) {
    if (Test-Path -LiteralPath $path) {
      $firstLine = (Get-Content -LiteralPath $path -TotalCount 1).Trim()
      if ($firstLine -match '^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9-]+\))?: .{1,100}$') {
        return $firstLine
      }
    }
  }

  return 'chore(openclaw): autonomous prompt-language improvement'
}

function Commit-And-Push {
  $status = & git -C $script:Worktree status --porcelain
  if (-not $status) {
    Write-Result -Status 'no-change' -Message 'Agent completed without repository changes.'
    return
  }

  if ($Mode -eq 'dry-run') {
    $status | Set-Content -LiteralPath (Join-Path $script:RunDir 'git-status.txt') -Encoding utf8
    Write-Result -Status 'dry-run-ready' -Message 'Changes passed gates, but dry-run mode skipped commit and push.'
    return
  }

  Invoke-Logged -Name 'git-add' -FilePath git -ArgumentList @('-C', $script:Worktree, 'add', '-A')
  Invoke-Logged -Name 'git-diff-check' -FilePath git -ArgumentList @('-C', $script:Worktree, 'diff', '--cached', '--check')

  $message = Get-CommitMessage
  Invoke-Logged -Name 'git-config-name' -FilePath git -ArgumentList @('-C', $script:Worktree, 'config', 'user.name', 'OpenClaw Autodev')
  Invoke-Logged -Name 'git-config-email' -FilePath git -ArgumentList @('-C', $script:Worktree, 'config', 'user.email', 'openclaw-autodev@users.noreply.github.com')
  Invoke-Logged -Name 'git-commit' -FilePath git -ArgumentList @(
    '-C',
    $script:Worktree,
    'commit',
    '-m',
    $message,
    '-m',
    "Autonomous OpenClaw cycle $($script:RunId). Inference ran through $Model; execution and gates ran in Docker image $Image."
  )

  Invoke-Logged -Name 'git-fetch-before-push' -FilePath git -ArgumentList @('-C', $script:Worktree, 'fetch', 'origin', 'main', '--prune')
  & git -C $script:Worktree merge-base --is-ancestor origin/main HEAD
  if ($LASTEXITCODE -ne 0) {
    Invoke-Logged -Name 'git-rebase-origin-main' -FilePath git -ArgumentList @('-C', $script:Worktree, 'rebase', 'origin/main')
    Invoke-Gates -Name 'gates-after-rebase'
  }

  Invoke-Logged -Name 'git-push-main' -FilePath git -ArgumentList @('-C', $script:Worktree, 'push', 'origin', 'HEAD:main')
  Write-Result -Status 'pushed' -Message 'Committed and pushed autonomous changes to main.' -Extra @{ commit = (& git -C $script:Worktree rev-parse HEAD) }
}

$script:RunId = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$runtimeRoot = Join-Path $RepoRoot '.tmp\openclaw-autodev'
$script:RunDir = Join-Path $runtimeRoot "runs\$($script:RunId)"
$script:Worktree = Join-Path $runtimeRoot "worktrees\$($script:RunId)"
$script:ProfileRoot = Join-Path $runtimeRoot 'container-openclaw-profile'

New-Item -ItemType Directory -Force -Path $script:RunDir | Out-Null

try {
  Invoke-Logged -Name 'docker-info' -FilePath docker -ArgumentList @('info')
  Invoke-Logged -Name 'git-fetch' -FilePath git -ArgumentList @('-C', $RepoRoot, 'fetch', 'origin', 'main', '--prune')
  Ensure-RunnerImage
  Write-ContainerOpenClawConfig

  $remoteUrl = (& git -C $RepoRoot remote get-url origin).Trim()
  if (-not $remoteUrl) {
    throw 'Could not resolve origin remote URL.'
  }

  Invoke-Logged -Name 'git-clone' -FilePath git -ArgumentList @(
    'clone',
    '--branch',
    'main',
    '--single-branch',
    $remoteUrl,
    $script:Worktree
  )

  Invoke-Logged -Name 'git-reset-origin-main' -FilePath git -ArgumentList @(
    '-C',
    $script:Worktree,
    'reset',
    '--hard',
    'origin/main'
  )

  New-CyclePrompt

  if (-not $SkipAgent) {
    Invoke-AgentTurn
  }

  Invoke-Gates
  Commit-And-Push
} catch {
  Write-Result -Status 'failed' -Message $_.Exception.Message
  Write-Error $_
  exit 1
}
