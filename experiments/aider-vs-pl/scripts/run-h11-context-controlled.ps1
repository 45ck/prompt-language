param(
  [int]$Repetitions = 3,
  [string[]]$Arms = @("solo", "pl"),
  [string]$Model = "ollama_chat/qwen3-opencode-big:30b",
  [string]$FlowFile = "task-artisan-v5.flow",
  [int]$AiderTimeoutSeconds = 1800,
  [int]$VerifyTimeoutSeconds = 60,
  [int]$MonitorIntervalSeconds = 15,
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../../..")).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Fixture = Join-Path $RepoRoot "experiments/aider-vs-pl/fixtures/h11-multi-file-refactor"
$ResultsRoot = Join-Path $RepoRoot "experiments/aider-vs-pl/results/h11-phase6-context-controlled"
$RunStamp = Get-Date -Format "yyyyMMdd-HHmmss"
$RunRoot = Join-Path $ResultsRoot $RunStamp

function New-Directory($Path) {
  New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

function Get-RepoCommit {
  $commit = & git -C $RepoRoot rev-parse HEAD
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to read repo commit"
  }
  return $commit.Trim()
}

function Write-FixtureHashes($Destination) {
  $hashes = Get-ChildItem -LiteralPath $Fixture -Recurse -File |
    Sort-Object FullName |
    ForEach-Object {
      $relative = [System.IO.Path]::GetRelativePath($Fixture, $_.FullName).Replace("\", "/")
      $hash = Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256
      [pscustomobject]@{
        path = $relative
        sha256 = $hash.Hash.ToLowerInvariant()
      }
    }
  $hashes | ConvertTo-Json -Depth 4 | Set-Content -Encoding ascii -LiteralPath $Destination
}

function Copy-Fixture($Workdir) {
  if (!(Test-Path -LiteralPath $Fixture)) {
    throw "Missing H11 fixture: $Fixture"
  }
  New-Directory $Workdir
  Get-ChildItem -LiteralPath $Fixture -Force | Copy-Item -Destination $Workdir -Recurse -Force
  & git -C $Workdir init -q
  & git -C $Workdir add -A
  & git -C $Workdir -c user.name=eval -c user.email=eval@example.invalid commit -q -m "chore(fixture): snapshot" --allow-empty
}

function Write-SoloPrompt($Workdir) {
  @'
Goal: Rename Contact to Client across the fixture using one bounded solo aider turn.

Edit only these authored files:
- README.md
- src/app.js
- src/contact-store.js
- src/contact.js
- src/routes.js
- src/seed.js
- src/test.js

You may read these support files, but do not edit them:
- TASK.md
- package.json
- verify.js
- count-contact.js
- find-contact-stragglers.js
- check-seed-contract.js
- list-contact-targets.js

Contract:
- Replace every word-boundary occurrence of "Contact" with "Client".
- Replace every word-boundary occurrence of "contact" with "client".
- Keep CommonJS require/module.exports syntax.
- Do not create new files.
- Do not create nested paths such as src/src/seed.js.
- Do not rename src/contact.js or src/contact-store.js for this controlled fixture.
- Do not introduce ES-module syntax or new dependencies.
- Preserve the fixture's original smoke-test shape: src/app.js should require ./contact-store, ./routes, and ./seed; create the store; call loadSeedData(store); createRoutes(store); verify listContacts() returns status 200; verify getContact('alice@example.com') returns status 200 with body.name === 'Alice Johnson'; print the existing success lines; exit 0.
- src/seed.js must preserve module.exports = { seedContacts, loadSeedData }. seedContacts must stay an array of plain objects. loadSeedData(store) must iterate over seedContacts, call store.add(record) for each item, and return store.count(). Do not instantiate Client at module scope.

Use the helper scripts as checks if needed:
- node count-contact.js <file>
- node find-contact-stragglers.js --include-readme
- node check-seed-contract.js
- node verify.js

Stop only when node verify.js passes or you cannot make further progress.
'@ | Set-Content -Encoding ascii -LiteralPath (Join-Path $Workdir "solo-prompt.txt")
}

function Start-OllamaMonitor($LogPath) {
  return Start-Job -ScriptBlock {
    param($Path, $IntervalSeconds)
    while ($true) {
      Add-Content -LiteralPath $Path -Value ("--- " + (Get-Date -Format o) + " ---")
      ollama ps 2>&1 | ForEach-Object { $_.TrimEnd() } | Add-Content -LiteralPath $Path
      Start-Sleep -Seconds $IntervalSeconds
    }
  } -ArgumentList $LogPath, $MonitorIntervalSeconds
}

function Stop-OllamaMonitor($Job) {
  if ($null -eq $Job) {
    return
  }
  Stop-Job $Job -ErrorAction SilentlyContinue
  Receive-Job $Job -ErrorAction SilentlyContinue | Out-Null
  Remove-Job $Job -ErrorAction SilentlyContinue
}

function Invoke-LoggedCommand($FileName, [string[]]$Arguments, $WorkingDirectory, $StdoutPath, $StderrPath, $TimeoutSeconds, $Environment) {
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

  $exitCode = if ($timedOut) { -1 } else { $process.ExitCode }
  return [pscustomobject]@{
    command = $FileName
    arguments = $Arguments
    exitCode = $exitCode
    timedOut = $timedOut
    timeoutSeconds = $TimeoutSeconds
    startedAt = $started.ToString("o")
    endedAt = $ended.ToString("o")
    wallSeconds = [math]::Round(($ended - $started).TotalSeconds, 3)
  }
}

function Invoke-Verify($Workdir, $ArmDir) {
  return Invoke-LoggedCommand `
    -FileName "node" `
    -Arguments @("verify.js") `
    -WorkingDirectory $Workdir `
    -StdoutPath (Join-Path $ArmDir "verify-stdout.txt") `
    -StderrPath (Join-Path $ArmDir "verify-stderr.txt") `
    -TimeoutSeconds $VerifyTimeoutSeconds `
    -Environment @{}
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

function Invoke-Solo($Workdir, $ArmDir) {
  $args = @(
    "--model", $Model,
    "--no-auto-commits",
    "--no-auto-lint",
    "--no-stream",
    "--yes-always",
    "--no-show-model-warnings",
    "--no-git",
    "--no-check-update",
    "--map-tokens", "1024",
    "--edit-format", "whole",
    "--message-file", "solo-prompt.txt",
    "TASK.md",
    "package.json",
    "verify.js",
    "count-contact.js",
    "find-contact-stragglers.js",
    "check-seed-contract.js",
    "list-contact-targets.js",
    "README.md",
    "src/app.js",
    "src/contact-store.js",
    "src/contact.js",
    "src/routes.js",
    "src/seed.js",
    "src/test.js"
  )
  return Invoke-LoggedCommand `
    -FileName "aider" `
    -Arguments $args `
    -WorkingDirectory $Workdir `
    -StdoutPath (Join-Path $ArmDir "runner-stdout.txt") `
    -StderrPath (Join-Path $ArmDir "runner-stderr.txt") `
    -TimeoutSeconds $AiderTimeoutSeconds `
    -Environment @{
      "TERM" = "dumb"
      "PYTHONUTF8" = "1"
      "PYTHONIOENCODING" = "utf-8"
      "OLLAMA_API_BASE" = "http://127.0.0.1:11434"
    }
}

function Invoke-Pl($Workdir, $ArmDir) {
  $cli = Join-Path $RepoRoot "bin/cli.mjs"
  $args = @(
    $cli,
    "ci",
    "--runner", "aider",
    "--model", $Model,
    "--file", $FlowFile
  )
  return Invoke-LoggedCommand `
    -FileName "node" `
    -Arguments $args `
    -WorkingDirectory $Workdir `
    -StdoutPath (Join-Path $ArmDir "runner-stdout.txt") `
    -StderrPath (Join-Path $ArmDir "runner-stderr.txt") `
    -TimeoutSeconds $AiderTimeoutSeconds `
    -Environment @{
      "TERM" = "dumb"
      "PYTHONUTF8" = "1"
      "PYTHONIOENCODING" = "utf-8"
      "OLLAMA_API_BASE" = "http://127.0.0.1:11434"
      "PROMPT_LANGUAGE_AIDER_TIMEOUT_MS" = [string]($AiderTimeoutSeconds * 1000)
    }
}

New-Directory $RunRoot
Write-FixtureHashes (Join-Path $RunRoot "fixture-hashes.json")

$commit = Get-RepoCommit
$allResults = @()

foreach ($rep in 1..$Repetitions) {
  foreach ($arm in $Arms) {
    if ($arm -notin @("solo", "pl")) {
      throw "Unsupported arm: $arm"
    }

    $label = "rep$rep-$arm"
    $ArmDir = Join-Path $RunRoot $label
    $Workdir = Join-Path $ArmDir "workspace"
    New-Directory $ArmDir
    Copy-Fixture $Workdir
    if ($arm -eq "solo") {
      Write-SoloPrompt $Workdir
    }

    $monitor = Start-OllamaMonitor (Join-Path $ArmDir "ollama-ps.log")
    try {
      if ($arm -eq "solo") {
        $runner = Invoke-Solo $Workdir $ArmDir
      } else {
        $runner = Invoke-Pl $Workdir $ArmDir
      }
    } finally {
      Stop-OllamaMonitor $monitor
    }

    $verify = Invoke-Verify $Workdir $ArmDir
    $oracle = Get-OracleSummary (Join-Path $ArmDir "verify-stdout.txt")

    $manifest = [pscustomobject]@{
      runId = $RunStamp
      label = $label
      arm = $arm
      repetition = $rep
      fixture = "h11-multi-file-refactor"
      model = $Model
      runner = if ($arm -eq "solo") { "aider" } else { "prompt-language ci --runner aider" }
      flow = if ($arm -eq "solo") { $null } else { $FlowFile }
      repoCommit = $commit
      runnerResult = $runner
      verifyResult = $verify
      oracle = $oracle
    }
    $manifest | ConvertTo-Json -Depth 8 | Set-Content -Encoding ascii -LiteralPath (Join-Path $ArmDir "run-manifest.json")

    $allResults += [pscustomobject]@{
      label = $label
      arm = $arm
      repetition = $rep
      runnerExitCode = $runner.exitCode
      runnerTimedOut = $runner.timedOut
      verifyExitCode = $verify.exitCode
      verifyTimedOut = $verify.timedOut
      passes = $oracle.passes
      total = $oracle.total
      oracleSummary = $oracle.summary
      wallSeconds = $runner.wallSeconds
    }
    $allResults | ConvertTo-Json -Depth 5 | Set-Content -Encoding ascii -LiteralPath (Join-Path $RunRoot "scorecard.json")
  }
}

$allResults | Format-Table -AutoSize | Out-String | Set-Content -Encoding ascii -LiteralPath (Join-Path $RunRoot "scorecard.txt")
$allResults | Format-Table -AutoSize
Write-Host "Wrote H11 context-controlled results to $RunRoot"
