param(
  [Parameter(Mandatory = $true)]
  [string]$FixtureName,
  [string]$Model = "ollama_chat/qwen3-opencode-big:30b",
  [int]$AiderTimeoutSeconds = 1200,
  [int]$PromptTurnTimeoutSeconds = 600,
  [int]$VerifyTimeoutSeconds = 60,
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../../..")).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Fixture = Join-Path $RepoRoot "experiments/aider-vs-pl/fixtures/$FixtureName"
$ResultsRoot = Join-Path $RepoRoot "experiments/aider-vs-pl/results"
$RunStamp = Get-Date -Format "yyyyMMdd-HHmmss"
$RunRoot = Join-Path $ResultsRoot "$FixtureName-local-$RunStamp"
$Cli = Join-Path $RepoRoot "bin/cli.mjs"

function New-Directory($Path) {
  New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

function Copy-Fixture($Workdir) {
  if (!(Test-Path -LiteralPath $Fixture)) {
    throw "Missing fixture: $Fixture"
  }

  New-Directory $Workdir
  Get-ChildItem -LiteralPath $Fixture -Force | Copy-Item -Destination $Workdir -Recurse -Force
  ".aider*`n.prompt-language/`n" | Set-Content -Encoding ascii -LiteralPath (Join-Path $Workdir ".gitignore")
  & git -C $Workdir init -q
  & git -C $Workdir config user.name eval
  & git -C $Workdir config user.email eval@example.invalid
  & git -C $Workdir add -A
  & git -C $Workdir commit -q -m "chore(fixture): snapshot" --allow-empty
}

function Invoke-LoggedCommand(
  [string]$FileName,
  [string[]]$Arguments,
  [string]$WorkingDirectory,
  [string]$StdoutPath,
  [string]$StderrPath,
  [int]$TimeoutSeconds,
  [hashtable]$Environment
) {
  $psi = [System.Diagnostics.ProcessStartInfo]::new()
  $psi.FileName = $FileName
  foreach ($arg in $Arguments) {
    [void]$psi.ArgumentList.Add($arg)
  }
  $psi.WorkingDirectory = $WorkingDirectory
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.UseShellExecute = $false

  foreach ($key in $Environment.Keys) {
    $psi.Environment[$key] = [string]$Environment[$key]
  }

  $started = Get-Date
  $process = [System.Diagnostics.Process]::Start($psi)
  $stdoutTask = $process.StandardOutput.ReadToEndAsync()
  $stderrTask = $process.StandardError.ReadToEndAsync()
  $timedOut = $false

  if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
    $timedOut = $true
    $process.Kill($true)
    $process.WaitForExit()
  }

  $stdoutTask.Wait()
  $stderrTask.Wait()
  $ended = Get-Date

  $stdoutTask.Result | Set-Content -Encoding utf8 -LiteralPath $StdoutPath
  $stderrTask.Result | Set-Content -Encoding utf8 -LiteralPath $StderrPath

  return [pscustomobject]@{
    command = $FileName
    arguments = $Arguments
    cwd = $WorkingDirectory
    exitCode = if ($timedOut) { -1 } else { $process.ExitCode }
    timedOut = $timedOut
    timeoutSeconds = $TimeoutSeconds
    startedAt = $started.ToString("o")
    endedAt = $ended.ToString("o")
    wallSeconds = [math]::Round(($ended - $started).TotalSeconds, 3)
  }
}

function Get-OracleSummary($VerifyStdoutPath) {
  $stdout = Get-Content -Raw -LiteralPath $VerifyStdoutPath -ErrorAction SilentlyContinue
  if ($stdout -match "Results:\s+(\d+)/(\d+)\s+passed") {
    return [pscustomobject]@{
      passes = [int]$Matches[1]
      total = [int]$Matches[2]
      summary = "Results: $($Matches[1])/$($Matches[2]) passed"
    }
  }

  return [pscustomobject]@{
    passes = $null
    total = $null
    summary = "unparsed"
  }
}

function Get-WorkspaceChangeSummary($Workdir) {
  $status = & git -C $Workdir status --porcelain --untracked-files=all
  $changes = @(
    $status | Where-Object {
      $_ -and
      $_ -notmatch "\.prompt-language" -and
      $_ -notmatch "\.aider" -and
      $_ -notmatch "solo-prompt\.txt" -and
      $_ -notmatch "\.gitignore"
    }
  )

  return [pscustomobject]@{
    changed = $changes.Count -gt 0
    count = $changes.Count
    files = @($changes)
  }
}

function Write-SoloPrompt($Workdir) {
  @"
Goal: Complete the fixture task in one bounded aider turn.

Read TASK.md and verify.js for the oracle. Edit only authored fixture files under src unless TASK.md requires otherwise. Keep CommonJS syntax. Do not add dependencies.

Stop only when node verify.js passes or you cannot make further progress.
"@ | Set-Content -Encoding ascii -LiteralPath (Join-Path $Workdir "solo-prompt.txt")
}

function Invoke-Solo($Workdir, $CellDir) {
  Write-SoloPrompt $Workdir
  $args = @(
    "--model", $Model,
    "--no-auto-commits",
    "--no-auto-lint",
    "--no-stream",
    "--yes-always",
    "--no-show-model-warnings",
    "--no-git",
    "--no-gitignore",
    "--no-check-update",
    "--map-tokens", "1024",
    "--edit-format", "whole",
    "--timeout", [string]$AiderTimeoutSeconds,
    "--message-file", "solo-prompt.txt",
    "TASK.md",
    "verify.js",
    "src/app.js",
    "src/test.js"
  )

  return Invoke-LoggedCommand `
    -FileName "aider" `
    -Arguments $args `
    -WorkingDirectory $Workdir `
    -StdoutPath (Join-Path $CellDir "runner-stdout.txt") `
    -StderrPath (Join-Path $CellDir "runner-stderr.txt") `
    -TimeoutSeconds $AiderTimeoutSeconds `
    -Environment @{
      "TERM" = "dumb"
      "PYTHONUTF8" = "1"
      "PYTHONIOENCODING" = "utf-8"
      "OLLAMA_API_BASE" = "http://127.0.0.1:11434"
    }
}

function Invoke-Pl($Workdir, $CellDir) {
  $args = @(
    $Cli,
    "ci",
    "--runner", "aider",
    "--model", $Model,
    "--file", "task.flow"
  )

  return Invoke-LoggedCommand `
    -FileName "node" `
    -Arguments $args `
    -WorkingDirectory $Workdir `
    -StdoutPath (Join-Path $CellDir "runner-stdout.txt") `
    -StderrPath (Join-Path $CellDir "runner-stderr.txt") `
    -TimeoutSeconds $AiderTimeoutSeconds `
    -Environment @{
      "TERM" = "dumb"
      "PYTHONUTF8" = "1"
      "PYTHONIOENCODING" = "utf-8"
      "OLLAMA_API_BASE" = "http://127.0.0.1:11434"
      "PROMPT_LANGUAGE_AIDER_TIMEOUT_MS" = [string]($PromptTurnTimeoutSeconds * 1000)
      "PROMPT_LANGUAGE_AIDER_SCOPED_MESSAGE" = "1"
    }
}

function Invoke-Verify($Workdir, $CellDir) {
  return Invoke-LoggedCommand `
    -FileName "node" `
    -Arguments @("verify.js") `
    -WorkingDirectory $Workdir `
    -StdoutPath (Join-Path $CellDir "verify-stdout.txt") `
    -StderrPath (Join-Path $CellDir "verify-stderr.txt") `
    -TimeoutSeconds $VerifyTimeoutSeconds `
    -Environment @{}
}

New-Directory $RunRoot
"*/workspace/`n" | Set-Content -Encoding ascii -LiteralPath (Join-Path $RunRoot ".gitignore")
$results = @()

foreach ($arm in @("solo", "pl")) {
  $label = "$FixtureName-$arm"
  $cellDir = Join-Path $RunRoot $label
  $workdir = Join-Path $cellDir "workspace"
  New-Directory $cellDir

  $runner = $null
  $verify = $null
  $changes = [pscustomobject]@{ changed = $false; count = 0; files = @() }
  $oracle = [pscustomobject]@{ passes = $null; total = $null; summary = "not run" }
  $errorText = $null

  try {
    Copy-Fixture $workdir
    $runner = if ($arm -eq "solo") { Invoke-Solo $workdir $cellDir } else { Invoke-Pl $workdir $cellDir }
    $changes = Get-WorkspaceChangeSummary $workdir
    $verify = Invoke-Verify $workdir $cellDir
    $oracle = Get-OracleSummary (Join-Path $cellDir "verify-stdout.txt")
  } catch {
    $errorText = $_.Exception.ToString()
    $errorText | Set-Content -Encoding utf8 -LiteralPath (Join-Path $cellDir "run-error.txt")
  } finally {
    $manifest = [pscustomobject]@{
      runId = $RunStamp
      label = $label
      fixture = $FixtureName
      arm = $arm
      model = $Model
      workdir = $workdir
      runnerResult = $runner
      workspaceChanges = $changes
      verifyResult = $verify
      oracle = $oracle
      error = $errorText
    }
    $manifest | ConvertTo-Json -Depth 8 | Set-Content -Encoding ascii -LiteralPath (Join-Path $cellDir "run-manifest.json")

    $results += [pscustomobject]@{
      label = $label
      arm = $arm
      runnerExitCode = if ($null -eq $runner) { $null } else { $runner.exitCode }
      runnerTimedOut = if ($null -eq $runner) { $null } else { $runner.timedOut }
      verifyExitCode = if ($null -eq $verify) { $null } else { $verify.exitCode }
      verifyTimedOut = if ($null -eq $verify) { $null } else { $verify.timedOut }
      passes = $oracle.passes
      total = $oracle.total
      oracleSummary = $oracle.summary
      workspaceChanged = $changes.changed
      workspaceChangeCount = $changes.count
      wallSeconds = if ($null -eq $runner) { $null } else { $runner.wallSeconds }
      errored = $null -ne $errorText
    }
    $results | ConvertTo-Json -Depth 5 | Set-Content -Encoding ascii -LiteralPath (Join-Path $RunRoot "scorecard.json")
  }
}

$results | Format-Table -AutoSize | Out-String | Set-Content -Encoding ascii -LiteralPath (Join-Path $RunRoot "scorecard.txt")
$results | Format-Table -AutoSize
Write-Host "Wrote fixture-pair results to $RunRoot"
